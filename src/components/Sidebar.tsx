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
  AlertTriangle,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'daily-reports'
  | 'admin-reports'
  | 'pending-reports'
  | 'pdf-exports'
  | 'post-offices'
  | 'users'
  | 'issue-explanation'
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
}) => {
  // When Admin is logged in: Dashboard is at the very TOP
  // When Public/Office user: Submit Daily Report is at the top
  const navItems =
    userRole === 'ADMIN'
      ? [
          { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard, role: 'ADMIN' },
          { id: 'daily-reports', label: 'Submit Daily Report', icon: FileSpreadsheet, role: 'ALL' },
          { id: 'admin-reports', label: 'Summary & Reports (Admin)', icon: FileSpreadsheet, role: 'ADMIN' },
          {
            id: 'pending-reports',
            label: 'Pending Offices',
            icon: Clock,
            role: 'ADMIN',
            badge: pendingCount > 0 ? pendingCount : null,
          },
          { id: 'pdf-exports', label: 'PDF & Excel Reports', icon: FileDown, role: 'ADMIN' },
          { id: 'post-offices', label: 'Post Offices Master', icon: Building, role: 'ADMIN' },
          { id: 'users', label: 'User Accounts', icon: Users, role: 'ADMIN' },
          {
            id: 'issue-explanation',
            label: 'Issue Explanation Notice',
            icon: AlertTriangle,
            role: 'ADMIN',
          },
          { id: 'whatsapp-triggers', label: 'WhatsApp & Triggers', icon: MessageSquare, role: 'ADMIN' },
          { id: 'logs', label: 'System Audit Logs', icon: ScrollText, role: 'ADMIN' },
        ]
      : [
          { id: 'daily-reports', label: 'Submit Daily Report', icon: FileSpreadsheet, role: 'ALL' },
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-medium transition-colors cursor-pointer ${
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
    </aside>
  );
};
