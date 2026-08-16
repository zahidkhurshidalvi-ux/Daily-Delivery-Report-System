import React, { useState, useEffect } from 'react';
import { DailyReport, GoogleSheetsConfig } from '../types';
import { formatDatePK } from '../utils/calculations';
import {
  requestGoogleOAuthToken,
  getGoogleAccessToken,
  clearGoogleToken,
  setGoogleAccessToken,
  createPakistanPostSpreadsheet,
  bulkSyncReportsToGoogleSheet,
  getSpreadsheetMetadata,
  extractSpreadsheetId,
  REPORT_HEADERS,
  getAppsScriptTemplateCode,
  testWebhookConnection,
  bulkSyncViaWebhook,
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
  FileCheck,
  Sparkles,
  Copy,
  Code,
  Globe,
  Lock,
  Download,
  HelpCircle,
} from 'lucide-react';

interface GoogleSheetsManagerProps {
  reports: DailyReport[];
  config: GoogleSheetsConfig;
  onUpdateConfig: (newConfig: GoogleSheetsConfig) => void;
  onAddLog: (action: string, details: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR') => void;
}

export const GoogleSheetsManager: React.FC<GoogleSheetsManagerProps> = ({
  reports,
  config,
  onUpdateConfig,
  onAddLog,
}) => {
  const [activeSyncTab, setActiveSyncTab] = useState<'webhook' | 'oauth'>('webhook');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Webhook State
  const [webhookUrlInput, setWebhookUrlInput] = useState<string>(config.webhookUrl || '');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);

  // Direct OAuth State
  const [manualInput, setManualInput] = useState<string>(config.spreadsheetId || '');
  const [customClientId, setCustomClientId] = useState<string>(config.customClientId || '');
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [showAdvancedOAuth, setShowAdvancedOAuth] = useState<boolean>(false);

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

  // Current domain detection for troubleshooting
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'deployed-app';

  // 1. Copy Apps Script Code to Clipboard
  const handleCopyScript = () => {
    const code = getAppsScriptTemplateCode();
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
    onAddLog('SCRIPT_COPY', 'Copied Google Apps Script sync code to clipboard', 'INFO');
  };

  // 2. Test & Save Webhook Connection
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
      };
      onUpdateConfig(updatedConfig);

      setStatusMessage({
        type: 'success',
        text: `✓ ${result.message} Webhook URL saved successfully!`,
      });
      onAddLog('WEBHOOK_TEST_SUCCESS', `Google Apps Script Webhook connected: ${cleanUrl.substring(0, 35)}...`, 'SUCCESS');
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

  // 3. Bulk Sync Reports via Webhook
  const handleBulkSyncWebhook = async () => {
    const cleanUrl = webhookUrlInput.trim() || config.webhookUrl;
    if (!cleanUrl) {
      setStatusMessage({
        type: 'error',
        text: 'Please configure and save the Google Apps Script Web App URL first.',
      });
      return;
    }

    setSyncing(true);
    setStatusMessage(null);
    try {
      await bulkSyncViaWebhook(cleanUrl, reports);
      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'WEBHOOK',
        webhookUrl: cleanUrl,
        lastSyncedAt: now,
      };
      onUpdateConfig(updatedConfig);

      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${reports.length} daily reports to your Google Spreadsheet via Webhook!`,
      });
      onAddLog('WEBHOOK_BULK_SYNC', `Bulk synced ${reports.length} reports to Google Sheet via Webhook`, 'SUCCESS');
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to sync reports via Webhook.',
      });
      onAddLog('WEBHOOK_SYNC_ERROR', `Webhook sync error: ${err.message}`, 'ERROR');
    } finally {
      setSyncing(false);
    }
  };

  // 4. Direct OAuth: Authorize with Google
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
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to authenticate with Google.',
      });
      onAddLog('GOOGLE_AUTH_ERR', `OAuth error: ${err.message || 'Unknown'}`, 'ERROR');
    } finally {
      setLoading(false);
    }
  };

  // 5. Manual Access Token Apply
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

  // 6. Disconnect OAuth
  const handleDisconnectOAuth = () => {
    clearGoogleToken();
    setIsConnected(false);
    setStatusMessage({
      type: 'info',
      text: 'Disconnected Google Account OAuth session.',
    });
    onAddLog('GOOGLE_DISCONNECT', 'Disconnected Google OAuth session', 'INFO');
  };

  // 7. Create New Spreadsheet via OAuth
  const handleCreateNewSheetOAuth = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      const { spreadsheetId, spreadsheetUrl } = await createPakistanPostSpreadsheet(
        `Pakistan Post - Daily Delivery Reports (${new Date().toLocaleDateString('en-GB')})`,
        token
      );

      if (reports.length > 0) {
        await bulkSyncReportsToGoogleSheet(spreadsheetId, reports, token);
      }

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'OAUTH',
        spreadsheetId,
        spreadsheetUrl,
        spreadsheetTitle: `Pakistan Post - Daily Delivery Reports (${new Date().toLocaleDateString('en-GB')})`,
        lastSyncedAt: now,
        sheetName: 'Daily Delivery Reports',
      };

      onUpdateConfig(updatedConfig);
      setManualInput(spreadsheetId);
      setStatusMessage({
        type: 'success',
        text: `Created new Google Spreadsheet with ${reports.length} reports synced!`,
      });
      onAddLog(
        'GOOGLE_SHEET_CREATED',
        `Created official Google Spreadsheet: ${spreadsheetId} (${reports.length} rows)`,
        'SUCCESS'
      );
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to create Google Spreadsheet.',
      });
      onAddLog('GOOGLE_SHEET_ERROR', `Creation failed: ${err.message}`, 'ERROR');
    } finally {
      setSyncing(false);
    }
  };

  // 8. Sync via Direct OAuth
  const handleSyncAllReportsOAuth = async () => {
    const targetId = extractSpreadsheetId(manualInput || config.spreadsheetId || '');
    if (!targetId) {
      setStatusMessage({
        type: 'error',
        text: 'Please create a new spreadsheet or enter an existing Google Sheet ID / URL first.',
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
      const sheetName = config.sheetName || meta.sheetNames[0] || 'Daily Delivery Reports';

      await bulkSyncReportsToGoogleSheet(targetId, reports, token, sheetName);

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'OAUTH',
        spreadsheetId: targetId,
        spreadsheetUrl: meta.url,
        spreadsheetTitle: meta.title,
        lastSyncedAt: now,
        sheetName,
      };

      onUpdateConfig(updatedConfig);
      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${reports.length} daily reports to "${meta.title}"!`,
      });
      onAddLog(
        'GOOGLE_SHEET_SYNC',
        `Bulk synced ${reports.length} reports to Google Sheet "${meta.title}"`,
        'SUCCESS'
      );
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to sync to Google Sheet.',
      });
      onAddLog('GOOGLE_SYNC_ERROR', `Sync error: ${err.message}`, 'ERROR');
    } finally {
      setSyncing(false);
    }
  };

  // 9. Link Existing Sheet via OAuth
  const handleLinkExistingOAuth = async () => {
    const targetId = extractSpreadsheetId(manualInput);
    if (!targetId) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter a valid Google Spreadsheet URL or Sheet ID.',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleOAuthToken(customClientId || undefined);
        setIsConnected(true);
      }

      const meta = await getSpreadsheetMetadata(targetId, token);
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        syncMethod: 'OAUTH',
        spreadsheetId: targetId,
        spreadsheetUrl: meta.url,
        spreadsheetTitle: meta.title,
        sheetName: meta.sheetNames[0] || 'Daily Delivery Reports',
      };

      onUpdateConfig(updatedConfig);
      setStatusMessage({
        type: 'success',
        text: `Connected to Google Spreadsheet: "${meta.title}"!`,
      });
      onAddLog('GOOGLE_LINK', `Linked existing Google Sheet: ${meta.title}`, 'SUCCESS');
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to connect to specified Google Sheet.',
      });
    } finally {
      setLoading(false);
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
      `Auto-Sync to Google Sheets ${nextVal ? 'ENABLED' : 'DISABLED'}`,
      'INFO'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">Google Sheets Live Integration</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Deployed Sync Engine
                </span>
                {config.webhookUrl && (
                  <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Webhook Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Automatically backup and sync all Pakistan Post daily delivery reports in Google Sheets on any device or deployed domain.
              </p>
            </div>
          </div>

          {/* Quick Actions / Download Direct Excel File */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportDailyReportsToExcel(reports, `PakPost_Reports_Backup_${new Date().toISOString().slice(0, 10)}`)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download Excel file to upload to Google Drive"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Download Excel Backup</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-start gap-2.5 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border border-red-200'
                : 'bg-blue-50 text-blue-900 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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

      {/* Integration Method Selector Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-3 shadow-xs">
        <button
          onClick={() => setActiveSyncTab('webhook')}
          className={`pb-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeSyncTab === 'webhook'
              ? 'border-[#00401A] text-[#00401A]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Method 1: Google Apps Script Webhook (100% Guaranteed for Deployed App)</span>
          <span className="bg-emerald-100 text-[#00401A] text-[10px] px-2 py-0.5 rounded-full font-bold">
            Recommended
          </span>
        </button>

        <button
          onClick={() => setActiveSyncTab('oauth')}
          className={`pb-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeSyncTab === 'oauth'
              ? 'border-[#00401A] text-[#00401A]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Method 2: Direct Google OAuth 2.0 (Sign in with Google)</span>
        </button>
      </div>

      {/* METHOD 1: GOOGLE APPS SCRIPT WEBHOOK (RECOMMENDED) */}
      {activeSyncTab === 'webhook' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Step-by-Step Webhook Setup */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-700" />
                  Connect Google Sheets Webhook (No Domain Setup Needed)
                </h2>
                {config.webhookUrl && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-md border border-emerald-200 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Webhook Connected
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Google Apps Script Webhooks allow your deployed Pakistan Post web application to live-sync reports directly to your Google Sheet without popup blocking, iframe restrictions, or Firebase domain whitelisting issues.
              </p>

              {/* 4 Quick Steps */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#00401A] text-white flex items-center justify-center text-[10px]">
                    ★
                  </span>
                  <span>4-Step Setup Guide (Takes 60 Seconds):</span>
                </div>

                <ol className="text-xs text-slate-700 space-y-2.5 list-decimal list-inside">
                  <li className="leading-snug">
                    Create a new spreadsheet at{' '}
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-0.5"
                    >
                      sheets.new <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li className="leading-snug">
                    Click <strong>Extensions</strong> → <strong>Apps Script</strong> in the top menu of your Google Sheet.
                  </li>
                  <li className="leading-snug">
                    Delete existing code, paste the script below, and click <strong>Deploy</strong> → <strong>New deployment</strong> → Select type <strong>Web app</strong> (Set <em>&quot;Execute as: Me&quot;</em> and <em>&quot;Who has access: Anyone&quot;</em>).
                  </li>
                  <li className="leading-snug">
                    Copy the <strong>Web app URL</strong> and paste it into the box below!
                  </li>
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
                        <span>Copy Apps Script Code (1-Click)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowScriptModal(true)}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Script Code</span>
                  </button>
                </div>
              </div>

              {/* Webhook URL Input & Actions */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-800">
                  Paste Google Apps Script Web App URL:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#00401A] focus:border-transparent"
                  />
                  <button
                    onClick={handleSaveAndTestWebhook}
                    disabled={testingWebhook || !webhookUrlInput.trim()}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    {testingWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-yellow-400" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Test & Save URL</span>
                  </button>
                </div>

                {config.webhookUrl && (
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleBulkSyncWebhook}
                      disabled={syncing}
                      className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Syncing...' : `Sync All ${reports.length} Reports Now`}</span>
                    </button>

                    <span className="text-xs text-slate-500">
                      Last synced:{' '}
                      <strong>
                        {config.lastSyncedAt
                          ? new Date(config.lastSyncedAt).toLocaleString('en-GB')
                          : 'Not synced yet'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Google Sheets Live Schema Preview */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  Google Sheets Formatted Schema ({REPORT_HEADERS.length} Columns)
                </h3>
                <span className="text-[11px] text-slate-500">Delivery % included</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
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
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {reports.slice(0, 3).map((r, idx) => {
                      const tot = Number(r.lastBalance) + Number(r.receivedToday);
                      const rec = Number(r.receivedToday) || 0;
                      const del = Number(r.delivered) || 0;
                      const rate = rec > 0 ? `${((del / rec) * 100).toFixed(1)}%` : '0.0%';
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-bold text-slate-900">{idx + 1}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap font-medium text-slate-700">{formatDatePK(r.date)}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap font-bold text-emerald-900">{r.officeName}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{r.postmasterName}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{r.lastBalance}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-blue-700">{r.receivedToday}</td>
                          <td className="px-3 py-1.5 text-right font-bold bg-slate-50">{tot}</td>
                          <td className="px-3 py-1.5 text-right font-bold text-emerald-700">{r.delivered}</td>
                          <td className="px-3 py-1.5 text-right font-black text-[#006633] bg-emerald-50/50">{rate}</td>
                          <td className="px-3 py-1.5 text-right text-red-600">{r.returnedToSender}</td>
                          <td className="px-3 py-1.5 text-right text-amber-600">{r.missent}</td>
                          <td className="px-3 py-1.5 text-right text-purple-700">{r.deposit}</td>
                          <td className="px-3 py-1.5 text-right font-black text-slate-900 bg-yellow-50">{r.closingBalance}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-400 text-[10px]">
                            {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : ''}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">{r.submittedBy}</td>
                          <td className="px-3 py-1.5 text-slate-500 truncate max-w-xs">{r.remarks || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Real-time Auto-sync & Benefits */}
          <div className="space-y-6">
            {/* Real-time Toggle */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-800">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Real-Time Auto-Sync</h3>
                    <p className="text-[11px] text-slate-500">Live append on form submit</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoSyncEnabled}
                    onChange={handleToggleAutoSync}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00401A]"></div>
                </label>
              </div>

              <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
                {config.autoSyncEnabled ? (
                  <div className="flex items-start gap-2 text-emerald-800 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Live Sync Active:</strong> Whenever any Post Office submits a delivery report, it will be automatically transmitted to your connected Google Sheet.
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500">
                    Auto-sync is disabled. You can manually sync reports whenever needed.
                  </span>
                )}
              </div>
            </div>

            {/* Why Webhook is Best for Deployed Apps */}
            <div className="bg-emerald-950 text-white rounded-xl p-5 shadow-xs space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-300">
                <Sparkles className="w-4 h-4" /> Why Webhook is Recommended?
              </h4>
              <ul className="text-xs space-y-2 text-emerald-100">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span><strong>Zero Domain Restrictions:</strong> Works on your deployed URL (<span className="text-yellow-200 font-mono text-[10px]">{currentHostname}</span>) without Firebase console errors.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span><strong>No Login Popups:</strong> Post offices can submit reports without needing Google login permissions.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">✓</span>
                  <span><strong>Automatic Formatting:</strong> Colors headers and computes delivery percentages automatically.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* METHOD 2: DIRECT GOOGLE OAUTH 2.0 */}
      {activeSyncTab === 'oauth' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-700" />
                    Direct Google OAuth 2.0 Authorization
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Connect your personal Google Account to create and sync spreadsheets in Google Drive.
                  </p>
                </div>

                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Google Connected
                    </span>
                    <button
                      onClick={handleDisconnectOAuth}
                      className="text-xs text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={loading}
                    className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
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
                    <span>Authorize with Google</span>
                  </button>
                )}
              </div>

              {/* Connected Spreadsheet Card */}
              {config.spreadsheetId ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                        Spreadsheet Title
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {config.spreadsheetTitle || 'Pakistan Post - Daily Delivery Reports'}
                      </div>
                    </div>

                    <a
                      href={config.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors shrink-0"
                    >
                      <span>Open in Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={handleSyncAllReportsOAuth}
                      disabled={syncing}
                      className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>{syncing ? 'Syncing...' : `Sync All ${reports.length} Reports Now`}</span>
                    </button>

                    <button
                      onClick={handleCreateNewSheetOAuth}
                      disabled={syncing}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Create Fresh Spreadsheet</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs text-slate-600">
                    Authorize your Google Account above, then click below to create an official Google Sheet:
                  </p>
                  <button
                    onClick={handleCreateNewSheetOAuth}
                    disabled={syncing}
                    className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-yellow-400" />
                    <span>Create Official Google Sheet (1-Click)</span>
                  </button>
                </div>
              )}

              {/* Link Existing Spreadsheet */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Link className="w-3.5 h-3.5 text-slate-500" />
                  <span>Or Link Existing Google Sheet (URL or ID):</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdB.../edit"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#00401A]"
                  />
                  <button
                    onClick={handleLinkExistingOAuth}
                    disabled={loading || !manualInput.trim()}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                  >
                    Connect Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Deployed Domain Diagnostics & Fallback */}
          <div className="space-y-6">
            {/* Domain Troubleshooting Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-3">
              <h4 className="font-bold flex items-center gap-1.5 text-amber-950">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                Deployed Domain Notice
              </h4>
              <p className="text-[11px] leading-relaxed">
                If the Google Sign-in popup fails on your deployed site (<strong>{currentHostname}</strong>) with an <em>&quot;unauthorized-domain&quot;</em> error, switch to <strong>Method 1 (Apps Script Webhook)</strong> tab which works 100% without domain approval!
              </p>
              <div className="bg-white p-2.5 rounded border border-amber-200 text-[10px] font-mono break-all">
                Your Domain: <strong>{currentHostname}</strong>
              </div>
            </div>

            {/* Advanced Token / Custom Client ID */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
              <button
                onClick={() => setShowAdvancedOAuth(!showAdvancedOAuth)}
                className="text-xs font-bold text-slate-700 flex items-center justify-between w-full"
              >
                <span>Advanced: Manual Token / Client ID</span>
                <span className="text-slate-400">{showAdvancedOAuth ? '▲' : '▼'}</span>
              </button>

              {showAdvancedOAuth && (
                <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Direct Google Access Token (Temporary/OAuth Playground):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ya29.a0AfH6..."
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded text-xs font-mono"
                      />
                      <button
                        onClick={handleApplyManualToken}
                        className="bg-[#00401A] text-white text-xs font-bold px-3 py-1.5 rounded"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Custom Google Cloud Client ID:
                    </label>
                    <input
                      type="text"
                      placeholder="your-app.apps.googleusercontent.com"
                      value={customClientId}
                      onChange={(e) => {
                        setCustomClientId(e.target.value);
                        onUpdateConfig({ ...config, customClientId: e.target.value });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code Viewer Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Google Apps Script Code</h3>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-slate-900 text-slate-100 text-xs font-mono">
              <pre>{getAppsScriptTemplateCode()}</pre>
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
              <span className="text-xs text-slate-500">Paste in Google Sheet &gt; Extensions &gt; Apps Script</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyScript}
                  className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-yellow-300" />
                  <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
                </button>
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
