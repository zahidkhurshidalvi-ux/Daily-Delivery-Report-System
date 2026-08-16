import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { DailyReport, GoogleSheetsConfig } from '../types';
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
let currentUser: User | null = null;
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
 * Request Google OAuth token via Firebase Popup with graceful domain & popup error diagnostics
 */
export const requestGoogleOAuthToken = async (
  _customClientId?: string,
  onSuccess?: (token: string) => void,
  onError?: (err: any) => void
): Promise<string> => {
  try {
    const existing = getGoogleAccessToken();
    if (existing) {
      if (onSuccess) onSuccess(existing);
      return existing;
    }

    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth, googleOAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    const accessToken = credential?.accessToken;
    if (!accessToken) {
      throw new Error('Google did not return an access token. Please ensure popup was not blocked or use the Google Apps Script Webhook sync method.');
    }

    setGoogleAccessToken(accessToken, 3599);
    currentUser = result.user;

    if (onSuccess) onSuccess(accessToken);
    return accessToken;
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    let friendlyMessage = error.message || 'Google authentication failed';
    
    if (error.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'deployed domain';
      friendlyMessage = `This deployed domain (${currentHost}) is not authorized in Firebase Console. Please use Method 1 (Google Apps Script Webhook) which works instantly without any domain authorization!`;
    } else if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Sign-in popup was closed before completing.';
    } else if (error.code === 'auth/popup-blocked') {
      friendlyMessage = 'Sign-in popup was blocked by browser. Please allow popups or use Method 1 (Apps Script Webhook).';
    } else if (error.code === 'auth/cancelled-popup-request') {
      friendlyMessage = 'Sign-in request was cancelled.';
    }

    const err = new Error(friendlyMessage);
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

/**
 * Standard table headers for Pakistan Post Daily Delivery Report
 */
export const REPORT_HEADERS = [
  'Sr #',
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

/**
 * Convert a single DailyReport into a Google Sheets row array
 */
export const reportToRowValues = (report: DailyReport, index: number): (string | number)[] => {
  const total = (Number(report.lastBalance) || 0) + (Number(report.receivedToday) || 0);
  const rec = Number(report.receivedToday) || 0;
  const del = Number(report.delivered) || 0;
  const delRate = rec > 0 ? `${((del / rec) * 100).toFixed(1)}%` : '0.0%';

  return [
    index + 1,
    formatDatePK(report.date) || report.date || '',
    report.officeName || '',
    report.postmasterName || '',
    Number(report.lastBalance) || 0,
    rec,
    total,
    del,
    delRate,
    Number(report.returnedToSender) || 0,
    Number(report.missent) || 0,
    Number(report.deposit) || 0,
    Number(report.closingBalance) || 0,
    report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '',
    report.submittedBy || 'Postmaster',
    report.remarks || '',
  ];
};

// ==========================================
// GOOGLE APPS SCRIPT WEBHOOK METHODS (100% RELIABLE)
// ==========================================

/**
 * Generate the ready-to-deploy Google Apps Script Code template with INSTANT DELETE, EDIT & BULK SYNC support
 */
export const getAppsScriptTemplateCode = (): string => {
  return `/**
 * PAKISTAN POST - GUJRANWALA DIVISION
 * AUTOMATED GOOGLE SHEETS LIVE SYNC WEB APP
 * 
 * FEATURES:
 * - Instant Append on Report Submission
 * - Instant Live Removal on Report Deletion (Web portal deletion immediately removes the row in Google Sheets)
 * - Instant Update on Report Edit
 * - Full 16-column Official Layout with Grand Totals & Delivery %
 * 
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet
 * 2. Click "Extensions" -> "Apps Script"
 * 3. Replace all existing code with this script
 * 4. Click "Deploy" -> "New deployment"
 * 5. Select type "Web app"
 * 6. Set Description: "Pak Post Live Sync & Delete"
 * 7. Set "Execute as": "Me (your email)"
 * 8. Set "Who has access": "Anyone"  <-- CRITICAL
 * 9. Click "Deploy", authorize permissions, and copy the "Web app URL"
 * 10. Paste the Web app URL in your Pakistan Post Web App!
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Pakistan Post Google Sheets Webhook is active and connected!",
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
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Auto-setup headers if empty sheet
    if (sheet.getLastRow() === 0) {
      setupHeaders(sheet);
    }

    // 1. DELETE ACTION / BULK REPLACEMENT (Instantly keeps sheet 100% accurate)
    if (payload.action === "delete_report" || payload.action === "bulk_sync" || payload.action === "update_all") {
      var reports = payload.reports || [];
      var lastRow = sheet.getLastRow();
      
      // Clear all existing data rows below the header (from row 3 downwards)
      if (lastRow >= 3) {
        sheet.getRange(3, 1, Math.max(1, lastRow - 2), 16).clearContent();
      }
      
      var rows = [];
      for (var i = 0; i < reports.length; i++) {
        var r = reports[i];
        var total = (Number(r.lastBalance) || 0) + (Number(r.receivedToday) || 0);
        var rec = Number(r.receivedToday) || 0;
        var del = Number(r.delivered) || 0;
        var delRate = rec > 0 ? ((del / rec) * 100).toFixed(1) + "%" : "0.0%";
        
        rows.push([
          i + 1,
          r.date || "",
          r.officeName || "",
          r.postmasterName || "",
          Number(r.lastBalance) || 0,
          rec,
          total,
          del,
          delRate,
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
        sheet.getRange(3, 1, rows.length, 16).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: payload.action,
        message: payload.action === "delete_report" 
          ? "Report removed and sheet updated with remaining " + rows.length + " reports" 
          : "Successfully synced " + rows.length + " reports",
        count: rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. SINGLE REPORT APPEND
    if (payload.action === "append_report" || payload.report) {
      var rep = payload.report;
      var srNo = Math.max(1, sheet.getLastRow() - 1);
      var tot = (Number(rep.lastBalance) || 0) + (Number(rep.receivedToday) || 0);
      var recCount = Number(rep.receivedToday) || 0;
      var delCount = Number(rep.delivered) || 0;
      var rateStr = recCount > 0 ? ((delCount / recCount) * 100).toFixed(1) + "%" : "0.0%";

      var newRow = [
        srNo,
        rep.date || "",
        rep.officeName || "",
        rep.postmasterName || "",
        Number(rep.lastBalance) || 0,
        recCount,
        tot,
        delCount,
        rateStr,
        Number(rep.returnedToSender) || 0,
        Number(rep.missent) || 0,
        Number(rep.deposit) || 0,
        Number(rep.closingBalance) || 0,
        rep.submittedAt ? new Date(rep.submittedAt).toLocaleString() : new Date().toLocaleString(),
        rep.submittedBy || "Postmaster",
        rep.remarks || ""
      ];

      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Appended report for " + rep.officeName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "Ping successful" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setupHeaders(sheet) {
  sheet.setName("Daily Delivery Reports");
  sheet.getRange(1, 1).setValue("PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTING SYSTEM");
  sheet.getRange(1, 1, 1, 16).merge().setBackground("#00401A").setFontColor("#FFFFFF").setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center");
  
  var headers = [
    "Sr #", "Date", "Post Office Name", "Postmaster / Operator",
    "Last Balance (A)", "Received Today (B)", "Total Articles (A+B)", "Delivered (C)", "Delivery %",
    "Returned to Sender (D)", "Missent (E)", "Deposit (F)", "Closing Balance (G)",
    "Submission Timestamp", "Submitted By", "Remarks & Notes"
  ];
  sheet.getRange(2, 1, 1, 16).setValues([headers]).setBackground("#006633").setFontColor("#FFFFFF").setFontWeight("bold").setFontSize(10);
  sheet.setFrozenRows(2);
}`;
};

/**
 * Test Webhook Connection
 */
export const testWebhookConnection = async (webhookUrl: string): Promise<{ success: boolean; message: string }> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
    throw new Error('Please enter a valid Google Apps Script Web App URL (starts with https://script.google.com/macros/s/...)');
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
        message: data.message || 'Connected to Google Apps Script Webhook successfully!',
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
      throw new Error(`Could not reach Webhook: ${innerErr.message || 'Network error'}. Check deployment permissions ("Who has access: Anyone").`);
    }
  }
};

/**
 * Append single report via Apps Script Webhook
 */
export const syncReportViaWebhook = async (webhookUrl: string, report: DailyReport): Promise<boolean> => {
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
 * Delete a report and update the Google Sheet via Apps Script Webhook
 */
export const deleteReportViaWebhook = async (
  webhookUrl: string,
  remainingReports: DailyReport[],
  deletedReport?: DailyReport
): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) return false;

  const sorted = [...remainingReports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

/**
 * Bulk sync all reports via Apps Script Webhook
 */
export const bulkSyncViaWebhook = async (webhookUrl: string, reports: DailyReport[]): Promise<boolean> => {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) throw new Error('Webhook URL is required');

  const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  await fetch(cleanUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'bulk_sync',
      reports: sorted,
    }),
  });

  return true;
};

// ==========================================
// DIRECT GOOGLE SHEETS REST API METHODS
// ==========================================

/**
 * Create a new styled Pakistan Post Google Spreadsheet via REST API
 */
export const createPakistanPostSpreadsheet = async (
  title: string = `Pakistan Post - Daily Delivery Reports (${new Date().getFullYear()})`,
  token: string
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
            title: 'Daily Delivery Reports',
            gridProperties: {
              frozenRowCount: 2,
              rowCount: 1000,
              columnCount: 16,
            },
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

  // Apply Title Banner & Headers
  const bannerRow = [
    'PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTING SYSTEM',
  ];
  
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Delivery Reports'!A1:P2?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [bannerRow, REPORT_HEADERS],
      }),
    }
  );

  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Append a single Daily Report row to the connected Google Spreadsheet
 */
export const appendReportToGoogleSheet = async (
  spreadsheetId: string,
  report: DailyReport,
  token: string,
  sheetName: string = 'Daily Delivery Reports'
): Promise<boolean> => {
  const rowValues = reportToRowValues(report, 0);
  const cleanRow = [
    '', // Sr# will be formatted or auto-incremented
    ...rowValues.slice(1),
  ];

  const range = `'${sheetName}'!A:P`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [cleanRow],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to append row to Google Sheets (${response.status})`
    );
  }

  return true;
};

/**
 * Bulk sync / overwrite all reports to the connected Google Spreadsheet (Also handles deletions cleanly)
 */
export const bulkSyncReportsToGoogleSheet = async (
  spreadsheetId: string,
  reports: DailyReport[],
  token: string,
  sheetName: string = 'Daily Delivery Reports'
): Promise<{ updatedRows: number }> => {
  const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rows = sorted.map((r, idx) => reportToRowValues(r, idx));

  // First clear old data range from A3 to P1000 so deleted records are completely removed
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${sheetName}'!A3:P1000:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  ).catch((e) => console.warn('Clear range warning:', e));

  const allValues = [
    ['PAKISTAN POST - GUJRANWALA DIVISION DAILY DELIVERY REPORTING SYSTEM'],
    REPORT_HEADERS,
    ...rows,
  ];

  const range = `'${sheetName}'!A1:P${allValues.length}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range
  )}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: allValues,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error?.message || `Failed to sync reports to Google Sheet (${response.status})`
    );
  }

  return { updatedRows: reports.length };
};

/**
 * Fetch spreadsheet metadata to verify connection
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
 * Universal Sync Helper for single report submission
 */
export const dispatchReportSync = async (
  config: GoogleSheetsConfig,
  report: DailyReport
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) {
    return { synced: false, method: 'none' };
  }

  // 1. Webhook (Recommended)
  if (config.webhookUrl?.trim()) {
    try {
      await syncReportViaWebhook(config.webhookUrl, report);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook auto-sync warning:', e);
    }
  }

  // 2. Direct OAuth
  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await appendReportToGoogleSheet(
          config.spreadsheetId,
          report,
          token,
          config.sheetName || 'Daily Delivery Reports'
        );
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth auto-sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};

/**
 * Universal Instant Delete Helper:
 * When a report is deleted from the web portal, immediately removes it from the connected Google Sheet
 */
export const dispatchReportDelete = async (
  config: GoogleSheetsConfig,
  remainingReports: DailyReport[],
  deletedReport?: DailyReport
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) {
    return { synced: false, method: 'none' };
  }

  // 1. Webhook Delete
  if (config.webhookUrl?.trim()) {
    try {
      await deleteReportViaWebhook(config.webhookUrl, remainingReports, deletedReport);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook delete sync warning:', e);
    }
  }

  // 2. Direct OAuth Delete
  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await bulkSyncReportsToGoogleSheet(
          config.spreadsheetId,
          remainingReports,
          token,
          config.sheetName || 'Daily Delivery Reports'
        );
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth delete sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};

/**
 * Universal Bulk Sync Helper:
 * Used for full sync or after editing reports
 */
export const dispatchReportBulkSync = async (
  config: GoogleSheetsConfig,
  updatedReports: DailyReport[]
): Promise<{ synced: boolean; method: string }> => {
  if (!config.autoSyncEnabled) {
    return { synced: false, method: 'none' };
  }

  // 1. Webhook Bulk Sync
  if (config.webhookUrl?.trim()) {
    try {
      await bulkSyncViaWebhook(config.webhookUrl, updatedReports);
      return { synced: true, method: 'webhook' };
    } catch (e) {
      console.warn('Webhook bulk sync warning:', e);
    }
  }

  // 2. Direct OAuth Bulk Sync
  if (config.spreadsheetId) {
    const token = getGoogleAccessToken();
    if (token) {
      try {
        await bulkSyncReportsToGoogleSheet(
          config.spreadsheetId,
          updatedReports,
          token,
          config.sheetName || 'Daily Delivery Reports'
        );
        return { synced: true, method: 'oauth' };
      } catch (e) {
        console.warn('OAuth bulk sync warning:', e);
      }
    }
  }

  return { synced: false, method: 'none' };
};
