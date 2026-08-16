import { PostOffice, DailyReport, User, TriggerConfig, WhatsAppConfig, GoogleSheetsConfig } from '../types';
import { getTodayDateString, calculateClosingBalance } from '../utils/calculations';

export const INITIAL_POST_OFFICES: PostOffice[] = [
  { id: 'po-1', name: 'Alipur Chatha PO', postmasterName: 'Postmaster', mobileNumber: '03001234501', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-2', name: 'Daska GPO', postmasterName: 'Postmaster', mobileNumber: '03001234502', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-3', name: 'Ghakkhar Mandi PO', postmasterName: 'Postmaster', mobileNumber: '03001234503', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-4', name: 'Gujranwala Cantt PO', postmasterName: 'Postmaster', mobileNumber: '03001234504', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-5', name: 'Gujranwala City PO', postmasterName: 'Postmaster', mobileNumber: '03001234505', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-6', name: 'Gujranwala GPO', postmasterName: 'Postmaster', mobileNumber: '03001234506', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-7', name: 'Gujranwala Satellite Town PO', postmasterName: 'Postmaster', mobileNumber: '03001234507', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-8', name: 'Gujrat GPO', postmasterName: 'Postmaster', mobileNumber: '03001234508', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-9', name: 'Hafizabad GPO', postmasterName: 'Postmaster', mobileNumber: '03001234509', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-10', name: 'Jalalpur Jattan PO', postmasterName: 'Postmaster', mobileNumber: '03001234510', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-11', name: 'Kamoke PO', postmasterName: 'Postmaster', mobileNumber: '03001234511', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-12', name: 'Kharian PO', postmasterName: 'Postmaster', mobileNumber: '03001234512', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-13', name: 'Malakwal PO', postmasterName: 'Postmaster', mobileNumber: '03001234513', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-14', name: 'Mandi Bahauddin GPO', postmasterName: 'Postmaster', mobileNumber: '03001234514', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-15', name: 'Narowal GPO', postmasterName: 'Postmaster', mobileNumber: '03001234515', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-16', name: 'Nowshera Virkan PO', postmasterName: 'Postmaster', mobileNumber: '03001234516', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-17', name: 'Pasrur PO', postmasterName: 'Postmaster', mobileNumber: '03001234517', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-18', name: 'Phalia PO', postmasterName: 'Postmaster', mobileNumber: '03001234518', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-19', name: 'Pindi Bhattian PO', postmasterName: 'Postmaster', mobileNumber: '03001234519', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-20', name: 'Qila Didar Singh PO', postmasterName: 'Postmaster', mobileNumber: '03001234520', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-21', name: 'Rahwali PO', postmasterName: 'Postmaster', mobileNumber: '03001234521', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-22', name: 'Sambrial PO', postmasterName: 'Postmaster', mobileNumber: '03001234522', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-23', name: 'Sarai Alamgir PO', postmasterName: 'Postmaster', mobileNumber: '03001234523', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-24', name: 'Shakargarh PO', postmasterName: 'Postmaster', mobileNumber: '03001234524', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-25', name: 'Sialkot Cantt PO', postmasterName: 'Postmaster', mobileNumber: '03001234525', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-26', name: 'Sialkot City PO', postmasterName: 'Postmaster', mobileNumber: '03001234526', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-27', name: 'Sialkot GPO', postmasterName: 'Postmaster', mobileNumber: '03001234527', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-28', name: 'Sukheke Mandi PO', postmasterName: 'Postmaster', mobileNumber: '03001234528', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-29', name: 'Wazirabad GPO', postmasterName: 'Postmaster', mobileNumber: '03001234529', status: 'ACTIVE', initialBalance: 0 },
  { id: 'po-30', name: 'Zafarwal PO', postmasterName: 'Postmaster', mobileNumber: '03001234530', status: 'ACTIVE', initialBalance: 0 },
];

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

