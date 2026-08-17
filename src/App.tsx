import React, { useState, useEffect } from 'react';
import { User, PostOffice, DailyReport, WhatsAppConfig, TriggerConfig, SystemLog, GoogleSheetsConfig } from './types';
import {
  INITIAL_POST_OFFICES,
  INITIAL_USERS,
  INITIAL_REPORTS,
  INITIAL_WHATSAPP_CONFIG,
  INITIAL_TRIGGER_CONFIG,
  INITIAL_GOOGLE_SHEETS_CONFIG,
} from './data/initialData';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { DailyReportForm } from './components/DailyReportForm';
import { ReportsList } from './components/ReportsList';
import { PendingReports } from './components/PendingReports';
import { GoogleSheetsManager } from './components/GoogleSheetsManager';
import { PdfExportView } from './components/PdfExportView';
import { PostOfficesManager } from './components/PostOfficesManager';
import { UserManagement } from './components/UserManagement';
import { WhatsAppAndTriggers } from './components/WhatsAppAndTriggers';
import { SystemLogs } from './components/SystemLogs';
import { LoginModal } from './components/LoginModal';
import {
  getTodayDateString,
  calculateClosingBalance,
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
  isInvalidPostOfficeName,
} from './utils/calculations';
import {
  dispatchReportSync,
  dispatchReportDelete,
  dispatchReportBulkSync,
  dispatchOfficesSync,
  fetchFullDatabaseFromGoogleSheet,
  fetchDatabaseViaWebhook,
  getGoogleAccessToken,
} from './utils/googleSheets';

export default function App() {
  const today = getTodayDateString();

  // Primary State Persistence
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pakpost_user');
    return saved ? JSON.parse(saved) : null; // Default: Public Direct Mode for Post Offices!
  });

  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  const [postOffices, setPostOffices] = useState<PostOffice[]>(() => {
    const saved = localStorage.getItem('pakpost_offices');
    const rawList: PostOffice[] = saved ? JSON.parse(saved) : INITIAL_POST_OFFICES;
    return cleanAndFilterPostOffices(rawList);
  });

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

  const [googleSheetsConfig, setGoogleSheetsConfig] = useState<GoogleSheetsConfig>(() => {
    const saved = localStorage.getItem('pakpost_sheets_config');
    return saved ? JSON.parse(saved) : INITIAL_GOOGLE_SHEETS_CONFIG;
  });

  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleString(),
      user: 'admin',
      role: 'ADMIN',
      action: 'SYSTEM_BOOT',
      details: 'Pakistan Post Daily Delivery Reporting System & Google Sheets Database initialized.',
      type: 'INFO',
    },
  ]);

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return currentUser?.role === 'ADMIN' ? 'dashboard' : 'daily-reports';
  });
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
      role: currentUser ? currentUser.role : 'GUEST',
      action,
      details,
      type,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Full Database State Replacement Handler (from Google Sheets Pull)
  const handleUpdateAllDatabase = (data: {
    reports?: DailyReport[];
    postOffices?: PostOffice[];
    users?: User[];
    whatsAppConfig?: WhatsAppConfig;
    triggerConfig?: TriggerConfig;
  }) => {
    if (data.reports) setReports(cleanAndFilterReports(data.reports));
    if (data.postOffices) {
      setPostOffices(cleanAndFilterPostOffices(data.postOffices));
    }
    if (data.users) setUsers(data.users);
    if (data.whatsAppConfig) setWhatsAppConfig(data.whatsAppConfig);
    if (data.triggerConfig) setTriggerConfig(data.triggerConfig);
    logAction('DATABASE_UPDATED', 'Updated application state from Google Sheets database', 'SUCCESS');
  };

  // Startup Auto-Pull from Google Sheets Database if configured
  useEffect(() => {
    const autoLoadFromGoogleSheets = async () => {
      // 1. If Webhook configured
      if (googleSheetsConfig.webhookUrl) {
        try {
          const res = await fetchDatabaseViaWebhook(googleSheetsConfig.webhookUrl);
          if (res.postOffices && res.postOffices.length > 0) {
            setPostOffices(cleanAndFilterPostOffices(res.postOffices));
          }
          if (res.reports && res.reports.length > 0) {
            setReports(cleanAndFilterReports(res.reports));
          }
          if (res.users && res.users.length > 0) {
            setUsers(res.users);
          }
          logAction('SHEETS_AUTO_LOAD', 'Loaded database directly from Google Sheet Webhook on startup', 'SUCCESS');
        } catch (e) {
          // Graceful fallback to local cache
        }
      }
      // 2. If OAuth configured with valid token
      else if (googleSheetsConfig.spreadsheetId) {
        const token = getGoogleAccessToken();
        if (token) {
          try {
            const res = await fetchFullDatabaseFromGoogleSheet(googleSheetsConfig.spreadsheetId, token);
            if (res.postOffices && res.postOffices.length > 0) {
              setPostOffices(cleanAndFilterPostOffices(res.postOffices));
            }
            if (res.reports && res.reports.length > 0) {
              setReports(cleanAndFilterReports(res.reports));
            }
            if (res.users && res.users.length > 0) {
              setUsers(res.users);
            }
            logAction('SHEETS_AUTO_LOAD', 'Loaded database directly from Google Sheet OAuth on startup', 'SUCCESS');
          } catch (e) {
            // Graceful fallback to local cache
          }
        }
      }
    };

    autoLoadFromGoogleSheets();
  }, []);

  const handleRefreshData = async () => {
    // 1. First refresh from local cache
    const savedReports = localStorage.getItem('pakpost_reports');
    if (savedReports) {
      try {
        setReports(cleanAndFilterReports(JSON.parse(savedReports)));
      } catch (e) {
        console.error('Failed to parse saved reports:', e);
      }
    }
    const savedOffices = localStorage.getItem('pakpost_offices');
    if (savedOffices) {
      try {
        setPostOffices(cleanAndFilterPostOffices(JSON.parse(savedOffices)));
      } catch (e) {
        console.error('Failed to parse saved offices:', e);
      }
    }
    setLastRefreshedAt(new Date());

    // 2. If Google Sheet database is linked, pull live updates
    if (googleSheetsConfig.webhookUrl) {
      try {
        const res = await fetchDatabaseViaWebhook(googleSheetsConfig.webhookUrl);
        if (res.postOffices && res.postOffices.length > 0) {
          setPostOffices(cleanAndFilterPostOffices(res.postOffices));
        }
        if (res.reports && res.reports.length > 0) {
          setReports(cleanAndFilterReports(res.reports));
        }
        if (res.users && res.users.length > 0) {
          setUsers(res.users);
        }
        setLastRefreshedAt(new Date());
      } catch (e) {
        // Silent catch for polling
      }
    } else if (googleSheetsConfig.spreadsheetId) {
      const token = getGoogleAccessToken();
      if (token) {
        try {
          const res = await fetchFullDatabaseFromGoogleSheet(googleSheetsConfig.spreadsheetId, token);
          if (res.postOffices && res.postOffices.length > 0) {
            setPostOffices(cleanAndFilterPostOffices(res.postOffices));
          }
          if (res.reports && res.reports.length > 0) {
            setReports(cleanAndFilterReports(res.reports));
          }
          if (res.users && res.users.length > 0) {
            setUsers(res.users);
          }
          setLastRefreshedAt(new Date());
        } catch (e) {
          // Silent catch for polling
        }
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('pakpost_auto_refresh', JSON.stringify(autoRefreshEnabled));
    if (!autoRefreshEnabled) return;

    const intervalId = setInterval(() => {
      handleRefreshData();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled]);

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN' && activeTab !== 'daily-reports') {
      setActiveTab('daily-reports');
    }
  }, [currentUser, activeTab]);

  // Sync LocalStorage
  useEffect(() => {
    localStorage.setItem('pakpost_offices', JSON.stringify(postOffices));
  }, [postOffices]);

  useEffect(() => {
    localStorage.setItem('pakpost_reports', JSON.stringify(reports));
  }, [reports]);

  useEffect(() => {
    localStorage.setItem('pakpost_sheets_config', JSON.stringify(googleSheetsConfig));
  }, [googleSheetsConfig]);

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
    if (user.role === 'ADMIN') {
      setActiveTab('dashboard');
    }
    logAction('USER_LOGIN', `Logged in as ${user.username} (${user.role})`, 'SUCCESS');
  };

  const handleLogout = () => {
    if (currentUser) {
      logAction('USER_LOGOUT', `Logged out user ${currentUser.username}`);
    }
    setCurrentUser(null);
  };

  // Submit/Edit Daily Report Handler
  const handleSubmitDailyReport = (
    reportData: Omit<DailyReport, 'id' | 'submittedAt'>,
    isEdit: boolean
  ) => {
    if (isEdit && editingReport) {
      const updatedReports = reports.map((r) =>
        r.id === editingReport.id
          ? {
              ...r,
              ...reportData,
              updatedAt: new Date().toISOString(),
            }
          : r
      );
      setReports(updatedReports);
      logAction(
        'REPORT_UPDATE',
        `Updated report for ${reportData.officeName} on ${reportData.date}. Closing Bal: ${reportData.closingBalance}`
      );
      setEditingReport(null);

      // Instantly sync edited report to connected Google Sheet
      if (googleSheetsConfig.autoSyncEnabled) {
        dispatchReportBulkSync(googleSheetsConfig, updatedReports)
          .then((res) => {
            if (res.synced) {
              logAction(
                'GOOGLE_SHEETS_UPDATE_SYNC',
                `Instantly updated Google Sheet with edited record for ${reportData.officeName}`,
                'SUCCESS'
              );
            }
          })
          .catch((err) => {
            console.warn('Google Sheets update sync error:', err);
          });
      }
    } else {
      const newReportRecord: DailyReport = {
        ...reportData,
        id: `rep-${Date.now()}`,
        submittedAt: new Date().toISOString(),
      };
      setReports((prev) => [newReportRecord, ...prev]);
      logAction(
        'REPORT_SUBMIT',
        `Submitted daily report for ${reportData.officeName} on ${reportData.date}. Closing Bal: ${reportData.closingBalance}`
      );

      // Auto-Sync to Google Sheets if enabled (supports Webhook & OAuth)
      if (googleSheetsConfig.autoSyncEnabled) {
        dispatchReportSync(googleSheetsConfig, newReportRecord)
          .then((res) => {
            if (res.synced) {
              logAction(
                'GOOGLE_SHEETS_AUTOSYNC',
                `Auto-synced report for ${reportData.officeName} to Google Sheet (${res.method.toUpperCase()})`,
                'SUCCESS'
              );
            }
          })
          .catch((err) => {
            console.warn('Google Sheets auto-sync error:', err);
          });
      }
    }
  };

  const handleDeleteReport = (reportId: string) => {
    const target = reports.find((r) => r.id === reportId);
    if (target) {
      const remainingReports = reports.filter((r) => r.id !== reportId);
      setReports(remainingReports);
      logAction('REPORT_DELETE', `Deleted report ${reportId} for ${target.officeName}`);

      // Instantly remove record from connected Google Sheet
      if (googleSheetsConfig.autoSyncEnabled) {
        dispatchReportDelete(googleSheetsConfig, remainingReports, target)
          .then((res) => {
            if (res.synced) {
              logAction(
                'GOOGLE_SHEETS_DELETE_SYNC',
                `Instantly removed deleted record (${target.officeName} - ${target.date}) from Google Sheet`,
                'SUCCESS'
              );
            }
          })
          .catch((err) => {
            console.warn('Google Sheets live delete sync error:', err);
          });
      }
    }
  };

  // Master Data Office CRUD (Always kept in Alphabetical A-Z Ascending Order & synced to Google Sheet)
  const handleSaveOffice = (office: PostOffice) => {
    if (!office.name || isInvalidPostOfficeName(office.name)) return;
    let updated: PostOffice[];
    const exists = postOffices.some((p) => p.id === office.id || p.name.toLowerCase() === office.name.toLowerCase());
    if (exists) {
      updated = postOffices.map((p) => (p.id === office.id || p.name.toLowerCase() === office.name.toLowerCase() ? office : p));
      logAction('MASTER_OFFICE_UPDATE', `Updated office master record for ${office.name}`);
    } else {
      updated = [...postOffices, office];
      logAction('MASTER_OFFICE_ADD', `Added new post office: ${office.name}`);
    }
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, cleaned).catch((err) => {
        console.warn('Google Sheets offices sync error:', err);
      });
    }
  };

  const handleToggleOfficeStatus = (officeId: string) => {
    const updated = postOffices.map((p) =>
      p.id === officeId ? { ...p, status: p.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const) } : p
    );
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);
    logAction('MASTER_STATUS_TOGGLE', `Toggled office status for ID ${officeId}`);

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, cleaned).catch((err) => {
        console.warn('Google Sheets offices sync error:', err);
      });
    }
  };

  const handleDeleteOffice = (officeId: string) => {
    const target = postOffices.find((p) => p.id === officeId);
    const updated = postOffices.filter((p) => p.id !== officeId);
    const cleaned = cleanAndFilterPostOffices(updated);
    setPostOffices(cleaned);
    logAction('MASTER_OFFICE_DELETE', `Deleted post office: ${target?.name || officeId}`, 'WARNING');

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, cleaned).catch((err) => {
        console.warn('Google Sheets offices sync error:', err);
      });
    }
  };

  const handleBulkImportOffices = (imported: PostOffice[], replaceExisting: boolean) => {
    const validImported = cleanAndFilterPostOffices(imported);
    let combined: PostOffice[];
    if (replaceExisting) {
      combined = validImported;
    } else {
      const existingNames = new Set(postOffices.map((p) => p.name.toLowerCase()));
      const newOnes = validImported.filter((p) => !existingNames.has(p.name.toLowerCase()));
      combined = [...postOffices, ...newOnes];
    }
    const cleaned = cleanAndFilterPostOffices(combined);
    setPostOffices(cleaned);
    logAction(
      'MASTER_OFFICE_BULK_IMPORT',
      `Imported ${validImported.length} offices (${replaceExisting ? 'Replaced existing' : 'Appended'})`
    );

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, cleaned).catch((err) => {
        console.warn('Google Sheets offices bulk sync error:', err);
      });
    }
  };

  const handleClearAllOffices = () => {
    setPostOffices([]);
    logAction('MASTER_OFFICE_CLEAR_ALL', 'Cleared all post offices from master directory', 'WARNING');

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, []).catch((err) => {
        console.warn('Google Sheets offices sync error:', err);
      });
    }
  };

  const handleResetDefaultOffices = () => {
    setPostOffices([...INITIAL_POST_OFFICES]);
    logAction('MASTER_OFFICE_RESET', 'Reset post offices to Gujranwala Division defaults');

    if (googleSheetsConfig.autoSyncEnabled) {
      dispatchOfficesSync(googleSheetsConfig, INITIAL_POST_OFFICES).catch((err) => {
        console.warn('Google Sheets offices sync error:', err);
      });
    }
  };

  // Password Update
  const handleChangePassword = (username: string, newPass: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.username === username ? { ...u, passwordHash: newPass } : u))
    );
    setPostOffices((prev) =>
      prev.map((p) => (p.username === username ? { ...p, password: newPass } : p))
    );
    logAction('PASSWORD_CHANGED', `Changed password for user ${username}`);
  };

  // Manual Trigger Executor
  const handleRunTriggerManually = (triggerType: 'REMINDER_5PM' | 'BACKUP_1159PM' | 'ROLLOVER_1205AM') => {
    const nowStr = `${getTodayDateString()} ${new Date().toLocaleTimeString()}`;

    if (triggerType === 'REMINDER_5PM') {
      const activeOffices = postOffices.filter((po) => po.status === 'ACTIVE');
      const submittedSet = new Set(reports.filter((r) => r.date === today).map((r) => r.officeName));
      const pending = activeOffices.filter((po) => !submittedSet.has(po.name));

      setTriggerConfig((prev) => ({ ...prev, lastReminderRun: nowStr }));
      logAction(
        'TRIGGER_5PM_RUN',
        `Executed 5:00 PM Trigger: Found ${pending.length} pending offices. Reminders dispatched.`
      );
    } else if (triggerType === 'BACKUP_1159PM') {
      setTriggerConfig((prev) => ({ ...prev, lastBackupRun: nowStr }));
      logAction(
        'TRIGGER_BACKUP_RUN',
        `Executed 11:59 PM Trigger: Backed up ${reports.length} daily delivery reports.`
      );
    } else if (triggerType === 'ROLLOVER_1205AM') {
      // 12:05 AM Balance Carry Forward
      const latestClosingMap: Record<string, number> = {};
      reports.forEach((r) => {
        latestClosingMap[r.officeName] = r.closingBalance;
      });

      const updated = postOffices.map((po) => ({
        ...po,
        initialBalance: latestClosingMap[po.name] !== undefined ? latestClosingMap[po.name] : po.initialBalance,
      }));

      setPostOffices(updated);
      setTriggerConfig((prev) => ({ ...prev, lastRolloverRun: nowStr }));
      logAction(
        'TRIGGER_ROLLOVER_RUN',
        'Executed 12:05 AM Trigger: Carried forward closing balances for all post offices.'
      );

      if (googleSheetsConfig.autoSyncEnabled) {
        dispatchOfficesSync(googleSheetsConfig, updated).catch((err) => {
          console.warn('Google Sheets offices rollover sync error:', err);
        });
      }
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
        googleSheetsConfig={googleSheetsConfig}
        onNavigateGoogleSheets={() => setActiveTab('google-sheets')}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar Menu */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setEditingReport(null);
            setActiveTab(tab);
          }}
          userRole={currentUser ? currentUser.role : 'PUBLIC'}
          pendingCount={pendingCountToday}
          onOpenAdminLogin={() => setShowAdminLoginModal(true)}
        />

        {/* Central Dynamic Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
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

          {activeTab === 'daily-reports' && (
            <div className="space-y-8">
              {/* Submission Form Section */}
              <DailyReportForm
                currentUser={currentUser}
                postOffices={postOffices}
                reports={reports}
                onSubmitReport={handleSubmitDailyReport}
                editingReport={editingReport}
                onCancelEdit={() => setEditingReport(null)}
              />
            </div>
          )}

          {activeTab === 'admin-reports' && currentUser?.role === 'ADMIN' && (
            <ReportsList
              reports={reports}
              postOffices={postOffices}
              currentUser={currentUser}
              onEditReport={(rep) => {
                setEditingReport(rep);
                setActiveTab('daily-reports');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDeleteReport={handleDeleteReport}
              onOpenNewReport={() => {
                setEditingReport(null);
                setActiveTab('daily-reports');
              }}
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

          {activeTab === 'google-sheets' && (
            <GoogleSheetsManager
              reports={reports}
              postOffices={postOffices}
              users={users}
              whatsAppConfig={whatsAppConfig}
              triggerConfig={triggerConfig}
              logs={logs}
              config={googleSheetsConfig}
              onUpdateConfig={setGoogleSheetsConfig}
              onUpdateAllDatabase={handleUpdateAllDatabase}
              onAddLog={logAction}
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

          {activeTab === 'post-offices' && (
            <PostOfficesManager
              postOffices={postOffices}
              onSaveOffice={handleSaveOffice}
              onToggleStatus={handleToggleOfficeStatus}
              onDeleteOffice={handleDeleteOffice}
              onBulkImportOffices={handleBulkImportOffices}
              onClearAllOffices={handleClearAllOffices}
              onResetDefaultOffices={handleResetDefaultOffices}
            />
          )}

          {activeTab === 'users' && (
            <UserManagement users={users} onChangePassword={handleChangePassword} />
          )}

          {activeTab === 'whatsapp-triggers' && (
            <WhatsAppAndTriggers
              whatsAppConfig={whatsAppConfig}
              triggerConfig={triggerConfig}
              onSaveWhatsApp={setWhatsAppConfig}
              onRunTriggerManually={handleRunTriggerManually}
            />
          )}

          {activeTab === 'logs' && <SystemLogs logs={logs} />}
        </main>
      </div>
    </div>
  );
}
