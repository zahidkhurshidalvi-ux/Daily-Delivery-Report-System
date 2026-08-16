import React, { useState } from 'react';
import { DailyReport, PostOffice, User } from '../types';
import { formatNumber, formatDatePK, getTodayDateString } from '../utils/calculations';
import {
  Edit2,
  Trash2,
  FileSpreadsheet,
  Download,
  Building2,
  XCircle,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Percent,
  Calendar,
} from 'lucide-react';
import { exportDailyReportsToExcel } from '../utils/excelExport';
import { triggerPrintableWindow } from '../utils/pdfGenerator';

interface ReportsListProps {
  reports: DailyReport[];
  postOffices?: PostOffice[];
  currentUser: User | null;
  onEditReport: (report: DailyReport) => void;
  onDeleteReport: (reportId: string) => void;
  onOpenNewReport: () => void;
}

type SortField =
  | 'date'
  | 'officeName'
  | 'lastBalance'
  | 'receivedToday'
  | 'delivered'
  | 'returnedToSender'
  | 'missent'
  | 'deposit'
  | 'rate';

export const ReportsList: React.FC<ReportsListProps> = ({
  reports,
  postOffices = [],
  currentUser,
  onEditReport,
  onDeleteReport,
  onOpenNewReport,
}) => {
  const today = getTodayDateString();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'range' | 'all'>('single');
  const [singleDate, setSingleDate] = useState(today);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Extract all unique office names from postOffices or reports
  const officeOptions = Array.from(
    new Set([
      ...postOffices.map((p) => p.name),
      ...reports.map((r) => r.officeName),
    ])
  ).sort();

  // 1. Role Filtering: Post Office users only see THEIR OWN office reports if restricted
  const roleFilteredReports =
    currentUser?.role === 'POST_OFFICE' && currentUser.officeName
      ? reports.filter((r) => r.officeName === currentUser.officeName)
      : reports;

  // 2. Base Reports
  const baseReports = roleFilteredReports;

  // 3. Search & Filter criteria: Office, Single Date OR Date Range
  const filteredReports = baseReports.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.officeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.remarks && r.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesDate = true;
    if (dateFilterMode === 'single') {
      matchesDate = !singleDate || r.date === singleDate;
    } else if (dateFilterMode === 'range') {
      const matchesFrom = !fromDate || r.date >= fromDate;
      const matchesTo = !toDate || r.date <= toDate;
      matchesDate = matchesFrom && matchesTo;
    }

    const matchesOffice = !filterOffice || r.officeName === filterOffice;

    return matchesSearch && matchesDate && matchesOffice;
  });

  // 4. Sorting logic
  const sortedReports = [...filteredReports].sort((a, b) => {
    let result = 0;
    switch (sortField) {
      case 'date':
        result = a.date.localeCompare(b.date);
        break;
      case 'officeName':
        result = a.officeName.localeCompare(b.officeName);
        break;
      case 'lastBalance':
        result = a.lastBalance - b.lastBalance;
        break;
      case 'receivedToday':
        result = a.receivedToday - b.receivedToday;
        break;
      case 'delivered':
        result = a.delivered - b.delivered;
        break;
      case 'returnedToSender':
        result = a.returnedToSender - b.returnedToSender;
        break;
      case 'missent':
        result = a.missent - b.missent;
        break;
      case 'deposit':
        result = a.deposit - b.deposit;
        break;
      case 'rate': {
        const rateA = a.receivedToday > 0 ? a.delivered / a.receivedToday : 0;
        const rateB = b.receivedToday > 0 ? b.delivered / b.receivedToday : 0;
        result = rateA - rateB;
        break;
      }
      default:
        result = 0;
    }
    return sortOrder === 'asc' ? result : -result;
  });

  // Toggle sort field or direction
  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Calculate Cumulative Summary Totals for filtered reports
  const summaryTotals = sortedReports.reduce(
    (acc, r) => ({
      lastBalance: acc.lastBalance + r.lastBalance,
      received: acc.received + r.receivedToday,
      delivered: acc.delivered + r.delivered,
      returned: acc.returned + r.returnedToSender,
      missent: acc.missent + r.missent,
      deposit: acc.deposit + r.deposit,
    }),
    { lastBalance: 0, received: 0, delivered: 0, returned: 0, missent: 0, deposit: 0 }
  );

  const deliveryRate =
    summaryTotals.received > 0
      ? ((summaryTotals.delivered / summaryTotals.received) * 100).toFixed(1)
      : '0.0';

  // Dynamic Period Label (DD/MM/YYYY)
  const getPeriodLabel = () => {
    if (dateFilterMode === 'single') {
      return singleDate ? formatDatePK(singleDate) : 'ALL DATES';
    }
    if (dateFilterMode === 'range') {
      if (fromDate && toDate) {
        if (fromDate === toDate) return formatDatePK(fromDate);
        return `${formatDatePK(fromDate)} TO ${formatDatePK(toDate)}`;
      }
      if (fromDate) return `FROM ${formatDatePK(fromDate)} ONWARDS`;
      if (toDate) return `UP TO ${formatDatePK(toDate)}`;
      return 'ALL RECORD DATES';
    }
    return 'ALL RECORD DATES';
  };

  const handleExportExcel = () => {
    const officeClean = filterOffice ? filterOffice.replace(/\s+/g, '_') : 'Gujranwala_Division';
    const periodClean =
      dateFilterMode === 'single'
        ? (singleDate || 'All')
        : (fromDate || toDate ? `${fromDate || 'Start'}_to_${toDate || 'Latest'}` : 'All_Dates');
    exportDailyReportsToExcel(sortedReports, `PakPost_${officeClean}_${periodClean}_${getTodayDateString()}`);
  };

  const handlePrintA4 = () => {
    triggerPrintableWindow(sortedReports, getPeriodLabel(), filterOffice);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSingleDate('');
    setFromDate('');
    setToDate('');
    setFilterOffice('');
    setDateFilterMode('all');
    setSortField('date');
    setSortOrder('desc');
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    filterOffice ||
    (dateFilterMode === 'single' && singleDate) ||
    (dateFilterMode === 'range' && (fromDate || toDate))
  );

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* OFFICIAL PAKISTAN POST A4 PRINT HEADER (Visible ONLY during Printing)     */}
      {/* ========================================================================= */}
      <div className="print-only-header hidden pb-3 mb-3 border-b-2 border-black text-center">
        {/* Line 1: PAKISTAN POST */}
        <div className="text-base font-black tracking-widest text-black uppercase">
          PAKISTAN POST
        </div>

        {/* Line 2: OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES GUJRANWALA DIVISION */}
        <div className="text-xs font-extrabold uppercase text-black mt-0.5 tracking-tight">
          OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES GUJRANWALA DIVISION
        </div>

        {/* Line 3: DAILY DELIVERY REPORT */}
        <div className="my-1.5">
          <span className="text-sm font-black uppercase tracking-wider text-black border-y-2 border-black py-0.5 px-6 inline-block bg-gray-100">
            DAILY DELIVERY REPORT
          </span>
        </div>

        {/* Line 4: Date Range & Office Info */}
        <div className="flex items-center justify-between text-[9.5px] font-bold text-black mt-1.5 px-1 border-t border-gray-400 pt-1">
          <div>
            <span>POST OFFICE: </span>
            <span className="font-extrabold underline uppercase">
              {filterOffice || 'ALL POST OFFICES (GUJRANWALA DIVISION)'}
            </span>
          </div>
          <div>
            <span>DATE / PERIOD: </span>
            <span className="font-extrabold underline font-mono">
              {getPeriodLabel()}
            </span>
          </div>
          <div>
            <span>PRINTED ON: </span>
            <span className="font-mono">{formatDatePK(today)}</span>
          </div>
        </div>

        {/* Print Summary Totals Box */}
        <div className="grid grid-cols-6 gap-1.5 mt-2 pt-1.5 border-t border-black text-center text-[9px]">
          <div className="border border-black p-1">
            <span className="text-gray-700 block uppercase font-bold text-[8px]">Last Balance</span>
            <strong className="text-[10px] text-black font-black font-mono">{formatNumber(summaryTotals.lastBalance)}</strong>
          </div>
          <div className="border border-black p-1">
            <span className="text-gray-700 block uppercase font-bold text-[8px]">Received</span>
            <strong className="text-[10px] text-black font-black font-mono">{formatNumber(summaryTotals.received)}</strong>
          </div>
          <div className="border border-black p-1">
            <span className="text-gray-700 block uppercase font-bold text-[8px]">Delivered</span>
            <strong className="text-[10px] text-black font-black font-mono">{formatNumber(summaryTotals.delivered)}</strong>
          </div>
          <div className="border border-black p-1 bg-gray-100">
            <span className="text-gray-900 block uppercase font-black text-[8px]">Delivery %</span>
            <strong className="text-[11px] text-black font-black font-mono">{deliveryRate}%</strong>
          </div>
          <div className="border border-black p-1">
            <span className="text-gray-700 block uppercase font-bold text-[8px]">Returned (RTS)</span>
            <strong className="text-[10px] text-black font-black font-mono">{formatNumber(summaryTotals.returned)}</strong>
          </div>
          <div className="border border-black p-1">
            <span className="text-gray-700 block uppercase font-bold text-[8px]">In-Hand Deposit</span>
            <strong className="text-[10px] text-black font-black font-mono">{formatNumber(summaryTotals.deposit)}</strong>
          </div>
        </div>
      </div>

      {/* Main Top Header & Action Controls (No Print) */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-tight">
                {currentUser?.role === 'ADMIN' ? 'Daily Delivery Summary & Reports' : 'Office Submission Archive'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {sortedReports.length} reports • Overall Delivery Rate: <strong className="text-[#006633] font-bold">{deliveryRate}%</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg border border-red-200 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            {/* Prominent Official A4 Print Option */}
            <button
              onClick={handlePrintA4}
              className="bg-[#00401A] hover:bg-[#003014] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print standard A4 format daily delivery report"
            >
              <Printer className="w-4 h-4 text-emerald-300" />
              <span>Print Report (A4)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Export filtered reports to Microsoft Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel Export</span>
            </button>

            <button
              onClick={onOpenNewReport}
              className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              + New Report
            </button>
          </div>
        </div>

        {/* Clean Filter Controls: Office Wise, Date Mode Selector, Single / Range Date Pickers */}
        <div className="space-y-3 pt-1 text-xs">
          {/* Top Row: Search & Office Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Search Input */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                Search Office / Remarks (تلاش کریں)
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by office name or remarks..."
                className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 focus:ring-2 focus:ring-[#006633]"
              />
            </div>

            {/* Office Wise Selection Filter */}
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-[#006633]" />
                <span>Office Wise (ڈاکخانہ منتخب کریں)</span>
              </label>
              <select
                value={filterOffice}
                onChange={(e) => setFilterOffice(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2.5 focus:ring-2 focus:ring-[#006633]"
              >
                <option value="">All Post Offices ({officeOptions.length})</option>
                {officeOptions.map((name) => {
                  const count = reports.filter((r) => r.officeName === name).length;
                  return (
                    <option key={name} value={name}>
                      {name} ({count} reports)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Bottom Row: Date Filter Mode Tabs & Date Inputs */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
              <span className="text-[11px] font-extrabold text-gray-800 uppercase tracking-wide flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-[#006633]" />
                <span>Date Filter Selection (تاریخ فلٹر)</span>
              </span>

              {/* Filter Mode Selector */}
              <div className="inline-flex bg-white p-0.5 rounded-lg border border-gray-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setDateFilterMode('single');
                    if (!singleDate) setSingleDate(today);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    dateFilterMode === 'single'
                      ? 'bg-[#00401A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Single Date (مخصوص تاریخ)
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('range')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    dateFilterMode === 'range'
                      ? 'bg-[#00401A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📆 Date Range (از تاریخ تا تاریخ)
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilterMode('all')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    dateFilterMode === 'all'
                      ? 'bg-[#00401A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 All Dates (تمام)
                </button>
              </div>
            </div>

            {/* Mode 1: Single Date Picker */}
            {dateFilterMode === 'single' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase">
                      Select Specific Report Date (مخصوص تاریخ منتخب کریں):
                    </label>
                    {singleDate && (
                      <span className="text-[10px] font-mono text-[#006633] font-bold bg-green-100 px-2 py-0.5 rounded">
                        Selected: {formatDatePK(singleDate)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      className="flex-1 bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
                    />
                    <button
                      type="button"
                      onClick={() => setSingleDate(today)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                        singleDate === today
                          ? 'bg-[#00401A] text-white'
                          : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                      title="Set to Today"
                    >
                      آج (Today)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setSingleDate(d.toISOString().slice(0, 10));
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 transition-colors"
                      title="Set to Yesterday"
                    >
                      گزشتہ روز (Yesterday)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Date Range Pickers (From / To) */}
            {dateFilterMode === 'range' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase">
                      From Date (از تاریخ)
                    </label>
                    {fromDate && (
                      <span className="text-[9px] font-mono text-[#006633] font-bold">
                        {formatDatePK(fromDate)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase">
                      To Date (تا تاریخ)
                    </label>
                    {toDate && (
                      <span className="text-[9px] font-mono text-[#006633] font-bold">
                        {formatDatePK(toDate)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
                  />
                </div>
              </div>
            )}

            {/* Mode 3: All Dates Notice */}
            {dateFilterMode === 'all' && (
              <div className="text-xs text-gray-500 italic py-1">
                Displaying all dates available in the system. Use the tabs above to filter by a specific single date or date range.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Office Wise & Date Range Executive Summary Card with Delivery Rate % */}
      {(filterOffice || (dateFilterMode === 'single' && singleDate) || (dateFilterMode === 'range' && (fromDate || toDate))) && (
        <div className="bg-[#00401A] text-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#005522] no-print">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-300" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide text-white">
                {filterOffice ? `${filterOffice} — Delivery Summary` : 'Gujranwala Division — Range Summary'}
              </h3>
              <span className="bg-emerald-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                {sortedReports.length} Reports
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-1">
              Period:{' '}
              <strong className="text-white bg-black/20 px-1.5 py-0.5 rounded font-mono">
                {getPeriodLabel()}
              </strong>{' '}
              {filterOffice && (
                <span>
                  • Division: <strong className="text-white">Gujranwala</strong>
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Last Bal</span>
              <strong className="text-sm font-bold text-white font-mono">{formatNumber(summaryTotals.lastBalance)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Received</span>
              <strong className="text-sm font-bold text-white font-mono">{formatNumber(summaryTotals.received)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Delivered</span>
              <strong className="text-sm font-bold text-emerald-300 font-mono">{formatNumber(summaryTotals.delivered)}</strong>
            </div>
            <div className="bg-emerald-800/80 p-2 rounded border border-emerald-400">
              <span className="text-[10px] text-yellow-200 block font-bold uppercase flex items-center justify-center space-x-0.5">
                <Percent className="w-3 h-3" />
                <span>Deliv. %</span>
              </span>
              <strong className="text-base font-black text-amber-300 font-mono">{deliveryRate}%</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Returned</span>
              <strong className="text-sm font-bold text-red-300 font-mono">{formatNumber(summaryTotals.returned)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Deposit</span>
              <strong className="text-sm font-bold text-blue-300 font-mono">{formatNumber(summaryTotals.deposit)}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table with Delivery Percentage in every row and totals */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {sortedReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  {/* Date (DD/MM/YYYY) */}
                  <th
                    onClick={() => handleSortToggle('date')}
                    className="p-2.5 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Date (DD/MM/YYYY)"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date (DD/MM/YYYY)</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#006633]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#006633]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  {/* Office Name */}
                  <th
                    onClick={() => handleSortToggle('officeName')}
                    className="p-2.5 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Office Name"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Office Name</span>
                      {sortField === 'officeName' ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-[#006633]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#006633]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  {/* Last Balance */}
                  <th
                    onClick={() => handleSortToggle('lastBalance')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Last Balance"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>Last Bal</span>
                      {sortField === 'lastBalance' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>

                  {/* Received */}
                  <th
                    onClick={() => handleSortToggle('receivedToday')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Received"
                  >
                    <div className="flex items-center justify-end space-x-1 text-[#006633]">
                      <span>Received</span>
                      {sortField === 'receivedToday' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  {/* Delivered */}
                  <th
                    onClick={() => handleSortToggle('delivered')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Delivered"
                  >
                    <div className="flex items-center justify-end space-x-1 text-emerald-800">
                      <span>Delivered</span>
                      {sortField === 'delivered' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  {/* Delivery Percentage Column */}
                  <th
                    onClick={() => handleSortToggle('rate')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none bg-emerald-50/50"
                    title="Click to sort by Delivery %"
                  >
                    <div className="flex items-center justify-end space-x-1 text-[#006633] font-black">
                      <span>Delivery %</span>
                      {sortField === 'rate' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  {/* Returned */}
                  <th
                    onClick={() => handleSortToggle('returnedToSender')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Returned"
                  >
                    <div className="flex items-center justify-end space-x-1 text-red-700">
                      <span>Returned</span>
                      {sortField === 'returnedToSender' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>

                  {/* Missent */}
                  <th
                    onClick={() => handleSortToggle('missent')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Missent"
                  >
                    <div className="flex items-center justify-end space-x-1 text-amber-700">
                      <span>Missent</span>
                      {sortField === 'missent' && (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>

                  {/* Deposit */}
                  <th
                    onClick={() => handleSortToggle('deposit')}
                    className="p-2.5 text-right cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Deposit"
                  >
                    <div className="flex items-center justify-end space-x-1 text-blue-700">
                      <span>Deposit</span>
                      {sortField === 'deposit' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50 no-print" />
                      )}
                    </div>
                  </th>

                  <th className="p-2.5 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {sortedReports.map((report) => {
                  const canEdit =
                    currentUser?.role === 'ADMIN' ||
                    report.date === today;

                  const canDelete = currentUser?.role === 'ADMIN';

                  const rowRate =
                    report.receivedToday > 0
                      ? ((report.delivered / report.receivedToday) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr key={report.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-2.5 font-bold text-[#006633] whitespace-nowrap font-mono">
                        {formatDatePK(report.date)}
                      </td>
                      <td className="p-2.5 font-extrabold text-gray-900">
                        {report.officeName}
                      </td>
                      <td className="p-2.5 text-right text-gray-600 font-mono">{formatNumber(report.lastBalance)}</td>
                      <td className="p-2.5 text-right font-bold text-[#006633] font-mono">
                        {formatNumber(report.receivedToday)}
                      </td>
                      <td className="p-2.5 text-right text-emerald-700 font-semibold font-mono">
                        {formatNumber(report.delivered)}
                      </td>
                      {/* Delivery Percentage Cell */}
                      <td className="p-2.5 text-right font-black font-mono">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          Number(rowRate) >= 90
                            ? 'bg-green-100 text-[#006633]'
                            : Number(rowRate) >= 70
                            ? 'bg-yellow-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {rowRate}%
                        </span>
                      </td>
                      <td className="p-2.5 text-right text-red-600 font-semibold font-mono">{formatNumber(report.returnedToSender)}</td>
                      <td className="p-2.5 text-right text-amber-600 font-semibold font-mono">{formatNumber(report.missent)}</td>
                      <td className="p-2.5 text-right text-blue-600 font-semibold font-mono">{formatNumber(report.deposit)}</td>
                      <td className="p-2.5 text-center whitespace-nowrap no-print">
                        <div className="flex items-center justify-center space-x-1.5">
                          {canEdit ? (
                            <button
                              onClick={() => onEditReport(report)}
                              className="p-1.5 bg-gray-100 hover:bg-amber-100 text-amber-800 rounded-md border border-gray-200 transition-colors cursor-pointer"
                              title="Edit Report"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Locked</span>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => onDeleteReport(report.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 transition-colors cursor-pointer"
                              title="Delete Report (Admin)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 text-gray-900 font-extrabold border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="p-2.5 text-left uppercase text-[11px]">
                    Total Summary ({sortedReports.length} Reports)
                  </td>
                  <td className="p-2.5 text-right font-mono">{formatNumber(summaryTotals.lastBalance)}</td>
                  <td className="p-2.5 text-right text-[#006633] font-mono">{formatNumber(summaryTotals.received)}</td>
                  <td className="p-2.5 text-right text-emerald-800 font-mono">{formatNumber(summaryTotals.delivered)}</td>
                  <td className="p-2.5 text-right text-[#006633] font-mono font-black text-xs">
                    {deliveryRate}%
                  </td>
                  <td className="p-2.5 text-right text-red-700 font-mono">{formatNumber(summaryTotals.returned)}</td>
                  <td className="p-2.5 text-right text-amber-700 font-mono">{formatNumber(summaryTotals.missent)}</td>
                  <td className="p-2.5 text-right text-blue-700 font-mono">{formatNumber(summaryTotals.deposit)}</td>
                  <td className="p-2.5 text-center no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400 text-xs">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-500" />
            <p className="font-bold text-gray-600">No Daily Reports Found</p>
            <p className="mt-1">Try adjusting the Office or Date filters.</p>
          </div>
        )}
      </div>

      {/* Official Signatures Block for A4 Print */}
      <div className="print-only-block hidden pt-8 mt-6">
        <div className="flex justify-between items-end text-xs">
          <div className="text-center w-60 border-t border-black pt-1 font-bold">
            Prepared By: In-Charge / Data Operator
            <span className="block text-[10px] text-gray-700 font-normal">Gujranwala Division</span>
          </div>
          <div className="text-center w-72 border-t border-black pt-1 font-bold">
            Divisional Superintendent Postal Services
            <span className="block text-[10px] text-gray-700 font-normal">Pakistan Post, Gujranwala Division</span>
          </div>
        </div>
      </div>
    </div>
  );
};
