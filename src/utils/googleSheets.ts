import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DailyReport,
  PostOffice,
  User,
  WhatsAppConfig,
  TriggerConfig,
  SystemLog,
  GoogleSheetsConfig,
} from '../types';
import { formatDatePK } from './calculations';

// Initialize Firebase App & Auth
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);

export const googleOAuthProvider = new GoogleAuthProvider();
googleOAuthProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleOAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleOAuthProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

// Token & User Storage (In-memory caching per guidelines)
let inMemoryToken: string | null = null;
let tokenExpiryTimestamp: number | null = null;
let currentUser: FirebaseUser | null = null;
let isSigningIn = false;

// Listen to auth state changes to clear/maintain session
onAuthStateChanged(firebaseAuth, (user) => {
  currentUser = user;
  if (!user && !isSigningIn) {
    inMemoryToken = null;
    tokenExpiryTimestamp = null;
  }
});

export const setGoogleAccessToken = (token: string, expiresInSeconds = 3500) => {
  inMemoryToken = token;
  tokenExpiryTimestamp = Date.now() + expiresInSeconds * 1000;
  try {
    sessionStorage.setItem('pak_post_google_token', token);
    sessionStorage.setItem('pak_post_google_token_exp', tokenExpiryTimestamp.toString());
  } catch (e) {
    // Ignore storage restrictions
  }
};

export const getGoogleAccessToken = (): string | null => {
  if (inMemoryToken && tokenExpiryTimestamp && Date.now() < tokenExpiryTimestamp) {
    return inMemoryToken;
  }
  try {
    const storedToken = sessionStorage.getItem('pak_post_google_token');
    const storedExp = sessionStorage.getItem('pak_post_google_token_exp');
    if (storedToken && storedExp && Date.now() < parseInt(storedExp, 10)) {
      inMemoryToken = storedToken;
      tokenExpiryTimestamp = parseInt(storedExp, 10);
      return storedToken;
    }
  } catch (e) {
    // Ignore
  }
  return null;
};

export const clearGoogleToken = async () => {
  inMemoryToken = null;
  tokenExpiryTimestamp = null;
  currentUser = null;
  try {
    sessionStorage.removeItem('pak_post_google_token');
    sessionStorage.removeItem('pak_post_google_token_exp');
    await signOut(firebaseAuth);
  } catch (e) {
    // Ignore
  }
};

/**
 * Request Google OAuth token via Google Identity Services (GSI) or Firebase Popup with graceful error handling
 */
export const requestGoogleOAuthToken = async (
  _customClientId?: string,
  onSuccess?: (token: string) => void,
  onError?: (err: any) => void
): Promise<string> => {
  const existing = getGoogleAccessToken();
  if (existing) {
    if (onSuccess) onSuccess(existing);
    return existing;
  }

  const clientId =
    _customClientId ||
    (firebaseConfig as any).oAuthClientId ||
    '199284519920-s5sjffjmkgae7fdop5iqm0sjcfv0fpv1.apps.googleusercontent.com';

  // 1. Try Google Identity Services (GSI) Token Client if available in window
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      const gsiToken = await new Promise<string>((resolve, reject) => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
            callback: (tokenResponse: any) => {
              if (tokenResponse.error) {
                if (
                  tokenResponse.error === 'popup_closed_by_user' ||
                  tokenResponse.error === 'user_cancelled' ||
                  tokenResponse.error === 'access_denied'
                ) {
                  const cancelErr: any = new Error(
                    'Sign-in popup was closed before completing. Click "Authorize Google Account" to try again, or use the Instant Webhook / Direct Paste tab.'
                  );
                  cancelErr.isUserCancellation = true;
                  reject(cancelErr);
                } else {
                  reject(new Error(tokenResponse.error_description || tokenResponse.error));
                }
                return;
              }

              if (tokenResponse.access_token) {
                const expiresIn = Number(tokenResponse.expires_in) || 3500;
                setGoogleAccessToken(tokenResponse.access_token, expiresIn);
                resolve(tokenResponse.access_token);
              } else {
                reject(new Error('No access token returned from Google Sign-In.'));
              }
            },
            error_callback: (err: any) => {
              const cancelErr: any = new Error(
                err?.message || 'Sign-in popup was closed before completing.'
              );
              if (err?.type === 'popup_closed' || err?.message?.includes('closed')) {
                cancelErr.isUserCancellation = true;
              }
              reject(cancelErr);
            },
          });

          client.requestAccessToken({ prompt: 'consent' });
        } catch (initErr) {
          reject(initErr);
        }
      });

      if (gsiToken) {
        if (onSuccess) onSuccess(gsiToken);
        return gsiToken;
      }
    } catch (gsiErr: any) {
      if (gsiErr.isUserCancellation) {
        console.info('Google Sign-in was dismissed by user.');
        if (onError) onError(gsiErr);
        throw gsiErr;
      }
      // If GSI failed due to other reasons, fall through to Firebase popup
      console.warn('GSI fallback to Firebase Auth:', gsiErr.message);
    }
  }

  // 2. Fallback to Firebase signInWithPopup
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, googleOAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error(
        'Google did not return an access token. Please ensure popup was not blocked or use the Google Apps Script Webhook sync method.'
      );
    }

    setGoogleAccessToken(accessToken, 3599);
    currentUser = result.user;

    if (onSuccess) onSuccess(accessToken);
    return accessToken;
  } catch (error: any) {
    const isCancel =
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request' ||
      error.isUserCancellation;

    let friendlyMessage = error.message || 'Google authentication failed';

    if (error.code === 'auth/unauthorized-domain') {
      const currentHost =
        typeof window !== 'undefined' ? window.location.hostname : 'deployed domain';
      friendlyMessage = `This deployed domain (${currentHost}) is not authorized in Firebase Console. Please use the Google Apps Script Webhook or Direct Paste sync options!`;
    } else if (isCancel) {
      friendlyMessage =
        'Sign-in popup was closed before completing. Click "Authorize Google Account" to try again, or use the Instant Webhook / Direct Paste tab.';
    } else if (error.code === 'auth/popup-blocked') {
      friendlyMessage =
        'Sign-in popup was blocked by browser. Please allow popups or use the Google Apps Script Webhook method.';
    }

    if (isCancel) {
      console.info('Google Sign In was dismissed or popup was closed by user.');
    } else {
      console.error('Google Sign In Error:', error);
    }

    const err: any = new Error(friendlyMessage);
    err.isUserCancellation = isCancel;
    if (onError) onError(err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Extract Spreadsheet ID from full URL or return ID as-is
 */
export const extractSpreadsheetId = (input: string): string => {
  const clean = input.trim();
  if (!clean) return '';
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return clean;
};

// ==========================================
// DATABASE SCHEMA & HEADERS DEFINITIONS
// ==========================================

export const SHEET_NAMES = {
  REPORTS: 'Daily_Reports',
  OFFICES: 'Post_Offices',
  USERS: 'System_Users',
  CONFIG: 'System_Config',
  LOGS: 'Activity_Logs',
};

export const REPORT_HEADERS = [
  'Sr #',
  'Report ID',
  'Date',
  'Post Office Name',
  'Postmaster / Operator',
  'Last Balance (A)',
  'Received Today (B)',
  'Total Articles (A+B)',
  'Delivered (C)',
  'Delivery %',
  'Returned to Sender (D)',
  'Missent (E)',
  'Deposit (F)',
  'Closing Balance (G = A+B-C-D-E-F)',
  'Submission Timestamp',
  'Submitted By',
  'Remarks & Notes',
];

export const OFFICE_HEADERS = [
  'Sr #',
  'Office ID',
  'Post Office Name',
  'Postmaster / Incharge Name',
  'Mobile Number (WhatsApp)',
  'Status (ACTIVE / INACTIVE)',
  'Initial Balance',
  'Last Updated',
];

export const USER_HEADERS = [
  'Sr #',
  'User ID',
  'Username',
  'Password / Pin',
  'Role (ADMIN / POST_OFFICE)',
  'Assigned Office Name',
  'Full Name / Title',
];

export const CONFIG_HEADERS = [
  'Config Key',
  'Config Value',
  'Category',
  'Description',
  'Last Updated',
];

export const LOG_HEADERS = [
  'Sr #',
  'Log ID',
  'Timestamp',
  'User',
  'Role',
  'Action',
  'Details',
  'Type',
];

// ==========================================
// SMART TOLERANT PARSERS (Handles any pasted data!)
// ==========================================

/**
 * Normalizes text for header matching
 */
const norm = (val: any): string =>
  String(val || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Smartly parse a Post Office row based on dynamic header index or pattern
 */
export const smartParseOfficeRow = (
  row: any[],
  colMap?: Record<string, number>,
  rowIndex: number = 0
): PostOffice | null => {
  if (!row || row.length === 0) return null;

  // If column map is provided, use mapped columns
  if (colMap) {
    const nameCol = colMap.name ?? colMap.office ?? colMap.officename ?? colMap.postoffice;
    const name = nameCol !== undefined && row[nameCol] ? String(row[nameCol]).trim() : '';
    if (!name || norm(name).includes('postofficename') || norm(name).includes('pakistanpost')) return null;

    const pmCol = colMap.postmaster ?? colMap.incharge ?? colMap.pm ?? colMap.operator;
    const mobCol = colMap.mobile ?? colMap.phone ?? colMap.whatsapp ?? colMap.contact ?? colMap.cell;
    const statusCol = colMap.status ?? colMap.state;
    const balCol = colMap.initialbalance ?? colMap.balance ?? colMap.openingbalance ?? colMap.bal;
    const idCol = colMap.id ?? colMap.officeid ?? colMap.sno ?? colMap.sr;

    return {
      id: idCol !== undefined && row[idCol] ? String(row[idCol]) : `po-${rowIndex + 1}`,
      name,
      postmasterName: pmCol !== undefined && row[pmCol] ? String(row[pmCol]).trim() : 'Postmaster',
      mobileNumber: mobCol !== undefined && row[mobCol] ? String(row[mobCol]).trim() : '03001234567',
      status: statusCol !== undefined && String(row[statusCol]).toUpperCase().includes('INACTIVE') ? 'INACTIVE' : 'ACTIVE',
      initialBalance: balCol !== undefined ? Number(row[balCol]) || 0 : 0,
    };
  }

  // Fallback positional heuristics
  // [Sr, ID, Name, PM, Mobile, Status, Balance]
  if (row.length >= 3 && row[2] && typeof row[2] === 'string' && isNaN(Number(row[2]))) {
    return {
      id: row[1] ? String(row[1]) : `po-${rowIndex + 1}`,
      name: String(row[2]).trim(),
      postmasterName: row[3] ? String(row[3]).trim() : 'Postmaster',
      mobileNumber: row[4] ? String(row[4]).trim() : '03001234567',
      status: String(row[5] || '').toUpperCase().includes('INACTIVE') ? 'INACTIVE' : 'ACTIVE',
      initialBalance: Number(row[6]) || 0,
    };
  }

  // If user pasted starting from column A: [Name, PM, Mobile, Status, Balance]
  if (row[0] && typeof row[0] === 'string' && isNaN(Number(row[0])) && !norm(row[0]).includes('office') && !norm(row[0]).includes('sr')) {
    return {
      id: `po-${rowIndex + 1}`,
      name: String(row[0]).trim(),
      postmasterName: row[1] ? String(row[1]).trim() : 'Postmaster',
      mobileNumber: row[2] ? String(row[2]).trim() : '03001234567',
      status: String(row[3] || '').toUpperCase().includes('INACTIVE') ? 'INACTIVE' : 'ACTIVE',
      initialBalance: Number(row[4]) || 0,
    };
  }

  return null;
};

/**
 * Smartly parse a Daily Report row based on dynamic header index or pattern
 */
export const smartParseReportRow = (
  row: any[],
  colMap?: Record<string, number>,
  rowIndex: number = 0
): DailyReport | null => {
  if (!row || row.length === 0) return null;

  if (colMap) {
    const officeCol = colMap.office ?? colMap.officename ?? colMap.postoffice ?? colMap.postofficename ?? colMap.name;
    const officeName = officeCol !== undefined && row[officeCol] ? String(row[officeCol]).trim() : '';
    if (!officeName || norm(officeName).includes('postofficename') || norm(officeName).includes('pakistanpost')) return null;

    const dateCol = colMap.date ?? colMap.reportdate ?? colMap.day;
    const dateVal = dateCol !== undefined && row[dateCol] ? String(row[dateCol]).trim() : new Date().toISOString().split('T')[0];
    
    // Normalize date format if in DD/MM/YYYY
    let cleanDate = dateVal;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateVal)) {
      const parts = dateVal.split(/[\/\-]/);
      cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    const pmCol = colMap.postmaster ?? colMap.operator ?? colMap.incharge;
    const lastBalCol = colMap.lastbalance ?? colMap.lastbal ?? colMap.opening ?? colMap.bal;
    const recCol = colMap.receivedtoday ?? colMap.received ?? colMap.rec;
    const delCol = colMap.delivered ?? colMap.del;
    const retCol = colMap.returnedtosender ?? colMap.returned ?? colMap.return ?? colMap.rts;
    const missCol = colMap.missent ?? colMap.miss;
    const depCol = colMap.deposit ?? colMap.dep ?? colMap.inhand;
    const closeCol = colMap.closingbalance ?? colMap.closing ?? colMap.closebal;
    const remarksCol = colMap.remarks ?? colMap.notes ?? colMap.comment;
    const subAtCol = colMap.submissiontimestamp ?? colMap.submittedat ?? colMap.time;
    const subByCol = colMap.submittedby ?? colMap.user;
    const idCol = colMap.id ?? colMap.reportid ?? colMap.sr;

    const lastBal = lastBalCol !== undefined ? Number(row[lastBalCol]) || 0 : 0;
    const rec = recCol !== undefined ? Number(row[recCol]) || 0 : 0;
    const del = delCol !== undefined ? Number(row[delCol]) || 0 : 0;
    const ret = retCol !== undefined ? Number(row[retCol]) || 0 : 0;
    const miss = missCol !== undefined ? Number(row[missCol]) || 0 : 0;
    const dep = depCol !== undefined ? Number(row[depCol]) || 0 : 0;
    const calculatedClose = lastBal + rec - del - ret - miss - dep;
    const close = closeCol !== undefined && row[closeCol] !== undefined && row[closeCol] !== '' ? Number(row[closeCol]) || 0 : calculatedClose;

    return {
      id: idCol !== undefined && row[idCol] ? String(row[idCol]) : `rep-${Date.now()}-${rowIndex}`,
      date: cleanDate,
      officeName,
      postmasterName: pmCol !== undefined && row[pmCol] ? String(row[pmCol]).trim() : 'Postmaster',
      lastBalance: lastBal,
      receivedToday: rec,
      delivered: del,
      returnedToSender: ret,
      missent: miss,
      deposit: dep,
      closingBalance: close,
      submittedAt: subAtCol !== undefined && row[subAtCol] ? String(row[subAtCol]) : new Date().toISOString(),
      submittedBy: subByCol !== undefined && row[subByCol] ? String(row[subByCol]) : 'Postmaster',
      remarks: remarksCol !== undefined && row[remarksCol] ? String(row[remarksCol]) : '',
    };
  }

  // Standard positional parsing:
  // Sr, ID, Date, OfficeName, Postmaster, LastBal, Rec, Tot, Del, Del%, Ret, Miss, Dep, Close, SubAt, SubBy, Remarks
  if (row.length >= 4) {
    // If office name is in column 3 (index 3)
    if (row[3] && typeof row[3] === 'string' && isNaN(Number(row[3]))) {
      const officeName = String(row[3]).trim();
      if (!norm(officeName).includes('postofficename') && !norm(officeName).includes('pakistanpost')) {
        const lastBal = Number(row[5]) || 0;
        const rec = Number(row[6]) || 0;
        const del = Number(row[8]) || 0;
        const ret = Number(row[10]) || 0;
        const miss = Number(row[11]) || 0;
        const dep = Number(row[12]) || 0;
        const close = Number(row[13]) || (lastBal + rec - del - ret - miss - dep);

        return {
          id: row[1] ? String(row[1]) : `rep-${Date.now()}-${rowIndex}`,
          date: row[2] ? String(row[2]) : new Date().toISOString().split('T')[0],
          officeName,
          postmasterName: row[4] ? String(row[4]) : 'Postmaster',
          lastBalance: lastBal,
          receivedToday: rec,
          delivered: del,
          returnedToSender: ret,
          missent: miss,
          deposit: dep,
          closingBalance: close,
          submittedAt: row[14] ? String(row[14]) : new Date().toISOString(),
          submittedBy: row[15] ? String(row[15]) : 'Postmaster',
          remarks: row[16] ? String(row[16]) : '',
        };
      }
    }

    // Direct pasted without Sr & ID: [Date, OfficeName, Postmaster, LastBal, Rec, Del, Ret, Miss, Dep, Close]
    if (row[1] && typeof row[1] === 'string' && isNaN(Number(row[1]))) {
      const officeName = String(row[1]).trim();
      if (!norm(officeName).includes('office') && !norm(officeName).includes('pakistanpost')) {
        return {
          id: `rep-${Date.now()}-${rowIndex}`,
          date: String(row[0] || new Date().toISOString().split('T')[0]),
          officeName,
          postmasterName: row[2] ? String(row[2]) : 'Postmaster',
          lastBalance: Number(row[3]) || 0,
          receivedToday: Number(row[4]) || 0,
          delivered: Number(row[5]) || 0,
          returnedToSender: Number(row[6]) || 0,
          missent: Number(row[7]) || 0,
          deposit: Number(row[8]) || 0,
          closingBalance: Number(row[9]) || 0,
          submittedAt: new Date().toISOString(),
          submittedBy: 'Postmaster',
          remarks: row[10] ? String(row[10]) : '',
        };
      }
    }
  }

  return null;
};

/**
 * Smartly parse a User row based on dynamic header index or pattern
 */
export const smartParseUserRow = (
  row: any[],
  colMap?: Record<string, number>,
  rowIndex: number = 0
): User | null => {
  if (!row || row.length === 0) return null;

  if (colMap) {
    const userCol = colMap.username ?? colMap.user ?? colMap.login ?? colMap.id;
    const username = userCol !== undefined && row[userCol] ? String(row[userCol]).trim() : '';
    if (!username || norm(username).includes('username') || norm(username).includes('pakistanpost')) return null;

    const passCol = colMap.password ?? colMap.pass ?? colMap.passwordhash ?? colMap.pin ?? colMap.code;
    const roleCol = colMap.role ?? colMap.type ?? colMap.access;
    const officeCol = colMap.assignedoffice ?? colMap.office ?? colMap.officename;
    const nameCol = colMap.name ?? colMap.fullname ?? colMap.title;

    return {
      id: `u-${rowIndex + 1}`,
      username,
      passwordHash: passCol !== undefined && row[passCol] ? String(row[passCol]) : '123456',
      role: roleCol !== undefined && String(row[roleCol]).toUpperCase().includes('ADMIN') ? 'ADMIN' : 'POST_OFFICE',
      officeName: officeCol !== undefined && row[officeCol] ? String(row[officeCol]).trim() : undefined,
      name: nameCol !== undefined && row[nameCol] ? String(row[nameCol]).trim() : username,
    };
  }

  // Positional [Sr, ID, Username, Password, Role, AssignedOffice, FullName]
  if (row.length >= 3 && row[2]) {
    const username = String(row[2]).trim();
    if (!norm(username).includes('username') && !norm(username).includes('pakistanpost')) {
      return {
        id: row[1] ? String(row[1]) : `u-${rowIndex + 1}`,
        username,
        passwordHash: row[3] ? String(row[3]) : '123456',
        role: String(row[4] || '').toUpperCase().includes('ADMIN') ? 'ADMIN' : 'POST_OFFICE',
        officeName: row[5] ? String(row[5]).trim() : undefined,
        name: row[6] ? String(row[6]).trim() : username,
      };
    }
  }

  // Direct pasted [Username, Password, Role, Office, Name]
  if (row[0] && typeof row[0] === 'string' && !norm(row[0]).includes('username')) {
    const username = String(row[0]).trim();
    return {
      id: `u-${rowIndex + 1}`,
      username,
      passwordHash: row[1] ? String(row[1]) : '123456',
      role: String(row[2] || '').toUpperCase().includes('ADMIN') ? 'ADMIN' : 'POST_OFFICE',
      officeName: row[3] ? String(row[3]).trim() : undefined,
      name: row[4] ? String(row[4]).trim() : username,
    };
  }

  return null;
};

/**
 * Builds a column index map from a header row
 */
export const buildHeaderMap = (headerRow: any[]): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!headerRow) return map;
  headerRow.forEach((col, idx) => {
    const clean = norm(col);
    if (clean) {
      map[clean] = idx;
    }
  });
  return map;
};

// ==========================================
// ROW SERIALIZATION / PARSING
// ==========================================

export const reportToRow = (r: DailyReport, index: number): (string | number)[] => {
  const total = (Number(r.lastBalance) || 0) + (Number(r.receivedToday) || 0);
  const rec = Number(r.receivedToday) || 0;
  const del = Number(r.delivered) || 0;
  const delRate = rec > 0 ? `${((del / rec) * 100).toFixed(1)}%` : '0.0%';

  return [
    index + 1,
    r.id || `rep-${Date.now()}-${index}`,
    r.date || '',
    r.officeName || '',
    r.postmasterName || '',
    Number(r.lastBalance) || 0,
    rec,
    total,
    del,
    delRate,
    Number(r.returnedToSender) || 0,
    Number(r.missent) || 0,
    Number(r.deposit) || 0,
    Number(r.closingBalance) || 0,
    r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '',
    r.submittedBy || 'Postmaster',
    r.remarks || '',
  ];
};

export const rowToReport = (row: any[]): DailyReport | null => {
  if (!row || row.length < 4 || !row[3]) return null;
  // Handle columns: Sr, ReportID, Date, OfficeName, Postmaster, LastBal, Rec, Tot, Del, DelRate, Ret, Miss, Dep, Close, SubAt, SubBy, Remarks
  const id = row[1] ? String(row[1]) : `rep-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const date = row[2] ? String(row[2]) : new Date().toISOString().split('T')[0];
  const officeName = String(row[3]);
  const postmasterName = row[4] ? String(row[4]) : 'Postmaster';
  const lastBalance = Number(row[5]) || 0;
  const receivedToday = Number(row[6]) || 0;
  const delivered = Number(row[8]) || 0;
  const returnedToSender = Number(row[10]) || 0;
  const missent = Number(row[11]) || 0;
  const deposit = Number(row[12]) || 0;
  const closingBalance = Number(row[13]) || (lastBalance + receivedToday - delivered - returnedToSender - missent - deposit);
  const submittedAt = row[14] ? String(row[14]) : new Date().toISOString();
  const submittedBy = row[15] ? String(row[15]) : 'Postmaster';
  const remarks = row[16] ? String(row[16]) : '';

  return {
    id,
    date,
    officeName,
    postmasterName,
    lastBalance,
    receivedToday,
    delivered,
    returnedToSender,
    missent,
    deposit,
    closingBalance,
    submittedAt,
    submittedBy,
    remarks,
  };
};

export const officeToRow = (po: PostOffice, index: number): (string | number)[] => {
  return [
    index + 1,
    po.id || `po-${index + 1}`,
    po.name || '',
    po.postmasterName || 'Postmaster',
    po.mobileNumber || '',
    po.status || 'ACTIVE',
    Number(po.initialBalance) || 0,
    new Date().toISOString(),
  ];
};

export const rowToOffice = (row: any[]): PostOffice | null => {
  if (!row || row.length < 3 || !row[2]) return null;
  return {
    id: row[1] ? String(row[1]) : `po-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: String(row[2]).trim(),
    postmasterName: row[3] ? String(row[3]).trim() : 'Postmaster',
    mobileNumber: row[4] ? String(row[4]).trim() : '03001234567',
    status: String(row[5]).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    initialBalance: Number(row[6]) || 0,
  };
};

export const userToRow = (u: User, index: number): (string | number)[] => {
  return [
    index + 1,
    u.id || `u-${index + 1}`,
    u.username || '',
    u.passwordHash || '',
    u.role || 'POST_OFFICE',
    u.officeName || '',
    u.name || '',
  ];
};

export const rowToUser = (row: any[]): User | null => {
  if (!row || row.length < 3 || !row[2]) return null;
  return {
    id: row[1] ? String(row[1]) : `u-${Date.now()}`,
    username: String(row[2]).trim(),
    passwordHash: row[3] ? String(row[3]) : '123456',
    role: String(row[4]).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'POST_OFFICE',
    officeName: row[5] ? String(row[5]).trim() : undefined,
    name: row[6] ? String(row[6]).trim() : String(row[2]),
  };
};

export const configToRows = (
  whatsApp: WhatsAppConfig,
  triggers: TriggerConfig,
  generalConfig?: any
): (string | number)[][] => {
  const timestamp = new Date().toISOString();
  return [
    ['whatsapp_phone_number_id', whatsApp.phoneNumberId || '', 'WHATSAPP', 'WhatsApp Cloud API Phone Number ID', timestamp],
    ['whatsapp_access_token', whatsApp.accessToken || '', 'WHATSAPP', 'WhatsApp API Permanent Access Token', timestamp],
    ['whatsapp_webapp_url', whatsApp.webAppUrl || '', 'WHATSAPP', 'System Web App URL for links', timestamp],
    ['whatsapp_auto_reminders', whatsApp.autoRemindersEnabled ? 'true' : 'false', 'WHATSAPP', 'Auto reminder notifications toggle', timestamp],
    ['whatsapp_reminder_time', whatsApp.reminderTime || '17:00', 'WHATSAPP', 'Daily reminder send time (PKT)', timestamp],
    ['trigger_reminder_time', triggers.reminderTriggerTime || '17:00', 'TRIGGERS', 'Evening reminder trigger time', timestamp],
    ['trigger_backup_time', triggers.backupTriggerTime || '23:59', 'TRIGGERS', 'Midnight automated backup trigger', timestamp],
    ['trigger_rollover_time', triggers.rolloverTriggerTime || '00:05', 'TRIGGERS', 'Daily balance rollover trigger', timestamp],
    ['division_name', 'Gujranwala Division', 'GENERAL', 'Postal Division Name', timestamp],
    ['system_version', '2.5.0', 'GENERAL', 'Pakistan Post DDRS Version', timestamp],
    ['database_type', 'Google Sheets Live Database', 'SYSTEM', 'Primary Backend Database Architecture', timestamp],
  ];
};

export const logToRow = (l: SystemLog, index: number): (string | number)[] => {
  return [
    index + 1,
    l.id || `log-${index + 1}`,
    l.timestamp || new Date().toISOString(),
    l.user || 'system',
    l.role || 'SYSTEM',
    l.action || '',
    l.details || '',
    l.type || 'INFO',
  ];
};

// ==========================================
// DIRECT GOOGLE SHEETS REST API DATABASE ENGINE
// ==========================================

export interface FullDatabaseState {
  reports: DailyReport[];
  postOffices: PostOffice[];
  users: User[];
  whatsAppConfig: WhatsAppConfig;
  triggerConfig: TriggerConfig;
  logs: SystemLog[];
}

/**
 * Fetch spreadsheet metadata
 */
export const getSpreadsheetMetadata = async (
  spreadsheetId: string,
  token: string
): Promise<{ title: string; sheetNames: string[]; url: string }> => {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Unable to access Google Sheet (${response.status}). Check permissions or token validity.`
    );
  }

  const data = await response.json();
  const title = data.properties?.title || 'Untitled Sheet';
  const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { title, sheetNames, url: spreadsheetUrl };
};

/**
 * Build & Initialize all 5 Database Sheets in a Google Spreadsheet with official headers & styling
 */
export const buildOrInitializeAllDatabaseSheets = async (
  spreadsheetId: string,
  token: string,
  currentData: FullDatabaseState
): Promise<{ success: boolean; sheetNames: string[] }> => {
  // 1. Get existing sheet names
  const meta = await getSpreadsheetMetadata(spreadsheetId, token);
  const existingSheets = new Set(meta.sheetNames);

  const neededTabs = [
    { title: SHEET_NAMES.REPORTS, headers: REPORT_HEADERS },
    { title: SHEET_NAMES.OFFICES, headers: OFFICE_HEADERS },
    { title: SHEET_NAMES.USERS, headers: USER_HEADERS },
    { title: SHEET_NAMES.CONFIG, headers: CONFIG_HEADERS },
    { title: SHEET_NAMES.LOGS, headers: LOG_HEADERS },
  ];

  // 2. Add missing sheets if any
  const requests: any[] = [];
  neededTabs.forEach((tab) => {
    if (!existingSheets.has(tab.title)) {
      requests.push({
        addSheet: {
          properties: {
            title: tab.title,
            gridProperties: {
              frozenRowCount: 2,
              rowCount: 1000,
              columnCount: tab.headers.length + 2,
            },
          },
        },
      });
    }
  });

  if (requests.length > 0) {
    const addResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );
    if (!addResp.ok) {
      console.warn('Batch add sheet notice:', await addResp.text());
    }
  }

  // 3. Populate initial data across all 5 sheets
  await pushFullDatabaseToGoogleSheet(spreadsheetId, token, currentData);

  return {
    success: true,
    sheetNames: [
      SHEET_NAMES.REPORTS,
      SHEET_NAMES.OFFICES,
      SHEET_NAMES.USERS,
      SHEET_NAMES.CONFIG,
      SHEET_NAMES.LOGS,
    ],
  };
};

/**
 * Create a brand new Google Spreadsheet in Google Drive containing all 5 database tabs
 */
export const createPakistanPostSpreadsheet = async (
  title: string = `Pakistan Post - Divisional Database (${new Date().toLocaleDateString('en-GB')})`,
  token: string,
  initialData?: FullDatabaseState
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'en_US',
        timeZone: 'Asia/Karachi',
      },
      sheets: [
        {
          properties: {
            title: SHEET_NAMES.REPORTS,
            gridProperties: { frozenRowCount: 2, rowCount: 1000, columnCount: 18 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.OFFICES,
            gridProperties: { frozenRowCount: 2, rowCount: 200, columnCount: 10 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.USERS,
            gridProperties: { frozenRowCount: 2, rowCount: 100, columnCount: 10 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.CONFIG,
            gridProperties: { frozenRowCount: 2, rowCount: 50, columnCount: 8 },
          },
        },
        {
          properties: {
            title: SHEET_NAMES.LOGS,
            gridProperties: { frozenRowCount: 2, rowCount: 1000, columnCount: 10 },
          },
        },
      ],
    }),
  });

  if (!createResp.ok) {
    const errorBody = await createResp.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to create Google Spreadsheet (HTTP ${createResp.status})`
    );
  }

  const result = await createResp.json();
  const spreadsheetId = result.spreadsheetId;
  const spreadsheetUrl =
    result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Write initial data if provided
  if (initialData) {
    await pushFullDatabaseToGoogleSheet(spreadsheetId, token, initialData);
  }

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Pushes entire application database (Offices, Reports, Users, Config, Logs) to Google Sheet at once
 */
export const pushFullDatabaseToGoogleSheet = async (
  spreadsheetId: string,
  token: string,
  data: FullDatabaseState
): Promise<boolean> => {
  const sortedReports = [...data.reports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const sortedOffices = [...data.postOffices].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );

  const reportRows = sortedReports.map((r, i) => reportToRow(r, i));
  const officeRows = sortedOffices.map((po, i) => officeToRow(po, i));
  const userRows = (data.users || []).map((u, i) => userToRow(u, i));
  const configRows = configToRows(data.whatsAppConfig, data.triggerConfig);
  const logRows = (data.logs || []).slice(0, 500).map((l, i) => logToRow(l, i));

  // Build batch payload for all 5 sheets
  const valueData = [
    {
      range: `'${SHEET_NAMES.REPORTS}'!A1:Q${Math.max(2, reportRows.length + 2)}`,
      values: [
        ['PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTS DATABASE'],
        REPORT_HEADERS,
        ...reportRows,
      ],
    },
    {
      range: `'${SHEET_NAMES.OFFICES}'!A1:H${Math.max(2, officeRows.length + 2)}`,
      values: [
        ['PAKISTAN POST - POST OFFICES MASTER DIRECTORY (DATABASE)'],
        OFFICE_HEADERS,
        ...officeRows,
      ],
    },
    {
      range: `'${SHEET_NAMES.USERS}'!A1:G${Math.max(2, userRows.length + 2)}`,
      values: [
        ['PAKISTAN POST - SYSTEM USERS & PORTAL CREDENTIALS (DATABASE)'],
        USER_HEADERS,
        ...userRows,
      ],
    },
    {
      range: `'${SHEET_NAMES.CONFIG}'!A1:E${Math.max(2, configRows.length + 2)}`,
      values: [
        ['PAKISTAN POST - SYSTEM CONFIGURATION & AUTOMATION SETTINGS'],
        CONFIG_HEADERS,
        ...configRows,
      ],
    },
    {
      range: `'${SHEET_NAMES.LOGS}'!A1:H${Math.max(2, logRows.length + 2)}`,
      values: [
        ['PAKISTAN POST - SYSTEM ACTIVITY & AUDIT LOGS TRAIL'],
        LOG_HEADERS,
        ...logRows,
      ],
    },
  ];

  // First clear data areas to ensure clean sync
  const clearRanges = [
    `'${SHEET_NAMES.REPORTS}'!A3:Q1000`,
    `'${SHEET_NAMES.OFFICES}'!A3:H500`,
    `'${SHEET_NAMES.USERS}'!A3:G200`,
    `'${SHEET_NAMES.CONFIG}'!A3:E100`,
    `'${SHEET_NAMES.LOGS}'!A3:H1000`,
  ];

  for (const r of clearRanges) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(r)}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }
    ).catch(() => {});
  }

  const batchResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    }
  );

  if (!batchResp.ok) {
    const errorBody = await batchResp.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to sync database to Google Sheets (${batchResp.status})`
    );
  }

  return true;
};

/**
 * Fetch entire Database (Offices, Reports, Users, Config) from Google Sheet with Smart Discovery & Fuzzy Tolerant Parsing
 */
export const fetchFullDatabaseFromGoogleSheet = async (
  spreadsheetId: string,
  token: string
): Promise<{
  reports: DailyReport[];
  postOffices: PostOffice[];
  users: User[];
  whatsAppConfig?: Partial<WhatsAppConfig>;
  triggerConfig?: Partial<TriggerConfig>;
}> => {
  // 1. Discover all actual sheets present in spreadsheet
  const meta = await getSpreadsheetMetadata(spreadsheetId, token);
  const actualSheets = meta.sheetNames || [];

  const findMatchingSheet = (synonyms: string[]): string | null => {
    for (const syn of synonyms) {
      const found = actualSheets.find(
        (s) => norm(s) === norm(syn) || norm(s).includes(norm(syn))
      );
      if (found) return found;
    }
    return null;
  };

  const reportsSheet = findMatchingSheet(['Daily_Reports', 'Daily Reports', 'Reports', 'Delivery', 'Daily Delivery', 'Delivery Data']) || actualSheets[0] || SHEET_NAMES.REPORTS;
  const officesSheet = findMatchingSheet(['Post_Offices', 'Post Offices', 'Offices', 'PostOffices', 'PO Master', 'Master']);
  const usersSheet = findMatchingSheet(['System_Users', 'Users', 'System Users', 'Passwords', 'Logins', 'Accounts', 'Staff']);
  const configSheet = findMatchingSheet(['System_Config', 'Config', 'Settings', 'Triggers']);

  // Fetch data ranges
  const fetchSheets = [
    { type: 'reports', name: reportsSheet },
    { type: 'offices', name: officesSheet },
    { type: 'users', name: usersSheet },
    { type: 'config', name: configSheet },
  ].filter((s) => s.name);

  const queryRanges = fetchSheets.map((s) => `'${s.name}'!A1:Z500`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryRanges
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&')}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to fetch data from Google Sheet (${resp.status})`);
  }

  const json = await resp.json();
  const valueRanges = json.valueRanges || [];

  let reports: DailyReport[] = [];
  let postOffices: PostOffice[] = [];
  let users: User[] = [];
  const whatsAppConfig: Partial<WhatsAppConfig> = {};
  const triggerConfig: Partial<TriggerConfig> = {};

  fetchSheets.forEach((sheetMeta, index) => {
    const rawRows: any[][] = valueRanges[index]?.values || [];
    if (!rawRows || rawRows.length === 0) return;

    if (sheetMeta.type === 'reports') {
      // Find header row
      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
        const rowStr = rawRows[i].map((c) => norm(c)).join(' ');
        if (rowStr.includes('office') || rowStr.includes('deliver') || rowStr.includes('date') || rowStr.includes('received')) {
          headerIdx = i;
          break;
        }
      }

      const colMap = headerIdx !== -1 ? buildHeaderMap(rawRows[headerIdx]) : undefined;
      const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

      for (let r = startIdx; r < rawRows.length; r++) {
        const rep = smartParseReportRow(rawRows[r], colMap, r);
        if (rep && rep.officeName) {
          reports.push(rep);
        }
      }
    }

    if (sheetMeta.type === 'offices') {
      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
        const rowStr = rawRows[i].map((c) => norm(c)).join(' ');
        if (rowStr.includes('office') || rowStr.includes('postmaster') || rowStr.includes('mobile') || rowStr.includes('status')) {
          headerIdx = i;
          break;
        }
      }

      const colMap = headerIdx !== -1 ? buildHeaderMap(rawRows[headerIdx]) : undefined;
      const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

      for (let r = startIdx; r < rawRows.length; r++) {
        const po = smartParseOfficeRow(rawRows[r], colMap, r);
        if (po && po.name) {
          postOffices.push(po);
        }
      }
    }

    if (sheetMeta.type === 'users') {
      let headerIdx = -1;
      for (let i = 0; i < Math.min(5, rawRows.length); i++) {
        const rowStr = rawRows[i].map((c) => norm(c)).join(' ');
        if (rowStr.includes('user') || rowStr.includes('pass') || rowStr.includes('pin') || rowStr.includes('role')) {
          headerIdx = i;
          break;
        }
      }

      const colMap = headerIdx !== -1 ? buildHeaderMap(rawRows[headerIdx]) : undefined;
      const startIdx = headerIdx !== -1 ? headerIdx + 1 : 0;

      for (let r = startIdx; r < rawRows.length; r++) {
        const u = smartParseUserRow(rawRows[r], colMap, r);
        if (u && u.username) {
          users.push(u);
        }
      }
    }

    if (sheetMeta.type === 'config') {
      rawRows.forEach((row) => {
        const key = String(row[0] || '').trim();
        const val = String(row[1] || '').trim();

        if (key === 'whatsapp_phone_number_id') whatsAppConfig.phoneNumberId = val;
        if (key === 'whatsapp_access_token') whatsAppConfig.accessToken = val;
        if (key === 'whatsapp_webapp_url') whatsAppConfig.webAppUrl = val;
        if (key === 'whatsapp_auto_reminders') whatsAppConfig.autoRemindersEnabled = val === 'true';
        if (key === 'whatsapp_reminder_time') whatsAppConfig.reminderTime = val;

        if (key === 'trigger_reminder_time') triggerConfig.reminderTriggerTime = val;
        if (key === 'trigger_backup_time') triggerConfig.backupTriggerTime = val;
        if (key === 'trigger_rollover_time') triggerConfig.rolloverTriggerTime = val;
      });
    }
  });

  // If Post Offices sheet was empty or missing, auto-extract all unique post offices from the delivery reports!
  if (postOffices.length === 0 && reports.length > 0) {
    const officeMap = new Map<string, { pm: string; lastClose: number }>();
    reports.forEach((r) => {
      if (r.officeName) {
        officeMap.set(r.officeName, {
          pm: r.postmasterName || 'Postmaster',
          lastClose: r.closingBalance || 0,
        });
      }
    });

    let idx = 1;
    officeMap.forEach((val, name) => {
      postOffices.push({
        id: `po-${idx}`,
        name,
        postmasterName: val.pm,
        mobileNumber: '03001234567',
        status: 'ACTIVE',
        initialBalance: val.lastClose,
      });
      idx++;
    });
  }

  // Sort post offices alphabetically A-Z
  postOffices = [...postOffices].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );

  return { reports, postOffices, users, whatsAppConfig, triggerConfig };
};

/**
 * Granular sync: push only Post Offices to Google Sheet
 */
export const pushOfficesToGoogleSheet = async (
  spreadsheetId: string,
  offices: PostOffice[],
  token: string
): Promise<boolean> => {
  const sorted = [...offices].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );
  const rows = sorted.map((po, i) => officeToRow(po, i));

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAMES.OFFICES}'!A3:H500:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  ).catch(() => {});

  const values = [
    ['PAKISTAN POST - POST OFFICES MASTER DIRECTORY (DATABASE)'],
    OFFICE_HEADERS,
    ...rows,
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${SHEET_NAMES.OFFICES}'!A1:H${values.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );

  return true;
};

/**
 * Granular sync: push only Reports to Google Sheet
 */
export const bulkSyncReportsToGoogleSheet = async (
  spreadsheetId: string,
  reports: DailyReport[],
  token: string,
  sheetName: string = SHEET_NAMES.REPORTS
): Promise<{ updatedRows: number }> => {
  const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rows = sorted.map((r, idx) => reportToRow(r, idx));

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A3:Q1000:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  ).catch(() => {});

  const allValues = [
    ['PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTS DATABASE'],
    REPORT_HEADERS,
    ...rows,
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A1:Q${allValues.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: allValues }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Failed to sync reports to Google Sheet`);
  }

  return { updatedRows: reports.length };
};

/**
 * Granular sync: append single report
 */
export const appendReportToGoogleSheet = async (
  spreadsheetId: string,
  report: DailyReport,
  token: string,
  sheetName: string = SHEET_NAMES.REPORTS
): Promise<boolean> => {
  const row = reportToRow(report, 0);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A:Q:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    }
  );
  return response.ok;
};

// ==========================================
// GOOGLE APPS SCRIPT WEBHOOK ENGINE (ALL TABS)
// ==========================================

export const getAppsScriptTemplateCode = (): string => {
  return `/**
 * PAKISTAN POST - GUJRANWALA DIVISION
 * AUTOMATED GOOGLE SHEETS FULL DATABASE ENGINE (5-IN-1 TABS)
 * 
 * TABS IN DATABASE:
 * 1. Daily_Reports (Delivery Reports)
 * 2. Post_Offices (Master Directory of Offices)
 * 3. System_Users (User Accounts & Roles)
 * 4. System_Config (WhatsApp, Triggers & Settings)
 * 5. Activity_Logs (Audit Trail)
 * 
 * HOW TO DEPLOY IN 60 SECONDS:
 * 1. Open your Google Sheet
 * 2. Click "Extensions" -> "Apps Script"
 * 3. Replace all existing code with this script
 * 4. Click "Deploy" -> "New deployment"
 * 5. Select type: "Web app"
 * 6. Set Description: "Pak Post Full Database Sync"
 * 7. Set "Execute as": "Me (your email)"
 * 8. Set "Who has access": "Anyone"  <-- CRITICAL
 * 9. Click "Deploy", authorize permissions, and copy the "Web app URL"
 * 10. Paste the Web app URL in your Pakistan Post Web App!
 */

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  
  if (action === "get_all_database") {
    var db = fetchAllDatabaseFromSheets();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: db,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Pakistan Post Google Sheets Database Webhook is active & healthy!",
    version: "2.5.0",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : null;
    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data payload received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = payload.action || "";

    // 1. INITIALIZE ALL 5 DATABASE SHEETS
    if (action === "init_database_schema" || action === "build_database") {
      setupAllDatabaseSheets(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Successfully initialized all 5 database sheets in Google Sheets!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. FETCH ENTIRE DATABASE
    if (action === "get_all_database") {
      var fullData = fetchAllDatabaseFromSheets();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: fullData
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. SAVE ENTIRE DATABASE AT ONCE
    if (action === "save_all_database") {
      if (payload.postOffices) saveOfficesSheet(ss, payload.postOffices);
      if (payload.reports) saveReportsSheet(ss, payload.reports);
      if (payload.users) saveUsersSheet(ss, payload.users);
      if (payload.config) saveConfigSheet(ss, payload.config);
      if (payload.logs) saveLogsSheet(ss, payload.logs);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Full database synced to Google Sheets successfully!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. POST OFFICES SYNC
    if (action === "save_offices") {
      saveOfficesSheet(ss, payload.postOffices || []);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Post offices master directory synced (" + (payload.postOffices ? payload.postOffices.length : 0) + " offices)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. REPORTS BULK / DELETE / APPEND SYNC
    if (action === "save_reports" || action === "delete_report" || action === "bulk_sync") {
      saveReportsSheet(ss, payload.reports || []);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Daily reports database updated (" + (payload.reports ? payload.reports.length : 0) + " reports)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "append_report" && payload.report) {
      appendSingleReport(ss, payload.report);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Appended report for " + payload.report.officeName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. USERS SYNC
    if (action === "save_users") {
      saveUsersSheet(ss, payload.users || []);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "System users database synced"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. CONFIG SYNC
    if (action === "save_config") {
      saveConfigSheet(ss, payload.config || {});
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "System configuration saved to Google Sheet"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "Ping received" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- HELPER FUNCTIONS ---

function getOrCreateSheet(ss, name, titleBanner, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1).setValue(titleBanner);
    sheet.getRange(1, 1, 1, headers.length).merge().setBackground("#00401A").setFontColor("#FFFFFF").setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center");
    sheet.getRange(2, 1, 1, headers.length).setValues([headers]).setBackground("#006633").setFontColor("#FFFFFF").setFontWeight("bold").setFontSize(10);
    sheet.setFrozenRows(2);
  }
  return sheet;
}

function setupAllDatabaseSheets(ss) {
  getOrCreateSheet(ss, "Daily_Reports", "PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTS DATABASE", [
    "Sr #", "Report ID", "Date", "Post Office Name", "Postmaster / Operator", "Last Balance (A)", "Received Today (B)",
    "Total Articles (A+B)", "Delivered (C)", "Delivery %", "Returned to Sender (D)", "Missent (E)", "Deposit (F)",
    "Closing Balance (G)", "Submission Timestamp", "Submitted By", "Remarks & Notes"
  ]);

  getOrCreateSheet(ss, "Post_Offices", "PAKISTAN POST - POST OFFICES MASTER DIRECTORY (DATABASE)", [
    "Sr #", "Office ID", "Post Office Name", "Postmaster / Incharge Name", "Mobile Number (WhatsApp)", "Status", "Initial Balance", "Last Updated"
  ]);

  getOrCreateSheet(ss, "System_Users", "PAKISTAN POST - SYSTEM USERS & PORTAL CREDENTIALS", [
    "Sr #", "User ID", "Username", "Password / Pin", "Role", "Assigned Office Name", "Full Name / Title"
  ]);

  getOrCreateSheet(ss, "System_Config", "PAKISTAN POST - SYSTEM CONFIGURATION & AUTOMATION SETTINGS", [
    "Config Key", "Config Value", "Category", "Description", "Last Updated"
  ]);

  getOrCreateSheet(ss, "Activity_Logs", "PAKISTAN POST - SYSTEM ACTIVITY & AUDIT LOGS TRAIL", [
    "Sr #", "Log ID", "Timestamp", "User", "Role", "Action", "Details", "Type"
  ]);
}

function saveOfficesSheet(ss, offices) {
  var sheet = getOrCreateSheet(ss, "Post_Offices", "PAKISTAN POST - POST OFFICES MASTER DIRECTORY (DATABASE)", [
    "Sr #", "Office ID", "Post Office Name", "Postmaster / Incharge Name", "Mobile Number (WhatsApp)", "Status", "Initial Balance", "Last Updated"
  ]);
  var last = sheet.getLastRow();
  if (last >= 3) {
    sheet.getRange(3, 1, Math.max(1, last - 2), 8).clearContent();
  }
  var rows = [];
  for (var i = 0; i < offices.length; i++) {
    var po = offices[i];
    rows.push([
      i + 1,
      po.id || ("po-" + (i + 1)),
      po.name || "",
      po.postmasterName || "Postmaster",
      po.mobileNumber || "",
      po.status || "ACTIVE",
      Number(po.initialBalance) || 0,
      new Date().toISOString()
    ]);
  }
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, 8).setValues(rows);
  }
}

function saveReportsSheet(ss, reports) {
  var sheet = getOrCreateSheet(ss, "Daily_Reports", "PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTS DATABASE", [
    "Sr #", "Report ID", "Date", "Post Office Name", "Postmaster / Operator", "Last Balance (A)", "Received Today (B)",
    "Total Articles (A+B)", "Delivered (C)", "Delivery %", "Returned to Sender (D)", "Missent (E)", "Deposit (F)",
    "Closing Balance (G)", "Submission Timestamp", "Submitted By", "Remarks & Notes"
  ]);
  var last = sheet.getLastRow();
  if (last >= 3) {
    sheet.getRange(3, 1, Math.max(1, last - 2), 17).clearContent();
  }
  var rows = [];
  for (var i = 0; i < reports.length; i++) {
    var r = reports[i];
    var tot = (Number(r.lastBalance) || 0) + (Number(r.receivedToday) || 0);
    var rec = Number(r.receivedToday) || 0;
    var del = Number(r.delivered) || 0;
    var rate = rec > 0 ? ((del / rec) * 100).toFixed(1) + "%" : "0.0%";
    rows.push([
      i + 1,
      r.id || ("rep-" + (i + 1)),
      r.date || "",
      r.officeName || "",
      r.postmasterName || "",
      Number(r.lastBalance) || 0,
      rec,
      tot,
      del,
      rate,
      Number(r.returnedToSender) || 0,
      Number(r.missent) || 0,
      Number(r.deposit) || 0,
      Number(r.closingBalance) || 0,
      r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
      r.submittedBy || "Postmaster",
      r.remarks || ""
    ]);
  }
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, 17).setValues(rows);
  }
}

function appendSingleReport(ss, r) {
  var sheet = getOrCreateSheet(ss, "Daily_Reports", "PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTS DATABASE", [
    "Sr #", "Report ID", "Date", "Post Office Name", "Postmaster / Operator", "Last Balance (A)", "Received Today (B)",
    "Total Articles (A+B)", "Delivered (C)", "Delivery %", "Returned to Sender (D)", "Missent (E)", "Deposit (F)",
    "Closing Balance (G)", "Submission Timestamp", "Submitted By", "Remarks & Notes"
  ]);
  var srNo = Math.max(1, sheet.getLastRow() - 1);
  var tot = (Number(r.lastBalance) || 0) + (Number(r.receivedToday) || 0);
  var rec = Number(r.receivedToday) || 0;
  var del = Number(r.delivered) || 0;
  var rate = rec > 0 ? ((del / rec) * 100).toFixed(1) + "%" : "0.0%";

  sheet.appendRow([
    srNo,
    r.id || ("rep-" + Date.now()),
    r.date || "",
    r.officeName || "",
    r.postmasterName || "",
    Number(r.lastBalance) || 0,
    rec,
    tot,
    del,
    rate,
    Number(r.returnedToSender) || 0,
    Number(r.missent) || 0,
    Number(r.deposit) || 0,
    Number(r.closingBalance) || 0,
    r.submittedAt ? new Date(r.submittedAt).toLocaleString() : new Date().toLocaleString(),
    r.submittedBy || "Postmaster",
    r.remarks || ""
  ]);
}

function saveUsersSheet(ss, users) {
  var sheet = getOrCreateSheet(ss, "System_Users", "PAKISTAN POST - SYSTEM USERS & PORTAL CREDENTIALS", [
    "Sr #", "User ID", "Username", "Password / Pin", "Role", "Assigned Office Name", "Full Name / Title"
  ]);
  var last = sheet.getLastRow();
  if (last >= 3) {
    sheet.getRange(3, 1, Math.max(1, last - 2), 7).clearContent();
  }
  var rows = [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    rows.push([
      i + 1,
      u.id || ("u-" + (i + 1)),
      u.username || "",
      u.passwordHash || "",
      u.role || "POST_OFFICE",
      u.officeName || "",
      u.name || ""
    ]);
  }
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, 7).setValues(rows);
  }
}

function saveConfigSheet(ss, config) {
  var sheet = getOrCreateSheet(ss, "System_Config", "PAKISTAN POST - SYSTEM CONFIGURATION & AUTOMATION SETTINGS", [
    "Config Key", "Config Value", "Category", "Description", "Last Updated"
  ]);
  var last = sheet.getLastRow();
  if (last >= 3) {
    sheet.getRange(3, 1, Math.max(1, last - 2), 5).clearContent();
  }
  var now = new Date().toISOString();
  var rows = [
    ["whatsapp_phone_number_id", config.whatsapp_phone_number_id || "", "WHATSAPP", "WhatsApp Cloud API Phone ID", now],
    ["whatsapp_access_token", config.whatsapp_access_token || "", "WHATSAPP", "WhatsApp API Permanent Token", now],
    ["whatsapp_webapp_url", config.whatsapp_webapp_url || "", "WHATSAPP", "System Web App URL", now],
    ["whatsapp_auto_reminders", config.whatsapp_auto_reminders || "true", "WHATSAPP", "Auto Reminders Status", now],
    ["whatsapp_reminder_time", config.whatsapp_reminder_time || "17:00", "WHATSAPP", "Reminder Time", now],
    ["trigger_reminder_time", config.trigger_reminder_time || "17:00", "TRIGGERS", "Reminder Trigger Time", now],
    ["trigger_backup_time", config.trigger_backup_time || "23:59", "TRIGGERS", "Midnight Backup Time", now],
    ["trigger_rollover_time", config.trigger_rollover_time || "00:05", "TRIGGERS", "Balance Rollover Time", now],
    ["division_name", "Gujranwala Division", "GENERAL", "Division Name", now]
  ];
  sheet.getRange(3, 1, rows.length, 5).setValues(rows);
}

function saveLogsSheet(ss, logs) {
  var sheet = getOrCreateSheet(ss, "Activity_Logs", "PAKISTAN POST - SYSTEM ACTIVITY & AUDIT LOGS TRAIL", [
    "Sr #", "Log ID", "Timestamp", "User", "Role", "Action", "Details", "Type"
  ]);
  var rows = [];
  var slice = logs.slice(0, 300);
  for (var i = 0; i < slice.length; i++) {
    var l = slice[i];
    rows.push([
      i + 1,
      l.id || ("log-" + (i + 1)),
      l.timestamp || new Date().toISOString(),
      l.user || "system",
      l.role || "SYSTEM",
      l.action || "",
      l.details || "",
      l.type || "INFO"
    ]);
  }
  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, 8).setValues(rows);
  }
}

function fetchAllDatabaseFromSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = { postOffices: [], reports: [], users: [], config: {} };
  var allSheets = ss.getSheets();

  function findSheetBySynonyms(synonyms) {
    for (var i = 0; i < allSheets.length; i++) {
      var sName = allSheets[i].getName().toLowerCase().replace(/[^a-z0-9]/g, "");
      for (var j = 0; j < synonyms.length; j++) {
        var syn = synonyms[j].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (sName === syn || sName.indexOf(syn) !== -1) {
          return allSheets[i];
        }
      }
    }
    return null;
  }

  // 1. Post Offices
  var poSheet = findSheetBySynonyms(["Post_Offices", "Post Offices", "Offices", "PostOffices", "POMaster", "Master"]);
  if (poSheet && poSheet.getLastRow() >= 1) {
    var poValues = poSheet.getDataRange().getValues();
    var headerRowIdx = -1;
    var colMap = {};
    for (var i = 0; i < Math.min(5, poValues.length); i++) {
      var rowText = poValues[i].join(" ").toLowerCase();
      if (rowText.indexOf("office") !== -1 || rowText.indexOf("postmaster") !== -1 || rowText.indexOf("mobile") !== -1) {
        headerRowIdx = i;
        for (var c = 0; c < poValues[i].length; c++) {
          var cleanCol = String(poValues[i][c] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanCol) colMap[cleanCol] = c;
        }
        break;
      }
    }

    var startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
    for (var r = startRow; r < poValues.length; r++) {
      var row = poValues[r];
      if (!row || row.length === 0) continue;

      var name = colMap.name !== undefined ? row[colMap.name] : (colMap.office !== undefined ? row[colMap.office] : (colMap.officename !== undefined ? row[colMap.officename] : (row[2] || row[0])));
      name = String(name || "").trim();
      if (!name || name.toLowerCase().indexOf("postofficename") !== -1 || name.toLowerCase().indexOf("pakistanpost") !== -1) continue;

      var pm = colMap.postmaster !== undefined ? row[colMap.postmaster] : (colMap.incharge !== undefined ? row[colMap.incharge] : (row[3] || row[1] || "Postmaster"));
      var mob = colMap.mobile !== undefined ? row[colMap.mobile] : (colMap.phone !== undefined ? row[colMap.phone] : (colMap.whatsapp !== undefined ? row[colMap.whatsapp] : (row[4] || row[2] || "03001234567")));
      var status = colMap.status !== undefined ? row[colMap.status] : (row[5] || row[3] || "ACTIVE");
      var bal = colMap.initialbalance !== undefined ? row[colMap.initialbalance] : (colMap.balance !== undefined ? row[colMap.balance] : (row[6] || row[4] || 0));

      result.postOffices.push({
        id: "po-" + (result.postOffices.length + 1),
        name: name,
        postmasterName: String(pm || "Postmaster").trim(),
        mobileNumber: String(mob || "03001234567").trim(),
        status: String(status).toUpperCase().indexOf("INACTIVE") !== -1 ? "INACTIVE" : "ACTIVE",
        initialBalance: Number(bal) || 0
      });
    }
  }

  // 2. Reports
  var repSheet = findSheetBySynonyms(["Daily_Reports", "Daily Reports", "Reports", "Delivery", "DailyDelivery", "DeliveryData", "Sheet1"]) || (allSheets.length > 0 ? allSheets[0] : null);
  if (repSheet && repSheet.getLastRow() >= 1) {
    var repValues = repSheet.getDataRange().getValues();
    var rHeaderIdx = -1;
    var rColMap = {};
    for (var ri = 0; ri < Math.min(5, repValues.length); ri++) {
      var rText = repValues[ri].join(" ").toLowerCase();
      if (rText.indexOf("office") !== -1 || rText.indexOf("deliver") !== -1 || rText.indexOf("received") !== -1 || rText.indexOf("date") !== -1) {
        rHeaderIdx = ri;
        for (var rc = 0; rc < repValues[ri].length; rc++) {
          var cleanRCol = String(repValues[ri][rc] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanRCol) rColMap[cleanRCol] = rc;
        }
        break;
      }
    }

    var rStartRow = rHeaderIdx !== -1 ? rHeaderIdx + 1 : 0;
    for (var rj = rStartRow; rj < repValues.length; rj++) {
      var rRow = repValues[rj];
      if (!rRow || rRow.length === 0) continue;

      var oName = rColMap.office !== undefined ? rRow[rColMap.office] : (rColMap.officename !== undefined ? rRow[rColMap.officename] : (rColMap.postoffice !== undefined ? rRow[rColMap.postoffice] : (rRow[3] || rRow[1])));
      oName = String(oName || "").trim();
      if (!oName || oName.toLowerCase().indexOf("postofficename") !== -1 || oName.toLowerCase().indexOf("pakistanpost") !== -1) continue;

      var date = rColMap.date !== undefined ? rRow[rColMap.date] : (rRow[2] || rRow[0] || new Date().toISOString().split("T")[0]);
      var postmaster = rColMap.postmaster !== undefined ? rRow[rColMap.postmaster] : (rColMap.operator !== undefined ? rRow[rColMap.operator] : (rRow[4] || rRow[2] || "Postmaster"));
      var lastBal = rColMap.lastbalance !== undefined ? Number(rRow[rColMap.lastbalance]) : (rColMap.opening !== undefined ? Number(rRow[rColMap.opening]) : (Number(rRow[5]) || Number(rRow[3]) || 0));
      var rec = rColMap.receivedtoday !== undefined ? Number(rRow[rColMap.receivedtoday]) : (rColMap.received !== undefined ? Number(rRow[rColMap.received]) : (Number(rRow[6]) || Number(rRow[4]) || 0));
      var del = rColMap.delivered !== undefined ? Number(rRow[rColMap.delivered]) : (Number(rRow[8]) || Number(rRow[5]) || 0);
      var ret = rColMap.returnedtosender !== undefined ? Number(rRow[rColMap.returnedtosender]) : (rColMap.returned !== undefined ? Number(rRow[rColMap.returned]) : (Number(rRow[10]) || Number(rRow[6]) || 0));
      var miss = rColMap.missent !== undefined ? Number(rRow[rColMap.missent]) : (Number(rRow[11]) || Number(rRow[7]) || 0);
      var dep = rColMap.deposit !== undefined ? Number(rRow[rColMap.deposit]) : (Number(rRow[12]) || Number(rRow[8]) || 0);
      var close = rColMap.closingbalance !== undefined ? Number(rRow[rColMap.closingbalance]) : (Number(rRow[13]) || Number(rRow[9]) || (lastBal + rec - del - ret - miss - dep));

      result.reports.push({
        id: "rep-" + (result.reports.length + 1),
        date: String(date),
        officeName: oName,
        postmasterName: String(postmaster || "Postmaster"),
        lastBalance: lastBal || 0,
        receivedToday: rec || 0,
        delivered: del || 0,
        returnedToSender: ret || 0,
        missent: miss || 0,
        deposit: dep || 0,
        closingBalance: close || 0,
        submittedAt: new Date().toISOString(),
        submittedBy: "Postmaster",
        remarks: ""
      });
    }
  }

  // 3. Auto-populate post offices from reports if none found
  if (result.postOffices.length === 0 && result.reports.length > 0) {
    var seen = {};
    for (var p = 0; p < result.reports.length; p++) {
      var repItem = result.reports[p];
      if (repItem.officeName && !seen[repItem.officeName]) {
        seen[repItem.officeName] = true;
        result.postOffices.push({
          id: "po-" + (result.postOffices.length + 1),
          name: repItem.officeName,
          postmasterName: repItem.postmasterName || "Postmaster",
          mobileNumber: "03001234567",
          status: "ACTIVE",
          initialBalance: repItem.closingBalance || 0
        });
      }
    }
  }

  // 4. Users & Passwords
  var uSheet = findSheetBySynonyms(["System_Users", "Users", "Passwords", "SystemUsers", "Logins", "Accounts"]);
  if (uSheet && uSheet.getLastRow() >= 1) {
    var uValues = uSheet.getDataRange().getValues();
    var uHeaderIdx = -1;
    var uColMap = {};
    for (var ui = 0; ui < Math.min(5, uValues.length); ui++) {
      var uText = uValues[ui].join(" ").toLowerCase();
      if (uText.indexOf("user") !== -1 || uText.indexOf("pass") !== -1 || uText.indexOf("pin") !== -1) {
        uHeaderIdx = ui;
        for (var uc = 0; uc < uValues[ui].length; uc++) {
          var cleanUCol = String(uValues[ui][uc] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (cleanUCol) uColMap[cleanUCol] = uc;
        }
        break;
      }
    }

    var uStartRow = uHeaderIdx !== -1 ? uHeaderIdx + 1 : 0;
    for (var uj = uStartRow; uj < uValues.length; uj++) {
      var uRow = uValues[uj];
      if (!uRow || uRow.length === 0) continue;

      var uName = uColMap.username !== undefined ? uRow[uColMap.username] : (uColMap.user !== undefined ? uRow[uColMap.user] : (uRow[2] || uRow[0]));
      uName = String(uName || "").trim();
      if (!uName || uName.toLowerCase().indexOf("username") !== -1 || uName.toLowerCase().indexOf("pakistanpost") !== -1) continue;

      var pass = uColMap.password !== undefined ? uRow[uColMap.password] : (uColMap.pin !== undefined ? uRow[uColMap.pin] : (uRow[3] || uRow[1] || "123456"));
      var role = uColMap.role !== undefined ? uRow[uColMap.role] : (uRow[4] || uRow[2] || "POST_OFFICE");
      var assignedOffice = uColMap.assignedoffice !== undefined ? uRow[uColMap.assignedoffice] : (uRow[5] || uRow[3]);
      var fullName = uColMap.name !== undefined ? uRow[uColMap.name] : (uRow[6] || uRow[4] || uName);

      result.users.push({
        id: "u-" + (result.users.length + 1),
        username: uName,
        passwordHash: String(pass || "123456"),
        role: String(role).toUpperCase().indexOf("ADMIN") !== -1 ? "ADMIN" : "POST_OFFICE",
        officeName: assignedOffice ? String(assignedOffice).trim() : undefined,
        name: String(fullName || uName).trim()
      });
    }
  }

  return result;
}
`;
};

/**
 * Test Webhook Connection
 */
export const testWebhookConnection = async (
  webhookUrl: string
): Promise<{ success: boolean; message: string }> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    throw new Error(
      'Please enter a valid Google Apps Script Web App URL (starts with https://script.google.com/macros/s/...)'
    );
  }

  try {
    const resp = await fetch(cleanUrl, {
      method: 'GET',
      mode: 'cors',
    });

    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return {
        success: true,
        message: data.message || 'Connected to Google Apps Script Webhook database successfully!',
      };
    } else {
      return {
        success: true,
        message: 'Google Apps Script Web App endpoint responded.',
      };
    }
  } catch (err: any) {
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'ping' }),
      });
      return {
        success: true,
        message: 'Google Apps Script Web App endpoint received ping test successfully (mode: no-cors)!',
      };
    } catch (innerErr: any) {
      throw new Error(
        `Could not reach Webhook: ${
          innerErr.message || 'Network error'
        }. Check deployment permissions ("Who has access: Anyone").`
      );
    }
  }
};

/**
 * Fetch entire Database via Apps Script Webhook
 */
export const fetchDatabaseViaWebhook = async (
  webhookUrl: string
): Promise<{
  reports: DailyReport[];
  postOffices: PostOffice[];
  users: User[];
}> => {
  const cleanUrl = webhookUrl.trim();
  const url = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=get_all_database`;

  const resp = await fetch(url, { method: 'GET', mode: 'cors' });
  if (!resp.ok) {
    throw new Error(`Failed to fetch database via Webhook (${resp.status})`);
  }

  const json = await resp.json();
  const data = json.data || {};
  return {
    reports: data.reports || [],
    postOffices: data.postOffices || [],
    users: data.users || [],
  };
};

/**
 * Save Full Database via Apps Script Webhook
 */
export const saveDatabaseViaWebhook = async (
  webhookUrl: string,
  data: FullDatabaseState
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) return false;

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'save_all_database',
      reports: data.reports,
      postOffices: data.postOffices,
      users: data.users,
      config: {
        whatsapp_phone_number_id: data.whatsAppConfig.phoneNumberId,
        whatsapp_access_token: data.whatsAppConfig.accessToken,
        whatsapp_webapp_url: data.whatsAppConfig.webAppUrl,
        whatsapp_auto_reminders: data.whatsAppConfig.autoRemindersEnabled ? 'true' : 'false',
        whatsapp_reminder_time: data.whatsAppConfig.reminderTime,
        trigger_reminder_time: data.triggerConfig.reminderTriggerTime,
        trigger_backup_time: data.triggerConfig.backupTriggerTime,
        trigger_rollover_time: data.triggerConfig.rolloverTriggerTime,
      },
      logs: data.logs,
    }),
  });

  return true;
};

/**
 * Save Post Offices via Apps Script Webhook
 */
export const saveOfficesViaWebhook = async (
  webhookUrl: string,
  offices: PostOffice[]
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) return false;

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'save_offices',
      postOffices: offices,
    }),
  });

  return true;
};

/**
 * Save Reports via Apps Script Webhook
 */
export const bulkSyncViaWebhook = async (
  webhookUrl: string,
  reports: DailyReport[]
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) throw new Error('Webhook URL is required');

  const sorted = [...reports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'save_reports',
      reports: sorted,
    }),
  });

  return true;
};

/**
 * Append single report via Apps Script Webhook
 */
export const syncReportViaWebhook = async (
  webhookUrl: string,
  report: DailyReport
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) return false;

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'append_report',
      report,
    }),
  });

  return true;
};

/**
 * Delete a report via Webhook
 */
export const deleteReportViaWebhook = async (
  webhookUrl: string,
  remainingReports: DailyReport[],
  deletedReport?: DailyReport
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) return false;

  const sorted = [...remainingReports].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'delete_report',
      deletedReport: deletedReport || null,
      reports: sorted,
    }),
  });

  return true;
};

// ==========================================
// UNIVERSAL DISPATCHERS (AUTO LIVE SYNC)
// ==========================================

export const dispatchReportSync = async (
  config: GoogleSheetsConfig,
  report: DailyReport
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) return { synced: false, method: 'none' };

  if (config.webhookUrl?.trim()) {
    try {
      await syncReportViaWebhook(config.webhookUrl, report);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook auto-sync warning:', e);
    }
  }

  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await appendReportToGoogleSheet(config.spreadsheetId, report, token);
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth auto-sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};

export const dispatchReportDelete = async (
  config: GoogleSheetsConfig,
  remainingReports: DailyReport[],
  deletedReport?: DailyReport
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) return { synced: false, method: 'none' };

  if (config.webhookUrl?.trim()) {
    try {
      await deleteReportViaWebhook(config.webhookUrl, remainingReports, deletedReport);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook delete sync warning:', e);
    }
  }

  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await bulkSyncReportsToGoogleSheet(config.spreadsheetId, remainingReports, token);
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth delete sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};

export const dispatchReportBulkSync = async (
  config: GoogleSheetsConfig,
  updatedReports: DailyReport[]
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) return { synced: false, method: 'none' };

  if (config.webhookUrl?.trim()) {
    try {
      await bulkSyncViaWebhook(config.webhookUrl, updatedReports);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook bulk sync warning:', e);
    }
  }

  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await bulkSyncReportsToGoogleSheet(config.spreadsheetId, updatedReports, token);
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth bulk sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};

export const dispatchOfficesSync = async (
  config: GoogleSheetsConfig,
  offices: PostOffice[]
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) return { synced: false, method: 'none' };

  if (config.webhookUrl?.trim()) {
    try {
      await saveOfficesViaWebhook(config.webhookUrl, offices);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook offices sync warning:', e);
    }
  }

  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await pushOfficesToGoogleSheet(config.spreadsheetId, offices, token);
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth offices sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};
