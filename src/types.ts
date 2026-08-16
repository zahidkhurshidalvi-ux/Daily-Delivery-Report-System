export type UserRole = 'ADMIN' | 'POST_OFFICE';

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Plain/hashed for demo display
  role: UserRole;
  officeName?: string;
  name: string;
}

export interface PostOffice {
  id: string;
  name: string;
  postmasterName: string;
  mobileNumber: string;
  status: 'ACTIVE' | 'INACTIVE';
  initialBalance: number;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD
  officeName: string;
  postmasterName: string;
  lastBalance: number;
  receivedToday: number;
  delivered: number;
  returnedToSender: number;
  missent: number;
  deposit: number;
  closingBalance: number; // Automatically calculated
  remarks: string;
  submittedAt: string; // ISO string or timestamp
  updatedAt?: string;
  submittedBy: string;
  officeCode?: string;
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
}

