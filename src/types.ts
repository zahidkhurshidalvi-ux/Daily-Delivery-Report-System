export type UserRole = 'ADMIN' | 'POST_OFFICE';

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Plain/hashed for demo display
  role: UserRole;
  officeName?: string;
  name: string;
}

export interface Postman {
  id: string;
  name: string;
  beatNo?: string; // Beat / Area No.
  mobileNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

export interface PostOffice {
  id: string;
  name: string;
  postmasterName: string;
  mobileNumber: string;
  status: 'ACTIVE' | 'INACTIVE';
  initialBalance: number;
  createdDate?: string;
  postmen?: Postman[]; // Postmen registered for this office
}

export interface ArticleCategoryConfig {
  id: string; // unique ID
  key: string; // slug key e.g. 'rgl', 'parcel', 'ums'
  label: string; // e.g. 'RGL (Intl/dom/ins)'
  code?: string;
  description?: string;
  requiresEmtts?: boolean; // trackable on EMTTS
  enabled: boolean;
  sortOrder: number;
  isSystemDefault?: boolean;
}

export interface CategoryBreakdown {
  [categoryKey: string]: number;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  officeName: string;
  postmasterName: string;
  postmanId?: string;
  postmanName?: string;
  lastBalance: number;
  receivedToday: number;
  delivered: number;
  returnedToSender: number;
  missent: number;
  deposit: number;
  closingBalance: number; // Automatically calculated
  remarks: string;
  submittedAt?: string; // ISO string or timestamp
  updatedAt?: string;
  submittedBy: string;
  officeCode?: string;

  // Detailed Category Breakdowns
  receivedBreakdown?: CategoryBreakdown;
  deliveredBreakdown?: CategoryBreakdown;

  // EMTTS Barcode / Track & Trace Articles status
  emttsUpdated?: number;
  emttsNotUpdated?: number;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webAppUrl: string;
  autoRemindersEnabled: boolean;
  reminderTime: string; // "17:00"
}

export interface SystemLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
}

export interface TriggerConfig {
  reminderTriggerTime: string; // "17:00" (5:00 PM)
  backupTriggerTime: string; // "23:59" (11:59 PM)
  rolloverTriggerTime: string; // "00:05" (12:05 AM)
  reminderTriggerActive: boolean;
  backupTriggerActive: boolean;
  rolloverTriggerActive: boolean;
  lastReminderRun?: string;
  lastBackupRun?: string;
  lastRolloverRun?: string;
}

export interface OfficialHoliday {
  date: string; // YYYY-MM-DD
  title: string; // e.g. "Official Public Holiday (26/08/2026)"
  declaredBy?: string;
  declaredAt?: string;
  notes?: string;
}

export interface GasModule {
  filename: string;
  language: string;
  title: string;
  description: string;
  code: string;
}

export interface GoogleSheetsConfig {
  syncMethod?: 'WEBHOOK' | 'OAUTH';
  webhookUrl?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetTitle?: string;
  autoSyncEnabled: boolean;
  lastSyncedAt?: string;
  customClientId?: string;
  userEmail?: string;
  sheetName?: string;
  dbInitialized?: boolean;
  autoPullOnLoad?: boolean;
  liveSyncOffices?: boolean;
  liveSyncReports?: boolean;
  liveSyncUsers?: boolean;
  liveSyncConfig?: boolean;
}


