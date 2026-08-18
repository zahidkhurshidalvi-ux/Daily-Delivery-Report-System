import { PostOffice, DailyReport, User, TriggerConfig, WhatsAppConfig, GoogleSheetsConfig } from '../types';
import { getTodayDateString, calculateClosingBalance } from '../utils/calculations';

// Clean empty initial post offices by default (actual offices load permanently from Google Sheets/LocalStorage)
export const INITIAL_POST_OFFICES: PostOffice[] = [];

export const INITIAL_USERS: User[] = [
  { id: 'u-admin', username: 'admin', passwordHash: 'admin123', role: 'ADMIN', name: 'Divisional Superintendent' },
];

const today = getTodayDateString();

// Clean empty initial reports by default (no dummy records deployed to GitHub/production)
export const INITIAL_REPORTS: DailyReport[] = [];

export const INITIAL_WHATSAPP_CONFIG: WhatsAppConfig = {
  phoneNumberId: '109823748912734',
  accessToken: 'YOUR_WHATSAPP_TOKEN',
  webAppUrl: typeof window !== 'undefined' ? window.location.origin : 'https://script.google.com/macros/s/AKfycbx_YOUR_APP_ID/exec',
  autoRemindersEnabled: true,
  reminderTime: '17:00',
};

export const INITIAL_TRIGGER_CONFIG: TriggerConfig = {
  reminderTriggerTime: '17:00',
  backupTriggerTime: '23:59',
  rolloverTriggerTime: '00:05',
  reminderTriggerActive: true,
  backupTriggerActive: true,
  rolloverTriggerActive: true,
  lastReminderRun: `${today} 17:00:00`,
  lastBackupRun: `${today} 23:59:00`,
  lastRolloverRun: `${today} 00:05:00`,
};

export const INITIAL_GOOGLE_SHEETS_CONFIG: GoogleSheetsConfig = {
  autoSyncEnabled: true,
  sheetName: 'Daily Delivery Reports',
};

