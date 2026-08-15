import React, { useState } from 'react';
import { DailyReport, PostOffice } from '../types';
import {
  formatNumber,
  formatDatePK,
  getTodayDateString,
  summarizeReports,
  getCompleteDateReports,
} from '../utils/calculations';
import {
  Building2,
  CheckCircle2,
  Clock,
  TrendingUp,
  PackageCheck,
  RotateCcw,
  AlertTriangle,
  Landmark,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardProps {
  reports: DailyReport[];
  postOffices: PostOffice[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onNavigateNewReport: () => void;
  onNavigatePending: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  reports,
  postOffices,
  selectedDate,
  setSelectedDate,
  onNavigateNewReport,
  onNavigatePending,
}) => {
  const activeOffices = postOffices.filter((po) => po.status === 'ACTIVE');
  const dateReports = reports.filter((r) => r.date === selectedDate);
  const allDateReports = getCompleteDateReports(reports, postOffices, selectedDate);
  const receivedCount = dateReports.length;
  const pendingCount = activeOffices.length - receivedCount;

  const totals = summarizeReports(dateReports);

  // Recharts Chart Data Prepared
  const barChartData = dateReports.slice(0, 10).map((r) => ({
    name: r.officeName.replace(' GPO', '').replace(' Post Office', ''),
    Received: r.receivedToday,
    Delivered: r.delivered,
    Returned: r.returnedToSender,
  }));

  const pieChartData = [
    { name: 'Delivered', value: totals.totalDelivered, color: '#059669' },
    { name: 'Returned to Sender', value: totals.totalReturned, color: '#dc2626' },
    { name: 'Missent', value: totals.totalMissent, color: '#d97706' },
    { name: 'Deposit', value: totals.totalDeposit, color: '#2563eb' },
  ];

  const deliveryRate =
    totals.totalReceived > 0
      ? Math.round((totals.totalDelivered / (totals.totalLastBalance + totals.totalReceived)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white border border-gray-200 p-5 rounded-lg text-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-[#00401A] text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
              Central Executive Overview
            </span>
            <span className="text-gray-500 text-xs font-mono">Circle Code: PAK-POST-DIV-01</span>
          </div>
          <h2 className="text-xl font-extrabold mt-1 text-gray-900 tracking-tight">
            Daily Delivery Performance Dashboard
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitoring {activeOffices.length} Post Offices across the Superintendent Circle.
          </p>
        </div>

        {/* Date Filter & Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <Filter className="w-3.5 h-3.5 text-[#006633]" />
            <label className="text-xs font-semibold text-gray-700">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white text-gray-800 text-xs px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#006633]"
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
          </div>

          <button
            onClick={onNavigateNewReport}
            className="bg-[#006633] hover:bg-[#00401A] text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center space-x-1.5"
          >
            <span>+ Submit Daily Report</span>
          </button>
        </div>
      </div>

      {/* Primary Status Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Offices */}
        <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Offices</p>
            <h3 className="text-2xl font-black text-gray-800">{activeOffices.length}</h3>
            <p className="text-[10px] text-green-600 mt-1 font-semibold">● Active Network Units</p>
          </div>
          <div className="w-10 h-10 bg-green-50 rounded-lg border border-green-200 flex items-center justify-center text-[#006633]">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Reports Received */}
        <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Reports Today</p>
            <h3 className="text-2xl font-black text-[#006633]">{receivedCount}</h3>
            <p className="text-[10px] text-gray-500 mt-1">
              {Math.round((receivedCount / activeOffices.length) * 100)}% Submitted
            </p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Reports */}
        <div
          onClick={onNavigatePending}
          className="bg-white border-l-4 border-l-red-500 border-t border-r border-b border-gray-200 p-4 rounded-lg shadow-sm flex items-center justify-between cursor-pointer hover:bg-red-50/20 transition-all"
        >
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pending Reports</p>
            <h3 className="text-2xl font-black text-red-600">{pendingCount}</h3>
            <p className="text-[10px] text-red-500 mt-1 font-semibold">Click to Remind Pending</p>
          </div>
          <div className="w-10 h-10 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center text-red-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Volume Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Last Balance */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Last Balance</p>
          <p className="text-base font-black text-gray-800 mt-1">
            {formatNumber(totals.totalLastBalance)}
          </p>
        </div>

        {/* Received */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs border-t-2 border-t-emerald-600">
          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Received</p>
          <p className="text-base font-black text-emerald-700 mt-1">
            {formatNumber(totals.totalReceived)}
          </p>
        </div>

        {/* Delivered */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs border-t-2 border-t-[#006633]">
          <p className="text-[10px] text-[#006633] font-bold uppercase tracking-wider">Delivered</p>
          <p className="text-base font-black text-[#006633] mt-1">
            {formatNumber(totals.totalDelivered)}
          </p>
        </div>

        {/* Returned to Sender */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs border-t-2 border-t-red-500">
          <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Returned</p>
          <p className="text-base font-black text-red-600 mt-1">
            {formatNumber(totals.totalReturned)}
          </p>
        </div>

        {/* Missent */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs border-t-2 border-t-amber-500">
          <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Missent</p>
          <p className="text-base font-black text-amber-700 mt-1">
            {formatNumber(totals.totalMissent)}
          </p>
        </div>

        {/* Deposit */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-xs border-t-2 border-t-blue-600">
          <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Deposit</p>
          <p className="text-base font-black text-blue-700 mt-1">
            {formatNumber(totals.totalDeposit)}
          </p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Office-wise Delivery Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Office Mail Volume & Deliveries</h3>
              <p className="text-xs text-gray-500">
                Articles Received vs Delivered vs Returned for {formatDatePK(selectedDate)}
              </p>
            </div>
            <span className="text-[10px] font-bold bg-green-50 text-[#006633] border border-green-200 px-2 py-0.5 rounded">
              Top 10 Offices
            </span>
          </div>

          {barChartData.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Received" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Delivered" fill="#059669" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Returned" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-lg text-gray-400">
              <Building2 className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">No reports submitted for this date yet.</p>
            </div>
          )}
        </div>

        {/* Mail Status Pie Chart & Efficiency Card */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-gray-100 mb-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Delivery Breakdown</h3>
              <p className="text-xs text-gray-500">Overall Articles Allocation</p>
            </div>

            {totals.totalReceived + totals.totalLastBalance > 0 ? (
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-gray-400">
                No mail data available
              </div>
            )}
          </div>

          <div className="bg-green-50 border border-green-200 p-3 rounded-lg mt-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#006633]">
              <span>Clearance Efficiency</span>
              <span>{deliveryRate}%</span>
            </div>
            <div className="w-full bg-green-200 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#006633] h-full transition-all duration-500"
                style={{ width: `${Math.min(deliveryRate, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submissions List Preview */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">
              Circle Master Log for {formatDatePK(selectedDate)}
            </h3>
            <p className="text-xs text-gray-500">
              {receivedCount} submitted, {pendingCount} pending submission out of {activeOffices.length} offices
            </p>
          </div>
        </div>

        {allDateReports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
                <tr>
                  <th className="p-2.5">Office Name</th>
                  <th className="p-2.5 text-right">Last Bal</th>
                  <th className="p-2.5 text-right">Received</th>
                  <th className="p-2.5 text-right">Delivered</th>
                  <th className="p-2.5 text-right">Returned</th>
                  <th className="p-2.5 text-right">Missent</th>
                  <th className="p-2.5 text-right">Deposit</th>
                  <th className="p-2.5">Remarks / Status</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                {allDateReports.map((r) => {
                  const isMissing = r.submittedBy === 'NOT_SUBMITTED' || r.remarks?.includes('Report not submitted');
                  return (
                    <tr key={r.id} className={isMissing ? 'bg-red-50/50 hover:bg-red-50/80 transition-colors' : 'hover:bg-gray-50/80 transition-colors'}>
                      <td className="p-2.5 font-bold text-gray-900">{r.officeName}</td>
                      <td className="p-2.5 text-right text-gray-600">{formatNumber(r.lastBalance)}</td>
                      <td className="p-2.5 text-right font-bold text-[#006633]">
                        {formatNumber(r.receivedToday)}
                      </td>
                      <td className="p-2.5 text-right text-emerald-700 font-semibold">{formatNumber(r.delivered)}</td>
                      <td className="p-2.5 text-right text-red-600 font-semibold">{formatNumber(r.returnedToSender)}</td>
                      <td className="p-2.5 text-right text-amber-600 font-semibold">{formatNumber(r.missent)}</td>
                      <td className="p-2.5 text-right text-blue-600 font-semibold">{formatNumber(r.deposit)}</td>
                      <td className="p-2.5 font-medium">
                        {isMissing ? (
                          <span className="text-red-700 font-bold text-[11px]">
                            Report not submitted till 5 PM
                          </span>
                        ) : (
                          <span className="text-gray-600">{r.remarks || '-'}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {isMissing ? (
                          <span className="bg-red-100 text-red-700 border border-red-200 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            NOT SUBMITTED
                          </span>
                        ) : (
                          <span className="bg-green-100 text-[#006633] border border-green-200 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            SUBMITTED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
            No active post offices registered for {formatDatePK(selectedDate)}.
          </div>
        )}
      </div>
    </div>
  );
};
