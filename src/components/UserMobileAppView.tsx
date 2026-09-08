import React, { useState } from 'react';
import { PostOffice, DailyReport, User, AdMobConfig } from '../types';
import { DailyReportForm } from './DailyReportForm';
import { AdMobBanner } from './AdMobBanner';
import { AdMobPlayerModal } from './AdMobPlayerModal';
import {
  FileText,
  Calendar,
  History,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Building,
  Sparkles,
  ExternalLink,
  Share2,
  Download,
} from 'lucide-react';
import { formatDatePK, getTodayDateString, cleanAndFilterPostOffices } from '../utils/calculations';
import { DownloadAppModal } from './DownloadAppModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface UserMobileAppViewProps {
  currentUser: User | null;
  postOffices: PostOffice[];
  reports: DailyReport[];
  onSubmitReport: (report: Omit<DailyReport, 'id' | 'submittedAt'>, isEdit: boolean) => void;
  adMobConfig: AdMobConfig;
  onSwitchToAdmin?: () => void;
}

export const UserMobileAppView: React.FC<UserMobileAppViewProps> = ({
  currentUser,
  postOffices,
  reports,
  onSubmitReport,
  adMobConfig,
  onSwitchToAdmin,
}) => {
  const today = getTodayDateString();
  const sortedOffices = cleanAndFilterPostOffices(postOffices);

  // States
  const [activeTab, setActiveTab] = useState<'home' | 'report-form' | 'history' | 'pendency-check'>('home');
  const [selectedOfficeName, setSelectedOfficeName] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlOffice = params.get('office') || params.get('po');
      if (urlOffice && sortedOffices.some((p) => (p.name || '').toLowerCase() === urlOffice.toLowerCase())) {
        return sortedOffices.find((p) => (p.name || '').toLowerCase() === urlOffice.toLowerCase())?.name || '';
      }
    } catch {
      // ignore
    }
    return currentUser?.officeName || sortedOffices[0]?.name || '';
  });

  const [showAdModal, setShowAdModal] = useState<boolean>(false);
  const [adTargetAction, setAdTargetAction] = useState<'OPEN_FORM' | 'SUBMIT_SUCCESS' | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<any | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const { isInstallable, isInstalled, installApp } = usePWAInstall();

  const handleOpenReportForm = () => {
    if (adMobConfig.enabled && adMobConfig.showOnFormOpen) {
      setAdTargetAction('OPEN_FORM');
      setShowAdModal(true);
    } else {
      setActiveTab('report-form');
    }
  };

  const handleAdClosed = () => {
    setShowAdModal(false);
    if (adTargetAction === 'OPEN_FORM') {
      setActiveTab('report-form');
    }
    setAdTargetAction(null);
  };

  const handleCustomSubmit = (report: Omit<DailyReport, 'id' | 'submittedAt'>, isEdit: boolean) => {
    onSubmitReport(report, isEdit);
    setSubmittedReceipt({
      officeName: report.officeName,
      date: report.date,
      lastBal: report.lastBalance,
      received: report.receivedToday,
      delivered: report.delivered,
      closing: report.closingBalance,
      deposit: report.deposit,
    });

    if (adMobConfig.enabled && adMobConfig.showOnReportSubmit) {
      setAdTargetAction('SUBMIT_SUCCESS');
      setShowAdModal(true);
    }
  };

  const handleCopyAppLink = () => {
    const userUrl = `${window.location.origin}${window.location.pathname}?mode=user`;
    navigator.clipboard.writeText(userUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  // Office history filter
  const officeHistory = reports
    .filter((r) => r.officeName === selectedOfficeName)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans max-w-md mx-auto shadow-2xl border-x border-slate-300">
      {/* Mobile Top App Bar */}
      <header className="bg-[#00401A] text-white px-4 py-3 sticky top-0 z-30 shadow-md border-b border-[#005522]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {activeTab !== 'home' ? (
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="p-1.5 -ml-1 text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Back to Home"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-yellow-300 text-xs">
                PP
              </div>
            )}
            <div>
              <h1 className="text-sm font-extrabold tracking-tight leading-tight">
                {activeTab === 'report-form'
                  ? 'Daily Delivery Report Form'
                  : 'Pakistan Post'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDownloadModal(true)}
              className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-2.5 py-1.5 rounded-lg font-black text-[10px] shadow-sm transition-transform cursor-pointer active:scale-95"
              title="Download APK / Install Mobile App"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download APK</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAppLink}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer text-xs"
              title="Share / Copy App Link"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="bg-white/15 hover:bg-white/25 text-white font-bold text-[10px] px-2 py-1.5 rounded-md border border-white/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Copy Notification */}
      {copiedLink && (
        <div className="bg-emerald-600 text-white text-xs px-3 py-1.5 text-center font-semibold animate-fade-in">
          ✓ Mobile App Link Copied to Clipboard!
        </div>
      )}

      {/* AdMob Top Banner */}
      {adMobConfig.enabled && <AdMobBanner config={adMobConfig} position="top" />}

      {/* Main Content Body */}
      <main className="flex-1 p-4 flex flex-col justify-center">
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 animate-fade-in">
            {/* ONE SINGLE CLEAN BOX: Icon and Text Together */}
            <button
              type="button"
              onClick={handleOpenReportForm}
              className="w-full max-w-sm bg-gradient-to-br from-[#00401A] to-[#005a26] hover:from-[#004d20] hover:to-[#00662a] active:scale-95 text-white rounded-3xl p-6 shadow-2xl border-2 border-yellow-400 transition-all flex items-center justify-between gap-4 cursor-pointer group"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shadow-lg group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="w-7 h-7 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-base font-black tracking-tight text-white block">
                    Daily Delivery Report
                  </span>
                  <span className="text-xs text-yellow-300 font-bold block mt-1 font-urdu">
                    روزانہ ترسیل رپورٹ
                  </span>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-yellow-400 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          </div>
        )}

        {/* TAB: Report Form */}
        {activeTab === 'report-form' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006633] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu (واپس جائیں)</span>
            </button>

            <DailyReportForm
              currentUser={currentUser}
              postOffices={postOffices}
              reports={reports}
              onSubmitReport={handleCustomSubmit}
            />
          </div>
        )}

        {/* TAB: Office History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006633] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu</span>
            </button>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Post Office (ڈاکخانہ منتخب کریں):
              </label>
              <select
                value={selectedOfficeName}
                onChange={(e) => setSelectedOfficeName(e.target.value)}
                className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#006633]"
              >
                {sortedOffices.map((po) => (
                  <option key={po.id || po.name} value={po.name}>
                    {po.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Submission Records ({officeHistory.length})
              </h3>
              {officeHistory.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No reports submitted yet for {selectedOfficeName}.
                </div>
              ) : (
                officeHistory.slice(0, 10).map((r) => (
                  <div
                    key={r.id || `${r.officeName}_${r.date}`}
                    className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                      <span className="font-bold text-slate-900">{formatDatePK(r.date)}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        Submitted
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                      <div className="bg-slate-50 p-1 rounded">
                        <span className="text-slate-500 block">Last</span>
                        <strong className="text-slate-800">{r.lastBalance}</strong>
                      </div>
                      <div className="bg-blue-50 p-1 rounded">
                        <span className="text-blue-600 block">Rec</span>
                        <strong className="text-blue-900">{r.receivedToday}</strong>
                      </div>
                      <div className="bg-emerald-50 p-1 rounded">
                        <span className="text-emerald-600 block">Del</span>
                        <strong className="text-emerald-900">{r.delivered}</strong>
                      </div>
                      <div className="bg-purple-50 p-1 rounded">
                        <span className="text-purple-600 block">Close</span>
                        <strong className="text-purple-900">{r.closingBalance}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: Pendency Check */}
        {activeTab === 'pendency-check' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006633] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Menu</span>
            </button>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 mb-2">
                Today's Submission Status ({formatDatePK(today)})
              </h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Verify if your post office has submitted today's report.
              </p>
            </div>

            <div className="space-y-2">
              {sortedOffices.map((po) => {
                const hasSubmittedToday = reports.some(
                  (r) => r.officeName === po.name && r.date === today && r.submittedBy !== 'NOT_SUBMITTED'
                );
                return (
                  <div
                    key={po.name}
                    className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span className="font-bold text-slate-900">{po.name}</span>
                    </div>
                    {hasSubmittedToday ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* AdMob Bottom Banner */}
      {adMobConfig.enabled && <AdMobBanner config={adMobConfig} position="bottom" />}

      {/* Interactive AdMob Player Modal */}
      <AdMobPlayerModal
        isOpen={showAdModal}
        onClose={handleAdClosed}
        config={adMobConfig}
        adType={adTargetAction === 'SUBMIT_SUCCESS' ? 'REWARDED' : 'INTERSTITIAL'}
      />

      {/* Download & Install PWA / APK Modal */}
      <DownloadAppModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </div>
  );
};
