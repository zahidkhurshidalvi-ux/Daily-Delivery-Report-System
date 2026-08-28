import React, { useState } from 'react';
import { PostOffice, DailyReport, WhatsAppConfig } from '../types';
import {
  formatDatePK,
  getTodayDateString,
  getMissingDatesForOffice,
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
  isSunday,
  getDayOfWeek,
} from '../utils/calculations';
import {
  getUrduReminderTemplate,
  getUrduSummaryTemplate,
  generateWhatsAppWebLink,
  sendWhatsAppMessageViaCloudApi,
} from '../utils/whatsapp';
import { exportPendingOfficesToExcel } from '../utils/excelExport';
import {
  generatePendingReportPDF,
  triggerPrintablePendingWindow,
} from '../utils/pdfGenerator';
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
  Search,
  User,
  Filter,
  Calendar,
  Phone,
  RefreshCw,
  Printer,
  FileDown,
  AlertTriangle,
  Sun,
} from 'lucide-react';

interface PendingReportsProps {
  postOffices: PostOffice[];
  reports: DailyReport[];
  selectedDate: string;
  setSelectedDate?: (date: string) => void;
  whatsAppConfig: WhatsAppConfig;
  onLogAction: (action: string, details: string) => void;
  onNavigateExplanation?: (officeName?: string) => void;
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
  setSelectedDate,
  whatsAppConfig,
  onLogAction,
  onNavigateExplanation,
}) => {
  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL_PENDING' | 'MULTI_DATE_ONLY'>('ALL_PENDING');

  const isSelectedDateSunday = isSunday(selectedDate);
  const activeOffices = validOffices.filter((po) => po.status === 'ACTIVE');
  const dateReports = validReports.filter((r) => r.date === selectedDate);
  const submittedOfficeNames = new Set(dateReports.map((r) => r.officeName));

  const pendingList = activeOffices
    .map((office) => {
      const pastReports = validReports
        .filter((r) => r.officeName === office.name)
        .sort((a, b) => (a.date > b.date ? -1 : 1));

      const missingDates = getMissingDatesForOffice(office.name, selectedDate, validReports);
      const isMissingToday = !isSelectedDateSunday && !submittedOfficeNames.has(office.name);

      return {
        office,
        lastReportDate: pastReports.length > 0 ? pastReports[0].date : undefined,
        missingDates,
        isMissingToday,
      };
    })
    .filter((item) => (isSelectedDateSunday ? item.missingDates.length > 0 : item.isMissingToday || item.missingDates.length > 0))
    .sort((a, b) => a.office.name.localeCompare(b.office.name, undefined, { sensitivity: 'base', numeric: true }));

  // Filter based on search & view mode
  const filteredPendingList = pendingList.filter((item) => {
    if (filterMode === 'MULTI_DATE_ONLY' && item.missingDates.length <= 1) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.office.name.toLowerCase().includes(term) ||
      (item.office.postmasterName || '').toLowerCase().includes(term) ||
      (item.office.mobileNumber || '').includes(term)
    );
  });

  // Total missing reports count across all pending offices
  const totalPendingReportsCount = pendingList.reduce(
    (sum, item) => sum + (item.missingDates.length > 0 ? item.missingDates.length : 1),
    0
  );

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
  const [copiedOfficeId, setCopiedOfficeId] = useState<string | null>(null);

  const handleCopySingleMessage = (office: PostOffice, missingDates: string[]) => {
    const reminderText = getUrduReminderTemplate(missingDates.length > 0 ? missingDates : selectedDate);
    const fullMsg = `محترم پوسٹ ماسٹر صاحب (${office.name})،\n\n` + reminderText + `\n\n${whatsAppConfig.webAppUrl}`;
    navigator.clipboard.writeText(fullMsg);
    setCopiedOfficeId(office.id);
    setTimeout(() => setCopiedOfficeId(null), 2000);
  };

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

  const handleDownloadSupervisorPDF = () => {
    const doc = generatePendingReportPDF(pendingList, selectedDate);
    doc.save(`Pakistan_Post_Supervisor_Pending_List_${selectedDate}.pdf`);
  };

  const handlePrintSupervisorPending = () => {
    triggerPrintablePendingWindow(pendingList, selectedDate);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-red-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded uppercase tracking-wider flex items-center space-x-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping mr-1" />
              Live Pending Monitor
            </span>
            <span className="text-gray-500 text-xs font-mono">Date: {formatDatePK(selectedDate)}</span>
          </div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight mt-1.5">
            Offices Pending Daily Delivery Report ({pendingList.length})
          </h2>
          <p className="text-xs text-gray-600 mt-0.5 font-medium">
            <strong className="text-emerald-700">{activeOffices.length - pendingList.length}</strong> of {activeOffices.length} offices submitted today. Total missing submissions: <strong className="text-red-600">{totalPendingReportsCount}</strong>.
          </p>
        </div>

        {/* Date Selector & Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Date Picker */}
          {setSelectedDate && (
            <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-300">
              <Calendar className="w-3.5 h-3.5 text-[#006633]" />
              <label className="text-xs font-bold text-gray-700">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white text-gray-800 text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633] font-medium"
              />
              {selectedDate !== getTodayDateString() && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className="text-[10px] bg-[#006633] text-white px-2 py-0.5 rounded font-bold hover:bg-[#00401A] transition-colors"
                  title="Jump to Today's date"
                >
                  Today
                </button>
              )}
              {isSelectedDateSunday && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded font-bold flex items-center space-x-1">
                  <Sun className="w-3 h-3 text-amber-600" />
                  <span>Sunday Holiday</span>
                </span>
              )}
            </div>
          )}

          {/* Supervisor Combined Report Buttons */}
          <button
            onClick={handlePrintSupervisorPending}
            disabled={pendingList.length === 0}
            className="bg-gray-800 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            title="Print A4 Portrait Supervisor Pending List"
          >
            <Printer className="w-3.5 h-3.5 text-yellow-400" />
            <span>Print Supervisor List (A4)</span>
          </button>

          <button
            onClick={handleDownloadSupervisorPDF}
            disabled={pendingList.length === 0}
            className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            title="Download Combined Pending List PDF for Supervisor"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Supervisor PDF</span>
          </button>

          <button
            onClick={() => exportPendingOfficesToExcel(pendingList, selectedDate)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
            title="Export full pending list to Excel"
          >
            <Download className="w-3.5 h-3.5 inline mr-0.5 text-yellow-300" />
            <span>Excel Export</span>
          </button>

          <button
            onClick={() => prepareBroadcastQueue('REMINDER_ALL')}
            disabled={pendingList.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Remind All ({pendingList.length})</span>
          </button>

          <button
            onClick={() => prepareBroadcastQueue('SUMMARY_ALL')}
            className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-yellow-400" />
            <span>Broadcast Summary</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-xs">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Active Offices</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-gray-900">{activeOffices.length}</span>
            <Building className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/20 p-3.5 rounded-lg shadow-xs">
          <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Submitted Today</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-[#006633]">{activeOffices.length - pendingList.length}</span>
            <CheckCircle2 className="w-5 h-5 text-[#006633]" />
          </div>
        </div>

        <div className="bg-white border border-red-200 bg-red-50/20 p-3.5 rounded-lg shadow-xs">
          <p className="text-[10px] text-red-800 font-bold uppercase tracking-wider">Pending Offices Today</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-red-600">{pendingList.length}</span>
            <Clock className="w-5 h-5 text-red-600" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 p-3.5 rounded-lg shadow-xs">
          <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Total Pending Submissions</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-amber-700">{totalPendingReportsCount}</span>
            <CalendarDays className="w-5 h-5 text-amber-700" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-200 p-3.5 rounded-lg shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search office, postmaster, or mobile..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633] focus:border-[#006633]"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-gray-500 font-medium">Filter:</span>
          <button
            onClick={() => setFilterMode('ALL_PENDING')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              filterMode === 'ALL_PENDING'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Pending ({pendingList.length})
          </button>
          <button
            onClick={() => setFilterMode('MULTI_DATE_ONLY')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
              filterMode === 'MULTI_DATE_ONLY'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Multi-Date Pending ({pendingList.filter((p) => p.missingDates.length > 1).length})
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
        {filteredPendingList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-black uppercase tracking-wider border-b border-gray-200 text-[10.5px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Office Name (دفتر کا نام)</th>
                  <th className="p-3">Postmaster Name (پوسٹ ماسٹر)</th>
                  <th className="p-3">Mobile Number (رابطہ نمبر)</th>
                  <th className="p-3">Pending Count (تعداد)</th>
                  <th className="p-3">Missing Dates (مورخہ جات)</th>
                  <th className="p-3">Last Submitted</th>
                  <th className="p-3 text-center">Live Status</th>
                  <th className="p-3 text-center">Actions & WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {filteredPendingList.map((item, idx) => {
                  const reminderMsg = getUrduReminderTemplate(item.missingDates.length > 0 ? item.missingDates : selectedDate);
                  const directLink = generateWhatsAppWebLink(
                    item.office.mobileNumber,
                    `محترم پوسٹ ماسٹر صاحب (${item.office.name})،\n\n` + reminderMsg,
                    whatsAppConfig.webAppUrl
                  );

                  return (
                    <tr key={item.office.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="p-3 text-gray-400 font-mono font-bold">{idx + 1}</td>
                      <td className="p-3 font-extrabold text-gray-900">
                        <div className="flex items-center space-x-2">
                          <Building className="w-3.5 h-3.5 text-[#006633] shrink-0" />
                          <span>{item.office.name}</span>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-gray-800">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{item.office.postmasterName || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-[#006633] font-mono font-bold">
                        <div className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-[#006633] shrink-0" />
                          <span>{item.office.mobileNumber}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black ${
                            item.missingDates.length > 1
                              ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {item.missingDates.length > 0 ? item.missingDates.length : 1}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.missingDates.length > 1 ? (
                          <div className="space-y-1 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {item.missingDates.map((d) => (
                                <span
                                  key={d}
                                  className="bg-red-50 text-red-700 border border-red-200 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold"
                                >
                                  {formatDatePK(d)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-800 font-mono font-semibold text-xs">
                            {formatDatePK(selectedDate)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-500 font-mono text-[11px]">
                        {item.lastReportDate ? formatDatePK(item.lastReportDate) : <span className="text-red-500 font-bold">No Record</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-red-50 text-red-700 border border-red-200 text-[9.5px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                          PENDING
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Send WhatsApp Cloud API / Direct */}
                          <button
                            onClick={() => handleSendSingleReminder(item.office, item.missingDates)}
                            disabled={singleSendingId === item.office.id}
                            className="bg-[#25D366] hover:bg-emerald-600 text-white font-bold text-[10.5px] px-2.5 py-1.5 rounded-md transition-all flex items-center space-x-1 shadow-xs cursor-pointer disabled:opacity-50"
                            title="Send WhatsApp Reminder"
                          >
                            {singleSendingId === item.office.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>WhatsApp</span>
                          </button>

                          {/* Issue Explanation Call Button */}
                          {onNavigateExplanation && (
                            <button
                              onClick={() => onNavigateExplanation(item.office.name)}
                              className="bg-red-700 hover:bg-red-800 text-white font-bold text-[10.5px] px-2.5 py-1.5 rounded-md transition-all flex items-center space-x-1 shadow-xs cursor-pointer"
                              title="Generate Official Explanation Call Letter for this Postmaster"
                            >
                              <AlertTriangle className="w-3 h-3 text-yellow-300" />
                              <span>Explanation</span>
                            </button>
                          )}

                          {/* Copy Urdu Message */}
                          <button
                            onClick={() => handleCopySingleMessage(item.office, item.missingDates)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border border-gray-300 transition-colors cursor-pointer"
                            title="Copy Urdu Reminder Text"
                          >
                            {copiedOfficeId === item.office.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Direct WhatsApp Web link */}
                          <a
                            href={directLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#006633] rounded-md border border-emerald-300 transition-colors"
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
            <h3 className="text-sm font-extrabold text-gray-900 uppercase">
              {searchTerm ? 'No Matching Offices' : '100% Compliance Achieved!'}
            </h3>
            <p className="mt-1 text-gray-500 font-medium">
              {searchTerm
                ? 'Try a different search term or clear the filter.'
                : `All active post offices have successfully submitted their Daily Delivery Reports for ${formatDatePK(
                    selectedDate
                  )}.`}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md font-bold transition-colors"
              >
                Clear Search Filter
              </button>
            )}
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

