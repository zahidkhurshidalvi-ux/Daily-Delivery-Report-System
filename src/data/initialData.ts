import { PostOffice, DailyReport, User, TriggerConfig, WhatsAppConfig, GoogleSheetsConfig, ArticleCategoryConfig } from '../types';
import { getTodayDateString, calculateClosingBalance } from '../utils/calculations';

// Clean empty initial post offices by default (actual offices load permanently from Google Sheets/LocalStorage)
export const INITIAL_POST_OFFICES: PostOffice[] = [];

export const INITIAL_USERS: User[] = [
  { id: 'u-admin', username: 'admin', passwordHash: 'admin123', role: 'ADMIN', name: 'Divisional Superintendent' },
];

const today = getTodayDateString();

// Clean empty initial reports by default (no dummy records deployed to GitHub/production)
export const INITIAL_REPORTS: DailyReport[] = [];

// Standard Pakistan Post Article Categories specified by user (10 categories in exact order)
export const DEFAULT_ARTICLE_CATEGORIES: ArticleCategoryConfig[] = [
  {
    id: 'cat-rgl',
    key: 'rgl',
    label: 'RGL',
    code: 'RGL',
    description: 'Registered Letter (Combined)',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 1,
    isSystemDefault: true,
  },
  {
    id: 'cat-parcel',
    key: 'parcel',
    label: 'Parcel',
    code: 'PARCEL',
    description: 'Parcel Post (Combined)',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 2,
    isSystemDefault: true,
  },
  {
    id: 'cat-ums',
    key: 'ums',
    label: 'UMS',
    code: 'UMS',
    description: 'Urgent Mail Service (Express Speed Post)',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 3,
    isSystemDefault: true,
  },
  {
    id: 'cat-ordinary',
    key: 'ordinary',
    label: 'Ordinary',
    code: 'ORD',
    description: 'Ordinary Unregistered Letters & Postcards',
    requiresEmtts: false,
    enabled: true,
    sortOrder: 4,
    isSystemDefault: true,
  },
  {
    id: 'cat-excise',
    key: 'excise',
    label: 'Excise',
    code: 'EXCISE',
    description: 'Excise & Taxation Vehicle Smart Cards / Books',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 5,
    isSystemDefault: true,
  },
  {
    id: 'cat-vpp',
    key: 'vpp',
    label: 'VPP/VPL',
    code: 'VPP',
    description: 'Value Payable Post / Value Payable Letter',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 6,
    isSystemDefault: true,
  },
  {
    id: 'cat-mo',
    key: 'mo',
    label: 'MO',
    code: 'MO',
    description: 'Electronic Money Order (eMO) & General MO',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 7,
    isSystemDefault: true,
  },
  {
    id: 'cat-echallan',
    key: 'echallan',
    label: 'E-Challan',
    code: 'ECHALLAN',
    description: 'Traffic Police Safe City E-Challans',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 8,
    isSystemDefault: true,
  },
  {
    id: 'cat-cod',
    key: 'cod',
    label: 'COD',
    code: 'COD',
    description: 'Cash On Delivery E-Commerce Parcels',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 9,
    isSystemDefault: true,
  },
  {
    id: 'cat-medical',
    key: 'medical',
    label: 'Medical',
    code: 'MED',
    description: 'Medical Store & Hospital Articles',
    requiresEmtts: true,
    enabled: true,
    sortOrder: 10,
    isSystemDefault: true,
  },
];

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


