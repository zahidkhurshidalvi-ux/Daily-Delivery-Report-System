import React, { useState } from 'react';
import { WhatsAppConfig, TriggerConfig } from '../types';
import {
  MessageSquare,
  Clock,
  Play,
  Save,
  CheckCircle2,
  RefreshCw,
  BellRing,
  DatabaseBackup,
  ArrowRightLeft,
} from 'lucide-react';

interface WhatsAppAndTriggersProps {
  whatsAppConfig: WhatsAppConfig;
  triggerConfig: TriggerConfig;
  onSaveWhatsApp: (config: WhatsAppConfig) => void;
  onRunTriggerManually: (triggerType: 'REMINDER_5PM' | 'BACKUP_1159PM' | 'ROLLOVER_1205AM') => void;
}

export const WhatsAppAndTriggers: React.FC<WhatsAppAndTriggersProps> = ({
  whatsAppConfig,
  triggerConfig,
  onSaveWhatsApp,
  onRunTriggerManually,
}) => {
  const [phoneNumberId, setPhoneNumberId] = useState(whatsAppConfig.phoneNumberId);
  const [accessToken, setAccessToken] = useState(whatsAppConfig.accessToken);
  const [webAppUrl, setWebAppUrl] = useState(whatsAppConfig.webAppUrl);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWhatsApp({
      phoneNumberId,
      accessToken,
      webAppUrl,
      autoRemindersEnabled: whatsAppConfig.autoRemindersEnabled,
      reminderTime: whatsAppConfig.reminderTime,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* WhatsApp Cloud API Config Box */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">WhatsApp Cloud API Configuration</h2>
            <p className="text-xs text-gray-500 font-medium">
              Configure Meta WhatsApp Cloud API credentials for automated SMS/WhatsApp alerts.
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-xs flex items-center space-x-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#006633]" />
            <span>WhatsApp settings successfully saved!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-1">
                WhatsApp Phone Number ID *
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="e.g. 109823748912734"
                className="w-full bg-white border border-gray-300 text-gray-900 rounded-md p-2 font-mono focus:ring-1 focus:ring-[#006633] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">
                System Web App Link (Appended in Messages) *
              </label>
              <input
                type="text"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-white border border-gray-300 text-[#006633] font-mono rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">
              WhatsApp Permanent Access Token *
            </label>
            <textarea
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              rows={2}
              placeholder="EAAG..."
              className="w-full bg-white border border-gray-300 text-gray-900 font-mono rounded-md p-2 focus:ring-1 focus:ring-[#006633] focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#005522] hover:bg-[#00401A] text-white font-bold px-4 py-2 rounded-md flex items-center space-x-1.5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save WhatsApp Config</span>
            </button>
          </div>
        </form>
      </div>

      {/* Automated Triggers Control Panel */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Google Apps Script Automated Triggers</h2>
            <p className="text-xs text-gray-500 font-medium">
              3 Time-driven automated triggers scheduled in Google Apps Script engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* 1. 5:00 PM Trigger */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300 text-[9px] uppercase">
                  5:00 PM DAILY
                </span>
                <span className="text-[#006633] font-bold">ACTIVE</span>
              </div>
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center space-x-1.5 uppercase">
                <BellRing className="w-4 h-4 text-amber-700" />
                <span>Pending Reminders</span>
              </h3>
              <p className="text-gray-600 mt-1 font-medium">
                Checks offices that have not submitted report today and dispatches Urdu WhatsApp reminder.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">Last Run: {triggerConfig.lastReminderRun}</span>
              <button
                onClick={() => onRunTriggerManually('REMINDER_5PM')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1 rounded-md flex items-center space-x-1 shadow-xs"
              >
                <Play className="w-3 h-3 fill-slate-950" />
                <span>Test Now</span>
              </button>
            </div>
          </div>

          {/* 2. 11:59 PM Trigger */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-300 text-[9px] uppercase">
                  11:59 PM DAILY
                </span>
                <span className="text-[#006633] font-bold">ACTIVE</span>
              </div>
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center space-x-1.5 uppercase">
                <DatabaseBackup className="w-4 h-4 text-blue-700" />
                <span>Automated Backup</span>
              </h3>
              <p className="text-gray-600 mt-1 font-medium">
                Archives all submitted daily delivery reports into the Google Sheets Backup tab.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">Last Run: {triggerConfig.lastBackupRun}</span>
              <button
                onClick={() => onRunTriggerManually('BACKUP_1159PM')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-md flex items-center space-x-1 shadow-xs"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Test Now</span>
              </button>
            </div>
          </div>

          {/* 3. 12:05 AM Trigger */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded border border-purple-300 text-[9px] uppercase">
                  12:05 AM DAILY
                </span>
                <span className="text-[#006633] font-bold">ACTIVE</span>
              </div>
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center space-x-1.5 uppercase">
                <ArrowRightLeft className="w-4 h-4 text-purple-700" />
                <span>Balance Rollover</span>
              </h3>
              <p className="text-gray-600 mt-1 font-medium">
                Carries forward Closing Balance to become the Last Balance for the next day.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">Last Run: {triggerConfig.lastRolloverRun}</span>
              <button
                onClick={() => onRunTriggerManually('ROLLOVER_1205AM')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1 rounded-md flex items-center space-x-1 shadow-xs"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Test Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
