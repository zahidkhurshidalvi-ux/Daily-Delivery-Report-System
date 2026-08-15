import { DailyReport } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              expires_in?: number;
            }) => void;
            error_callback?: (err: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          hasGrantedAllScopes: (tokenResponse: any, ...scopes: string[]) => boolean;
        };
      };
    };
  }
}

export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

// Token Storage
let inMemoryToken: string | null = null;
let tokenExpiryTimestamp: number | null = null;

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

export const clearGoogleToken = () => {
  inMemoryToken = null;
  tokenExpiryTimestamp = null;
  try {
    sessionStorage.removeItem('pak_post_google_token');
    sessionStorage.removeItem('pak_post_google_token_exp');
  } catch (e) {
    // Ignore
  }
};

/**
 * Initialize GIS Token Client and request access token
 */
export const requestGoogleOAuthToken = (
  clientId?: string,
  onSuccess?: (token: string) => void,
  onError?: (err: any) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Check if token already valid
    const existing = getGoogleAccessToken();
    if (existing) {
      if (onSuccess) onSuccess(existing);
      resolve(existing);
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      const err = new Error(
        'Google Identity Services library is still loading. Please wait 2 seconds and try again.'
      );
      if (onError) onError(err);
      reject(err);
      return;
    }

    // Resolve client ID from environment or user override
    const effectiveClientId =
      clientId ||
      ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) ||
      '653201276103-mock-oauth-client.apps.googleusercontent.com';

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: effectiveClientId,
        scope: SHEETS_SCOPES,
        callback: (resp) => {
          if (resp.error) {
            const err = new Error(`OAuth error: ${resp.error}`);
            if (onError) onError(err);
            reject(err);
          } else if (resp.access_token) {
            setGoogleAccessToken(resp.access_token, resp.expires_in || 3599);
            if (onSuccess) onSuccess(resp.access_token);
            resolve(resp.access_token);
          } else {
            const err = new Error('No access token returned by Google.');
            if (onError) onError(err);
            reject(err);
          }
        },
        error_callback: (err) => {
          if (onError) onError(err);
          reject(err);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (e: any) {
      if (onError) onError(e);
      reject(e);
    }
  });
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
  return [
    index + 1,
    report.date || '',
    report.officeName || '',
    report.postmasterName || '',
    Number(report.lastBalance) || 0,
    Number(report.receivedToday) || 0,
    total,
    Number(report.delivered) || 0,
    Number(report.returnedToSender) || 0,
    Number(report.missent) || 0,
    Number(report.deposit) || 0,
    Number(report.closingBalance) || 0,
    report.submittedAt ? new Date(report.submittedAt).toLocaleString() : '',
    report.submittedBy || 'Postmaster',
    report.remarks || '',
  ];
};

/**
 * Create a new styled Pakistan Post Google Spreadsheet
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
    'PAKISTAN POST - DIVISIONAL SUPERINTENDENT DAILY DELIVERY REPORTING SYSTEM',
  ];
  
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Delivery Reports'!A1:O2?valueInputOption=USER_ENTERED`,
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
  const rowValues = reportToRowValues(report, 0); // row index placeholder
  // Remove Sr# to avoid collision or allow Sheets to place it
  const cleanRow = [
    '', // Sr# will be row index or formatted
    rowValues[1],
    rowValues[2],
    rowValues[3],
    rowValues[4],
    rowValues[5],
    rowValues[6],
    rowValues[7],
    rowValues[8],
    rowValues[9],
    rowValues[10],
    rowValues[11],
    rowValues[12],
    rowValues[13],
    rowValues[14],
  ];

  const range = `'${sheetName}'!A:O`;
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
 * Bulk sync / overwrite all reports to the connected Google Spreadsheet
 */
export const bulkSyncReportsToGoogleSheet = async (
  spreadsheetId: string,
  reports: DailyReport[],
  token: string,
  sheetName: string = 'Daily Delivery Reports'
): Promise<{ updatedRows: number }> => {
  // Sort reports chronologically
  const sorted = [...reports].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rows = sorted.map((r, idx) => reportToRowValues(r, idx));

  // Banner + Header + all data rows
  const allValues = [
    ['PAKISTAN POST - DIVISIONAL SUPERINTENDENT DAILY DELIVERY REPORTING SYSTEM'],
    REPORT_HEADERS,
    ...rows,
  ];

  // Write starting from A1
  const range = `'${sheetName}'!A1:O${allValues.length}`;
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
      errorBody.error?.message || `Unable to access Google Sheet (${response.status}). Check permissions.`
    );
  }

  const data = await response.json();
  const title = data.properties?.title || 'Untitled Sheet';
  const sheetNames = (data.sheets || []).map((s: any) => s.properties?.title);
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return { title, sheetNames, url: spreadsheetUrl };
};
