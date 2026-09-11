import React from 'react';
import { FileEdit, Clock, BarChart3, ShieldCheck, Download } from 'lucide-react';
import { NavTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  pendingCount: number;
  onOpenAdminLogin: () => void;
  isAdmin: boolean;
  onOpenApkDownload: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
  onOpenAdminLogin,
  isAdmin,
  onOpenApkDownload,
}) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-lg px-2 py-1.5 flex items-center justify-around select-none no-print lg:hidden"
      id="mobile-bottom-navigation"
    >
      {/* 1. Daily Report Form Tab */}
      <button
        type="button"
        onClick={() => setActiveTab('daily-reports')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          activeTab === 'daily-reports'
            ? 'text-[#00401A] font-black'
            : 'text-gray-500 hover:text-gray-900 font-medium'
        }`}
      >
        <div
          className={`p-1 rounded-lg ${
            activeTab === 'daily-reports' ? 'bg-[#00401A]/10' : ''
          }`}
        >
          <FileEdit className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Report Form</span>
      </button>

      {/* 2. Pending Reports Tab with Badge */}
      <button
        type="button"
        onClick={() => setActiveTab('pending-reports')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative cursor-pointer ${
          activeTab === 'pending-reports'
            ? 'text-[#00401A] font-black'
            : 'text-gray-500 hover:text-gray-900 font-medium'
        }`}
      >
        <div
          className={`p-1 rounded-lg relative ${
            activeTab === 'pending-reports' ? 'bg-[#00401A]/10' : ''
          }`}
        >
          <Clock className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full ring-2 ring-white">
              {pendingCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Pendency</span>
      </button>

      {/* 3. Dashboard / Summary Tab */}
      <button
        type="button"
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
          activeTab === 'dashboard'
            ? 'text-[#00401A] font-black'
            : 'text-gray-500 hover:text-gray-900 font-medium'
        }`}
      >
        <div
          className={`p-1 rounded-lg ${
            activeTab === 'dashboard' ? 'bg-[#00401A]/10' : ''
          }`}
        >
          <BarChart3 className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Summary</span>
      </button>

      {/* 4. Admin Portal or Login */}
      {isAdmin ? (
        <button
          type="button"
          onClick={() => setActiveTab('admin-reports')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'admin-reports' || activeTab === 'post-offices' || activeTab === 'whatsapp-triggers'
              ? 'text-[#00401A] font-black'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          <div
            className={`p-1 rounded-lg ${
              activeTab === 'admin-reports' ? 'bg-[#00401A]/10' : ''
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-[#00401A]" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Admin</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenAdminLogin}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-gray-500 hover:text-[#00401A] font-medium transition-all cursor-pointer"
          title="Admin Login"
        >
          <div className="p-1 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Login</span>
        </button>
      )}

      {/* 5. APK Download */}
      <button
        type="button"
        onClick={onOpenApkDownload}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-emerald-700 hover:text-emerald-900 font-bold transition-all cursor-pointer"
        title="Download Android APK"
      >
        <div className="p-1 rounded-lg bg-emerald-50 text-[#00401A]">
          <Download className="w-5 h-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Get App</span>
      </button>
    </nav>
  );
};
