import React, { useState, useMemo } from 'react';
import { DailyReport, PostOffice, User, ArticleCategoryConfig } from '../types';
import {
  formatNumber,
  formatDatePK,
  getTodayDateString,
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
  buildDailyPostmanArticleReport,
  FINAL_ARTICLE_CATEGORIES,
  DailyPostmanArticleReportData,
  PostmanReportRow,
  OfficeReportGroup,
  isSunday,
  isHoliday,
  getHolidayReason,
  summarizeReports,
} from '../utils/calculations';
import {
  Edit2,
  Trash2,
  FileSpreadsheet,
  Download,
  Building2,
  XCircle,
  Printer,
  Calendar,
  AlertTriangle,
  Clock,
  Eye,
  X,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  PlusCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';
import {
  exportDailyPostmanArticleReportToExcel,
  exportDailyReportsToExcel,
} from '../utils/excelExport';
import {
  triggerDailyPostmanArticleReportPrint,
  triggerPrintableWindow,
} from '../utils/pdfGenerator';

interface ReportsListProps {
  reports: DailyReport[];
  postOffices?: PostOffice[];
  categories?: ArticleCategoryConfig[];
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
  currentUser: User | null;
  onEditReport: (report: DailyReport) => void;
  onDeleteReport: (reportId: string) => void;
  onOpenNewReport?: () => void;
  onNavigatePending?: () => void;
  onLogAction?: (action: string, details: string, type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR') => void;
}

export const ReportsList: React.FC<ReportsListProps> = ({
  reports,
  postOffices = [],
  categories = [],
  selectedDate: propSelectedDate,
  setSelectedDate: propSetSelectedDate,
  currentUser,
  onEditReport,
  onDeleteReport,
  onOpenNewReport,
  onNavigatePending,
}) => {
  const today = getTodayDateString();
  const activeDate = propSelectedDate || today;
  const setDate = (d: string) => {
    if (propSetSelectedDate) {
      propSetSelectedDate(d);
    }
  };

  // View mode: 'daily-postman' (primary required format) vs 'historical-all'
  const [viewMode, setViewMode] = useState<'daily-postman' | 'historical-all'>('daily-postman');

  // Date selection mode: 'single' vs 'range' (Multi-Date / Date Range)
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [fromDate, setFromDate] = useState<string>(() => {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch {
      return today;
    }
  });
  const [toDate, setToDate] = useState<string>(today);

  const handleSetQuickRange = (preset: 'today' | '3days' | '7days' | '15days' | 'thisMonth') => {
    const end = today;
    setToDate(end);
    const d = new Date();
    if (preset === 'today') {
      setFromDate(end);
    } else if (preset === '3days') {
      d.setDate(d.getDate() - 2);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setFromDate(`${y}-${m}-${day}`);
    } else if (preset === '7days') {
      d.setDate(d.getDate() - 6);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setFromDate(`${y}-${m}-${day}`);
    } else if (preset === '15days') {
      d.setDate(d.getDate() - 14);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setFromDate(`${y}-${m}-${day}`);
    } else if (preset === 'thisMonth') {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      setFromDate(`${y}-${m}-01`);
    }
  };

  // Filters for Daily Postman Report
  const [filterOffice, setFilterOffice] = useState('');
  const [searchPostman, setSearchPostman] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Submitted' | 'Report Not Submitted' | 'Incomplete'>('ALL');

  // Confirmation modal state for admin deletion
  const [reportToDelete, setReportToDelete] = useState<DailyReport | null>(null);
  // View details modal state
  const [viewingReport, setViewingReport] = useState<DailyReport | null>(null);

  const validOffices = useMemo(() => cleanAndFilterPostOffices(postOffices), [postOffices]);
  const validReports = useMemo(() => cleanAndFilterReports(reports), [reports]);

  // Role Filtering: Post Office users only see their own office reports if restricted
  const userOffice = currentUser?.role === 'POST_OFFICE' ? currentUser.officeName : '';

  // Extract all unique office names for dropdown
  const officeOptions = useMemo(() => {
    const names = new Set<string>();
    validOffices.forEach((p) => names.add(p.name));
    validReports.forEach((r) => names.add(r.officeName));
    return Array.from(names).sort();
  }, [validOffices, validReports]);

  // Build the comprehensive Daily Postman Article Report Data for the active date or date range
  const rawReportData: DailyPostmanArticleReportData = useMemo(() => {
    if (dateMode === 'range') {
      return buildDailyPostmanArticleReport(validReports, validOffices, fromDate, toDate);
    }
    return buildDailyPostmanArticleReport(validReports, validOffices, activeDate);
  }, [validReports, validOffices, dateMode, activeDate, fromDate, toDate]);

  // Filter the report data according to user role and UI filters
  const filteredReportData: DailyPostmanArticleReportData = useMemo(() => {
    const effectiveOffice = userOffice || filterOffice;
    const searchLower = searchPostman.toLowerCase().trim();

    let filteredGroups: OfficeReportGroup[] = rawReportData.officeGroups;

    if (effectiveOffice) {
      filteredGroups = filteredGroups.filter(
        (g) => g.officeName.toLowerCase() === effectiveOffice.toLowerCase()
      );
    }

    // Filter postman rows inside groups
    filteredGroups = filteredGroups
      .map((group) => {
        const matchingRows = group.postmanRows.filter((pm) => {
          if (filterStatus !== 'ALL' && pm.status !== filterStatus) {
            return false;
          }
          if (searchLower) {
            const matchName = pm.postmanName.toLowerCase().includes(searchLower);
            const matchOffice = pm.officeName.toLowerCase().includes(searchLower);
            if (!matchName && !matchOffice) return false;
          }
          return true;
        });

        // Recalculate group totals for the filtered set of rows
        let subCount = 0;
        let notSubCount = 0;
        let incCount = 0;

        const totals = {
          lastBalance: 0,
          receivedByCategory: {} as Record<string, number>,
          receivedTotal: 0,
          deliveredByCategory: {} as Record<string, number>,
          deliveredTotal: 0,
          totalAvailable: 0,
          returnedToSender: 0,
          missent: 0,
          deposit: 0,
          deliveryPercentage: null as number | null,
        };

        FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
          totals.receivedByCategory[cat.key] = 0;
          totals.deliveredByCategory[cat.key] = 0;
        });

        for (const row of matchingRows) {
          if (row.status === 'Submitted') subCount++;
          else if (row.status === 'Incomplete') incCount++;
          else notSubCount++;

          if (row.hasSubmission) {
            totals.lastBalance += row.lastBalance || 0;
            totals.receivedTotal += row.receivedTotal || 0;
            totals.deliveredTotal += row.deliveredTotal || 0;
            totals.totalAvailable += row.totalAvailable || 0;
            totals.returnedToSender += row.returnedToSender || 0;
            totals.missent += row.missent || 0;
            totals.deposit += row.deposit || 0;

            FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
              totals.receivedByCategory[cat.key] += row.received[cat.key] || 0;
              totals.deliveredByCategory[cat.key] += row.delivered[cat.key] || 0;
            });
          }
        }

        const compRate = matchingRows.length > 0 ? (subCount / matchingRows.length) * 100 : 0;
        if (totals.totalAvailable > 0) {
          totals.deliveryPercentage = (totals.deliveredTotal / totals.totalAvailable) * 100;
        }

        return {
          ...group,
          postmanRows: matchingRows,
          totalRegisteredPostmen: matchingRows.length,
          submittedCount: subCount,
          notSubmittedCount: notSubCount,
          incompleteCount: incCount,
          completionRate: compRate,
          totals,
        };
      })
      .filter((g) => g.postmanRows.length > 0);

    // Calculate Grand Totals across all filtered groups
    const grandTotals = {
      totalOffices: filteredGroups.length,
      totalRegisteredPostmen: 0,
      submittedCount: 0,
      notSubmittedCount: 0,
      incompleteCount: 0,
      completionRate: 0,
      lastBalance: 0,
      receivedByCategory: {} as Record<string, number>,
      receivedTotal: 0,
      deliveredByCategory: {} as Record<string, number>,
      deliveredTotal: 0,
      totalAvailable: 0,
      returnedToSender: 0,
      missent: 0,
      deposit: 0,
      deliveryPercentage: null as number | null,
    };

    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      grandTotals.receivedByCategory[cat.key] = 0;
      grandTotals.deliveredByCategory[cat.key] = 0;
    });

    const allFilteredRows: PostmanReportRow[] = [];

    for (const group of filteredGroups) {
      allFilteredRows.push(...group.postmanRows);
      grandTotals.totalRegisteredPostmen += group.totalRegisteredPostmen;
      grandTotals.submittedCount += group.submittedCount;
      grandTotals.notSubmittedCount += group.notSubmittedCount;
      grandTotals.incompleteCount += group.incompleteCount;

      grandTotals.lastBalance += group.totals.lastBalance;
      grandTotals.receivedTotal += group.totals.receivedTotal;
      grandTotals.deliveredTotal += group.totals.deliveredTotal;
      grandTotals.totalAvailable += group.totals.totalAvailable;
      grandTotals.returnedToSender += group.totals.returnedToSender;
      grandTotals.missent += group.totals.missent;
      grandTotals.deposit += group.totals.deposit;

      FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
        grandTotals.receivedByCategory[cat.key] += group.totals.receivedByCategory[cat.key] || 0;
        grandTotals.deliveredByCategory[cat.key] += group.totals.deliveredByCategory[cat.key] || 0;
      });
    }

    if (grandTotals.totalRegisteredPostmen > 0) {
      grandTotals.completionRate =
        (grandTotals.submittedCount / grandTotals.totalRegisteredPostmen) * 100;
    }
    if (grandTotals.totalAvailable > 0) {
      grandTotals.deliveryPercentage =
        (grandTotals.deliveredTotal / grandTotals.totalAvailable) * 100;
    }

    return {
      reportDate: rawReportData.reportDate,
      startDate: rawReportData.startDate,
      endDate: rawReportData.endDate,
      isDateRange: rawReportData.isDateRange,
      totalDaysInRange: rawReportData.totalDaysInRange,
      officeGroups: filteredGroups,
      allRows: allFilteredRows,
      grandTotals,
    };
  }, [rawReportData, userOffice, filterOffice, searchPostman, filterStatus]);

  // Date step helper (Previous / Next Day)
  const handleStepDate = (direction: 'prev' | 'next') => {
    try {
      const cur = new Date(activeDate);
      cur.setDate(cur.getDate() + (direction === 'prev' ? -1 : 1));
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      setDate(`${y}-${m}-${d}`);
    } catch (_) {
      setDate(today);
    }
  };

  const isToday = activeDate === today;
  const isSun = isSunday(activeDate);
  const isHol = isHoliday(activeDate);
  const holReason = getHolidayReason(activeDate);

  const isAdmin = currentUser?.role === 'ADMIN';

  // Export handlers
  const handleExportExcel = () => {
    const exportName = dateMode === 'range'
      ? `Pakistan_Post_Postman_Article_Report_${fromDate}_to_${toDate}`
      : `Pakistan_Post_Daily_Postman_Article_Report_${activeDate}`;
    exportDailyPostmanArticleReportToExcel(filteredReportData, exportName);
  };

  const handlePrintA4Landscape = () => {
    triggerDailyPostmanArticleReportPrint(filteredReportData, 'Gujranwala Division');
  };

  const handleClearFilters = () => {
    setFilterOffice('');
    setSearchPostman('');
    setFilterStatus('ALL');
  };

  const hasActiveFilters = Boolean(filterOffice || searchPostman || filterStatus !== 'ALL');

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* MAIN HEADER: DAILY POSTMAN ARTICLE REPORT                                */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Title Bar & Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-[#00401A] text-yellow-300 border border-[#005522] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                PAKISTAN POST
              </span>
              <span className="text-gray-500 text-xs font-semibold">Gujranwala Division</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-gray-950 uppercase tracking-tight mt-1 flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-[#006633]" />
              <span>DAILY POSTMAN ARTICLE REPORT</span>
            </h1>
            <p className="text-xs text-gray-500 font-semibold tracking-wide uppercase mt-0.5">
              Office Wise &amp; Postman Wise
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {onNavigatePending && (
              <button
                type="button"
                onClick={onNavigatePending}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                title="View offices with missing submissions"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Offices</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintA4Landscape}
              className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print official Pakistan Post A4 Landscape Report"
            >
              <Printer className="w-3.5 h-3.5 text-yellow-400" />
              <span>Print A4 Landscape</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Download Excel Spreadsheet with all 31 columns"
            >
              <Download className="w-3.5 h-3.5 text-yellow-400" />
              <span>Export to Excel</span>
            </button>

            {onOpenNewReport && (
              <button
                type="button"
                onClick={onOpenNewReport}
                className="bg-[#006633] hover:bg-[#00401A] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Report</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Mode Switcher: Single Date vs Date Range */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-gray-100 pb-2.5">
          <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setDateMode('single')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                dateMode === 'single'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#006633]" />
              <span>Single Date (ایک تاریخ)</span>
            </button>
            <button
              type="button"
              onClick={() => setDateMode('range')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center space-x-1.5 ${
                dateMode === 'range'
                  ? 'bg-[#006633] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-yellow-300" />
              <span>Date Range / Multi-Date (مختلف تواریخ کا مجموعہ)</span>
            </button>
          </div>

          {dateMode === 'range' && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-gray-500 font-bold uppercase text-[10px] mr-1">Quick Range:</span>
              <button
                type="button"
                onClick={() => handleSetQuickRange('today')}
                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-bold text-gray-700 cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickRange('3days')}
                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-bold text-gray-700 cursor-pointer"
              >
                Last 3 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickRange('7days')}
                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-bold text-gray-700 cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickRange('15days')}
                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-bold text-gray-700 cursor-pointer"
              >
                Last 15 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickRange('thisMonth')}
                className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-bold text-gray-700 cursor-pointer"
              >
                This Month
              </button>
            </div>
          )}
        </div>

        {/* Date Selector Banner: Single Date vs Multi-Date Range */}
        {dateMode === 'single' ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-gray-700 uppercase">Selected Date:</span>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handleStepDate('prev')}
                  className="p-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded text-gray-700 transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <input
                  type="date"
                  value={activeDate}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
                />

                <button
                  type="button"
                  onClick={() => handleStepDate('next')}
                  className="p-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded text-gray-700 transition-colors cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {!isToday && (
                <button
                  type="button"
                  onClick={() => setDate(today)}
                  className="text-[11px] bg-[#006633] text-white hover:bg-[#00401A] px-2.5 py-1.5 rounded font-bold transition-colors cursor-pointer"
                >
                  Go to Today
                </button>
              )}

              {isSun && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-1 rounded">
                  Sunday Holiday
                </span>
              )}
              {isHol && (
                <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-black px-2 py-1 rounded">
                  {holReason || 'Public Holiday'} (Closed)
                </span>
              )}
            </div>

            <div className="text-xs text-gray-600 font-medium">
              Report Date:{' '}
              <strong className="text-gray-950 font-mono font-bold">
                {formatDatePK(activeDate)}
              </strong>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-emerald-950 uppercase flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-[#006633]" />
                <span>From Date:</span>
              </span>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
              />

              <span className="text-xs font-bold text-emerald-950 uppercase">To Date:</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
              />

              <span className="bg-[#00401A] text-yellow-300 text-[10px] font-black px-2.5 py-1 rounded">
                {filteredReportData.totalDaysInRange || 1} Days Consolidated
              </span>
            </div>

            <div className="text-xs text-emerald-900 font-medium">
              Consolidated Range:{' '}
              <strong className="text-gray-950 font-mono font-bold">
                {formatDatePK(fromDate)} — {formatDatePK(toDate)}
              </strong>
            </div>
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 text-xs pt-1">
          {/* Office Filter Dropdown */}
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Filter by Post Office
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                disabled={Boolean(userOffice)}
                className="w-full bg-white text-gray-900 text-xs font-medium pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633] disabled:bg-gray-100"
              >
                <option value="">All Post Offices ({officeOptions.length})</option>
                {officeOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Postman */}
          <div className="lg:col-span-4">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Search Postman / Office
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Type postman name or office..."
                value={searchPostman}
                onChange={(e) => setSearchPostman(e.target.value)}
                className="w-full bg-white text-gray-900 text-xs font-medium pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Submission Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full bg-white text-gray-900 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
            >
              <option value="ALL">All Statuses (Sub + Not Sub)</option>
              <option value="Submitted">Submitted Only</option>
              <option value="Report Not Submitted">Report Not Submitted</option>
              <option value="Incomplete">Incomplete Reports</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="lg:col-span-1 flex items-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="w-full py-1.5 text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg font-bold flex items-center justify-center transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUMMARY STATS BANNER FOR SELECTED DATE                                    */}
      {/* ========================================================================= */}
      <div className="bg-[#00401A] text-white p-4 rounded-xl shadow-sm border border-[#005522]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#005522]/80 pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-emerald-300" />
            <h2 className="font-extrabold text-sm uppercase tracking-wide text-white">
              {filterOffice ? `${filterOffice} — Postman Article Summary` : 'Gujranwala Division — Article Performance'}
            </h2>
            <span className="bg-emerald-800 text-yellow-300 text-[10px] font-black px-2 py-0.5 rounded font-mono">
              {filteredReportData.grandTotals.totalOffices} Offices • {filteredReportData.grandTotals.totalRegisteredPostmen} Postmen
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-emerald-200">
              Submitted:{' '}
              <strong className="text-white font-mono">
                {filteredReportData.grandTotals.submittedCount} / {filteredReportData.grandTotals.totalRegisteredPostmen}
              </strong>{' '}
              ({filteredReportData.grandTotals.completionRate.toFixed(1)}%)
            </span>
            <span className="text-amber-200">
              Pending:{' '}
              <strong className="text-white font-mono">
                {filteredReportData.grandTotals.notSubmittedCount}
              </strong>
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
            <span className="text-[10px] text-emerald-200 block font-bold uppercase">Last Bal</span>
            <strong className="text-sm sm:text-base font-black text-white font-mono">
              {formatNumber(filteredReportData.grandTotals.lastBalance)}
            </strong>
          </div>
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
            <span className="text-[10px] text-emerald-200 block font-bold uppercase">Total Received</span>
            <strong className="text-sm sm:text-base font-black text-yellow-300 font-mono">
              {formatNumber(filteredReportData.grandTotals.receivedTotal)}
            </strong>
          </div>
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
            <span className="text-[10px] text-emerald-200 block font-bold uppercase">Total Delivered</span>
            <strong className="text-sm sm:text-base font-black text-emerald-300 font-mono">
              {formatNumber(filteredReportData.grandTotals.deliveredTotal)}
            </strong>
          </div>
          <div className="bg-emerald-900/90 p-2.5 rounded-lg border border-emerald-400">
            <span className="text-[10px] text-yellow-200 block font-bold uppercase">Delivery %</span>
            <strong className="text-base sm:text-lg font-black text-yellow-300 font-mono">
              {filteredReportData.grandTotals.deliveryPercentage !== null
                ? `${filteredReportData.grandTotals.deliveryPercentage.toFixed(1)}%`
                : '0.0%'}
            </strong>
          </div>
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
            <span className="text-[10px] text-emerald-200 block font-bold uppercase">Returned / Mis</span>
            <strong className="text-sm sm:text-base font-black text-rose-300 font-mono">
              {formatNumber(filteredReportData.grandTotals.returnedToSender + filteredReportData.grandTotals.missent)}
            </strong>
          </div>
          <div className="bg-white/10 p-2.5 rounded-lg border border-white/20">
            <span className="text-[10px] text-emerald-200 block font-bold uppercase">Deposit / Not Del</span>
            <strong className="text-sm sm:text-base font-black text-blue-300 font-mono">
              {formatNumber(filteredReportData.grandTotals.deposit)}
            </strong>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 31-COLUMN DAILY POSTMAN ARTICLE REPORT TABLE                              */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filteredReportData.officeGroups.length > 0 ? (
          <div className="overflow-x-auto max-h-[750px] relative">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Head: 2-Tier Header Structure */}
              <thead className="bg-[#00401A] text-white text-[10px] uppercase font-bold sticky top-0 z-20 shadow-xs">
                {/* Header Row 1 */}
                <tr className="border-b border-[#005522]">
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-center w-8">
                    Sr
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] min-w-[130px]">
                    Office Name
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] min-w-[130px]">
                    Postman Name
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-right min-w-[65px]">
                    Last Bal
                  </th>

                  {/* 10 Received Categories + Received Total (11 Columns) */}
                  <th colSpan={11} className="p-1.5 text-center bg-[#005522] border-r border-emerald-700 tracking-wider font-black">
                    RECEIVED ARTICLES
                  </th>

                  {/* 10 Delivered Categories + Delivered Total (11 Columns) */}
                  <th colSpan={11} className="p-1.5 text-center bg-[#047857] border-r border-teal-700 tracking-wider font-black">
                    DELIVERED ARTICLES
                  </th>

                  {/* Outcomes & Balances */}
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-right min-w-[55px] text-red-200">
                    Returned
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-right min-w-[55px] text-amber-200">
                    Missent
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-right min-w-[65px] text-blue-200">
                    Deposit
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-right min-w-[65px] text-yellow-300 font-black">
                    Deliv %
                  </th>
                  <th rowSpan={2} className="p-2 border-r border-[#005522] text-center min-w-[100px]">
                    Status
                  </th>
                  <th rowSpan={2} className="p-2 text-center min-w-[90px] no-print">
                    Actions
                  </th>
                </tr>

                {/* Header Row 2: Category Names */}
                <tr className="border-b-2 border-gray-300 text-[9px]">
                  {/* Received Categories */}
                  {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                    <th key={`recv-${cat.key}`} className="p-1.5 text-right bg-[#004d1f] border-r border-[#005d26]">
                      {cat.label}
                    </th>
                  ))}
                  <th className="p-1.5 text-right bg-[#003817] border-r border-emerald-800 font-black text-yellow-300 min-w-[60px]">
                    Total Recv
                  </th>

                  {/* Delivered Categories */}
                  {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                    <th key={`deliv-${cat.key}`} className="p-1.5 text-right bg-[#056d4f] border-r border-[#07805d]">
                      {cat.label}
                    </th>
                  ))}
                  <th className="p-1.5 text-right bg-[#034d38] border-r border-teal-800 font-black text-emerald-200 min-w-[60px]">
                    Total Deliv
                  </th>
                </tr>
              </thead>

              {/* Table Body: Grouped by Office */}
              <tbody className="divide-y divide-gray-200 text-gray-800 font-medium">
                {filteredReportData.officeGroups.map((group, groupIdx) => {
                  return (
                    <React.Fragment key={`group-${group.officeName}-${groupIdx}`}>
                      {/* Office Group Header Row */}
                      <tr className="bg-slate-100 border-t-2 border-b border-slate-300 font-bold text-gray-900 sticky z-10">
                        <td colSpan={32} className="p-2 sm:px-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <Building2 className="w-4 h-4 text-[#006633]" />
                              <span className="font-extrabold text-gray-900 uppercase tracking-tight text-xs">
                                {group.officeName}
                              </span>
                              {group.office.postmasterName && (
                                <span className="text-[10px] text-gray-500 font-normal">
                                  • Incharge: <strong className="text-gray-700">{group.office.postmasterName}</strong>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 text-[11px]">
                              <span className="text-gray-600">
                                Roster:{' '}
                                <strong className="text-gray-900 font-mono">
                                  {group.totalRegisteredPostmen}
                                </strong>{' '}
                                Postmen
                              </span>
                              <span className="text-[#006633]">
                                Submitted:{' '}
                                <strong className="font-mono">
                                  {group.submittedCount} / {group.totalRegisteredPostmen}
                                </strong>{' '}
                                ({group.completionRate.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Postman Rows */}
                      {group.postmanRows.map((row) => {
                        const isSub = row.hasSubmission;
                        const canEdit = isSub && row.report && (isAdmin || row.report.date === today);
                        const pctStr =
                          row.deliveryPercentage !== null ? `${row.deliveryPercentage.toFixed(1)}%` : '-';

                        const valCell = (v: number | null | undefined) =>
                          isSub && v !== null && v !== undefined ? (
                            <span className="font-mono">{formatNumber(v)}</span>
                          ) : (
                            <span className="text-gray-300 select-none">—</span>
                          );

                        return (
                          <tr
                            key={`pm-row-${group.officeName}-${row.postmanName}-${row.srNo}`}
                            className={`hover:bg-amber-50/40 transition-colors ${
                              !isSub ? 'bg-red-50/20' : ''
                            }`}
                          >
                            <td className="p-2 text-center text-gray-500 font-mono text-[11px] border-r border-gray-100">
                              {row.srNo}
                            </td>
                            <td className="p-2 font-bold text-gray-900 border-r border-gray-100">
                              {row.officeName}
                            </td>
                            <td className="p-2 border-r border-gray-100">
                              <span className="font-extrabold text-gray-900">{row.postmanName}</span>
                              {!row.isRegisteredPostman && (
                                <span className="block text-[9px] text-gray-400 italic">Office General</span>
                              )}
                            </td>
                            <td className="p-2 text-right border-r border-gray-100 font-mono text-gray-600">
                              {valCell(row.lastBalance)}
                            </td>

                            {/* 10 Received Categories */}
                            {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                              <td
                                key={`r-${cat.key}-${row.srNo}`}
                                className="p-1.5 text-right border-r border-gray-100 font-mono text-gray-700"
                              >
                                {valCell(row.received[cat.key])}
                              </td>
                            ))}
                            {/* Received Total */}
                            <td className="p-1.5 text-right border-r border-gray-200 font-mono font-bold text-[#006633] bg-emerald-50/40">
                              {valCell(row.receivedTotal)}
                            </td>

                            {/* 10 Delivered Categories */}
                            {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                              <td
                                key={`d-${cat.key}-${row.srNo}`}
                                className="p-1.5 text-right border-r border-gray-100 font-mono text-gray-700"
                              >
                                {valCell(row.delivered[cat.key])}
                              </td>
                            ))}
                            {/* Delivered Total */}
                            <td className="p-1.5 text-right border-r border-gray-200 font-mono font-bold text-emerald-800 bg-teal-50/40">
                              {valCell(row.deliveredTotal)}
                            </td>

                            {/* Returned, Missent, Deposit */}
                            <td className="p-1.5 text-right border-r border-gray-100 font-mono text-red-600">
                              {valCell(row.returnedToSender)}
                            </td>
                            <td className="p-1.5 text-right border-r border-gray-100 font-mono text-amber-600">
                              {valCell(row.missent)}
                            </td>
                            <td className="p-1.5 text-right border-r border-gray-100 font-mono text-blue-700 font-semibold">
                              {valCell(row.deposit)}
                            </td>

                            {/* Delivery % */}
                            <td className="p-1.5 text-right border-r border-gray-100 font-mono font-black text-xs">
                              {isSub && row.deliveryPercentage !== null ? (
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                                    row.deliveryPercentage >= 90
                                      ? 'bg-green-100 text-[#006633]'
                                      : row.deliveryPercentage >= 70
                                      ? 'bg-yellow-100 text-amber-800'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {pctStr}
                                </span>
                              ) : (
                                <span className="text-gray-300 select-none">—</span>
                              )}
                            </td>

                            {/* Report Status */}
                            <td className="p-1.5 text-center border-r border-gray-100 whitespace-nowrap">
                              {row.status === 'Submitted' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-[#006633] border border-green-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>
                                    {filteredReportData.isDateRange && row.submissionCount !== undefined
                                      ? `${row.submissionCount}/${filteredReportData.totalDaysInRange || 1} Days`
                                      : 'Submitted'}
                                  </span>
                                </span>
                              )}
                              {row.status === 'Report Not Submitted' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Not Submitted</span>
                                </span>
                              )}
                              {row.status === 'Incomplete' && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  <HelpCircle className="w-3 h-3" />
                                  <span>Incomplete</span>
                                </span>
                              )}
                            </td>

                            {/* Action Buttons */}
                            <td className="p-1.5 text-center whitespace-nowrap no-print">
                              <div className="flex items-center justify-center space-x-1">
                                {isSub && row.report ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setViewingReport(row.report!)}
                                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors cursor-pointer"
                                      title="View Breakdown Details"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>

                                    {canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => onEditReport(row.report!)}
                                        className="p-1.5 bg-gray-100 hover:bg-amber-100 text-amber-800 rounded border border-gray-200 transition-colors cursor-pointer"
                                        title="Edit Report"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-gray-400 italic">Locked</span>
                                    )}

                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => setReportToDelete(row.report!)}
                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 transition-colors cursor-pointer"
                                        title="Delete Report (Admin Only)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Shortcut to open DailyReportForm with this office and postman prefilled
                                      const mockReport: DailyReport = {
                                        id: '',
                                        date: activeDate,
                                        officeName: row.officeName,
                                        postmasterName: group.office.postmasterName || '',
                                        postmanName: row.postmanName,
                                        postmanId: row.postmanId,
                                        lastBalance: 0,
                                        receivedToday: 0,
                                        delivered: 0,
                                        returnedToSender: 0,
                                        missent: 0,
                                        deposit: 0,
                                        closingBalance: 0,
                                        remarks: '',
                                        submittedBy: currentUser?.username || 'Admin',
                                        submittedAt: new Date().toISOString(),
                                      };
                                      onEditReport(mockReport);
                                    }}
                                    className="px-2 py-1 bg-[#006633] hover:bg-[#00401A] text-white rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center space-x-0.5 shadow-2xs"
                                    title="Submit Report for this Postman"
                                  >
                                    <PlusCircle className="w-3 h-3" />
                                    <span>Submit</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Office Total Row */}
                      <tr className="bg-[#e2f0d9] border-t border-b-2 border-[#006633] text-gray-900 font-extrabold text-xs">
                        <td className="p-2 text-center text-[#006633] font-black border-r border-emerald-300">
                          Σ
                        </td>
                        <td colSpan={2} className="p-2 border-r border-emerald-300 uppercase tracking-tight">
                          <span className="text-[#00401A]">{group.officeName} TOTAL</span>
                        </td>
                        <td className="p-2 text-right border-r border-emerald-300 font-mono text-gray-900">
                          {formatNumber(group.totals.lastBalance)}
                        </td>

                        {/* 10 Received Totals */}
                        {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                          <td
                            key={`ot-rec-${cat.key}-${groupIdx}`}
                            className="p-1.5 text-right border-r border-emerald-300 font-mono text-gray-900"
                          >
                            {formatNumber(group.totals.receivedByCategory[cat.key] || 0)}
                          </td>
                        ))}
                        <td className="p-1.5 text-right border-r border-emerald-400 font-mono font-black text-[#00401A] bg-emerald-200/50">
                          {formatNumber(group.totals.receivedTotal)}
                        </td>

                        {/* 10 Delivered Totals */}
                        {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                          <td
                            key={`ot-del-${cat.key}-${groupIdx}`}
                            className="p-1.5 text-right border-r border-emerald-300 font-mono text-gray-900"
                          >
                            {formatNumber(group.totals.deliveredByCategory[cat.key] || 0)}
                          </td>
                        ))}
                        <td className="p-1.5 text-right border-r border-emerald-400 font-mono font-black text-emerald-900 bg-teal-200/50">
                          {formatNumber(group.totals.deliveredTotal)}
                        </td>

                        <td className="p-1.5 text-right border-r border-emerald-300 font-mono text-red-800">
                          {formatNumber(group.totals.returnedToSender)}
                        </td>
                        <td className="p-1.5 text-right border-r border-emerald-300 font-mono text-amber-800">
                          {formatNumber(group.totals.missent)}
                        </td>
                        <td className="p-1.5 text-right border-r border-emerald-300 font-mono text-blue-900 font-black">
                          {formatNumber(group.totals.deposit)}
                        </td>

                        {/* Office Delivery % */}
                        <td className="p-1.5 text-right border-r border-emerald-300 font-mono font-black text-xs text-[#00401A]">
                          {group.totals.deliveryPercentage !== null
                            ? `${group.totals.deliveryPercentage.toFixed(1)}%`
                            : '0.0%'}
                        </td>
                        <td className="p-1.5 text-center border-r border-emerald-300 text-[10px] font-bold text-emerald-900">
                          {group.submittedCount} / {group.totalRegisteredPostmen} Sub
                        </td>
                        <td className="p-1.5 text-center text-[10px] text-gray-400 no-print">—</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Table Footer: GRAND TOTAL ROW */}
              <tfoot className="bg-[#00401A] text-white font-extrabold text-xs sticky bottom-0 z-20 shadow-md">
                <tr className="border-t-2 border-yellow-400">
                  <td className="p-2.5 text-center text-yellow-300 font-black border-r border-[#005522]">
                    ★
                  </td>
                  <td colSpan={2} className="p-2.5 border-r border-[#005522] uppercase tracking-wider text-yellow-300">
                    GRAND TOTAL ({filteredReportData.grandTotals.totalOffices} OFFICES)
                  </td>
                  <td className="p-2.5 text-right border-r border-[#005522] font-mono text-white">
                    {formatNumber(filteredReportData.grandTotals.lastBalance)}
                  </td>

                  {/* 10 Received Grand Totals */}
                  {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                    <td
                      key={`gt-rec-${cat.key}`}
                      className="p-1.5 text-right border-r border-[#005522] font-mono text-emerald-100"
                    >
                      {formatNumber(filteredReportData.grandTotals.receivedByCategory[cat.key] || 0)}
                    </td>
                  ))}
                  <td className="p-1.5 text-right border-r border-[#005522] font-mono font-black text-yellow-300 bg-emerald-900">
                    {formatNumber(filteredReportData.grandTotals.receivedTotal)}
                  </td>

                  {/* 10 Delivered Grand Totals */}
                  {FINAL_ARTICLE_CATEGORIES.map((cat) => (
                    <td
                      key={`gt-del-${cat.key}`}
                      className="p-1.5 text-right border-r border-[#005522] font-mono text-emerald-100"
                    >
                      {formatNumber(filteredReportData.grandTotals.deliveredByCategory[cat.key] || 0)}
                    </td>
                  ))}
                  <td className="p-1.5 text-right border-r border-[#005522] font-mono font-black text-emerald-300 bg-teal-900">
                    {formatNumber(filteredReportData.grandTotals.deliveredTotal)}
                  </td>

                  <td className="p-1.5 text-right border-r border-[#005522] font-mono text-rose-300">
                    {formatNumber(filteredReportData.grandTotals.returnedToSender)}
                  </td>
                  <td className="p-1.5 text-right border-r border-[#005522] font-mono text-amber-300">
                    {formatNumber(filteredReportData.grandTotals.missent)}
                  </td>
                  <td className="p-1.5 text-right border-r border-[#005522] font-mono text-blue-300">
                    {formatNumber(filteredReportData.grandTotals.deposit)}
                  </td>

                  {/* Grand Delivery % */}
                  <td className="p-1.5 text-right border-r border-[#005522] font-mono font-black text-sm text-yellow-300">
                    {filteredReportData.grandTotals.deliveryPercentage !== null
                      ? `${filteredReportData.grandTotals.deliveryPercentage.toFixed(1)}%`
                      : '0.0%'}
                  </td>
                  <td className="p-1.5 text-center border-r border-[#005522] text-[10px] uppercase font-bold text-yellow-200">
                    CONSOLIDATED
                  </td>
                  <td className="p-1.5 text-center text-gray-400 no-print">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-gray-500 text-xs space-y-2">
            <p className="font-bold text-gray-700">No postman records found matching your criteria.</p>
            <p>Try clearing filters or selecting another date.</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADMIN DELETE CONFIRMATION MODAL                                           */}
      {/* ========================================================================= */}
      {reportToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 leading-tight">
                  Delete Daily Report (Admin Only)
                </h3>
                <p className="text-xs text-gray-500 font-medium">Permanent Record Deletion</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed mb-4">
              Are you sure you want to permanently delete the daily report for{' '}
              <strong className="text-gray-900 font-bold">{reportToDelete.officeName}</strong> submitted for{' '}
              <strong className="text-gray-900 font-bold font-mono">{formatDatePK(reportToDelete.date)}</strong>?
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[11px] text-red-800 space-y-1 mb-5">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️</span> This action is only authorized for Divisional Superintendent Admin.
              </p>
              <p>This report will be permanently removed from Firebase Cloud Database across all mobile and desktop devices.</p>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setReportToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteReport(reportToDelete.id);
                  setReportToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW REPORT DETAILS MODAL                                                 */}
      {/* ========================================================================= */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Header */}
            <div className="bg-[#00401A] text-white p-4.5 flex items-center justify-between border-b border-[#005522]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-yellow-400 text-[#00401A] rounded-lg flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-tight">
                    {viewingReport.officeName} — Delivery Report Details
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Date: <strong className="text-white font-mono">{formatDatePK(viewingReport.date)}</strong>
                    {viewingReport.postmanName ? ` • Postman: ${viewingReport.postmanName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">Last Bal</span>
                  <span className="text-base font-black font-mono text-gray-800">
                    {formatNumber(viewingReport.lastBalance)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-[#006633] font-bold block uppercase">Received</span>
                  <span className="text-base font-black font-mono text-[#006633]">
                    {formatNumber(viewingReport.receivedToday)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">Delivered</span>
                  <span className="text-base font-black font-mono text-emerald-800">
                    {formatNumber(viewingReport.delivered)}
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Deposit</span>
                  <span className="text-base font-black font-mono text-blue-900">
                    {formatNumber(viewingReport.deposit)}
                  </span>
                </div>
              </div>

              {/* 10 Category Breakdown Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3.5 py-2 font-black text-gray-800 text-[11px] uppercase flex items-center justify-between border-b border-gray-200">
                  <span>Category Breakdown (10 Standard Postal Categories)</span>
                  <span className="text-[#006633] font-bold">RGL &amp; Parcel Combined</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">Category Name</th>
                      <th className="p-2.5 text-right">Received</th>
                      <th className="p-2.5 text-right">Delivered</th>
                      <th className="p-2.5 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                    {FINAL_ARTICLE_CATEGORIES.map((cat) => {
                      const recVal =
                        viewingReport.receivedBreakdown &&
                        viewingReport.receivedBreakdown[cat.key] !== undefined
                          ? Number(viewingReport.receivedBreakdown[cat.key]) || 0
                          : 0;
                      const delVal =
                        viewingReport.deliveredBreakdown &&
                        viewingReport.deliveredBreakdown[cat.key] !== undefined
                          ? Number(viewingReport.deliveredBreakdown[cat.key]) || 0
                          : 0;
                      const bal = Math.max(0, recVal - delVal);

                      return (
                        <tr key={cat.key} className="hover:bg-gray-50/60">
                          <td className="p-2.5 font-bold text-gray-900">{cat.label}</td>
                          <td className="p-2.5 text-right font-mono text-[#006633] font-bold">
                            {formatNumber(recVal)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-800 font-bold">
                            {formatNumber(delVal)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-600">
                            {formatNumber(bal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Outcomes & Balances */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1.5">
                <h4 className="font-bold text-gray-900 text-xs">Outcomes &amp; Balances</h4>
                <div className="flex justify-between">
                  <span className="text-gray-600">Returned to Sender:</span>
                  <strong className="font-mono text-red-700">{formatNumber(viewingReport.returnedToSender)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Missent Articles:</span>
                  <strong className="font-mono text-amber-700">{formatNumber(viewingReport.missent)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit / Undelivered:</span>
                  <strong className="font-mono text-blue-700">{formatNumber(viewingReport.deposit)}</strong>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1">
                  <span className="text-gray-800 font-bold">Closing Balance:</span>
                  <strong className="font-mono text-[#006633] font-black">{formatNumber(viewingReport.closingBalance)}</strong>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
              <span className="text-gray-500 text-[11px]">
                Report ID: <code className="font-mono">{viewingReport.id}</code>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const rep = viewingReport;
                    setViewingReport(null);
                    onEditReport(rep);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center space-x-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Report</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg text-xs cursor-pointer"
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
