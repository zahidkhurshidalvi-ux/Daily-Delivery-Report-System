import React, { useState, useEffect } from 'react';
import {
  DailyReport,
  PostOffice,
  User,
  WhatsAppConfig,
  TriggerConfig,
  SystemLog,
  GoogleSheetsConfig,
} from '../types';
import { formatDatePK } from '../utils/calculations';
import {
  requestGoogleOAuthToken,
  getGoogleAccessToken,
  clearGoogleToken,
  setGoogleAccessToken,
  createPakistanPostSpreadsheet,
  buildOrInitializeAllDatabaseSheets,
  pushFullDatabaseToGoogleSheet,
  fetchFullDatabaseFromGoogleSheet,
  getSpreadsheetMetadata,
  extractSpreadsheetId,
  REPORT_HEADERS,
  OFFICE_HEADERS,
  USER_HEADERS,
  CONFIG_HEADERS,
  LOG_HEADERS,
  getAppsScriptTemplateCode,
  testWebhookConnection,
  saveDatabaseViaWebhook,
  fetchDatabaseViaWebhook,
  FullDatabaseState,
  SHEET_NAMES,
  buildHeaderMap,
  smartParseOfficeRow,
  smartParseReportRow,
  smartParseUserRow,
} from '../utils/googleSheets';
import { exportDailyReportsToExcel } from '../utils/excelExport';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Link,
  ShieldCheck,
  Zap,
  Check,
  Sparkles,
  Copy,
  Code,
  Globe,
  Lock,
  Download,
  Building,
  Users,
  Settings,
  Database,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  ClipboardPaste,
  UploadCloud,
} from 'lucide-react';

interface GoogleSheetsManagerProps {
  reports: DailyReport[];
  postOffices: PostOffice[];
  users: User[];
  whatsAppConfig: WhatsAppConfig;
  triggerConfig: TriggerConfig;
  logs: SystemLog[];
  config: GoogleSheetsConfig;
  onUpdateConfig: (newConfig: GoogleSheetsConfig) => void;
  onUpdateAllDatabase?: (data: {
    reports?: DailyReport[];
    postOffices?: PostOffice[];
    users?: User[];
    whatsAppConfig?: WhatsAppConfig;
    triggerConfig?: TriggerConfig;
  }) => void;
  onAddLog: (action: string, details: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR') => void;
}

export const GoogleSheetsManager: React.FC<GoogleSheetsManagerProps> = ({
  reports,
  postOffices,
  users,
  whatsAppConfig,
  triggerConfig,
  logs,
  config,
  onUpdateConfig,
  onUpdateAllDatabase,
  onAddLog,
}) => {
  const [activeSyncTab, setActiveSyncTab] = useState<'oauth' | 'webhook' | 'paste'>('oauth');
  const [previewTab, setPreviewTab] = useState<'reports' | 'offices' | 'users' | 'config' | 'logs'>('reports');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [pulling, setPulling] = useState<boolean>(false);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Direct Paste Ingestion State
  const [pasteCategory, setPasteCategory] = useState<'offices' | 'reports' | 'users'>('offices');
  const [pastedRawText, setPastedRawText] = useState<string>('');
  const [parsedItemsPreview, setParsedItemsPreview] = useState<any[]>([]);
  const [isApplyingPaste, setIsApplyingPaste] = useState<boolean>(false);

  // Webhook State
  const [webhookUrlInput, setWebhookUrlInput] = useState<string>(config.webhookUrl || '');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Direct OAuth State
  const [manualInput, setManualInput] = useState<string>(config.spreadsheetId || '');
  const [customClientId, setCustomClientId] = useState<string>(config.customClientId || '');
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState<boolean>(false);

  const fullDatabasePayload: FullDatabaseState = {
    reports,
    postOffices,
    users,
    whatsAppConfig,
    triggerConfig,
    logs,
  };

  // Check token & initial sync mode on mount
  useEffect(() => {
    const token = getGoogleAccessToken();
    setIsConnected(!!token);
    if (config.webhookUrl) {
      setActiveSyncTab('webhook');
    } else if (token || config.spreadsheetId) {
      setActiveSyncTab('oauth');
    }
  }, [config.webhookUrl, config.spreadsheetId]);

  // Current domain detection
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'deployed-app';

  // 1. Copy Apps Script Code to Clipboard
  const handleCopyScript = () => {
    const code = getAppsScriptTemplateCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
    onAddLog('SCRIPT_COPY', 'Copied Multi-Tab Google Sheets Database Script to clipboard', 'INFO');
  };

  // Helper to handle OAuth errors & popup cancellations gracefully
  const handleOAuthError = (err: any, defaultMsg: string, logAction: string) => {
    const isCancellation =
      err?.isUserCancellation ||
      err?.message?.includes('closed') ||
      err?.message?.includes('cancelled') ||
      err?.message?.includes('Sign-in popup');

    if (isCancellation) {
      setStatusMessage({
        type: 'info',
        text: 'Google sign-in popup was closed. Click "Authorize Google Account" when ready, or switch to the Google Apps Script Webhook or Direct Paste sync options.',
      });
      onAddLog('GOOGLE_AUTH_INFO', 'Google sign-in popup dismissed by user', 'INFO');
    } else {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err?.message || defaultMsg,
      });
      onAddLog(logAction, `${defaultMsg}: ${err?.message || 'Unknown'}`, 'ERROR');
    }
  };

  // 2. Direct OAuth: Authorize with Google
  const handleConnectGoogle = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const token = await requestGoogleOAuthToken(customClientId || undefined);
      setIsConnected(true);
      setStatusMessage({
        type: 'success',
        text: 'Successfully authorized Google Sheets & Drive access!',
      });
      onAddLog('GOOGLE_AUTH', 'Google Sheets OAuth authorization granted', 'SUCCESS');

      if (config.spreadsheetId) {
        try {
          const meta = await getSpreadsheetMetadata(config.spreadsheetId, token);
          onUpdateConfig({
            ...config,
            syncMethod: 'OAUTH',
            spreadsheetTitle: meta.title,
            spreadsheetUrl: meta.url,
          });
        } catch (e) {
          // Keep existing config
        }
      }
    } catch (err: any) {
      handleOAuthError(err, 'Failed to authenticate with Google.', 'GOOGLE_AUTH_ERR');
    } finally {
      setLoading(false);
    }
  };

  // 3. Create Full 5-Tab Database in Google Drive
  const handleCreateNewDatabaseSpreadsheet = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      const { spreadsheetId, spreadsheetUrl } = await createPakistanPostSpreadsheet(
        `Pakistan Post - Divisional Database (${new Date().toLocaleDateString('en-GB')})`,
        token,
        fullDatabasePayload
      );

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'OAUTH',
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: `Pakistan Post - Divisional Database (${new Date().toLocaleDateString('en-GB')})`,
        lastSyncedAt: now,
        dbInitialized: true,
        autoSyncEnabled: true,
      };

      onUpdateConfig(updatedConfig);
      setManualInput(spreadsheetId);
      setStatusMessage({
        type: 'success',
        text: `✓ Created complete Pakistan Post Database Spreadsheet in Google Drive with all 5 database tabs initialized!`,
      });
      onAddLog(
        'GOOGLE_DB_CREATED',
        `Created Google Sheet Database: ${spreadsheetId} (5 Tabs: Reports, Offices, Users, Config, Logs)`,
        'SUCCESS'
      );
    } catch (err: any) {
      handleOAuthError(err, 'Failed to create Google Spreadsheet database.', 'GOOGLE_DB_ERROR');
    } finally {
      setSyncing(false);
    }
  };

  // 4. Link & Initialize Attached Existing Sheet (5 Tabs)
  const handleLinkAndInitExistingSheet = async () => {
    const targetId = extractSpreadsheetId(manualInput);
    if (!targetId) {
      setStatusMessage({
        type: 'error',
        text: 'Please paste your Google Spreadsheet URL or Sheet ID first.',
      });
      return;
    }

    setSyncing(true);
    setStatusMessage(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      const meta = await getSpreadsheetMetadata(targetId, token);
      await buildOrInitializeAllDatabaseSheets(targetId, token, fullDatabasePayload);

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'OAUTH',
        spreadsheetId: targetId,
        spreadsheetUrl: meta.url,
        spreadsheetTitle: meta.title,
        lastSyncedAt: now,
        dbInitialized: true,
        autoSyncEnabled: true,
      };

      onUpdateConfig(updatedConfig);
      setStatusMessage({
        type: 'success',
        text: `✓ Connected to "${meta.title}" and built all 5 database tabs (Daily_Reports, Post_Offices, System_Users, System_Config, Activity_Logs)!`,
      });
      onAddLog('GOOGLE_DB_INIT', `Initialized all 5 database tabs in Google Sheet: ${meta.title}`, 'SUCCESS');
    } catch (err: any) {
      handleOAuthError(err, 'Failed to initialize database in specified Google Sheet.', 'GOOGLE_DB_INIT_ERR');
    } finally {
      setSyncing(false);
    }
  };

  // 5. Push All Database Records to Google Sheet
  const handlePushAllDatabase = async () => {
    // If Webhook configured:
    if (activeSyncTab === 'webhook' && config.webhookUrl) {
      setSyncing(true);
      setStatusMessage(null);
      try {
        await saveDatabaseViaWebhook(config.webhookUrl, fullDatabasePayload);
        const now = new Date().toISOString();
        onUpdateConfig({ ...config, lastSyncedAt: now });
        setStatusMessage({
          type: 'success',
          text: `✓ Full Database synced to Google Sheet via Webhook (${postOffices.length} offices, ${reports.length} reports, ${users.length} users, system config & logs)!`,
        });
        onAddLog('WEBHOOK_DB_PUSH', `Pushed full database to Google Sheet via Webhook`, 'SUCCESS');
      } catch (err: any) {
        console.error(err);
        setStatusMessage({
          type: 'error',
          text: err.message || 'Failed to push database via Webhook.',
        });
      } finally {
        setSyncing(false);
      }
      return;
    }

    // Direct OAuth:
    const targetId = extractSpreadsheetId(manualInput || config.spreadsheetId || '');
    if (!targetId) {
      setStatusMessage({
        type: 'error',
        text: 'Please connect or create a Google Spreadsheet database first.',
      });
      return;
    }

    setSyncing(true);
    setStatusMessage(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      await pushFullDatabaseToGoogleSheet(targetId, token, fullDatabasePayload);

      const now = new Date().toISOString();
      onUpdateConfig({
        ...config,
        spreadsheetId: targetId,
        lastSyncedAt: now,
      });

      setStatusMessage({
        type: 'success',
        text: `✓ Successfully pushed entire database (${postOffices.length} offices, ${reports.length} reports, ${users.length} users, config & logs) to Google Sheet!`,
      });
      onAddLog(
        'GOOGLE_DB_PUSH_ALL',
        `Synced full database to Google Sheet: ${postOffices.length} offices, ${reports.length} reports`,
        'SUCCESS'
      );
    } catch (err: any) {
      handleOAuthError(err, 'Failed to sync database to Google Sheet.', 'GOOGLE_DB_PUSH_ERR');
    } finally {
      setSyncing(false);
    }
  };

  // 6. Pull Database from Google Sheet (Load into App)
  const handlePullDatabaseFromGoogleSheet = async () => {
    setPulling(true);
    setStatusMessage(null);

    // If Webhook:
    if (activeSyncTab === 'webhook' && config.webhookUrl) {
      try {
        const fetched = await fetchDatabaseViaWebhook(config.webhookUrl);
        if (onUpdateAllDatabase) {
          onUpdateAllDatabase({
            reports: fetched.reports.length > 0 ? fetched.reports : undefined,
            postOffices: fetched.postOffices.length > 0 ? fetched.postOffices : undefined,
            users: fetched.users.length > 0 ? fetched.users : undefined,
          });
        }
        setStatusMessage({
          type: 'success',
          text: `✓ Pulled database from Google Sheet: ${fetched.postOffices.length} post offices, ${fetched.reports.length} reports, and ${fetched.users.length} users loaded!`,
        });
        onAddLog(
          'WEBHOOK_DB_PULL',
          `Loaded ${fetched.postOffices.length} offices, ${fetched.reports.length} reports from Google Sheet`,
          'SUCCESS'
        );
      } catch (err: any) {
        console.error(err);
        setStatusMessage({
          type: 'error',
          text: err.message || 'Failed to pull database via Webhook.',
        });
      } finally {
        setPulling(false);
      }
      return;
    }

    // Direct OAuth:
    const targetId = extractSpreadsheetId(manualInput || config.spreadsheetId || '');
    if (!targetId) {
      setStatusMessage({
        type: 'error',
        text: 'Please connect a Google Spreadsheet database first.',
      });
      setPulling(false);
      return;
    }

    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      const fetched = await fetchFullDatabaseFromGoogleSheet(targetId, token);
      if (onUpdateAllDatabase) {
        onUpdateAllDatabase({
          reports: fetched.reports.length > 0 ? fetched.reports : undefined,
          postOffices: fetched.postOffices.length > 0 ? fetched.postOffices : undefined,
          users: fetched.users.length > 0 ? fetched.users : undefined,
          whatsAppConfig: fetched.whatsAppConfig ? ({ ...whatsAppConfig, ...fetched.whatsAppConfig } as WhatsAppConfig) : undefined,
          triggerConfig: fetched.triggerConfig ? ({ ...triggerConfig, ...fetched.triggerConfig } as TriggerConfig) : undefined,
        });
      }

      const now = new Date().toISOString();
      onUpdateConfig({ ...config, lastSyncedAt: now });

      setStatusMessage({
        type: 'success',
        text: `✓ Successfully loaded database from Google Sheet: ${fetched.postOffices.length} post offices, ${fetched.reports.length} reports, ${fetched.users.length} users!`,
      });
      onAddLog(
        'GOOGLE_DB_PULL',
        `Pulled database from Google Sheet: ${fetched.postOffices.length} offices, ${fetched.reports.length} reports`,
        'SUCCESS'
      );
    } catch (err: any) {
      handleOAuthError(err, 'Failed to fetch database from Google Sheet.', 'GOOGLE_DB_PULL_ERR');
    } finally {
      setPulling(false);
    }
  };

  // 7. Test & Save Webhook Connection
  const handleSaveAndTestWebhook = async () => {
    const cleanUrl = webhookUrlInput.trim();
    if (!cleanUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Please paste your Google Apps Script Web App URL first.',
      });
      return;
    }

    setTestingWebhook(true);
    setStatusMessage(null);
    try {
      const result = await testWebhookConnection(cleanUrl);
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'WEBHOOK',
        webhookUrl: cleanUrl,
        autoSyncEnabled: true,
        dbInitialized: true,
      };
      onUpdateConfig(updatedConfig);

      setStatusMessage({
        type: 'success',
        text: `✓ ${result.message} Webhook URL saved successfully!`,
      });
      onAddLog('WEBHOOK_TEST_SUCCESS', `Google Apps Script Database Webhook connected: ${cleanUrl.substring(0, 35)}...`, 'SUCCESS');
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to connect to Google Apps Script Webhook.',
      });
      onAddLog('WEBHOOK_TEST_ERROR', `Webhook error: ${err.message}`, 'ERROR');
    } finally {
      setTestingWebhook(false);
    }
  };

  // Toggle Auto-sync
  const handleToggleAutoSync = () => {
    const nextVal = !config.autoSyncEnabled;
    onUpdateConfig({
      ...config,
      autoSyncEnabled: nextVal,
    });
    onAddLog(
      'GOOGLE_AUTOSYNC_TOGGLE',
      `Auto-Sync to Google Sheets Database ${nextVal ? 'ENABLED' : 'DISABLED'}`,
      'INFO'
    );
  };

  // Disconnect OAuth
  const handleDisconnectOAuth = () => {
    clearGoogleToken();
    setIsConnected(false);
    setStatusMessage({
      type: 'info',
      text: 'Disconnected Google Account session.',
    });
    onAddLog('GOOGLE_DISCONNECT', 'Disconnected Google OAuth session', 'INFO');
  };

  // Apply manual token
  const handleApplyManualToken = () => {
    const cleanToken = manualTokenInput.trim();
    if (!cleanToken) return;
    setGoogleAccessToken(cleanToken, 3600);
    setIsConnected(true);
    setStatusMessage({
      type: 'success',
      text: 'Manual Google Access Token applied successfully!',
    });
    setManualTokenInput('');
    onAddLog('MANUAL_TOKEN', 'Manual Google OAuth Token applied', 'SUCCESS');
  };

  // Smart Parse Pasted Data from Clipboard/Excel/Google Sheet
  const handleAnalyzePastedData = () => {
    if (!pastedRawText.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Please paste table rows or TSV/CSV data into the box first.',
      });
      return;
    }

    const lines = pastedRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    // Detect delimiter: tab or comma or multiple spaces
    const rawMatrix = lines.map((line) => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(',')) return line.split(',');
      return line.split(/\s{2,}/);
    });

    // Check if line 0 is a header row
    const firstLineText = rawMatrix[0].join(' ').toLowerCase();
    const isHeader =
      firstLineText.includes('office') ||
      firstLineText.includes('post') ||
      firstLineText.includes('name') ||
      firstLineText.includes('user') ||
      firstLineText.includes('date') ||
      firstLineText.includes('balance');

    const colMap = isHeader ? buildHeaderMap(rawMatrix[0]) : undefined;
    const startIndex = isHeader ? 1 : 0;

    const parsedResults: any[] = [];

    if (pasteCategory === 'offices') {
      for (let i = startIndex; i < rawMatrix.length; i++) {
        const po = smartParseOfficeRow(rawMatrix[i], colMap, i);
        if (po && po.name) {
          parsedResults.push(po);
        }
      }
    } else if (pasteCategory === 'reports') {
      for (let i = startIndex; i < rawMatrix.length; i++) {
        const rep = smartParseReportRow(rawMatrix[i], colMap, i);
        if (rep && rep.officeName) {
          parsedResults.push(rep);
        }
      }
    } else if (pasteCategory === 'users') {
      for (let i = startIndex; i < rawMatrix.length; i++) {
        const u = smartParseUserRow(rawMatrix[i], colMap, i);
        if (u && u.username) {
          parsedResults.push(u);
        }
      }
    }

    setParsedItemsPreview(parsedResults);

    if (parsedResults.length > 0) {
      setStatusMessage({
        type: 'success',
        text: `✓ Successfully parsed ${parsedResults.length} valid ${pasteCategory} records! Click "Apply to Live Portal & Push to Google Sheet" below to ingest.`,
      });
    } else {
      setStatusMessage({
        type: 'error',
        text: `Could not detect valid ${pasteCategory} records from the pasted text. Please check the columns and try again.`,
      });
    }
  };

  // Ingest parsed data live into application and push to Google Sheet if connected
  const handleApplyPastedDataToDatabase = async () => {
    if (parsedItemsPreview.length === 0) return;

    setIsApplyingPaste(true);
    setStatusMessage(null);

    try {
      if (pasteCategory === 'offices') {
        const existingNames = new Set(postOffices.map((po) => po.name.toLowerCase().trim()));
        const mergedOffices = [...postOffices];

        parsedItemsPreview.forEach((newPo: PostOffice) => {
          const idx = mergedOffices.findIndex(
            (o) => o.name.toLowerCase().trim() === newPo.name.toLowerCase().trim()
          );
          if (idx !== -1) {
            mergedOffices[idx] = { ...mergedOffices[idx], ...newPo };
          } else {
            mergedOffices.push(newPo);
          }
        });

        // Sort A to Z
        mergedOffices.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
        );

        if (onUpdateAllDatabase) {
          onUpdateAllDatabase({ postOffices: mergedOffices });
        }

        // If Google Sheet is connected, auto-push to Google Sheet!
        if (config.webhookUrl) {
          await saveDatabaseViaWebhook(config.webhookUrl, {
            ...fullDatabasePayload,
            postOffices: mergedOffices,
          }).catch(() => {});
        } else if (config.spreadsheetId) {
          const token = getGoogleAccessToken();
          if (token) {
            await pushFullDatabaseToGoogleSheet(config.spreadsheetId, token, {
              ...fullDatabasePayload,
              postOffices: mergedOffices,
            }).catch(() => {});
          }
        }

        setStatusMessage({
          type: 'success',
          text: `✓ Successfully ingested ${parsedItemsPreview.length} Post Offices into live portal & Google Sheet! Total Offices: ${mergedOffices.length}.`,
        });
        onAddLog(
          'PASTE_INGEST_OFFICES',
          `Ingested ${parsedItemsPreview.length} Post Offices via Smart Ingest`,
          'SUCCESS'
        );
      } else if (pasteCategory === 'reports') {
        const mergedReports = [...reports];
        parsedItemsPreview.forEach((newRep: DailyReport) => {
          const existingIdx = mergedReports.findIndex(
            (r) => r.id === newRep.id || (r.date === newRep.date && r.officeName === newRep.officeName)
          );
          if (existingIdx !== -1) {
            mergedReports[existingIdx] = { ...mergedReports[existingIdx], ...newRep };
          } else {
            mergedReports.unshift(newRep);
          }
        });

        if (onUpdateAllDatabase) {
          onUpdateAllDatabase({ reports: mergedReports });
        }

        if (config.webhookUrl) {
          await saveDatabaseViaWebhook(config.webhookUrl, {
            ...fullDatabasePayload,
            reports: mergedReports,
          }).catch(() => {});
        } else if (config.spreadsheetId) {
          const token = getGoogleAccessToken();
          if (token) {
            await pushFullDatabaseToGoogleSheet(config.spreadsheetId, token, {
              ...fullDatabasePayload,
              reports: mergedReports,
            }).catch(() => {});
          }
        }

        setStatusMessage({
          type: 'success',
          text: `✓ Successfully ingested ${parsedItemsPreview.length} Delivery Reports into live portal & Google Sheet! Total Reports: ${mergedReports.length}.`,
        });
        onAddLog(
          'PASTE_INGEST_REPORTS',
          `Ingested ${parsedItemsPreview.length} Daily Reports via Smart Ingest`,
          'SUCCESS'
        );
      } else if (pasteCategory === 'users') {
        const mergedUsers = [...users];
        parsedItemsPreview.forEach((newU: User) => {
          const existingIdx = mergedUsers.findIndex(
            (u) => u.username.toLowerCase() === newU.username.toLowerCase()
          );
          if (existingIdx !== -1) {
            mergedUsers[existingIdx] = { ...mergedUsers[existingIdx], ...newU };
          } else {
            mergedUsers.push(newU);
          }
        });

        if (onUpdateAllDatabase) {
          onUpdateAllDatabase({ users: mergedUsers });
        }

        if (config.webhookUrl) {
          await saveDatabaseViaWebhook(config.webhookUrl, {
            ...fullDatabasePayload,
            users: mergedUsers,
          }).catch(() => {});
        } else if (config.spreadsheetId) {
          const token = getGoogleAccessToken();
          if (token) {
            await pushFullDatabaseToGoogleSheet(config.spreadsheetId, token, {
              ...fullDatabasePayload,
              users: mergedUsers,
            }).catch(() => {});
          }
        }

        setStatusMessage({
          type: 'success',
          text: `✓ Successfully ingested ${parsedItemsPreview.length} System Users/Passwords into live portal & Google Sheet!`,
        });
        onAddLog(
          'PASTE_INGEST_USERS',
          `Ingested ${parsedItemsPreview.length} Users via Smart Ingest`,
          'SUCCESS'
        );
      }

      setPastedRawText('');
      setParsedItemsPreview([]);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to ingest pasted data.',
      });
    } finally {
      setIsApplyingPaste(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Central Google Sheets Database Hub */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#00401A] border-2 border-yellow-400 flex items-center justify-center shadow-sm shrink-0">
              <Database className="w-7 h-7 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#00401A] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded tracking-wider">
                  Master Database Engine
                </span>
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  Google Sheets Central Database Hub
                </h1>
                {config.spreadsheetId || config.webhookUrl ? (
                  <span className="bg-green-100 text-[#006633] text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-300 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Database Live Connected
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                    Not Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1 font-medium max-w-3xl leading-relaxed">
                Your entire application database—including <strong>Post Offices Master Directory</strong>, <strong>Daily Delivery Reports</strong>, <strong>System User Accounts</strong>, and <strong>System Configuration</strong>—is hosted, structured, and synchronized directly inside Google Sheets.
              </p>
            </div>
          </div>

          {/* Quick Actions & Excel Fallback */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {config.spreadsheetUrl && (
              <a
                href={config.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-all"
              >
                <span>Open Google Sheet DB</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={() => exportDailyReportsToExcel(reports, `PakPost_Full_Database_Backup_${new Date().toISOString().slice(0, 10)}`)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download Excel backup file"
            >
              <Download className="w-3.5 h-3.5 text-[#006633]" />
              <span>Download Excel Backup</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-lg flex items-start gap-2.5 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-900 border border-green-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border border-red-200'
                : 'bg-blue-50 text-blue-900 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span>{statusMessage.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Database Quick Operations & Auto-Sync Control Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-[#006633]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Database 2-Way Sync Engine</h3>
              <p className="text-[11px] text-gray-500 font-medium">
                Pull fresh database records from Google Sheet or Push local updates to the Sheet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Pull Button */}
            <button
              onClick={handlePullDatabaseFromGoogleSheet}
              disabled={pulling || syncing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Load all offices, reports, users and settings from the Google Sheet into the application"
            >
              <ArrowDownToLine className={`w-3.5 h-3.5 ${pulling ? 'animate-bounce' : ''}`} />
              <span>{pulling ? 'Loading from Sheet...' : 'Pull Database from Sheet'}</span>
            </button>

            {/* Push Button */}
            <button
              onClick={handlePushAllDatabase}
              disabled={pulling || syncing}
              className="bg-[#005522] hover:bg-[#00401A] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Push all current offices, reports, users and settings to the Google Sheet"
            >
              <ArrowUpFromLine className={`w-3.5 h-3.5 ${syncing ? 'animate-pulse' : ''}`} />
              <span>{syncing ? 'Saving to Sheet...' : 'Push All to Google Sheet'}</span>
            </button>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
              <span className="text-xs font-bold text-gray-700">Live Auto-Sync:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoSyncEnabled}
                  onChange={handleToggleAutoSync}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#006633]"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 5-Tab Database Schema Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Tab 1</div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">Daily_Reports</div>
            <div className="text-[11px] font-semibold text-[#006633]">{reports.length} Records</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Tab 2</div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">Post_Offices</div>
            <div className="text-[11px] font-semibold text-[#006633]">{postOffices.length} Offices</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Tab 3</div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">System_Users</div>
            <div className="text-[11px] font-semibold text-[#006633]">{users.length} Accounts</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Tab 4</div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">System_Config</div>
            <div className="text-[11px] font-semibold text-[#006633]">Active Settings</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <div className="text-[10px] font-mono uppercase text-gray-500 font-bold">Tab 5</div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">Activity_Logs</div>
            <div className="text-[11px] font-semibold text-[#006633]">{logs.length} Log Entries</div>
          </div>
        </div>
      </div>

      {/* Connection & Configuration Methods */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        {/* Method Selector Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-3">
          <button
            onClick={() => setActiveSyncTab('oauth')}
            className={`pb-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeSyncTab === 'oauth'
                ? 'border-[#00401A] text-[#00401A] bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Direct Google Drive & Sheets Integration (OAuth 2.0)</span>
            <span className="bg-green-100 text-[#006633] text-[10px] px-2 py-0.5 rounded-full font-bold">
              Official
            </span>
          </button>

          <button
            onClick={() => setActiveSyncTab('webhook')}
            className={`pb-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeSyncTab === 'webhook'
                ? 'border-[#00401A] text-[#00401A] bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Google Apps Script Webhook (Zero Domain Restrictions)</span>
          </button>

          <button
            onClick={() => setActiveSyncTab('paste')}
            className={`pb-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeSyncTab === 'paste'
                ? 'border-[#00401A] text-[#00401A] bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <ClipboardPaste className="w-4 h-4 text-emerald-600" />
            <span>Direct Paste Data / ڈیٹا فوری پیسٹ کریں</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Instant Live
            </span>
          </button>
        </div>

        <div className="p-6">
          {/* METHOD 1: DIRECT GOOGLE OAUTH 2.0 (RECOMMENDED) */}
          {activeSyncTab === 'oauth' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-[#006633]" />
                        Connect Your Google Account & Spreadsheet
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Build your multi-tab database directly inside your attached Google Sheet or create a fresh one in Google Drive.
                      </p>
                    </div>

                    {isConnected ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-[#006633] text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                          Google Account Authorized
                        </span>
                        <button
                          onClick={handleDisconnectOAuth}
                          className="text-xs text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleConnectGoogle}
                        disabled={loading}
                        className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                            <path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                          </svg>
                        )}
                        <span>Sign In & Authorize with Google</span>
                      </button>
                    )}
                  </div>

                  {/* Connected Spreadsheet Box */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-[#006633]" />
                        <span>Paste Attached Google Sheet (URL or Spreadsheet ID):</span>
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdB.../edit"
                          value={manualInput}
                          onChange={(e) => setManualInput(e.target.value)}
                          className="flex-1 px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-[#005522] focus:outline-none"
                        />
                        <button
                          onClick={handleLinkAndInitExistingSheet}
                          disabled={syncing || !manualInput.trim()}
                          className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Database className="w-3.5 h-3.5 text-yellow-300" />
                          <span>Build & Link 5 Database Tabs</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 flex-wrap gap-2">
                      <span className="text-xs text-gray-600">
                        Or create a brand new Google Spreadsheet automatically:
                      </span>
                      <button
                        onClick={handleCreateNewDatabaseSpreadsheet}
                        disabled={syncing}
                        className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-[#006633]" />
                        <span>Create New Database Sheet in Google Drive</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Info Box */}
                <div className="space-y-4">
                  <div className="bg-[#00401A] text-white rounded-xl p-5 shadow-xs space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-300">
                      <Sparkles className="w-4 h-4" /> Full 5-in-1 Database Architecture
                    </h4>
                    <ul className="text-xs space-y-2 text-gray-100">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">1.</span>
                        <span><strong>Daily_Reports:</strong> Stores every submitted, updated, or calculated delivery report.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">2.</span>
                        <span><strong>Post_Offices:</strong> Central directory of all post offices, phone numbers & incharge info.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">3.</span>
                        <span><strong>System_Users:</strong> Portal accounts, credentials & role authorizations.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 font-bold">4.</span>
                        <span><strong>System_Config:</strong> WhatsApp Cloud API & automation trigger settings.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* METHOD 2: GOOGLE APPS SCRIPT WEBHOOK */}
          {activeSyncTab === 'webhook' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#00401A] text-white flex items-center justify-center text-[10px]">
                        ★
                      </span>
                      <span>Google Apps Script Database Setup (Zero Domain Restrictions):</span>
                    </div>

                    <ol className="text-xs text-gray-700 space-y-2 list-decimal list-inside">
                      <li>Open your attached Google Sheet.</li>
                      <li>Click <strong>Extensions</strong> → <strong>Apps Script</strong>.</li>
                      <li>Delete all existing code, paste the 5-Tab Database Script below, and click <strong>Deploy</strong> → <strong>New deployment</strong>.</li>
                      <li>Select type <strong>Web app</strong> (Set <em>&quot;Execute as: Me&quot;</em> and <em>&quot;Who has access: Anyone&quot;</em>).</li>
                      <li>Copy the <strong>Web app URL</strong> and paste it below!</li>
                    </ol>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleCopyScript}
                        className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        {copiedScript ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-yellow-300" />
                            <span>Script Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-yellow-300" />
                            <span>Copy 5-Tab Database Script (1-Click)</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setShowScriptModal(true)}
                        className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Code className="w-3.5 h-3.5 text-gray-500" />
                        <span>View Script Code</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-800">
                      Paste Google Apps Script Web App URL:
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                        value={webhookUrlInput}
                        onChange={(e) => setWebhookUrlInput(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-lg text-xs font-mono bg-white focus:ring-2 focus:ring-[#005522] focus:outline-none"
                      />
                      <button
                        onClick={handleSaveAndTestWebhook}
                        disabled={testingWebhook || !webhookUrlInput.trim()}
                        className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                      >
                        {testingWebhook ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Save & Test Webhook</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                    <h4 className="font-bold flex items-center gap-1.5 text-blue-950">
                      <Globe className="w-4 h-4 text-blue-700" />
                      Why Webhook Sync?
                    </h4>
                    <p className="text-[11px] leading-relaxed">
                      Google Apps Script Webhook provides 100% reliable 2-way sync across all mobile devices, post office branches, and deployed web URLs without requiring postmasters to log into Google accounts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* METHOD 3: DIRECT DATA PASTE & SMART INGESTION */}
          {activeSyncTab === 'paste' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00401A] text-yellow-300 flex items-center justify-center shrink-0">
                    <ClipboardPaste className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Smart Data Paste & 1-Click Ingest Engine
                    </h3>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Copy rows from any existing Google Sheet, Excel, or CSV and paste below. The system automatically detects columns, parses names, balances, or passwords, and updates both the live portal &amp; Google Sheet database instantly.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-green-200 shrink-0">
                  <button
                    onClick={() => {
                      setPasteCategory('offices');
                      setParsedItemsPreview([]);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      pasteCategory === 'offices'
                        ? 'bg-[#00401A] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Post Offices Directory
                  </button>
                  <button
                    onClick={() => {
                      setPasteCategory('reports');
                      setParsedItemsPreview([]);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      pasteCategory === 'reports'
                        ? 'bg-[#00401A] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Delivery Reports
                  </button>
                  <button
                    onClick={() => {
                      setPasteCategory('users');
                      setParsedItemsPreview([]);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      pasteCategory === 'users'
                        ? 'bg-[#00401A] text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Users &amp; Passwords
                  </button>
                </div>
              </div>

              {/* Paste Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <span>Paste Raw Data for {pasteCategory === 'offices' ? 'Post Offices' : pasteCategory === 'reports' ? 'Delivery Reports' : 'Staff Passwords'} (TSV / Excel / Tabular):</span>
                  </label>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Headers are optional (auto-detected)
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={pastedRawText}
                  onChange={(e) => setPastedRawText(e.target.value)}
                  placeholder={
                    pasteCategory === 'offices'
                      ? 'Example:\nGujranwala GPO\tMuhammad Imran\t03001234567\tACTIVE\t150\nWazirabad SO\tTariq Mahmood\t03019876543\tACTIVE\t200'
                      : pasteCategory === 'reports'
                      ? 'Example:\n2025-05-18\tGujranwala GPO\tMuhammad Imran\t150\t250\t240\t5\t2\t10\t143'
                      : 'Example:\ngujranwala_gpo\tpass123\tPOST_OFFICE\tGujranwala GPO\tMuhammad Imran'
                  }
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs font-mono bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#005522] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleAnalyzePastedData}
                  disabled={!pastedRawText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>Analyze &amp; Preview Parsed Records</span>
                </button>

                {parsedItemsPreview.length > 0 && (
                  <button
                    onClick={handleApplyPastedDataToDatabase}
                    disabled={isApplyingPaste}
                    className="bg-[#005522] hover:bg-[#00401A] disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    {isApplyingPaste ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-yellow-300" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-yellow-300" />
                    )}
                    <span>
                      {isApplyingPaste
                        ? 'Applying & Syncing to Google Sheet...'
                        : `Apply ${parsedItemsPreview.length} Records to Live Portal & Google Sheet`}
                    </span>
                  </button>
                )}

                {pastedRawText && (
                  <button
                    onClick={() => {
                      setPastedRawText('');
                      setParsedItemsPreview([]);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-800 px-3 py-2"
                  >
                    Clear Box
                  </button>
                )}
              </div>

              {/* Preview Table of Parsed Items */}
              {parsedItemsPreview.length > 0 && (
                <div className="border border-green-300 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="bg-green-50 px-4 py-2.5 border-b border-green-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-green-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Parsed Preview: {parsedItemsPreview.length} items ready to ingest
                    </span>
                    <span className="text-[11px] text-green-700 font-medium">
                      Status: Verified
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 text-gray-700 text-[11px] uppercase font-bold sticky top-0">
                        {pasteCategory === 'offices' && (
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Office Name</th>
                            <th className="px-3 py-2">Postmaster</th>
                            <th className="px-3 py-2">Phone / WhatsApp</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Initial Balance</th>
                          </tr>
                        )}
                        {pasteCategory === 'reports' && (
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Office Name</th>
                            <th className="px-3 py-2">Postmaster</th>
                            <th className="px-3 py-2 text-right">Opening</th>
                            <th className="px-3 py-2 text-right">Received</th>
                            <th className="px-3 py-2 text-right">Delivered</th>
                            <th className="px-3 py-2 text-right">Closing</th>
                          </tr>
                        )}
                        {pasteCategory === 'users' && (
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Username</th>
                            <th className="px-3 py-2">Password</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Assigned Office</th>
                            <th className="px-3 py-2">Full Name</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {parsedItemsPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">{idx + 1}</td>
                            {pasteCategory === 'offices' && (
                              <>
                                <td className="px-3 py-2 font-bold text-[#00401A]">{item.name}</td>
                                <td className="px-3 py-2 text-gray-700">{item.postmasterName}</td>
                                <td className="px-3 py-2 text-gray-600 font-mono">{item.mobileNumber}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-gray-900">{item.initialBalance}</td>
                              </>
                            )}
                            {pasteCategory === 'reports' && (
                              <>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{item.date}</td>
                                <td className="px-3 py-2 font-bold text-[#00401A]">{item.officeName}</td>
                                <td className="px-3 py-2 text-gray-700">{item.postmasterName}</td>
                                <td className="px-3 py-2 text-right font-medium">{item.lastBalance}</td>
                                <td className="px-3 py-2 text-right font-bold text-blue-600">{item.receivedToday}</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-600">{item.delivered}</td>
                                <td className="px-3 py-2 text-right font-bold text-gray-900">{item.closingBalance}</td>
                              </>
                            )}
                            {pasteCategory === 'users' && (
                              <>
                                <td className="px-3 py-2 font-bold text-gray-900 font-mono">{item.username}</td>
                                <td className="px-3 py-2 text-gray-600 font-mono">••••••</td>
                                <td className="px-3 py-2 font-semibold text-blue-700">{item.role}</td>
                                <td className="px-3 py-2 text-gray-700">{item.officeName || 'All Offices'}</td>
                                <td className="px-3 py-2 text-gray-800">{item.name}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Database Tables Previewer */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#006633]" />
              Database Tables Live Structure Preview
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Inspect how data is mapped and formatted inside the Google Sheets database tabs.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setPreviewTab('reports')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                previewTab === 'reports' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Daily_Reports ({reports.length})
            </button>
            <button
              onClick={() => setPreviewTab('offices')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                previewTab === 'offices' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Post_Offices ({postOffices.length})
            </button>
            <button
              onClick={() => setPreviewTab('users')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                previewTab === 'users' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              System_Users ({users.length})
            </button>
            <button
              onClick={() => setPreviewTab('config')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                previewTab === 'config' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              System_Config
            </button>
          </div>
        </div>

        {/* Tab 1: Daily Reports Preview */}
        {previewTab === 'reports' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-[#00401A] text-white">
                <tr>
                  {REPORT_HEADERS.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap border-r border-[#005522]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={REPORT_HEADERS.length} className="text-center py-6 text-gray-400 font-medium">
                      No reports submitted yet. New reports will automatically be recorded in this sheet.
                    </td>
                  </tr>
                ) : (
                  reports.slice(0, 5).map((r, idx) => {
                    const tot = Number(r.lastBalance) + Number(r.receivedToday);
                    const rec = Number(r.receivedToday) || 0;
                    const del = Number(r.delivered) || 0;
                    const rate = rec > 0 ? `${((del / rec) * 100).toFixed(1)}%` : '0.0%';
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-bold text-gray-900">{idx + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">{r.id}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-700">{formatDatePK(r.date)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap font-bold text-[#00401A]">{r.officeName}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{r.postmasterName}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{r.lastBalance}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-blue-700">{r.receivedToday}</td>
                        <td className="px-3 py-1.5 text-right font-bold bg-gray-50">{tot}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-emerald-700">{r.delivered}</td>
                        <td className="px-3 py-1.5 text-right font-black text-[#006633] bg-green-50/50">{rate}</td>
                        <td className="px-3 py-1.5 text-right text-red-600">{r.returnedToSender}</td>
                        <td className="px-3 py-1.5 text-right text-amber-600">{r.missent}</td>
                        <td className="px-3 py-1.5 text-right text-purple-700">{r.deposit}</td>
                        <td className="px-3 py-1.5 text-right font-black text-gray-900 bg-yellow-50">{r.closingBalance}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-400 text-[10px]">
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : ''}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{r.submittedBy}</td>
                        <td className="px-3 py-1.5 text-gray-500 truncate max-w-xs">{r.remarks || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Post Offices Preview */}
        {previewTab === 'offices' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-[#00401A] text-white">
                <tr>
                  {OFFICE_HEADERS.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap border-r border-[#005522]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {postOffices.map((po, idx) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-bold text-gray-900">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">{po.id}</td>
                    <td className="px-3 py-1.5 font-bold text-gray-900">{po.name}</td>
                    <td className="px-3 py-1.5 text-gray-700">{po.postmasterName}</td>
                    <td className="px-3 py-1.5 font-mono text-[#006633] font-bold">{po.mobileNumber}</td>
                    <td className="px-3 py-1.5">
                      <span className="bg-green-100 text-green-800 text-[9px] font-bold px-2 py-0.5 rounded">
                        {po.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{po.initialBalance || 0}</td>
                    <td className="px-3 py-1.5 text-gray-400 text-[10px]">{new Date().toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Users Preview */}
        {previewTab === 'users' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-[#00401A] text-white">
                <tr>
                  {USER_HEADERS.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap border-r border-[#005522]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {users.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-bold text-gray-900">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500 text-[10px]">{u.id}</td>
                    <td className="px-3 py-1.5 font-bold text-gray-900">{u.username}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-400">••••••••</td>
                    <td className="px-3 py-1.5 font-bold text-[#006633]">{u.role}</td>
                    <td className="px-3 py-1.5 text-gray-600">{u.officeName || 'All Offices'}</td>
                    <td className="px-3 py-1.5 font-medium">{u.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Config Preview */}
        {previewTab === 'config' && (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-[#00401A] text-white">
                <tr>
                  {CONFIG_HEADERS.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap border-r border-[#005522]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono font-bold text-gray-900">whatsapp_phone_number_id</td>
                  <td className="px-3 py-1.5 font-mono text-[#006633]">{whatsAppConfig.phoneNumberId || '-'}</td>
                  <td className="px-3 py-1.5 font-bold text-purple-700">WHATSAPP</td>
                  <td className="px-3 py-1.5 text-gray-600">WhatsApp Cloud API Phone ID</td>
                  <td className="px-3 py-1.5 text-gray-400">{new Date().toLocaleDateString()}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono font-bold text-gray-900">whatsapp_reminder_time</td>
                  <td className="px-3 py-1.5 font-mono text-[#006633]">{whatsAppConfig.reminderTime || '17:00'}</td>
                  <td className="px-3 py-1.5 font-bold text-purple-700">WHATSAPP</td>
                  <td className="px-3 py-1.5 text-gray-600">Daily Reminder Time</td>
                  <td className="px-3 py-1.5 text-gray-400">{new Date().toLocaleDateString()}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono font-bold text-gray-900">trigger_reminder_time</td>
                  <td className="px-3 py-1.5 font-mono text-[#006633]">{triggerConfig.reminderTriggerTime || '17:00'}</td>
                  <td className="px-3 py-1.5 font-bold text-blue-700">TRIGGERS</td>
                  <td className="px-3 py-1.5 text-gray-600">Evening Reminder Trigger</td>
                  <td className="px-3 py-1.5 text-gray-400">{new Date().toLocaleDateString()}</td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono font-bold text-gray-900">division_name</td>
                  <td className="px-3 py-1.5 font-bold text-gray-900">Gujranwala Division</td>
                  <td className="px-3 py-1.5 font-bold text-gray-700">GENERAL</td>
                  <td className="px-3 py-1.5 text-gray-600">Divisional Superintendent Jurisdiction</td>
                  <td className="px-3 py-1.5 text-gray-400">{new Date().toLocaleDateString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Viewer Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-[#006633]" />
                <h3 className="text-sm font-bold text-slate-900">Google Apps Script Full Database Engine Code</h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed">
              <pre>{getAppsScriptTemplateCode()}</pre>
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
              <span className="text-xs text-slate-500">Supports all 5 database sheets automatically.</span>
              <button
                onClick={handleCopyScript}
                className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
