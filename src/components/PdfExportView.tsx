import React, { useState } from 'react';
import { DailyReport, PostOffice } from '../types';
import {
  generateDailyReportPDF,
  triggerPrintableWindow,
} from '../utils/pdfGenerator';
import { exportDailyReportsToExcel } from '../utils/excelExport';
import {
  formatDatePK,
  formatNumber,
  summarizeReports,
  getCompleteDateReports,
  getTodayDateString,
} from '../utils/calculations';
import {
  Printer,
  Download,
  FileDown,
  Building,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

interface PdfExportViewProps {
  reports: DailyReport[];
  postOffices?: PostOffice[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

export const PdfExportView: React.FC<PdfExportViewProps> = ({
  reports,
  postOffices = [],
  selectedDate,
  setSelectedDate,
}) => {
  const [divisionName, setDivisionName] = useState('Gujranwala Division');
  const dateReports = getCompleteDateReports(reports, postOffices, selectedDate);
  const totals = summarizeReports(dateReports);

  const handleDownloadPDF = () => {
    const doc = generateDailyReportPDF(dateReports, selectedDate, divisionName);
    doc.save(`Pakistan_Post_Daily_Report_${selectedDate}.pdf`);
  };

  const handlePrint = () => {
    triggerPrintableWindow(dateReports, selectedDate);
  };

  const handleExcelExport = () => {
    exportDailyReportsToExcel(dateReports, `Pakistan_Post_Report_${selectedDate}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#00401A] text-white border border-[#005522] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              Document Export Hub
            </span>
            <span className="text-gray-500 text-xs font-mono">Official Superintendent Format</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-1">Generate PDF & Excel Reports</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Branded Pakistan Post documents complete with emblem headers, grand totals, and signature blocks.
          </p>
        </div>

        {/* Date & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-gray-300 text-gray-900 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#006633]"
          />
          {selectedDate !== getTodayDateString() && (
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayDateString())}
              className="text-[10px] bg-[#006633] text-white px-2.5 py-2 rounded-lg font-bold hover:bg-[#00401A] transition-colors"
              title="Set to Today's date"
            >
              Today
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            className="bg-[#005522] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all flex items-center space-x-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>

          <button
            onClick={handleExcelExport}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-2 rounded-lg border border-gray-300 flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#006633]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Live On-Screen Document Paper Preview */}
      <div className="bg-gray-100 p-6 rounded-lg border border-gray-200">
        <div className="max-w-5xl mx-auto bg-white text-gray-900 rounded-lg shadow-md overflow-hidden border border-gray-300 font-sans p-8">
          {/* Document Header */}
          <div className="bg-[#00401A] text-white p-6 -m-8 mb-6 border-b-4 border-yellow-400 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#005522] rounded-full border border-yellow-400 flex items-center justify-center font-black text-yellow-400 text-sm shadow-xs">
                  PAK
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight leading-tight uppercase">
                    PAKISTAN POST - DAILY DELIVERY REPORT
                  </h1>
                  <p className="text-xs text-green-200 font-medium">{divisionName.toUpperCase()}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-yellow-400 block">OFFICIAL RECORD</span>
              <span className="text-sm font-black">{formatDatePK(selectedDate)}</span>
            </div>
          </div>

          {/* Document Summary Box */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Offices</span>
              <strong className="text-emerald-900 text-sm font-bold">{dateReports.length}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Last Bal</span>
              <strong className="text-slate-800">{formatNumber(totals.totalLastBalance)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Received</span>
              <strong className="text-emerald-700">{formatNumber(totals.totalReceived)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Delivered</span>
              <strong className="text-emerald-700">{formatNumber(totals.totalDelivered)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Returned</span>
              <strong className="text-rose-700">{formatNumber(totals.totalReturned)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Missent</span>
              <strong className="text-amber-700">{formatNumber(totals.totalMissent)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-semibold">Deposit</span>
              <strong className="text-blue-700">{formatNumber(totals.totalDeposit)}</strong>
            </div>
          </div>

          {/* Document Table */}
          {dateReports.length > 0 ? (
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#006633] text-white font-bold">
                    <th className="p-2 border border-emerald-800">#</th>
                    <th className="p-2 border border-emerald-800">Office Name</th>
                    <th className="p-2 border border-emerald-800 text-right">Last Bal</th>
                    <th className="p-2 border border-emerald-800 text-right">Received</th>
                    <th className="p-2 border border-emerald-800 text-right">Delivered</th>
                    <th className="p-2 border border-emerald-800 text-right">Returned</th>
                    <th className="p-2 border border-emerald-800 text-right">Missent</th>
                    <th className="p-2 border border-emerald-800 text-right">Deposit</th>
                    <th className="p-2 border border-emerald-800">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dateReports.map((r, idx) => {
                    const isMissing = r.submittedBy === 'NOT_SUBMITTED' || r.remarks?.includes('Report not submitted');
                    return (
                      <tr
                        key={r.id}
                        className={isMissing ? 'bg-red-50/70' : idx % 2 === 1 ? 'bg-slate-50' : ''}
                      >
                        <td className="p-2 border border-slate-200 text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">
                          {r.officeName}
                        </td>
                        <td className="p-2 border border-slate-200 text-right text-slate-600">
                          {formatNumber(r.lastBalance)}
                        </td>
                        <td className="p-2 border border-slate-200 text-right font-semibold text-emerald-800">
                          {formatNumber(r.receivedToday)}
                        </td>
                        <td className="p-2 border border-slate-200 text-right text-emerald-700">
                          {formatNumber(r.delivered)}
                        </td>
                        <td className="p-2 border border-slate-200 text-right text-rose-700">
                          {formatNumber(r.returnedToSender)}
                        </td>
                        <td className="p-2 border border-slate-200 text-right text-amber-700">
                          {formatNumber(r.missent)}
                        </td>
                        <td className="p-2 border border-slate-200 text-right text-blue-700">
                          {formatNumber(r.deposit)}
                        </td>
                        <td className="p-2 border border-slate-200 font-medium">
                          {isMissing ? (
                            <span className="text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded text-[10px]">
                              Report not submitted till 5 PM
                            </span>
                          ) : (
                            r.remarks || '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand Totals */}
                  <tr className="bg-[#e1eee4] text-[#006633] font-black border-2 border-[#006633]">
                    <td className="p-2 border border-emerald-300"></td>
                    <td className="p-2 border border-emerald-300">GRAND TOTALS</td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalLastBalance)}
                    </td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalReceived)}
                    </td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalDelivered)}
                    </td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalReturned)}
                    </td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalMissent)}
                    </td>
                    <td className="p-2 border border-emerald-300 text-right">
                      {formatNumber(totals.totalDeposit)}
                    </td>
                    <td className="p-2 border border-emerald-300"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-lg mb-8">
              No reports available for preview on {formatDatePK(selectedDate)}.
            </div>
          )}

          {/* Signature Footer */}
          <div className="pt-12 flex justify-between text-xs text-slate-700 font-medium">
            <div>
              <div className="w-48 border-t border-slate-500 pt-1 text-center font-semibold">
                Reporting In-Charge / Admin
              </div>
            </div>
            <div>
              <div className="w-64 border-t border-slate-500 pt-1 text-center font-bold text-[#006633]">
                Divisional Superintendent Postal Services
                <span className="block text-[10px] text-slate-500 font-normal">
                  Pakistan Post, Gujranwala Division
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
