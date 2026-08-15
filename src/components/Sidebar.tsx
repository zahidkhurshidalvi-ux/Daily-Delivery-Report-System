import React from 'react';
import { UserRole } from '../types';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Clock,
  FileDown,
  Building,
  Users,
  MessageSquare,
  ScrollText,
  Lock,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'daily-reports'
  | 'pending-reports'
  | 'google-sheets'
  | 'pdf-exports'
  | 'post-offices'
  | 'users'
  | 'whatsapp-triggers'
  | 'logs';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  userRole: UserRole | 'PUBLIC';
  pendingCount: number;
  onOpenAdminLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  pendingCount,
  onOpenAdminLogin,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, role: 'ADMIN' },
    { id: 'daily-reports', label: 'Submit Daily Report', icon: FileSpreadsheet, role: 'ALL' },
    {
      id: 'pending-reports',
      label: 'Pending Offices',
      icon: Clock,
      role: 'ADMIN',
      badge: pendingCount > 0 ? pendingCount : null,
    },
    { id: 'google-sheets', label: 'Google Sheets Sync', icon: FileSpreadsheet, role: 'ADMIN' },
    { id: 'pdf-exports', label: 'PDF & Excel Reports', icon: FileDown, role: 'ADMIN' },
    { id: 'post-offices', label: 'Post Offices Master', icon: Building, role: 'ADMIN' },
    { id: 'users', label: 'User Accounts', icon: Users, role: 'ADMIN' },
    { id: 'whatsapp-triggers', label: 'WhatsApp & Triggers', icon: MessageSquare, role: 'ADMIN' },
    { id: 'logs', label: 'System Audit Logs', icon: ScrollText, role: 'ADMIN' },
  ];

  const filteredItems = navItems.filter((item) => item.role === 'ALL' || userRole === 'ADMIN');

  return (
    <aside className="w-full lg:w-60 bg-[#00401A] text-white flex flex-col border-b lg:border-b-0 lg:border-r border-[#005522] shrink-0 no-print">
      <div className="p-4 border-b border-[#005522] flex items-center gap-3">
        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
          <div className="w-4 h-4 border-2 border-[#00401A] rounded-full"></div>
        </div>
        <div>
          <h2 className="text-sm font-bold leading-tight uppercase tracking-wider text-white">
            Pak Post Portal
          </h2>
          <span className="text-[10px] text-green-200 opacity-90 font-medium block">
            {userRole === 'ADMIN' ? 'Divisional Admin Panel' : 'Direct Submission Portal'}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-1 flex-1">
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as NavTab)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#005522] text-white font-bold shadow-xs'
                    : 'text-green-100/90 hover:bg-[#005522]/80 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-yellow-400' : 'text-green-200/70'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full text-[10px]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info / Admin Login Trigger */}
      <div className="p-3.5 border-t border-[#005522] text-xs space-y-2">
        <div className="text-[10px] text-green-300/80 uppercase font-semibold tracking-wider">
          ACCESS MODE
        </div>
        <div className="text-xs font-extrabold text-white truncate">
          {userRole === 'ADMIN' ? 'Divisional Superintendent' : 'Post Office Direct (No Login)'}
        </div>

        {userRole !== 'ADMIN' && (
          <button
            onClick={onOpenAdminLogin}
            className="w-full mt-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-[11px] font-bold py-1.5 px-3 rounded flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Superintendent Admin Login</span>
          </button>
        )}
      </div>
    </aside>
  );
};

