import React, { useState, useEffect, useRef } from 'react';
import { User, DailyReport, PostOffice, WhatsAppConfig, TriggerConfig, SystemLog } from './types';
import {
  INITIAL_POST_OFFICES,
  INITIAL_USERS,
  INITIAL_REPORTS,
  INITIAL_WHATSAPP_CONFIG,
  INITIAL_TRIGGER_CONFIG,
} from './data/initialData';
import {
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
  getTodayDateString,
  isInvalidPostOfficeName,
} from './utils/calculations';
import {
  subscribeToPostOffices,
  subscribeToDailyReports,
  savePostOfficeToCloud,
  deletePostOfficeFromCloud,
  syncAllOfficesToCloud,
  saveDailyReportToCloud,
  deleteDailyReportFromCloud,
  saveAppConfigToCloud,
  subscribeToAppConfig,
} from './services/cloudDatabase';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DailyReportForm } from './components/DailyReportForm';
import { ReportsList } from './components/ReportsList';
import { PostOfficesManager } from './components/PostOfficesManager';
import { PendingReports } from './components/PendingReports';
import { PdfExportView } from './components/PdfExportView';
import { WhatsAppAndTriggers } from './components/WhatsAppAndTriggers';
import { UserManagement } from './components/UserManagement';
import { SystemLogs } from './components/SystemLogs';
import { LoginModal } from './components/LoginModal';

// Helper function to merge two post office lists preserving contact numbers and mobile numbers
function mergeOfficesPreservingData(current: PostOffice[], incoming: PostOffice[]): PostOffice[] {
  const officeMap = new Map<string, PostOffice>();

  current.forEach((po) => {
    if (po && po.name) {
      officeMap.set(po.name.toLowerCase().trim(), { ...po });
    }
  });

  incoming.forEach((inc) => {
    if (!inc || !inc.name) return;
    const key = inc.name.toLowerCase().trim();
    const existing = officeMap.get(key);
    if (existing) {
      officeMap.set(key, {
        ...existing,
        ...inc,
        // Preserve mobile number if incoming is empty but existing has one
        mobileNumber: (inc.mobileNumber && inc.mobileNumber.trim()) || existing.mobileNumber || '',
        postmasterName: (inc.postmasterName && inc.postmasterName.trim()) || existing.postmasterName || 'Postmaster',
        status: inc.status || existing.status || 'ACTIVE',
        initialBalance: typeof inc.initialBalance === 'number' ? inc.initialBalance : existing.initialBalance,
      });
    } else {
      officeMap.set(key, { ...inc });
    }
  });

  return Array.from(officeMap.values());
}

export default function App() {
  const today = getTodayDateString();

  // Primary State Persistence
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pakpost_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  const [postOffices, setPostOffices] = useState<PostOffice[]>(() => {
    const saved = localStorage.getItem('pakpost_offices');
    const rawList: PostOffice[] = saved ? JSON.parse(saved) : INITIAL_POST_OFFICES;
    return cleanAndFilterPostOffices(rawList);
  });

  const postOfficesRef = useRef<PostOffice[]>(postOffices);
  useEffect(() => {
    postOfficesRef.current = postOffices;
  }, [postOffices]);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('pakpost_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [reports, setReports] = useState<DailyReport[]>(() => {
    const saved = localStorage.getItem('pakpost_reports');
    const rawList: DailyReport[] = saved ? JSON.parse(saved) : INITIAL_REPORTS;
    return cleanAndFilterReports(rawList);
  });

  const [whatsAppConfig, setWhatsAppConfig] = useState<WhatsAppConfig>(() => {
    const saved = localStorage.getItem('pakpost_whatsapp');
    return saved ? JSON.parse(saved) : INITIAL_WHATSAPP_CONFIG;
  });

  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>(() => {
    const saved = localStorage.getItem('pakpost_triggers');
    return saved ? JSON.parse(saved) : INITIAL_TRIGGER_CONFIG;
  });

  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleString(),
      user: 'admin',
      role: 'ADMIN',
      action: 'SYSTEM_BOOT',
      details: 'Pakistan Post Daily Delivery Reporting System & Permanent Cloud Database connected.',
      type: 'INFO',
    },
  ]);

  // Main page default tab is ALWAYS 'daily-reports' (User Daily Submission Form) for easy user entry
  const [activeTab, setActiveTab] = useState<NavTab>('daily-reports');
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);

  // Auto-Refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('pakpost_auto_refresh');
    return saved ? JSON.parse(saved) : true;
  });
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(new Date());

  // Logging Helper
  const logAction = (action: string, details: string, type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR' = 'INFO') => {
    const newLog: SystemLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      user: currentUser ? currentUser.username : 'SYSTEM',
      role: currentUser ? currentUser.role : 'PUBLIC',
      action,
      details,
      type,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // 1. Permanent Real-time Cloud Subscriptions across all Mobile & Desktop devices
  useEffect(() => {
    const unsubOffices = subscribeToPostOffices(
      (cloudOffices) => {
        if (cloudOffices && cloudOffices.length > 0) {
          const merged = mergeOfficesPreservingData(postOfficesRef.current, cleanAndFilterPostOffices(cloudOffices));
          setPostOffices(merged);
          setLastRefreshedAt(new Date());
        } else if (postOfficesRef.current.length > 0) {
          syncAllOfficesToCloud(postOfficesRef.current);
        }
      },
      (err) => {
        console.warn('Realtime cloud offices subscription:', err);
      }
    );

    const unsubReports = subscribeToDailyReports(
      (cloudReports) => {
        if (cloudReports && cloudReports.length > 0) {
          setReports(cleanAndFilterReports(cloudReports));
          setLastRefreshedAt(new Date());
        }
      },
      (err) => {
        console.warn('Realtime cloud reports subscription:', err);
      }
    );

    const unsubConfig = subscribeToAppConfig((cfg) => {
      if (cfg.whatsAppConfig) setWhatsAppConfig(cfg.whatsAppConfig);
      if (cfg.triggerConfig) setTriggerConfig(cfg.triggerConfig);
    });

    return () => {
      unsubOffices();
      unsubReports();
      unsubConfig();
    };
  }, []);

  const handleRefreshData = async () => {
    setLastRefreshedAt(new Date());
  };

  useEffect(() => {
    localStorage.setItem('pakpost_auto_refresh', JSON.stringify(autoRefreshEnabled));
    if (!autoRefreshEnabled) return;

    const intervalId = setInterval(() => {
      handleRefreshData();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled]);

  // Sync LocalStorage for offline durability
  useEffect(() => {
    localStorage.setItem('pakpost_offices', JSON.stringify(postOffices));
  }, [postOffices]);

  useEffect(() => {
    localStorage.setItem('pakpost_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('pakpost_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('pakpost_whatsapp', JSON.stringify(whatsAppConfig));
  }, [whatsAppConfig]);

  useEffect(() => {
    localStorage.setItem('pakpost_triggers', JSON.stringify(triggerConfig));
  }, [triggerConfig]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('pakpost_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('pakpost_user');
    }
  }, [currentUser]);

  // Login & Logout
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowAdminLoginModal(false);
    logAction('USER_LOGIN', `Logged in as ${user.username} (${user.role})`, 'SUCCESS');
  };

  const handleLogout = () => {
    if (currentUser) {
      logAction('USER_LOGOUT', `Logged out user ${currentUser.username}`);
    }
    setCurrentUser(null);
    setActiveTab('daily-reports');
  };

  // Submit/Edit Daily Report Handler
  const handleSubmitDailyReport = (
    reportData: Omit<DailyReport, 'id' | 'submittedAt'>,
    isEdit: boolean
  ) => {
    if (isEdit && editingReport) {
      const updatedReportRecord: DailyReport = {
        ...editingReport,
        ...reportData,
        updatedAt: new Date().toISOString(),
      };
      const updatedReports = reports.map((r) =>
        r.id === editingReport.id ? updatedReportRecord : r
      );
      setReports(updatedReports);
      saveDailyReportToCloud(updatedReportRecord);
      logAction(
        'REPORT_UPDATE',
        `Updated report for ${reportData.officeName} on ${reportData.date}. Closing Bal: ${reportData.closingBalance}`
      );
      setEditingReport(null);
    } else {
      const newReportRecord: DailyReport = {
        ...reportData,
        id: `rep-${Date.now()}`,
        submittedAt: new Date().toISOString(),
      };
      setReports((prev) => [newReportRecord, ...prev]);
      saveDailyReportToCloud(newReportRecord);
      logAction(
        'REPORT_SUBMIT',
        `Submitted daily report for ${reportData.officeName} on ${reportData.date}. Closing Bal: ${reportData.closingBalance}`
      );
    }
  };

  const handleDeleteReport = (reportId: string) => {
    const target = reports.find((r) => r.id === reportId);
    if (target) {
      const remainingReports = reports.filter((r) => r.id !== reportId);
      setReports(remainingReports);
      deleteDailyReportFromCloud(reportId);
      logAction('REPORT_DELETE', `Deleted report ${reportId} for ${target.officeName}`);
    }
  };

  // Master Data Office CRUD
  const handleSaveOffice = (office: PostOffice) => {
    if (!office.name || isInvalidPostOfficeName(office.name)) return;
    let updated: PostOffice[];
    const targetNameLower = (office.name || '').toLowerCase().trim();
    const exists = postOffices.some(
      (p) => p.id === office.id || (p.name || '').toLowerCase().trim() === targetNameLower
    );
    if (exists) {
      updated = postOffices.map((p) => {
        if (p.id === office.id || (p.name || '').toLowerCase().trim() === targetNameLower) {
          return {
            ...p,
            ...office,
            mobileNumber: office.mobileNumber !== undefined ? office.mobileNumber : p.mobileNumber,
          };
        }
        return p;
      });
      logAction('MASTER_OFFICE_UPDATE', `Updated office master record for ${office.name} with contact ${office.mobileNumber || 'N/A'}`);
    } else {
      updated = [...postOffices, office];
      logAction('MASTER_OFFICE_ADD', `Added new post office: ${office.name} with contact ${office.mobileNumber || 'N/A'}`);
    }
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);
    savePostOfficeToCloud(office);
  };

  const handleToggleOfficeStatus = (officeId: string) => {
    const target = postOffices.find((p) => p.id === officeId);
    if (!target) return;
    const newStatus = target.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const);
    const updatedOffice = { ...target, status: newStatus };
    const updated = postOffices.map((p) => (p.id === officeId ? updatedOffice : p));
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);
    savePostOfficeToCloud(updatedOffice);
    logAction('MASTER_STATUS_TOGGLE', `Toggled office status for ${target.name} to ${newStatus}`);
  };

  const handleDeleteOffice = (officeId: string) => {
    const target = postOffices.find((p) => p.id === officeId);
    const updated = postOffices.filter((p) => p.id !== officeId);
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);
    deletePostOfficeFromCloud(officeId);
    logAction('MASTER_OFFICE_DELETE', `Deleted post office: ${target?.name || officeId}`, 'WARNING');
  };

  const handleBulkImportOffices = (imported: PostOffice[], replaceExisting: boolean) => {
    const validImported = cleanAndFilterPostOffices(imported);
    let combined: PostOffice[];
    if (replaceExisting) {
      combined = mergeOfficesPreservingData(postOffices, validImported);
    } else {
      combined = mergeOfficesPreservingData(postOffices, validImported);
    }
    const cleaned = cleanAndFilterPostOffices(combined);
    setPostOffices(cleaned);
    syncAllOfficesToCloud(cleaned);
    logAction(
      'MASTER_OFFICE_BULK_IMPORT',
      `Imported ${validImported.length} offices (${replaceExisting ? 'Updated existing' : 'Appended'}) with preserved contact details.`
    );
  };

  const handleClearAllOffices = () => {
    postOffices.forEach((po) => deletePostOfficeFromCloud(po.id));
    setPostOffices([]);
    logAction('MASTER_OFFICE_CLEAR_ALL', 'Cleared all post offices from master directory', 'WARNING');
  };

  const handleResetDefaultOffices = () => {
    setPostOffices([...INITIAL_POST_OFFICES]);
    syncAllOfficesToCloud(INITIAL_POST_OFFICES);
    logAction('MASTER_OFFICE_RESET', 'Reset post offices to defaults');
  };

  // Password Update
  const handleChangePassword = (username: string, newPass: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.username === username ? { ...u, passwordHash: newPass } : u))
    );
    logAction('PASSWORD_CHANGED', `Changed password for user ${username}`);
  };

  // Automated Trigger Manual Execution
  const handleRunTrigger = (triggerType: 'REMINDER_5PM' | 'BACKUP_1159PM' | 'ROLLOVER_1205AM') => {
    const nowStr = new Date().toLocaleString();
    if (triggerType === 'REMINDER_5PM') {
      setTriggerConfig((prev) => ({ ...prev, lastReminderRun: nowStr }));
      logAction('TRIGGER_REMINDER_RUN', 'Executed 5:00 PM Trigger: Generated WhatsApp missing report alerts.');
    } else if (triggerType === 'BACKUP_1159PM') {
      setTriggerConfig((prev) => ({ ...prev, lastBackupRun: nowStr }));
      logAction(
        'TRIGGER_BACKUP_RUN',
        `Executed 11:59 PM Trigger: Backed up ${reports.length} daily delivery reports.`
      );
    } else if (triggerType === 'ROLLOVER_1205AM') {
      const latestClosingMap: Record<string, number> = {};
      reports.forEach((r) => {
        latestClosingMap[r.officeName] = r.closingBalance;
      });

      const updated = postOffices.map((po) => ({
        ...po,
        initialBalance: latestClosingMap[po.name] !== undefined ? latestClosingMap[po.name] : po.initialBalance,
      }));

      const cleaned = cleanAndFilterPostOffices(updated);
      setPostOffices(cleaned);
      syncAllOfficesToCloud(cleaned);
      setTriggerConfig((prev) => ({ ...prev, lastRolloverRun: nowStr }));
      logAction(
        'TRIGGER_ROLLOVER_RUN',
        'Executed 12:05 AM Trigger: Carried forward closing balances for all post offices.'
      );
    }
  };

  // Calculate pending office count for today
  const activeOffices = postOffices.filter((po) => po.status === 'ACTIVE');
  const todaySubmittedSet = new Set(reports.filter((r) => r.date === today).map((r) => r.officeName));
  const pendingCountToday = activeOffices.filter((po) => !todaySubmittedSet.has(po.name)).length;

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-800 font-sans flex flex-col">
      {/* Optional Admin Login Modal */}
      {showAdminLoginModal && (
        <LoginModal
          users={users}
          postOffices={postOffices}
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowAdminLoginModal(false)}
        />
      )}

      {/* Top Header Navbar */}
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        pendingCount={pendingCountToday}
        onNavigatePending={() => setActiveTab('pending-reports')}
        onOpenAdminLogin={() => setShowAdminLoginModal(true)}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={() => setAutoRefreshEnabled((prev) => !prev)}
        onManualRefresh={handleRefreshData}
        lastRefreshedAt={lastRefreshedAt}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar Menu */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={currentUser ? currentUser.role : 'PUBLIC'}
          pendingCount={pendingCountToday}
          onOpenAdminLogin={() => setShowAdminLoginModal(true)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl">
          {activeTab === 'daily-reports' && (
            <DailyReportForm
              postOffices={postOffices}
              reports={reports}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onSubmitReport={handleSubmitDailyReport}
              editingReport={editingReport}
              onCancelEdit={() => setEditingReport(null)}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              reports={reports}
              postOffices={postOffices}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onNavigateNewReport={() => setActiveTab('daily-reports')}
              onNavigatePending={() => setActiveTab('pending-reports')}
            />
          )}

          {activeTab === 'admin-reports' && (
            <ReportsList
              reports={reports}
              postOffices={postOffices}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onDeleteReport={handleDeleteReport}
              onEditReport={(rep) => {
                setEditingReport(rep);
                setActiveTab('daily-reports');
              }}
              onLogAction={logAction}
            />
          )}

          {activeTab === 'pending-reports' && (
            <PendingReports
              postOffices={postOffices}
              reports={reports}
              selectedDate={selectedDate}
              whatsAppConfig={whatsAppConfig}
              onLogAction={logAction}
            />
          )}

          {activeTab === 'post-offices' && (
            <PostOfficesManager
              postOffices={postOffices}
              onSaveOffice={handleSaveOffice}
              onDeleteOffice={handleDeleteOffice}
              onToggleStatus={handleToggleOfficeStatus}
              onBulkImport={handleBulkImportOffices}
              onClearAll={handleClearAllOffices}
              onResetDefault={handleResetDefaultOffices}
            />
          )}

          {activeTab === 'pdf-exports' && (
            <PdfExportView
              reports={reports}
              postOffices={postOffices}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          )}

          {activeTab === 'whatsapp-triggers' && (
            <WhatsAppAndTriggers
              whatsAppConfig={whatsAppConfig}
              triggerConfig={triggerConfig}
              onSaveWhatsApp={(newCfg) => {
                setWhatsAppConfig(newCfg);
                saveAppConfigToCloud({ whatsAppConfig: newCfg });
              }}
              onRunTriggerManually={handleRunTrigger}
            />
          )}

          {activeTab === 'users' && (
            <UserManagement
              users={users}
              postOffices={postOffices}
              currentUser={currentUser}
              onChangePassword={handleChangePassword}
            />
          )}

          {activeTab === 'logs' && <SystemLogs logs={logs} />}
        </main>
      </div>
    </div>
  );
}
