import React from 'react';
import { SystemLog } from '../types';
import { ScrollText, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SystemLogsProps {
  logs: SystemLog[];
}

export const SystemLogs: React.FC<SystemLogsProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">System Activity Logs & Audit Trail</h2>
            <p className="text-xs text-gray-500 font-medium">
              Audit trail for user logins, daily report submissions, WhatsApp dispatches, and triggers.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200 text-[10px]">
              <tr>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">User</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-2.5 text-gray-500 font-mono text-[11px] whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-2.5 font-bold text-gray-900">{log.user}</td>
                  <td className="p-2.5">
                    <span className="text-[9px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase">
                      {log.role}
                    </span>
                  </td>
                  <td className="p-2.5 text-[#006633] font-bold font-mono">{log.action}</td>
                  <td className="p-2.5 text-gray-700">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
