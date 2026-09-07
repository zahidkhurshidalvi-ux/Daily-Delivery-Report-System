import React, { useState } from 'react';
import { OfficialHoliday } from '../types';
import {
  formatDatePK,
  isHoliday,
  getHolidayReason,
  saveCustomHoliday,
  deleteCustomHoliday,
  getAllOfficialHolidays,
  normalizeDateToIso,
} from '../utils/calculations';
import { saveHolidaysToCloud } from '../services/cloudDatabase';
import {
  CalendarOff,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface HolidayManagerProps {
  onNavigateDate?: (date: string) => void;
  onHolidayUpdated?: () => void;
  currentUsername?: string;
}

const COMMON_PRESETS = [
  { title: 'Official Public Holiday (26/08/2026)', date: '2026-08-26', notes: 'Federal Govt Gazette Notification' },
  { title: 'Eid Milad-un-Nabi (12 Rabi-ul-Awwal)', date: '', notes: 'Official Closed' },
  { title: 'Iqbal Day (9 November)', date: '2026-11-09', notes: 'National Holiday' },
  { title: 'Quaid-e-Azam Day / Christmas (25 Dec)', date: '2026-12-25', notes: 'National Holiday' },
  { title: 'Kashmir Solidarity Day (5 Feb)', date: '2027-02-05', notes: 'National Gazetted Holiday' },
  { title: 'Pakistan Day (23 March)', date: '2027-03-23', notes: 'National Gazetted Holiday' },
  { title: 'Local Administrative Holiday', date: '', notes: 'Divisional Superintendent Order' },
  { title: 'Emergency Rain / Flood Closure', date: '', notes: 'District Disaster Management Order' },
];

export const HolidayManager: React.FC<HolidayManagerProps> = ({
  onNavigateDate,
  onHolidayUpdated,
  currentUsername = 'Admin',
}) => {
  const [holidays, setHolidays] = useState<OfficialHoliday[]>(() => getAllOfficialHolidays());
  const [inputDate, setInputDate] = useState<string>('2026-08-26');
  const [inputTitle, setInputTitle] = useState<string>('Official Public Holiday (26/08/2026)');
  const [inputNotes, setInputNotes] = useState<string>('Official Closed - Excluded from all pendency');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshList = () => {
    const fresh = getAllOfficialHolidays();
    setHolidays(fresh);
    if (onHolidayUpdated) {
      onHolidayUpdated();
    }
  };

  const handleDeclareHoliday = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const iso = normalizeDateToIso(inputDate);
    if (!iso) {
      setErrorMessage('Please select a valid date (YYYY-MM-DD).');
      return;
    }

    if (!inputTitle.trim()) {
      setErrorMessage('Please provide a title or reason for the holiday.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Save to local storage and in-memory cache
      saveCustomHoliday(iso, inputTitle.trim(), currentUsername, inputNotes.trim());

      // 2. Sync to Cloud Firestore
      const updatedList = getAllOfficialHolidays();
      const payload: Record<string, OfficialHoliday> = {};
      updatedList.forEach((h) => {
        payload[h.date] = h;
      });
      await saveHolidaysToCloud(payload);

      refreshList();
      setSuccessMessage(
        `Holiday for ${formatDatePK(iso)} successfully declared! All offices have been removed from pendency for this date.`
      );

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save holiday. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (dateStr: string) => {
    const formatted = formatDatePK(dateStr);
    const confirmed = window.confirm(
      `Are you sure you want to remove the declared holiday on ${formatted}? \n\nThis will re-enable daily delivery report requirements and pendency tracking for this date.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      deleteCustomHoliday(dateStr);

      const updatedList = getAllOfficialHolidays().filter((h) => h.date !== dateStr);
      const payload: Record<string, OfficialHoliday> = {};
      updatedList.forEach((h) => {
        payload[h.date] = h;
      });
      await saveHolidaysToCloud(payload);

      refreshList();
      setSuccessMessage(`Holiday on ${formatted} removed. Normal reporting resumed.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: { title: string; date: string; notes: string }) => {
    setInputTitle(preset.title);
    if (preset.date) {
      setInputDate(preset.date);
    }
    if (preset.notes) {
      setInputNotes(preset.notes);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00401A] to-[#005a26] text-white p-6 rounded-lg shadow-sm border border-[#005522]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-white/10 rounded-lg shrink-0">
              <CalendarOff className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Public Holidays & Closure Registry (سرکاری تعطیلات)
                </h1>
                <span className="bg-yellow-400 text-[#00401A] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Automatic Pendency Exemption
                </span>
              </div>
              <p className="text-xs text-green-100 mt-1 max-w-2xl leading-relaxed">
                Declare official public holidays, gazetted closures, or emergency office holidays. When a date is declared
                as a holiday, daily delivery report submissions are waived, and the date is{' '}
                <span className="font-bold text-yellow-300 underline">
                  automatically purged from pendency, WhatsApp reminders, and explanation notices
                </span>{' '}
                for all post offices across the entire division.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-black/20 px-3 py-2 rounded-lg border border-white/10 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <div>
              <span className="font-bold block text-white">Cloud Synced</span>
              <span className="text-[10px] text-green-200">Real-time across all devices</span>
            </div>
          </div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg flex items-center gap-3 text-xs shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-4 py-3 rounded-lg flex items-center gap-3 text-xs shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Declare Form */}
        <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4 h-fit">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <PlusCircle className="w-5 h-5 text-[#006633]" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Declare Public Holiday
            </h2>
          </div>

          <form onSubmit={handleDeclareHoliday} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Holiday Date (چھٹی کی تاریخ) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-[#006633] focus:border-transparent outline-none"
                  required
                />
                <Calendar className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
              </div>
              {inputDate && (
                <p className="text-[11px] text-[#006633] font-semibold mt-1">
                  Selected: {formatDatePK(inputDate)}
                </p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Holiday Title / Reason (عنوان / تفصیل) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder="e.g. Official Public Holiday (26/08/2026)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#006633] focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Official Reference / Notification (اختیاری)
              </label>
              <input
                type="text"
                value={inputNotes}
                onChange={(e) => setInputNotes(e.target.value)}
                placeholder="e.g. Govt of Pakistan Gazette Notification"
                className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#006633] focus:border-transparent outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#006633] hover:bg-[#005522] text-white font-bold py-2.5 px-4 rounded shadow transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarOff className="w-4 h-4 text-yellow-300" />
              )}
              <span>Declare Holiday & Remove Pendency</span>
            </button>
          </form>

          {/* Presets */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Quick Presets</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="bg-gray-50 hover:bg-green-50 hover:text-[#006633] hover:border-[#006633] border border-gray-200 text-[10px] px-2 py-1 rounded transition-colors text-left text-gray-700 cursor-pointer"
                >
                  {preset.title.split('(')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Registered Holidays Table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#006633]" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Declared Holidays Directory ({holidays.length})
              </h2>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              Submissions waived & removed from pendency
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="p-3">Date (مورخہ)</th>
                  <th className="p-3">Holiday Details (تفصیل)</th>
                  <th className="p-3">Reference / Declared By</th>
                  <th className="p-3 text-center">Pendency Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No holidays declared yet. Use the form on the left to declare a public holiday.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => {
                    const isKeyDate = h.date === '2026-08-26';
                    return (
                      <tr
                        key={h.date}
                        className={`hover:bg-gray-50/80 transition-colors ${
                          isKeyDate ? 'bg-amber-50/40 font-medium' : ''
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-800 border border-gray-200 text-xs px-2 py-0.5 rounded font-mono font-bold">
                              {formatDatePK(h.date)}
                            </span>
                            {isKeyDate && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                Official 26/08
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 block mt-0.5 font-normal">
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('en-PK', {
                              weekday: 'long',
                            })}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-900">
                          <span className="text-gray-900 block">{h.title}</span>
                          {h.notes && <span className="text-[10px] text-gray-500 block font-normal">{h.notes}</span>}
                        </td>
                        <td className="p-3 text-gray-600 text-[11px]">
                          <span className="block font-medium">{h.declaredBy || 'Administration'}</span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>EXCLUDED FROM PENDENCY</span>
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-1">
                          {onNavigateDate && (
                            <button
                              type="button"
                              onClick={() => onNavigateDate(h.date)}
                              title="Verify pendency on this date"
                              className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors inline-flex items-center cursor-pointer"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(h.date)}
                            title="Delete Holiday"
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors inline-flex items-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-3 text-[11px] text-gray-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-gray-800">Operational Guarantee:</span> When any date (such as 26/08/2026) is
              listed here as an official holiday:
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>
                  No post office is marked as delinquent, pending, or non-compliant for that day.
                </li>
                <li>
                  Missing dates list in <strong>Pending Offices</strong> and <strong>Issue Explanation Notice</strong> will
                  never include this date.
                </li>
                <li>
                  Article balances smoothly carry forward to the next working day without any disruption.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
