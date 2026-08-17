import React, { useState } from 'react';
import { PostOffice, DailyReport, WhatsAppConfig } from '../types';
import {
  formatDatePK,
  getTodayDateString,
  getMissingDatesForOffice,
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
} from '../utils/calculations';
import {
  getUrduReminderTemplate,
  getUrduSummaryTemplate,
  generateWhatsAppWebLink,
  sendWhatsAppMessageViaCloudApi,
} from '../utils/whatsapp';
import { exportPendingOfficesToExcel } from '../utils/excelExport';
import {
  Clock,
  Send,
  MessageSquare,
  Building,
  CheckCircle2,
  Download,
  AlertCircle,
  ExternalLink,
  CalendarDays,
  Loader2,
  Copy,
  Check,
  Play,
  X,
  Layers,
} from 'lucide-react';

interface PendingReportsProps {
  postOffices: PostOffice[];
  reports: DailyReport[];
  selectedDate: string;
  whatsAppConfig: WhatsAppConfig;
  onLogAction: (action: string, details: string) => void;
}

interface BroadcastItem {
  office: PostOffice;
  missingDates: string[];
  message: string;
  mobile: string;
  status: 'PENDING' | 'SENDING' | 'SENT_API' | 'OPENED_LINK' | 'FAILED';
  errorDetails?: string;
}

export const PendingReports: React.FC<PendingReportsProps> = ({
  postOffices,
  reports,
  selectedDate,
  whatsAppConfig,
  onLogAction,
}) => {
  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  const activeOffices = validOffices.filter((po) => po.status === 'ACTIVE');
  const dateReports = validReports.filter((r) => r.date === selectedDate);
  const submittedOfficeNames = new Set(dateReports.map((r) => r.officeName));

  const pendingList = activeOffices
    .filter((po) => !submittedOfficeNames.has(po.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
    .map((office) => {
      const pastReports = validReports
        .filter((r) => r.officeName === office.name)
        .sort((a, b) => (a.date > b.date ? -1 : 1));

      const missingDates = getMissingDatesForOffice(office.name, selectedDate, validReports);

      return {
        office,
        lastReportDate: pastReports.length > 0 ? pastReports[0].date : undefined,
        missingDates,
      };
    });

  const [notification, setNotification] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    text: string;
  } | null>(null);

  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastItems, setBroadcastItems] = useState<BroadcastItem[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [copiedText, setCopiedText] = useState(false);
  const [singleSendingId, setSingleSendingId] = useState<string | null>(null);

  const handleSendSingleReminder = async (office: PostOffice, missingDates: string[]) => {
    setSingleSendingId(office.id);
    const reminderText = getUrduReminderTemplate(missingDates.length > 0 ? missingDates : selectedDate);
    const fullMsg = `محترم پوسٹ ماسٹر صاحب (${office.name})،\n\n` + reminderText;
    
    const res = await sendWhatsAppMessageViaCloudApi(
      whatsAppConfig,
      office.mobileNumber,
      fullMsg
    );

    setSingleSendingId(null);

    // Always open standard WhatsApp link so user can immediately send via WhatsApp Web/App if needed
    const link = generateWhatsAppWebLink(
      office.mobileNumber,
      fullMsg,
      whatsAppConfig.webAppUrl
    );
    window.open(link, '_blank');

    if (res.success) {
      setNotification({
        type: 'SUCCESS',
        text: `WhatsApp reminder dispatched to ${office.postmasterName} (${office.name})!`,
      });
      onLogAction(
        'WHATSAPP_REMINDER_SENT',
        `Dispatched Urdu WhatsApp reminder to ${office.name} (${office.mobileNumber}) for dates: ${missingDates.join(', ')}`
      );
    } else {
      setNotification({
        type: 'ERROR',
        text: `API message error: ${res.message}. Opened direct WhatsApp web link instead.`,
      });
    }
  };

  const prepareBroadcastQueue = (type: 'REMINDER_ALL' | 'SUMMARY_ALL') => {
    if (type === 'REMINDER_ALL') {
      if (pendingList.length === 0) return;
      const items: BroadcastItem[] = pendingList.map((item) => {
        const reminderText = getUrduReminderTemplate(
          item.missingDates.length > 0 ? item.missingDates : selectedDate
        );
        return {
          office: item.office,
          missingDates: item.missingDates,
          message: `محترم پوسٹ ماسٹر صاحب (${item.office.name})،\n\n` + reminderText,
          mobile: item.office.mobileNumber,
          status: 'PENDING',
        };
      });
      setBroadcastTitle(`Urdu Reminders Broadcast (${items.length} Pending Offices)`);
      setBroadcastItems(items);
      setShowBroadcastModal(true);
    } else {
      if (activeOffices.length === 0) return;
      const summaryText = getUrduSummaryTemplate(selectedDate);
      const items: BroadcastItem[] = activeOffices.map((po) => ({
        office: po,
        missingDates: [selectedDate],
        message: summaryText,
        mobile: po.mobileNumber,
        status: 'PENDING',
      }));
      setBroadcastTitle(`Daily Summary Broadcast (${items.length} Postmasters)`);
      setBroadcastItems(items);
      setShowBroadcastModal(true);
    }
  };

  const handleRunCloudApiBroadcast = async () => {
    setIsProcessingBulk(true);
    let sentCount = 0;
    let failCount = 0;

    const updatedList = [...broadcastItems];

    for (let i = 0; i < updatedList.length; i++) {
      updatedList[i] = { ...updatedList[i], status: 'SENDING' };
      setBroadcastItems([...updatedList]);

      const item = updatedList[i];
      const res = await sendWhatsAppMessageViaCloudApi(
        whatsAppConfig,
        item.mobile,
        item.message
      );

      if (res.success) {
        sentCount++;
        updatedList[i] = { ...updatedList[i], status: 'SENT_API' };
      } else {
        failCount++;
        updatedList[i] = { ...updatedList[i], status: 'FAILED', errorDetails: res.message };
      }
      setBroadcastItems([...updatedList]);
    }

    setIsProcessingBulk(false);
    setNotification({
      type: sentCount > 0 ? 'SUCCESS' : 'ERROR',
      text: `Bulk dispatch completed: ${sentCount} sent successfully, ${failCount} failed/simulated.`,
    });

    onLogAction(
      'WHATSAPP_BULK_DISPATCH',
      `Executed bulk WhatsApp broadcast for ${updatedList.length} recipients. Success: ${sentCount}, Failed: ${failCount}`
    );
  };

  const handleOpenIndividualLink = (index: number) => {
    const item = broadcastItems[index];
    if (!item) return;

    const link = generateWhatsAppWebLink(item.mobile, item.message, whatsAppConfig.webAppUrl);
    window.open(link, '_blank');

    const updated = [...broadcastItems];
    updated[index] = { ...updated[index], status: 'OPENED_LINK' };
    setBroadcastItems(updated);
  };

  const handleCopyAllBroadcastData = () => {
    const fullContent = broadcastItems
      .map(
        (b, idx) =>
          `----------------------------\n#${idx + 1} ${b.office.name} (${b.mobile}):\n${b.message}\n`
      )
      .join('\n');

    navigator.clipboard.writeText(fullContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
              Pending Monitoring Unit
            </span>
            <span className="text-gray-500 text-xs font-mono">Date: {formatDatePK(selectedDate)}</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1">
            Offices Pending Daily Delivery Report ({pendingList.length})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            {activeOffices.length - pendingList.length} of {activeOffices.length} offices submitted today.
          </p>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => prepareBroadcastQueue('REMINDER_ALL')}
            disabled={pendingList.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Remind All Pending ({pendingList.length})</span>
          </button>

          <button
            onClick={() => prepareBroadcastQueue('SUMMARY_ALL')}
            className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-yellow-400" />
            <span>Broadcast Summary to All</span>
          </button>

          <button
            onClick={() => exportPendingOfficesToExcel(pendingList)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Alert Notification */}
      {notification && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs ${
            notification.type === 'SUCCESS'
              ? 'bg-green-50 border-green-200 text-green-800 font-medium'
              : notification.type === 'ERROR'
              ? 'bg-red-50 border-red-200 text-red-800 font-medium'
              : 'bg-blue-50 border-blue-200 text-blue-800 font-medium'
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-[#006633] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-gray-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Offices Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {pendingList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Office Name</th>
                  <th className="p-2.5">Postmaster Name</th>
                  <th className="p-2.5">Mobile Number</th>
                  <th className="p-2.5">Pending Dates (مورخہ جات)</th>
                  <th className="p-2.5">Last Submitted</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-center">1-Click WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {pendingList.map((item, idx) => {
                  const reminderMsg = getUrduReminderTemplate(item.missingDates.length > 0 ? item.missingDates : selectedDate);
                  const directLink = generateWhatsAppWebLink(
                    item.office.mobileNumber,
                    `محترم پوسٹ ماسٹر صاحب (${item.office.name})،\n\n` + reminderMsg,
                    whatsAppConfig.webAppUrl
                  );

                  return (
                    <tr key={item.office.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-2.5 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-gray-900">
                        {item.office.name}
                      </td>
                      <td className="p-2.5 text-gray-700">{item.office.postmasterName}</td>
                      <td className="p-2.5 text-[#006633] font-mono font-bold">{item.office.mobileNumber}</td>
                      <td className="p-2.5">
                        {item.missingDates.length > 1 ? (
                          <div className="space-y-1">
                            <span className="bg-red-100 text-red-800 border border-red-300 text-[10px] px-2 py-0.5 rounded font-extrabold flex items-center w-max space-x-1">
                              <CalendarDays className="w-3 h-3 text-red-700" />
                              <span>{item.missingDates.length} Pending Dates</span>
                            </span>
                            <div className="text-[10px] text-red-700 font-mono font-semibold">
                              {item.missingDates.map((d) => formatDatePK(d)).join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-800 font-medium text-xs">
                            {formatDatePK(selectedDate)}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-gray-500">
                        {item.lastReportDate ? formatDatePK(item.lastReportDate) : 'Never'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                          PENDING ({item.missingDates.length})
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleSendSingleReminder(item.office, item.missingDates)}
                            disabled={singleSendingId === item.office.id}
                            className="bg-[#25D366] hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-md transition-all flex items-center space-x-1 shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {singleSendingId === item.office.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>Send Reminder</span>
                          </button>

                          <a
                            href={directLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-[#006633] rounded-md border border-gray-300"
                            title="Open in WhatsApp Web"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 text-xs">
            <CheckCircle2 className="w-12 h-12 text-[#006633] mx-auto mb-3" />
            <h3 className="text-sm font-extrabold text-gray-900 uppercase">100% Compliance Achieved!</h3>
            <p className="mt-1 text-gray-500 font-medium">
              All active post offices have successfully submitted their Daily Delivery Reports for{' '}
              {formatDatePK(selectedDate)}.
            </p>
          </div>
        )}
      </div>

      {/* Urdu Template Preview Box */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
          Urdu Reminder Message Template {pendingList.some((p) => p.missingDates.length > 1) && '(Multi-Date Mode Enabled)'}
        </h3>
        <div
          dir="rtl"
          className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-[#00401A] text-sm font-serif leading-relaxed whitespace-pre-line"
        >
          {getUrduReminderTemplate(
            pendingList.find((p) => p.missingDates.length > 1)?.missingDates || selectedDate
          )}
          {'\n\n'}
          <span className="text-xs text-gray-500 font-sans">{whatsAppConfig.webAppUrl}</span>
        </div>
      </div>

      {/* BULK BROADCAST DISPATCHER MODAL */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#00401A] text-white p-4 flex items-center justify-between border-b-2 border-[#D4AF37]">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-yellow-400" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">{broadcastTitle}</h3>
                  <p className="text-[11px] text-green-200">
                    Dispatch messages via Cloud API or sequentially launch WhatsApp Web links.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-white hover:text-yellow-400 p-1 font-bold rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Actions */}
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRunCloudApiBroadcast}
                  disabled={isProcessingBulk}
                  className="bg-[#006633] hover:bg-[#00401A] text-white font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingBulk ? (
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                  ) : (
                    <Play className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  )}
                  <span>
                    {isProcessingBulk ? 'Sending via Cloud API...' : 'Auto-Dispatch via Meta Cloud API'}
                  </span>
                </button>

                <button
                  onClick={handleCopyAllBroadcastData}
                  className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold px-3 py-2 rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  {copiedText ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                  )}
                  <span>{copiedText ? 'Copied All!' : 'Copy Messages'}</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-gray-500">
                Total: <span className="font-bold text-gray-900">{broadcastItems.length}</span> | Sent API:{' '}
                <span className="font-bold text-green-700">
                  {broadcastItems.filter((i) => i.status === 'SENT_API').length}
                </span>{' '}
                | Opened Link:{' '}
                <span className="font-bold text-blue-700">
                  {broadcastItems.filter((i) => i.status === 'OPENED_LINK').length}
                </span>
              </div>
            </div>

            {/* Modal Queue Table */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {broadcastItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs hover:border-[#006633] transition-all"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-gray-900">
                        #{idx + 1} {item.office.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#006633]">
                        ({item.mobile})
                      </span>
                      {item.status === 'SENT_API' && (
                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-extrabold border border-green-300">
                          ✓ SENT VIA API
                        </span>
                      )}
                      {item.status === 'OPENED_LINK' && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-extrabold border border-blue-300">
                          ✓ LINK LAUNCHED
                        </span>
                      )}
                      {item.status === 'SENDING' && (
                        <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-extrabold border border-yellow-300 flex items-center space-x-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>SENDING...</span>
                        </span>
                      )}
                      {item.status === 'FAILED' && (
                        <span className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-extrabold border border-red-300">
                          ⚠ SIMULATED / FAILED
                        </span>
                      )}
                    </div>
                    <div
                      dir="rtl"
                      className="text-xs font-serif text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 whitespace-pre-line"
                    >
                      {item.message}
                    </div>
                    {item.errorDetails && (
                      <p className="text-[10px] text-red-600 font-mono">Note: {item.errorDetails}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenIndividualLink(idx)}
                      className="bg-[#25D366] hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open WhatsApp Web</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 p-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="bg-gray-700 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2 rounded-lg"
              >
                Close Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

