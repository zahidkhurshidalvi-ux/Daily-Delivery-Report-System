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

  // 2. Search & Filter criteria
  const filteredReports = baseReports.filter((r) => {
    const matchesSearch =
      r.officeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.remarks && r.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSingleDate = !filterDate || r.date === filterDate;
    const matchesFromDate = !fromDate || r.date >= fromDate;
    const matchesToDate = !toDate || r.date <= toDate;
    const matchesOffice = !filterOffice || r.officeName === filterOffice;

    return matchesSearch && matchesSingleDate && matchesFromDate && matchesToDate && matchesOffice;
  });

  // Calculate Cumulative Summary Totals for filtered reports
  const summaryTotals = filteredReports.reduce(
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

  const handleExportExcel = () => {
    const prefix = filterOffice ? filterOffice.replace(/\s+/g, '_') : 'Pakistan_Post';
    exportDailyReportsToExcel(filteredReports, `${prefix}_Date_to_Date_Report_${getTodayDateString()}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFromDate('');
    setToDate('');
    setFilterOffice('');
  };

  const hasActiveFilters = Boolean(searchTerm || filterDate || fromDate || toDate || filterOffice);

  return (
    <div className="space-y-4">
      {/* Official Print Header (Visible ONLY during Printing) */}
      <div className="print-only-header hidden pb-4 mb-4 border-b-2 border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-black">
              PAKISTAN POST - DAILY DELIVERY REPORTS ARCHIVE
            </h1>
            <p className="text-xs font-bold text-gray-700">
              DIVISIONAL SUPERINTENDENT POSTAL SERVICES | FEDERAL CIRCLE
            </p>
            <p className="text-[11px] text-gray-600 mt-1">
              Office: <span className="font-bold">{filterOffice || 'All Post Offices'}</span> | Period:{' '}
              <span className="font-bold">
                {fromDate || 'Earliest'} to {toDate || 'Latest'}
              </span>{' '}
              {filterDate && `(Single Date: ${formatDatePK(filterDate)})`}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Printed On: {formatDatePK(getTodayDateString())}</p>
            <p className="text-gray-600 font-mono text-[10px]">Total Records: {filteredReports.length}</p>
          </div>
        </div>
      </div>

      {/* Search & Date-to-Date / Single Office Filter Controls */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900 uppercase tracking-tight">
                {currentUser?.role === 'ADMIN' ? 'Central Daily Reports & Office Search' : 'Office Submission Archive'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {filteredReports.length} reports match current filters
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
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

        {/* Filter Bar Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          {/* Office Selection Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Filter By Single Office
            </label>
            <select
              value={filterOffice}
              onChange={(e) => setFilterOffice(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
            >
              <option value="">All Post Offices ({officeOptions.length})</option>
              {officeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setFilterDate(''); // clear single date if range picked
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setFilterDate(''); // clear single date if range picked
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
            />
          </div>

          {/* Single Date Filter */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase">
                Specific Date
              </label>
              <button
                type="button"
                onClick={() => {
                  setFilterDate(getTodayDateString());
                  setFromDate('');
                  setToDate('');
                }}
                className="text-[10px] text-[#006633] hover:underline font-bold"
              >
                Today
              </button>
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setFromDate('');
                setToDate('');
              }}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
            />
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Search Remarks / Text
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg pl-8 pr-2 p-2 focus:ring-1 focus:ring-[#006633]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Date-to-Date Single Office Performance Banner */}
      {(filterOffice || fromDate || toDate) && (
        <div className="bg-[#006633] text-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-200" />
              <h3 className="font-extrabold text-sm uppercase tracking-wide">
                {filterOffice ? `${filterOffice} — Performance Report` : 'Date-to-Date Range Summary'}
              </h3>
            </div>
            <p className="text-xs text-emerald-100 mt-0.5">
              Period:{' '}
              <strong className="text-white">
                {fromDate ? formatDatePK(fromDate) : 'Start'}
              </strong>{' '}
              to{' '}
              <strong className="text-white">
                {toDate ? formatDatePK(toDate) : filterDate ? formatDatePK(filterDate) : 'Latest'}
              </strong>{' '}
              ({filteredReports.length} reports)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-100 block font-semibold uppercase">Received</span>
              <strong className="text-sm font-bold">{formatNumber(summaryTotals.received)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-100 block font-semibold uppercase">Delivered</span>
              <strong className="text-sm font-bold text-emerald-200">{formatNumber(summaryTotals.delivered)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-100 block font-semibold uppercase">Returned</span>
              <strong className="text-sm font-bold text-red-200">{formatNumber(summaryTotals.returned)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-100 block font-semibold uppercase">Deposit</span>
              <strong className="text-sm font-bold text-blue-200">{formatNumber(summaryTotals.deposit)}</strong>
            </div>
            <div className="bg-white/10 p-2 rounded border border-white/20">
              <span className="text-[10px] text-emerald-100 block font-semibold uppercase">Deliv. Rate</span>
              <strong className="text-sm font-bold text-amber-200">{deliveryRate}%</strong>
            </div>
          </div>
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {filteredReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Office Name</th>
                  <th className="p-2.5 text-right">Last Bal</th>
                  <th className="p-2.5 text-right">Received</th>
                  <th className="p-2.5 text-right">Delivered</th>
                  <th className="p-2.5 text-right">Returned</th>
                  <th className="p-2.5 text-right">Missent</th>
                  <th className="p-2.5 text-right">Deposit</th>
                  <th className="p-2.5 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {filteredReports.map((report) => {
                  const canEdit =
                    currentUser?.role === 'ADMIN' ||
                    report.date === today;

                  const canDelete = currentUser?.role === 'ADMIN';

                  return (
                    <tr key={report.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-2.5 font-bold text-[#006633] whitespace-nowrap">
                        {formatDatePK(report.date)}
                      </td>
                      <td className="p-2.5 font-extrabold text-gray-900">
                        {report.officeName}
                      </td>
                      <td className="p-2.5 text-right text-gray-600">{formatNumber(report.lastBalance)}</td>
                      <td className="p-2.5 text-right font-bold text-[#006633]">
                        {formatNumber(report.receivedToday)}
                      </td>
                      <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNumber(report.delivered)}</td>
                      <td className="p-2.5 text-right text-red-600 font-semibold">{formatNumber(report.returnedToSender)}</td>
                      <td className="p-2.5 text-right text-amber-600 font-semibold">{formatNumber(report.missent)}</td>
                      <td className="p-2.5 text-right text-blue-600 font-semibold">{formatNumber(report.deposit)}</td>
                      <td className="p-2.5 text-center whitespace-nowrap no-print">
                        <div className="flex items-center justify-center space-x-1.5">
                          {canEdit ? (
                            <button
                              onClick={() => onEditReport(report)}
                              className="p-1.5 bg-gray-100 hover:bg-amber-100 text-amber-800 rounded-md border border-gray-200 transition-colors"
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
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 transition-colors"
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
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400 text-xs">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-500" />
            <p className="font-bold text-gray-600">No Daily Reports Found</p>
            <p className="mt-1">Try adjusting search filters or submit a new report.</p>
          </div>
        )}
      </div>
    </div>
  );
};
