import React, { useState } from 'react';
import { DailyReport, PostOffice, User } from '../types';
import { formatNumber, formatDatePK, getTodayDateString, cleanAndFilterPostOffices, cleanAndFilterReports } from '../utils/calculations';
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
  AlertTriangle,
} from 'lucide-react';
import { exportDailyReportsToExcel } from '../utils/excelExport';
import { triggerPrintableWindow } from '../utils/pdfGenerator';

interface ReportsListProps {
  reports: DailyReport[];
  postOffices?: PostOffice[];
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
  currentUser: User | null;
  onEditReport: (report: DailyReport) => void;
  onDeleteReport: (reportId: string) => void;
  onOpenNewReport?: () => void;
  onLogAction?: (action: string, details: string, type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR') => void;
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

  // Confirmation modal state for admin deletion
  const [reportToDelete, setReportToDelete] = useState<DailyReport | null>(null);

  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  // Extract all unique office names from postOffices or reports
  const officeOptions = Array.from(
    new Set([
      ...validOffices.map((p) => p.name),
      ...validReports.map((r) => r.officeName),
    ])
  ).sort();

  // 1. Role Filtering: Post Office users only see THEIR OWN office reports if restricted
  const roleFilteredReports =
    currentUser?.role === 'POST_OFFICE' && currentUser.officeName
      ? validReports.filter((r) => r.officeName === currentUser.officeName)
      : validReports;

  // 2. Base Reports
  const baseReports = roleFilteredReports;

  // 3. Search & Filter criteria: Office, Single Date OR Date Range
  const searchLower = (searchTerm || '').toLowerCase();

  const filteredReports = baseReports.filter((r) => {
    // Office Filter (Exact match dropdown or search)
    if (filterOffice && r.officeName !== filterOffice) {
      return false;
    }

    // Text Search Match
    if (searchLower) {
      const matchOffice = r.officeName.toLowerCase().includes(searchLower);
      const matchDate = r.date.includes(searchLower);
      const matchRemarks = (r.remarks || '').toLowerCase().includes(searchLower);
      if (!matchOffice && !matchDate && !matchRemarks) return false;
    }

    // Date Mode: Single Date (Exact)
    if (dateFilterMode === 'single') {
      if (singleDate && r.date !== singleDate) return false;
    }

    // Date Mode: Date Range (From - To)
    if (dateFilterMode === 'range') {
      if (fromDate && r.date < fromDate) return false;
      if (toDate && r.date > toDate) return false;
    }

    return true;
  });

  // 4. Multi-Column Sorting
  const sortedReports = [...filteredReports].sort((a, b) => {
    let result = 0;
    if (sortField === 'date') {
      result = a.date.localeCompare(b.date);
    } else if (sortField === 'officeName') {
      result = a.officeName.localeCompare(b.officeName);
    } else if (sortField === 'rate') {
      const rateA = a.receivedToday > 0 ? (a.delivered / a.receivedToday) * 100 : 0;
      const rateB = b.receivedToday > 0 ? (b.delivered / b.receivedToday) * 100 : 0;
      result = rateA - rateB;
    } else {
      const valA = Number(a[sortField]) || 0;
      const valB = Number(b[sortField]) || 0;
      result = valA - valB;
    }
    return sortOrder === 'asc' ? result : -result;
  });

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 5. Accurate Summary Totals Calculation
  const summaryTotals = sortedReports.reduce(
    (acc, r) => ({
      lastBalance: acc.lastBalance + (Number(r.lastBalance) || 0),
      received: acc.received + (Number(r.receivedToday) || 0),
      delivered: acc.delivered + (Number(r.delivered) || 0),
      returned: acc.returned + (Number(r.returnedToSender) || 0),
      missent: acc.missent + (Number(r.missent) || 0),
      deposit: acc.deposit + (Number(r.deposit) || 0),
    }),
    { lastBalance: 0, received: 0, delivered: 0, returned: 0, missent: 0, deposit: 0 }
  );

  const deliveryRate =
    summaryTotals.received > 0
      ? ((summaryTotals.delivered / summaryTotals.received) * 100).toFixed(1)
      : '0.0';

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

  const isAdmin = currentUser?.role === 'ADMIN';

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
            <span>TOTAL REPORTS: </span>
            <span className="font-extrabold underline font-mono">
              {sortedReports.length}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Delete Confirmation Modal */}
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

      {/* Main Filter & Action Bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-tight flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-[#006633]" />
              <span>Daily Delivery Reports Summary</span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Showing {sortedReports.length} of {baseReports.length} Total Submissions
            </p>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrintA4}
              className="bg-gray-800 hover:bg-black text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print official Pakistan Post A4 summary"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 / PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Download Excel Spreadsheet for current filtered view"
            >
              <Download className="w-3.5 h-3.5 text-yellow-400" />
              <span>Export to Excel</span>
            </button>

            {onOpenNewReport && (
              <button
                onClick={onOpenNewReport}
                className="bg-[#006633] hover:bg-[#00401A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                + New Report
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-gray-100 text-xs">
          {/* 1. Date Mode Selector (3 Cols) */}
          <div className="lg:col-span-3 flex items-center space-x-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setDateFilterMode('single');
                if (!singleDate) setSingleDate(today);
              }}
              className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                dateFilterMode === 'single'
                  ? 'bg-[#006633] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Single Date
            </button>

            <button
              type="button"
              onClick={() => {
                setDateFilterMode('range');
                if (!fromDate) setFromDate(today);
                if (!toDate) setToDate(today);
              }}
              className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                dateFilterMode === 'range'
                  ? 'bg-[#006633] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Date Range
            </button>

            <button
              type="button"
              onClick={() => setDateFilterMode('all')}
              className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                dateFilterMode === 'all'
                  ? 'bg-[#006633] text-white shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* 2. Date Inputs (4 Cols) */}
          <div className="lg:col-span-4 flex items-center space-x-1.5">
            {dateFilterMode === 'single' && (
              <div className="w-full flex items-center space-x-1">
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="w-full bg-white text-gray-800 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
                />
                {singleDate !== today && (
                  <button
                    type="button"
                    onClick={() => setSingleDate(today)}
                    className="text-[10px] bg-green-100 text-[#006633] hover:bg-green-200 px-2 py-1.5 rounded font-extrabold whitespace-nowrap cursor-pointer"
                  >
                    Today
                  </button>
                )}
              </div>
            )}

            {dateFilterMode === 'range' && (
              <div className="w-full flex items-center space-x-1">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-1/2 bg-white text-gray-800 text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
                  title="From Date"
                />
                <span className="text-gray-400 font-bold text-xs">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-1/2 bg-white text-gray-800 text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
                  title="To Date"
                />
              </div>
            )}

            {dateFilterMode === 'all' && (
              <div className="w-full bg-gray-100 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 flex items-center justify-between">
                <span>Displaying all historical dates</span>
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
              </div>
            )}
          </div>

          {/* 3. Post Office Filter Dropdown (3 Cols) */}
          <div className="lg:col-span-3">
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="w-full bg-white text-gray-800 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
            >
              <option value="">All Post Offices ({officeOptions.length})</option>
              {officeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Text Search & Clear (2 Cols) */}
          <div className="lg:col-span-2 flex items-center space-x-1">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-gray-800 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Clear all filters"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats Banner for Current Filter */}
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
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[11px] border-b border-gray-200 tracking-wider">
                <tr>
                  {/* Date */}
                  <th
                    onClick={() => handleSortToggle('date')}
                    className="p-2.5 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    title="Click to sort by Date"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#006633]" /> : <ArrowDown className="w-3 h-3 text-[#006633]" />
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
                      <span>Post Office</span>
                      {sortField === 'officeName' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#006633]" /> : <ArrowDown className="w-3 h-3 text-[#006633]" />
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
                    isAdmin ||
                    report.date === today;

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

                          {/* Delete option is STRICTLY restricted to Admin Only */}
                          {isAdmin ? (
                            <button
                              onClick={() => setReportToDelete(report)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 transition-colors cursor-pointer"
                              title="Delete Report (Admin Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 font-mono" title="Only Admin can delete submitted reports">—</span>
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
                  <td className="p-2.5 text-center text-gray-500 font-normal text-[10px] no-print">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-xs">
            No daily delivery reports found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};
