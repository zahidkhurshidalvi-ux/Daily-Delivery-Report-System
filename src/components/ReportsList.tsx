import React, { useState } from 'react';
import { DailyReport, PostOffice, User } from '../types';
import { formatNumber, formatDatePK, getTodayDateString, getCompleteDateReports } from '../utils/calculations';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  XCircle,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { exportDailyReportsToExcel } from '../utils/excelExport';

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

type DatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'weekly'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

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
  const [filterDate, setFilterDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
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

  // 2. Base Reports: If a specific date is filtered, include active offices that haven't submitted till 5 PM
  const baseReports = filterDate
    ? getCompleteDateReports(roleFilteredReports, postOffices, filterDate)
    : roleFilteredReports;

  // 3. Search & Filter criteria
  const filteredReports = baseReports.filter((r) => {
    const matchesSearch =
      r.officeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.remarks && r.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMonth = !selectedMonth || r.date.startsWith(selectedMonth);
    const matchesSingleDate = !filterDate || r.date === filterDate;
    const matchesFromDate = !fromDate || r.date >= fromDate;
    const matchesToDate = !toDate || r.date <= toDate;
    const matchesOffice = !filterOffice || r.officeName === filterOffice;

    return matchesSearch && matchesMonth && matchesSingleDate && matchesFromDate && matchesToDate && matchesOffice;
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
      received: acc.received + r.receivedToday,
      delivered: acc.delivered + r.delivered,
      returned: acc.returned + r.returnedToSender,
      missent: acc.missent + r.missent,
      deposit: acc.deposit + r.deposit,
    }),
    { received: 0, delivered: 0, returned: 0, missent: 0, deposit: 0 }
  );

  const deliveryRate =
    summaryTotals.received > 0
      ? ((summaryTotals.delivered / summaryTotals.received) * 100).toFixed(1)
      : '0.0';

  // Apply Quick Date Range Preset
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      setFilterDate('');
      setSelectedMonth('');
    } else if (preset === 'today') {
      const todayStr = getTodayDateString();
      setFilterDate(todayStr);
      setFromDate('');
      setToDate('');
      setSelectedMonth('');
    } else if (preset === 'yesterday') {
      const yDate = new Date();
      yDate.setDate(yDate.getDate() - 1);
      const yYear = yDate.getFullYear();
      const yMonth = String(yDate.getMonth() + 1).padStart(2, '0');
      const yDay = String(yDate.getDate()).padStart(2, '0');
      const yStr = `${yYear}-${yMonth}-${yDay}`;
      setFilterDate(yStr);
      setFromDate('');
      setToDate('');
      setSelectedMonth('');
    } else if (preset === 'weekly') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      const fYear = past7.getFullYear();
      const fMonth = String(past7.getMonth() + 1).padStart(2, '0');
      const fDay = String(past7.getDate()).padStart(2, '0');
      setFromDate(`${fYear}-${fMonth}-${fDay}`);
      setToDate(today);
      setFilterDate('');
      setSelectedMonth('');
    } else if (preset === 'this_month') {
      const curMonth = today.slice(0, 7);
      setSelectedMonth(curMonth);
      setFromDate(`${curMonth}-01`);
      setToDate(today);
      setFilterDate('');
    } else if (preset === 'last_month') {
      const prevM = new Date();
      prevM.setMonth(prevM.getMonth() - 1);
      const lmYear = prevM.getFullYear();
      const lmMonth = String(prevM.getMonth() + 1).padStart(2, '0');
      const lmStr = `${lmYear}-${lmMonth}`;
      const lastDayOfPrevMonth = new Date(lmYear, prevM.getMonth() + 1, 0).getDate();
      setSelectedMonth(lmStr);
      setFromDate(`${lmStr}-01`);
      setToDate(`${lmStr}-${String(lastDayOfPrevMonth).padStart(2, '0')}`);
      setFilterDate('');
    } else if (preset === 'this_year') {
      const curYear = today.slice(0, 4);
      setFromDate(`${curYear}-01-01`);
      setToDate(`${curYear}-12-31`);
      setFilterDate('');
      setSelectedMonth('');
    } else if (preset === 'custom') {
      setFilterDate('');
      setSelectedMonth('');
    }
  };

  // Dynamic Period Label
  const getPeriodLabel = () => {
    if (selectedMonth) return `Month: ${selectedMonth}`;
    if (filterDate) return `Date: ${formatDatePK(filterDate)}`;
    if (fromDate || toDate) {
      return `${fromDate ? formatDatePK(fromDate) : 'Start'} to ${toDate ? formatDatePK(toDate) : 'Latest'}`;
    }
    return 'All Records Archive';
  };

  const dynamicPrintTitle = filterOffice
    ? `Gujranwala Division - ${filterOffice} Performance Summary`
    : `Gujranwala Division - Performance Summary (${getPeriodLabel()})`;

  const handleExportExcel = () => {
    const officeClean = filterOffice ? filterOffice.replace(/\s+/g, '_') : 'Gujranwala_Division';
    const periodClean = datePreset !== 'all' ? datePreset : 'All_Records';
    exportDailyReportsToExcel(sortedReports, `PakPost_${officeClean}_${periodClean}_${getTodayDateString()}`);
  };

  const handlePrintReports = (customTitle?: string) => {
    const prevTitle = document.title;
    document.title = customTitle || dynamicPrintTitle;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFromDate('');
    setToDate('');
    setFilterOffice('');
    setSelectedMonth('');
    setDatePreset('all');
    setSortField('date');
    setSortOrder('desc');
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterDate || fromDate || toDate || filterOffice || selectedMonth || datePreset !== 'all'
  );

  return (
    <div className="space-y-4">
      {/* Official Print Header (Visible ONLY during Printing) */}
      <div className="print-only-header hidden pb-4 mb-4 border-b-2 border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#006633]">
              PAKISTAN POST • GUJRANWALA DIVISION
            </div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-black mt-0.5">
              {dynamicPrintTitle}
            </h1>
            <p className="text-xs font-bold text-gray-700">
              DIVISIONAL SUPERINTENDENT POSTAL SERVICES | GUJRANWALA DIVISION
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              Office: <span className="font-bold">{filterOffice || 'All Post Offices in Division'}</span> | Period:{' '}
              <span className="font-bold">{getPeriodLabel()}</span>
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-black">Printed On: {formatDatePK(getTodayDateString())}</p>
            <p className="text-gray-600 font-mono text-[10px]">Total Reports: {sortedReports.length}</p>
            <p className="text-gray-800 font-bold text-[10px] mt-0.5">
              Delivery Rate: <span className="text-[#006633]">{deliveryRate}%</span>
            </p>
          </div>
        </div>

        {/* Print Summary Totals Box */}
        <div className="grid grid-cols-5 gap-2 mt-3 pt-2 border-t border-gray-300 text-center text-[10px]">
          <div className="border border-gray-400 p-1.5 rounded">
            <span className="text-gray-600 block uppercase font-bold">Total Received</span>
            <strong className="text-xs text-black font-extrabold">{formatNumber(summaryTotals.received)}</strong>
          </div>
          <div className="border border-gray-400 p-1.5 rounded">
            <span className="text-gray-600 block uppercase font-bold">Total Delivered</span>
            <strong className="text-xs text-black font-extrabold">{formatNumber(summaryTotals.delivered)}</strong>
          </div>
          <div className="border border-gray-400 p-1.5 rounded">
            <span className="text-gray-600 block uppercase font-bold">Returned / RTS</span>
            <strong className="text-xs text-black font-extrabold">{formatNumber(summaryTotals.returned)}</strong>
          </div>
          <div className="border border-gray-400 p-1.5 rounded">
            <span className="text-gray-600 block uppercase font-bold">Missent Articles</span>
            <strong className="text-xs text-black font-extrabold">{formatNumber(summaryTotals.missent)}</strong>
          </div>
          <div className="border border-gray-400 p-1.5 rounded">
            <span className="text-gray-600 block uppercase font-bold">In-Hand Deposit</span>
            <strong className="text-xs text-black font-extrabold">{formatNumber(summaryTotals.deposit)}</strong>
          </div>
        </div>
      </div>

      {/* Main Top Header & Action Controls */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-tight">
                {currentUser?.role === 'ADMIN' ? 'Gujranwala Division Reports & Archive' : 'Office Submission Archive'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {sortedReports.length} reports match current filters • Gujranwala Division
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

            {/* Print All Monthly / Office Summary Button */}
            <button
              onClick={() => handlePrintReports(dynamicPrintTitle)}
              className="bg-[#00401A] hover:bg-[#003014] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print Summary Report with official Gujranwala Division header"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-300" />
              <span>Print Performance Summary</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Export Current Filtered List to Microsoft Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel Export</span>
            </button>

            <button
              onClick={onOpenNewReport}
              className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              + New Report
            </button>
          </div>
        </div>

        {/* Quick Time Period Preset Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-[#006633]" />
              <span>Quick Time Period Presets (ہفتہ وار / ماہانہ / تاریخ تا تاریخ)</span>
            </span>
            {filterOffice && (
              <span className="text-[#006633] font-bold">
                Filtered: <strong className="underline">{filterOffice}</strong>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Records (تمام)' },
              { id: 'today', label: 'Today (آج)' },
              { id: 'yesterday', label: 'Yesterday (گزشتہ روز)' },
              { id: 'weekly', label: 'This Week / 7 Days (ہفتہ وار)' },
              { id: 'this_month', label: 'This Month (ماہانہ)' },
              { id: 'last_month', label: 'Last Month (گزشتہ ماہ)' },
              { id: 'this_year', label: 'Year 2026 (سالانہ)' },
              { id: 'custom', label: 'Custom Date-to-Date (تاریخ تا تاریخ)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => applyDatePreset(tab.id as DatePreset)}
                className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  datePreset === tab.id
                    ? 'bg-[#006633] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Controls Row: Office Wise, Date To/From, Month & Sorting System */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs pt-2 border-t border-gray-100">
          {/* 1. Office Wise Selection Filter */}
          <div className="lg:col-span-1">
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center space-x-1">
              <Building2 className="w-3 h-3 text-[#006633]" />
              <span>1. Office Wise Filter</span>
            </label>
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
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

          {/* 2. From Date Filter (DD/MM/YYYY) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase">
                2. From Date (از تاریخ)
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
              onChange={(e) => {
                setFromDate(e.target.value);
                setFilterDate('');
                setSelectedMonth('');
                setDatePreset('custom');
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
            />
          </div>

          {/* 3. To Date Filter (DD/MM/YYYY) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase">
                3. To Date (تا تاریخ)
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
              onChange={(e) => {
                setToDate(e.target.value);
                setFilterDate('');
                setSelectedMonth('');
                setDatePreset('custom');
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
            />
          </div>

          {/* 4. Month Selector Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
              4. Specific Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setFilterDate('');
                setFromDate('');
                setToDate('');
                setDatePreset('custom');
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
            />
          </div>

          {/* 5. Sorting System Selection */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1 flex items-center space-x-1">
              <SlidersHorizontal className="w-3 h-3 text-[#006633]" />
              <span>5. Sorting System</span>
            </label>
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [f, o] = e.target.value.split('-');
                setSortField(f as SortField);
                setSortOrder(o as 'asc' | 'desc');
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-[#006633]"
            >
              <option value="date-desc">Date (Newest First ↓)</option>
              <option value="date-asc">Date (Oldest First ↑)</option>
              <option value="officeName-asc">Office Name (A → Z)</option>
              <option value="officeName-desc">Office Name (Z → A)</option>
              <option value="receivedToday-desc">Received (Highest First ↓)</option>
              <option value="delivered-desc">Delivered (Highest First ↓)</option>
              <option value="rate-desc">Delivery Rate % (Highest ↓)</option>
              <option value="deposit-desc">Deposit / In-Hand (Highest ↓)</option>
              <option value="returnedToSender-desc">Returned RTS (Highest ↓)</option>
            </select>
          </div>

          {/* 6. Search Box */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
              6. Search Remarks
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg pl-8 pr-2 p-2 focus:ring-2 focus:ring-[#006633]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Office Wise / Date-to-Date Performance Executive Summary Card */}
      {(filterOffice || fromDate || toDate || selectedMonth || datePreset !== 'all') && (
        <div className="bg-[#00401A] text-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#005522]">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-300" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide text-white">
                {filterOffice ? `${filterOffice} — Performance Report` : 'Gujranwala Division — Range Summary'}
              </h3>
              <span className="bg-emerald-800 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                {sortedReports.length} Reports
              </span>
            </div>
            <p className="text-xs text-emerald-100 mt-1">
              Period:{' '}
              <strong className="text-white bg-black/20 px-1.5 py-0.5 rounded">
                {getPeriodLabel()}
              </strong>{' '}
              {filterOffice && (
                <span>
                  • Division: <strong className="text-white">Gujranwala</strong>
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Received</span>
              <strong className="text-sm font-bold text-white">{formatNumber(summaryTotals.received)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Delivered</span>
              <strong className="text-sm font-bold text-emerald-300">{formatNumber(summaryTotals.delivered)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Returned</span>
              <strong className="text-sm font-bold text-red-300">{formatNumber(summaryTotals.returned)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Deposit</span>
              <strong className="text-sm font-bold text-blue-300">{formatNumber(summaryTotals.deposit)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Deliv. Rate</span>
              <strong className="text-sm font-bold text-amber-300">{deliveryRate}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table with Clickable Sortable Columns */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {sortedReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  {/* Sortable Date Header (DD/MM/YYYY) */}
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
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                      )}
                    </div>
                  </th>

                  {/* Sortable Office Name */}
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
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                      )}
                    </div>
                  </th>

                  {/* Sortable Last Balance */}
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

                  {/* Sortable Received */}
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
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                      )}
                    </div>
                  </th>

                  {/* Sortable Delivered */}
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
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
                      )}
                    </div>
                  </th>

                  {/* Sortable Returned */}
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

                  {/* Sortable Missent */}
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

                  {/* Sortable Deposit */}
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
                        <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-50" />
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
                      ? ((report.delivered / report.receivedToday) * 100).toFixed(0)
                      : '0';

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
                        <span>{formatNumber(report.delivered)}</span>
                        <span className="text-[10px] text-gray-400 ml-1">({rowRate}%)</span>
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
                  <td className="p-2.5 text-right font-mono">-</td>
                  <td className="p-2.5 text-right text-[#006633] font-mono">{formatNumber(summaryTotals.received)}</td>
                  <td className="p-2.5 text-right text-emerald-800 font-mono">{formatNumber(summaryTotals.delivered)}</td>
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
            <p className="mt-1">Try adjusting search filters or selecting another post office.</p>
          </div>
        )}
      </div>

      {/* Official Signatures for Print Dialog */}
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

