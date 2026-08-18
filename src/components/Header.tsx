import React from 'react';
import { User, GoogleSheetsConfig } from '../types';
import { LogOut, ShieldCheck, Building2, Calendar, Bell, Lock, RefreshCw, Database, ExternalLink } from 'lucide-react';
import { formatDatePK, getTodayDateString } from '../utils/calculations';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenAdminLogin: () => void;
  pendingCount: number;
  onNavigatePending: () => void;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  lastRefreshedAt?: Date | null;
  googleSheetsConfig?: GoogleSheetsConfig;
  onNavigateGoogleSheets?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenAdminLogin,
  pendingCount,
  onNavigatePending,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  onManualRefresh,
  lastRefreshedAt,
  googleSheetsConfig,
  onNavigateGoogleSheets,
}) => {
  const todayStr = getTodayDateString();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isSheetsConnected = !!(googleSheetsConfig?.spreadsheetId || googleSheetsConfig?.webhookUrl);

  return (
    <header className="bg-white text-gray-800 shadow-xs border-b border-gray-200 sticky top-0 z-30 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#00401A] rounded-full border-2 border-yellow-400 flex items-center justify-center shadow-xs shrink-0">
              <span className="text-yellow-400 font-black text-sm tracking-tighter">PAK</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-extrabold tracking-tight text-[#00401A] uppercase leading-tight">
                  PAKISTAN POST
                </h1>
                <span className="bg-[#00401A]/10 text-[#00401A] text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-[#00401A]/20">
                  DDRS
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                Daily Delivery Reporting System - {isAdmin ? 'Superintendent Administration' : 'Direct Post Office Portal'}
              </p>
            </div>
          </div>

          {/* Right Section: Cloud DB, Auto-Refresh, Date, Pending Badge, User & Admin Login / Logout */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Cloud Database Connected Pill */}
            <div
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-[#006633] border border-emerald-200"
              title="Firebase Cloud Database is live and permanently syncing all devices in real-time."
            >
              <span className="w-2 h-2 rounded-full bg-[#006633] animate-pulse"></span>
              <span>Cloud DB: Connected</span>
            </div>

            {/* Google Sheets Database Status Pill */}
            {onNavigateGoogleSheets && (
              <button
                onClick={onNavigateGoogleSheets}
                className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                  isSheetsConnected
                    ? 'bg-green-50 hover:bg-green-100 text-[#006633] border-green-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                }`}
                title={
                  isSheetsConnected
                    ? `Google Sheets Backup is Linked (${googleSheetsConfig?.syncMethod || 'ACTIVE'}). Click to open database manager.`
                    : 'Click to link optional Google Sheets Backup'
                }
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isSheetsConnected ? 'Sheets Backup: On' : 'Sheets Backup'}</span>
              </button>
            )}

            {/* Auto-Refresh Toggle Control */}
            <div className="flex items-center space-x-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200">
              <button
                onClick={onToggleAutoRefresh}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  autoRefreshEnabled
                    ? 'bg-[#006633] text-white shadow-2xs'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title={autoRefreshEnabled ? 'Auto-Refresh every 60s is ON. Click to disable.' : 'Click to enable Auto-Refresh every 60s'}
              >
                <RefreshCw className={`w-3 h-3 ${autoRefreshEnabled ? 'animate-spin' : ''}`} />
                <span className="text-[11px]">Auto 60s</span>
                <div
                  className={`w-3 h-3 rounded-full transition-colors ${
                    autoRefreshEnabled ? 'bg-yellow-400' : 'bg-gray-400'
                  }`}
                />
              </button>

              <button
                onClick={onManualRefresh}
                className="p-1 hover:bg-gray-200 text-gray-600 hover:text-gray-900 rounded transition-colors cursor-pointer"
                title={`Click to sync data now ${lastRefreshedAt ? `(Last: ${lastRefreshedAt.toLocaleTimeString()})` : ''}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Current Date Badge */}
            <div className="hidden md:flex items-center space-x-1.5 bg-gray-50 text-gray-700 text-xs px-3 py-1.5 rounded-md border border-gray-200 font-medium">
              <Calendar className="w-3.5 h-3.5 text-[#006633]" />
              <span>{formatDatePK(todayStr)}</span>
            </div>

            {/* Pending Reports Notification Pill for Admin */}
            {isAdmin && (
              <button
                onClick={onNavigatePending}
                className={`relative flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  pendingCount > 0
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs animate-pulse'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Pending: {pendingCount}</span>
              </button>
            )}

            {/* Admin Badge if logged in */}
            {isAdmin && (
              <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                <ShieldCheck className="w-4 h-4 text-[#006633]" />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold leading-none text-gray-800">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                    Div. Superintendent
                  </p>
                </div>
              </div>
            )}

            {/* Admin Login Button OR Logout Button */}
            {isAdmin ? (
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs px-2.5 py-1.5 rounded-md border border-red-200 font-bold transition-colors cursor-pointer"
                title="Sign Out Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button
                onClick={onOpenAdminLogin}
                className="flex items-center space-x-1.5 bg-[#005522] hover:bg-[#00401A] text-white text-xs px-3 py-1.5 rounded-md font-bold transition-all shadow-xs cursor-pointer"
                title="Superintendent Admin Login"
              >
                <Lock className="w-3.5 h-3.5 text-yellow-400" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
