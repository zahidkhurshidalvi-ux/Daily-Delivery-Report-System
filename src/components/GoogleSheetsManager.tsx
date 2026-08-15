import React, { useState, useEffect } from 'react';
import { DailyReport, GoogleSheetsConfig, SystemLog } from '../types';
import { formatDatePK } from '../utils/calculations';
import {
  requestGoogleOAuthToken,
  getGoogleAccessToken,
  clearGoogleToken,
  createPakistanPostSpreadsheet,
  bulkSyncReportsToGoogleSheet,
  getSpreadsheetMetadata,
  extractSpreadsheetId,
  REPORT_HEADERS,
} from '../utils/googleSheets';
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
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Custom manual URL input
  const [manualInput, setManualInput] = useState<string>(config.spreadsheetId || '');
  const [customClientId, setCustomClientId] = useState<string>(config.customClientId || '');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Check token on mount
  useEffect(() => {
    const token = getGoogleAccessToken();
    setIsConnected(!!token);
  }, []);

  // Connect Google Account
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

      // If we already have a spreadsheet ID, verify metadata
      if (config.spreadsheetId) {
        try {
          const meta = await getSpreadsheetMetadata(config.spreadsheetId, token);
          onUpdateConfig({
            ...config,
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

  // Disconnect
  const handleDisconnect = () => {
    clearGoogleToken();
    setIsConnected(false);
    setStatusMessage({
      type: 'info',
      text: 'Disconnected Google Account session.',
    });
    onAddLog('GOOGLE_DISCONNECT', 'Disconnected Google OAuth session', 'INFO');
  };

  // Create brand new Google Sheet
  const handleCreateNewSheet = async () => {
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

      // Now sync all existing reports into it
      if (reports.length > 0) {
        await bulkSyncReportsToGoogleSheet(spreadsheetId, reports, token);
      }

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
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

  // Sync to existing spreadsheet
  const handleSyncAllReports = async () => {
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

      // Check metadata
      const meta = await getSpreadsheetMetadata(targetId, token);
      const sheetName = config.sheetName || meta.sheetNames[0] || 'Sheet1';

      await bulkSyncReportsToGoogleSheet(targetId, reports, token, sheetName);

      const now = new Date().toISOString();
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
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

  // Link existing spreadsheet manually
  const handleLinkExisting = async () => {
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Google Sheets Live Integration</h1>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Official OAuth 2.0
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Automatically sync, backup, and view all Divisional Post Office daily delivery reports in Google Spreadsheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Google Connected
                </span>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={loading}
                className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                )}
                <span>Authorize with Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Connected Spreadsheet & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Spreadsheet Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#00401A]" />
                Connected Google Spreadsheet
              </span>
              {config.spreadsheetId && (
                <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active & Linked
                </span>
              )}
            </h2>

            {config.spreadsheetId ? (
              <div className="space-y-4">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Spreadsheet ID:</span>
                      <span className="font-mono text-slate-700 font-medium truncate block">
                        {config.spreadsheetId.substring(0, 16)}...
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Local Reports:</span>
                      <span className="font-bold text-slate-900">{reports.length} records</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Last Synced:</span>
                      <span className="font-medium text-slate-800">
                        {config.lastSyncedAt
                          ? new Date(config.lastSyncedAt).toLocaleString('en-GB')
                          : 'Not synced yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Sync Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleSyncAllReports}
                    disabled={syncing}
                    className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing Reports...' : `Sync All ${reports.length} Reports Now`}</span>
                  </button>

                  <button
                    onClick={handleCreateNewSheet}
                    disabled={syncing}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Create Fresh Spreadsheet</span>
                  </button>
                </div>
              </div>
            ) : (
              /* If No Spreadsheet Connected Yet */
              <div className="text-center py-8 px-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">No Google Spreadsheet Connected</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Create a new dedicated official Pakistan Post delivery sheet or paste the URL of an existing spreadsheet.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={syncing}
                    className="bg-[#00401A] hover:bg-[#005522] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {syncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
                    ) : (
                      <PlusCircle className="w-4 h-4 text-yellow-400" />
                    )}
                    <span>Create Official Google Sheet (1-Click)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Link Existing Spreadsheet Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Link className="w-4 h-4 text-slate-600" />
              Link Existing Google Sheet via URL or ID
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              If you already have a Google Sheet created, paste its full browser link or Sheet ID below:
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdB.../edit"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#00401A] focus:border-transparent font-mono"
              />
              <button
                onClick={handleLinkExisting}
                disabled={loading || !manualInput.trim()}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                Connect Sheet
              </button>
            </div>
          </div>

          {/* Live Data Mapping Preview */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                Google Sheets Column Schema ({REPORT_HEADERS.length} Columns)
              </h3>
              <span className="text-[11px] text-slate-500">Auto-formatted & formula ready</span>
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

        {/* Right Column: Settings & Auto-sync Automation */}
        <div className="space-y-6">
          {/* Auto-Sync Realtime Card */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-800">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Real-Time Auto-Sync</h3>
                  <p className="text-[11px] text-slate-500">Append new report to Google Sheet instantly</p>
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
                    <strong>Enabled:</strong> When any Post Office submits their daily delivery report, it will be automatically appended to the connected Google Spreadsheet.
                  </span>
                </div>
              ) : (
                <span className="text-slate-500">
                  Auto-sync is off. You can manually sync all reports at any time by clicking &quot;Sync All Reports Now&quot;.
                </span>
              )}
            </div>
          </div>

          {/* Benefits Card */}
          <div className="bg-emerald-900 text-white rounded-xl p-5 shadow-xs space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-300">
              <Sparkles className="w-4 h-4" /> Why Sync to Google Sheets?
            </h4>
            <ul className="text-xs space-y-2 text-emerald-100">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold">•</span>
                <span><strong>Multi-Device Access:</strong> View divisional delivery metrics from any phone, tablet or laptop.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold">•</span>
                <span><strong>Automated Cloud Backup:</strong> Your post office delivery records are safely saved on Google Drive.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 font-bold">•</span>
                <span><strong>Export & Share:</strong> Share spreadsheets with circle and regional headquarters instantly.</span>
              </li>
            </ul>
          </div>

          {/* Advanced OAuth Configuration (Optional) */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-slate-700 flex items-center justify-between w-full"
            >
              <span>Custom Google Cloud Client ID (Optional)</span>
              <span className="text-slate-400">{showAdvanced ? '▲' : '▼'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-100 text-xs">
                <p className="text-slate-500 text-[11px]">
                  By default, the system uses the configured AI Studio OAuth client. If you want to use your own custom Google Cloud Project Client ID, you can specify it here:
                </p>
                <input
                  type="text"
                  placeholder="your-project-id.apps.googleusercontent.com"
                  value={customClientId}
                  onChange={(e) => {
                    setCustomClientId(e.target.value);
                    onUpdateConfig({ ...config, customClientId: e.target.value });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
