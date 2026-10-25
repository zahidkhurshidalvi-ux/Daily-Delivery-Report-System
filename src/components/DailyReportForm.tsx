import React, { useState, useEffect, useMemo } from 'react';
import { DailyReport, PostOffice, User, ArticleCategoryConfig } from '../types';
import { DEFAULT_ARTICLE_CATEGORIES } from '../data/initialData';
import {
  calculateClosingBalance,
  validateReportFields,
  formatNumber,
  getTodayDateString,
  formatDatePK,
  cleanAndFilterPostOffices,
  isSunday,
  normalizeDateToIso,
  getMissingDatesForOffice,
  SYSTEM_LAUNCH_DATE,
} from '../utils/calculations';
import {
  AlertCircle,
  CheckCircle2,
  Calculator,
  Save,
  FileText,
  Loader2,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Eye,
  UserCheck,
  PackageCheck,
  Inbox,
  Send,
  Sliders,
  TrendingUp,
} from 'lucide-react';

interface DailyReportFormProps {
  currentUser: User | null;
  postOffices: PostOffice[];
  reports: DailyReport[];
  categories?: ArticleCategoryConfig[];
  onSubmitReport: (report: Omit<DailyReport, 'id' | 'submittedAt'>, isEdit: boolean) => Promise<any> | void;
  editingReport?: DailyReport | null;
  onCancelEdit?: () => void;
  onViewPending?: () => void;
}

export const DailyReportForm: React.FC<DailyReportFormProps> = ({
  currentUser,
  postOffices,
  reports,
  categories = DEFAULT_ARTICLE_CATEGORIES,
  onSubmitReport,
  editingReport,
  onCancelEdit,
  onViewPending,
}) => {
  const today = getTodayDateString();

  // Active categories configured by admin (or default Pakistan Post categories)
  const activeCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : DEFAULT_ARTICLE_CATEGORIES;
    return list.filter((c) => c.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories]);

  // Always sort clean post offices in ascending alphabetical order (A to Z)
  const sortedPostOffices = cleanAndFilterPostOffices(postOffices);

  // Check URL parameter for pre-selected post office
  const getUrlOfficeName = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const name = params.get('office') || params.get('po');
      if (name && sortedPostOffices.some((p) => (p.name || '').toLowerCase() === name.toLowerCase())) {
        return sortedPostOffices.find((p) => (p.name || '').toLowerCase() === name.toLowerCase())?.name || '';
      }
    } catch {
      // ignore
    }
    return '';
  };

  const initialOfficeName =
    editingReport
      ? editingReport.officeName
      : getUrlOfficeName() ||
        (currentUser?.role === 'POST_OFFICE' && currentUser.officeName
          ? currentUser.officeName
          : sortedPostOffices[0]?.name || '');

  // Form State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [date, setDate] = useState<string>(editingReport ? editingReport.date : today);
  const [selectedOfficeName, setSelectedOfficeName] = useState<string>(initialOfficeName);
  const [selectedPostmanId, setSelectedPostmanId] = useState<string>(editingReport?.postmanId || '');

  // Opening / Last Balance (Total articles brought forward)
  const [lastBalance, setLastBalance] = useState<string>(
    editingReport ? String(editingReport.lastBalance) : ''
  );

  // Category Breakdowns: key -> quantity
  const [receivedByCategory, setReceivedByCategory] = useState<Record<string, string>>(() => {
    if (editingReport?.receivedBreakdown) {
      const initial: Record<string, string> = {};
      Object.entries(editingReport.receivedBreakdown).forEach(([k, v]) => {
        initial[k] = String(v);
      });
      return initial;
    }
    return {};
  });

  const [deliveredByCategory, setDeliveredByCategory] = useState<Record<string, string>>(() => {
    if (editingReport?.deliveredBreakdown) {
      const initial: Record<string, string> = {};
      Object.entries(editingReport.deliveredBreakdown).forEach(([k, v]) => {
        initial[k] = String(v);
      });
      return initial;
    }
    return {};
  });

  // Outcomes
  const [returnedToSender, setReturnedToSender] = useState<string>(
    editingReport ? String(editingReport.returnedToSender) : '0'
  );
  const [missent, setMissent] = useState<string>(
    editingReport ? String(editingReport.missent) : '0'
  );
  const [deposit, setDeposit] = useState<string>(
    editingReport ? String(editingReport.deposit) : ''
  );
  const [remarks, setRemarks] = useState<string>(editingReport ? editingReport.remarks : '');

  // EMTTS Express Mail Track & Trace System Status
  const [emttsUpdated, setEmttsUpdated] = useState<string>(
    editingReport?.emttsUpdated !== undefined ? String(editingReport.emttsUpdated) : ''
  );
  const [emttsNotUpdatedManual, setEmttsNotUpdatedManual] = useState<string | null>(
    editingReport?.emttsNotUpdated !== undefined ? String(editingReport.emttsNotUpdated) : null
  );

  // Deep Preview Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Submission Status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReceipt, setSubmissionReceipt] = useState<{
    trackingId: string;
    submittedAt: string;
    officeName: string;
    postmanName?: string;
    date: string;
    isEdit: boolean;
    closingBalance: number;
    delivered: number;
    receivedToday: number;
    lastBalance: number;
  } | null>(null);

  // Selected Office Object
  const selectedOffice = sortedPostOffices.find((po) => po.name === selectedOfficeName);
  const officePostmen = selectedOffice?.postmen || [];
  const selectedPostman = officePostmen.find((pm) => pm.id === selectedPostmanId);

  // Auto-fill Last Balance from previous day closing/deposit balance whenever office or date changes
  useEffect(() => {
    if (editingReport) return;

    const office = postOffices.find((p) => p.name === selectedOfficeName);
    if (!office) return;

    // Find latest previous report before selected date
    const officeReports = reports
      .filter((r) => r.officeName === selectedOfficeName && r.date < date)
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    if (officeReports.length > 0) {
      const prev = officeReports[0];
      const prevDeposit = Number(prev.deposit) || 0;
      const prevCalculated = Math.max(
        0,
        (Number(prev.lastBalance) || 0) +
          (Number(prev.receivedToday) || 0) -
          (Number(prev.delivered) || 0) -
          (Number(prev.returnedToSender) || 0) -
          (Number(prev.missent) || 0)
      );
      const prevBal = prevDeposit > 0 ? prevDeposit : prevCalculated;
      const safeBal = prevBal >= 0 && prevBal < 10000 ? prevBal : 0;
      setLastBalance(String(safeBal));
    } else {
      const initBal =
        office.initialBalance && Number(office.initialBalance) < 10000
          ? Math.max(0, Number(office.initialBalance))
          : 0;
      setLastBalance(String(initBal));
    }
  }, [selectedOfficeName, date, reports, postOffices, editingReport]);

  // Auto-select first post office when list loads if none currently selected
  useEffect(() => {
    if (!selectedOfficeName && sortedPostOffices.length > 0) {
      setSelectedOfficeName(sortedPostOffices[0].name);
    }
  }, [selectedOfficeName, sortedPostOffices]);

  // Check if report already exists for selected date
  const normOffice = (name: string) => String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const selectedDateIso = normalizeDateToIso(date) || date;
  const existingReportForSelected = reports.find(
    (r) =>
      normOffice(r.officeName) === normOffice(selectedOfficeName) &&
      (normalizeDateToIso(r.date) || r.date) === selectedDateIso &&
      r.submittedBy !== 'NOT_SUBMITTED' &&
      !r.remarks?.includes('Report not submitted')
  );

  // Missing/Pending dates for selected office
  const pendingDatesForOffice = selectedOfficeName
    ? getMissingDatesForOffice(selectedOfficeName, today, reports)
    : [];

  // ==========================================
  // CALCULATIONS
  // ==========================================
  const numLastBalance = parseInt(lastBalance, 10) || 0;

  // Total Received Today is the sum of all active categories in Step 1
  const totalReceivedToday = useMemo(() => {
    return activeCategories.reduce((sum, cat) => {
      const val = parseInt(receivedByCategory[cat.key] || '0', 10) || 0;
      return sum + Math.max(0, val);
    }, 0);
  }, [activeCategories, receivedByCategory]);

  // Total Available Articles = Last Balance + Received Today
  const totalAvailableArticles = numLastBalance + totalReceivedToday;

  // Total Delivered Articles is the sum of all categories in Step 2
  const totalDelivered = useMemo(() => {
    return activeCategories.reduce((sum, cat) => {
      const val = parseInt(deliveredByCategory[cat.key] || '0', 10) || 0;
      return sum + Math.max(0, val);
    }, 0);
  }, [activeCategories, deliveredByCategory]);

  const deliveryRate = totalAvailableArticles > 0
    ? ((totalDelivered / totalAvailableArticles) * 100).toFixed(1)
    : '0.0';

  // Total Trackable (EMTTS) items processed
  const totalEmttsTrackableProcessed = useMemo(() => {
    return activeCategories.reduce((sum, cat) => {
      if (cat.requiresEmtts) {
        const delVal = parseInt(deliveredByCategory[cat.key] || '0', 10) || 0;
        return sum + Math.max(0, delVal);
      }
      return sum;
    }, 0);
  }, [activeCategories, deliveredByCategory]);

  const numReturned = parseInt(returnedToSender, 10) || 0;
  const numMissent = parseInt(missent, 10) || 0;

  // Auto Deposit / Not Delivered = Total Available - Delivered - Returned - Missent
  const autoDepositValue = Math.max(0, totalAvailableArticles - totalDelivered - numReturned - numMissent);

  const numDeposit = deposit === '' ? autoDepositValue : parseInt(deposit, 10) || 0;

  // EMTTS Auto Calculation
  const numEmttsUpdated = parseInt(emttsUpdated, 10) || 0;
  const autoEmttsNotUpdated = Math.max(0, (totalEmttsTrackableProcessed || totalDelivered) - numEmttsUpdated);
  const finalEmttsNotUpdated =
    emttsNotUpdatedManual !== null ? parseInt(emttsNotUpdatedManual, 10) || 0 : autoEmttsNotUpdated;

  // Calculated Closing Balance
  const calculatedClosingBal = calculateClosingBalance(
    numLastBalance,
    totalReceivedToday,
    totalDelivered,
    numReturned,
    numMissent,
    numDeposit
  );

  // Category handlers
  const handleReceivedChange = (key: string, val: string) => {
    setReceivedByCategory((prev) => ({ ...prev, [key]: val }));
  };

  const handleDeliveredChange = (key: string, val: string) => {
    setDeliveredByCategory((prev) => ({ ...prev, [key]: val }));
  };

  // Step 1 Validation
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedOffice) {
      setErrorMessage('Please select a valid Post Office from the list.');
      return;
    }
    if (isSunday(date)) {
      setErrorMessage('Sunday is an official weekly holiday. Report submission is not required.');
      return;
    }
    if (date > today) {
      setErrorMessage('مستقبل کی تاریخ کی رپورٹ جمع نہیں کروائی جا سکتی۔ براہ کرم آج کی یا سابقہ تاریخ منتخب کریں۔');
      return;
    }

    setCurrentStep(2);
  };

  // Step 2 Validation
  const handleProceedToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Verify delivery counts
    for (const cat of activeCategories) {
      const rec = parseInt(receivedByCategory[cat.key] || '0', 10) || 0;
      const del = parseInt(deliveredByCategory[cat.key] || '0', 10) || 0;
      if (del < 0) {
        setErrorMessage(`Delivered count for ${cat.label} cannot be negative.`);
        return;
      }
    }

    // Auto-fill deposit if empty
    if (deposit === '') {
      setDeposit(String(autoDepositValue));
    }
    // Default EMTTS updated to trackable delivered count if unset
    if (emttsUpdated === '') {
      setEmttsUpdated(String(totalEmttsTrackableProcessed || totalDelivered));
    }

    setCurrentStep(3);
  };

  // Open Deep Preview before final submit
  const handleOpenDeepPreview = () => {
    setErrorMessage(null);

    const valError = validateReportFields({
      date,
      officeCode: selectedOfficeName,
      lastBalance: numLastBalance,
      receivedToday: totalReceivedToday,
      delivered: totalDelivered,
      returnedToSender: numReturned,
      missent: numMissent,
      deposit: numDeposit,
    });

    if (valError) {
      setErrorMessage(valError);
      return;
    }

    setIsPreviewModalOpen(true);
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmissionReceipt(null);
    setIsPreviewModalOpen(false);

    // Build numeric category breakdown records
    const cleanReceivedBreakdown: Record<string, number> = {};
    const cleanDeliveredBreakdown: Record<string, number> = {};

    activeCategories.forEach((cat) => {
      cleanReceivedBreakdown[cat.key] = parseInt(receivedByCategory[cat.key] || '0', 10) || 0;
      cleanDeliveredBreakdown[cat.key] = parseInt(deliveredByCategory[cat.key] || '0', 10) || 0;
    });

    const isEdit = Boolean(editingReport) || Boolean(existingReportForSelected);

    const newReport: Omit<DailyReport, 'id' | 'submittedAt'> = {
      date,
      officeName: selectedOffice!.name,
      postmasterName: selectedOffice?.postmasterName || '',
      postmanId: selectedPostmanId || undefined,
      postmanName: selectedPostman ? selectedPostman.name : undefined,
      lastBalance: numLastBalance,
      receivedToday: totalReceivedToday,
      delivered: totalDelivered,
      returnedToSender: numReturned,
      missent: numMissent,
      deposit: numDeposit,
      closingBalance: calculatedClosingBal,
      remarks,
      submittedBy: currentUser
        ? currentUser.username
        : `office_${(selectedOffice?.name || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
      receivedBreakdown: cleanReceivedBreakdown,
      deliveredBreakdown: cleanDeliveredBreakdown,
      emttsUpdated: numEmttsUpdated,
      emttsNotUpdated: finalEmttsNotUpdated,
    };

    setIsSubmitting(true);
    try {
      await onSubmitReport(newReport, isEdit);

      const trackingId = `PKPOST-REP-${date.replace(/-/g, '')}-${selectedOffice!.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`;
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      setSubmissionReceipt({
        trackingId,
        submittedAt: timeStr,
        officeName: selectedOffice!.name,
        postmanName: selectedPostman?.name,
        date,
        isEdit,
        closingBalance: calculatedClosingBal,
        delivered: totalDelivered,
        receivedToday: totalReceivedToday,
        lastBalance: numLastBalance,
      });

      setSuccessMessage(
        `Daily Delivery Report for ${selectedOffice!.name} (${formatDatePK(date)}) ${
          isEdit ? 'updated' : 'submitted'
        } successfully with category breakdown and saved in Central Cloud Database!`
      );

      // Reset form if new submission
      if (!isEdit) {
        setReceivedByCategory({});
        setDeliveredByCategory({});
        setReturnedToSender('0');
        setMissent('0');
        setDeposit('');
        setEmttsUpdated('');
        setEmttsNotUpdatedManual(null);
        setRemarks('');
        setCurrentStep(1);
      }
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMessage(
        `رپورٹ کلاؤڈ ڈیٹا بیس میں محفوظ نہیں ہو سکی! براہ کرم دوبارہ کوشش کریں۔ (${err?.message || 'Network Timeout'})`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-4 mb-6 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-200 text-[#006633] rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-[#00401A] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                Daily Delivery Portal
              </span>
              <span className="text-gray-500 text-xs font-mono">Step {currentStep} of 3</span>
            </div>
            <h2 className="text-lg font-extrabold text-gray-900 uppercase tracking-tight mt-0.5">
              {editingReport ? 'Edit Daily Delivery Report' : 'Submit Daily Delivery Report'}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              (وصول و ترسیل ڈاک کی روزانہ تفصیلی رپورٹ — برائے ڈویژنل سپرنٹنڈنٹ)
            </p>
          </div>
        </div>

        {editingReport && onCancelEdit && (
          <button
            onClick={onCancelEdit}
            className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-300 font-bold self-start cursor-pointer"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* 3 Step Wizard Progress Bar */}
      <div className="mb-6 grid grid-cols-3 gap-2 text-xs">
        {/* Step 1 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
            currentStep === 1
              ? 'bg-emerald-50 border-[#006633] text-[#006633] font-black shadow-xs ring-1 ring-[#006633]'
              : 'bg-gray-50 border-gray-200 text-gray-600 font-semibold hover:bg-gray-100'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep === 1
                ? 'bg-[#006633] text-white'
                : totalReceivedToday > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            {totalReceivedToday > 0 ? <Check className="w-3.5 h-3.5" /> : '1'}
          </div>
          <div>
            <span className="block text-[11px] font-bold">Step 1: Received</span>
            <span className="text-[10px] opacity-80 block truncate">
              {totalReceivedToday > 0 ? `${formatNumber(totalReceivedToday)} Articles` : 'Categories & Last Bal'}
            </span>
          </div>
        </button>

        {/* Step 2 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
            currentStep === 2
              ? 'bg-emerald-50 border-[#006633] text-[#006633] font-black shadow-xs ring-1 ring-[#006633]'
              : 'bg-gray-50 border-gray-200 text-gray-600 font-semibold hover:bg-gray-100'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep === 2
                ? 'bg-[#006633] text-white'
                : totalDelivered > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            {totalDelivered > 0 ? <Check className="w-3.5 h-3.5" /> : '2'}
          </div>
          <div>
            <span className="block text-[11px] font-bold">Step 2: Delivered</span>
            <span className="text-[10px] opacity-80 block truncate">
              {totalDelivered > 0 ? `${formatNumber(totalDelivered)} Delivered (${deliveryRate}%)` : 'Delivery by Category'}
            </span>
          </div>
        </button>

        {/* Step 3 Tab */}
        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
            currentStep === 3
              ? 'bg-emerald-50 border-[#006633] text-[#006633] font-black shadow-xs ring-1 ring-[#006633]'
              : 'bg-gray-50 border-gray-200 text-gray-600 font-semibold hover:bg-gray-100'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep === 3
                ? 'bg-[#006633] text-white'
                : calculatedClosingBal >= 0
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-300 text-gray-700'
            }`}
          >
            3
          </div>
          <div>
            <span className="block text-[11px] font-bold">Step 3: Outcomes & EMTTS</span>
            <span className="text-[10px] opacity-80 block truncate">
              Deposit: {formatNumber(numDeposit)} • Bal: {formatNumber(calculatedClosingBal)}
            </span>
          </div>
        </button>
      </div>

      {/* Cloud Verified Receipt Card */}
      {submissionReceipt && (
        <div className="mb-6 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 text-emerald-950 shadow-sm animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    Cloud Verified Receipt
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    {submissionReceipt.trackingId}
                  </span>
                </div>
                <h3 className="text-base font-black text-emerald-900 mt-0.5">
                  رپورٹ کلاؤڈ ڈیٹا بیس میں کامیابی سے تصدیق اور محفوظ ہو گئی ہے!
                </h3>
              </div>
            </div>
            <div className="text-right sm:text-right">
              <span className="text-[11px] text-emerald-700 font-semibold block">Confirmed At:</span>
              <span className="text-xs font-mono font-black text-emerald-900">{submissionReceipt.submittedAt}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 text-[10px] font-bold block">Post Office:</span>
              <span className="font-bold text-emerald-950 text-sm truncate block">{submissionReceipt.officeName}</span>
              {submissionReceipt.postmanName && (
                <span className="text-[10px] text-gray-500 block truncate">Postman: {submissionReceipt.postmanName}</span>
              )}
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 text-[10px] font-bold block">Report Date:</span>
              <span className="font-bold text-emerald-950 text-sm block font-mono">{formatDatePK(submissionReceipt.date)}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 text-[10px] font-bold block">Received Today:</span>
              <span className="font-bold text-emerald-950 text-sm block font-mono">{formatNumber(submissionReceipt.receivedToday)}</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 text-[10px] font-bold block">Closing Balance:</span>
              <span className="font-bold text-emerald-950 text-sm block font-mono">{formatNumber(submissionReceipt.closingBalance)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <p className="text-[11px] text-emerald-800 font-medium">
              ✓ یہ رسید آپ کے دفتر کے ریکارڈ اور ڈویژنل ہیڈکوارٹر کے پاس محفوظ ہو چکی ہے۔ پینڈنسی لسٹ سے یہ تاریخ خودکار طور پر خارج ہو چکی ہے۔
            </p>
            {onViewPending && (
              <button
                type="button"
                onClick={onViewPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                Check Pending List
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error & Success Banners */}
      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start space-x-3 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Validation / Cloud Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && !submissionReceipt && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-start space-x-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-[#006633] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Submission Successful</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Office & Date Selection Header (Shared across all steps) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 text-xs">
        {/* Date Selection */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-bold text-gray-700">Report Date *</label>
            {!editingReport && (
              <button
                type="button"
                onClick={() => setDate(getTodayDateString())}
                className="text-[10px] text-[#006633] hover:underline font-bold"
              >
                Today ({formatDatePK(getTodayDateString())})
              </button>
            )}
          </div>
          <input
            type="date"
            value={date}
            min={SYSTEM_LAUNCH_DATE}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            disabled={Boolean(editingReport) || isSubmitting}
            className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
            required
          />
        </div>

        {/* Post Office Selection */}
        <div>
          <label className="block font-bold text-gray-700 mb-1">Select Post Office *</label>
          <select
            value={selectedOfficeName}
            onChange={(e) => {
              setSelectedOfficeName(e.target.value);
              setSelectedPostmanId('');
            }}
            disabled={Boolean(editingReport)}
            className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
          >
            {sortedPostOffices.map((po) => (
              <option key={po.id} value={po.name}>
                {po.name} {po.status === 'INACTIVE' ? '(Inactive)' : ''}
              </option>
            ))}
          </select>
          {selectedOffice && (
            <p className="text-[10px] text-gray-500 mt-1 font-medium truncate">
              PM: <strong>{selectedOffice.postmasterName}</strong> • {selectedOffice.mobileNumber}
            </p>
          )}
        </div>

        {/* Postman Selection (Optional if registered) */}
        <div>
          <label className="block font-bold text-gray-700 mb-1">
            Assign Postman (پوسٹ مین / ڈاکیے کا انتخاب)
          </label>
          <select
            value={selectedPostmanId}
            onChange={(e) => setSelectedPostmanId(e.target.value)}
            className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2 focus:ring-1 focus:ring-[#006633]"
          >
            <option value="">All Postmen / General Office Delivery (مجموعی)</option>
            {officePostmen.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name} {pm.beatNo ? `(${pm.beatNo})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-500 mt-1 font-medium">
            {officePostmen.length > 0
              ? `${officePostmen.length} Postmen registered for this office`
              : 'No individual postmen added in Master yet'}
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* STEP 1: RECEIVED ARTICLES (وصول شدہ ڈاک اور اوپننگ بیلنس) */}
      {/* ======================================================== */}
      {currentStep === 1 && (
        <form onSubmit={handleProceedToStep2} className="space-y-6">
          {/* Section 1A: Opening / Last Balance */}
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <label className="block text-xs font-black text-amber-950 uppercase tracking-wide">
                  Last Balance (Opening Total Articles Brought Forward — سابقہ بقایا کل ڈاک)
                </label>
                <p className="text-[11px] text-amber-800">
                  گزشتہ دن کا ڈیپازٹ یا کل بیلنس جو آج صبح ترسیل کے لیے دستیاب ہے۔
                </p>
              </div>
              <span className="bg-amber-200/80 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold self-start">
                Total Opening
              </span>
            </div>

            <div className="max-w-xs">
              <input
                type="number"
                min="0"
                placeholder="0"
                value={lastBalance}
                onChange={(e) => setLastBalance(e.target.value)}
                className="w-full bg-white border border-amber-300 text-gray-900 text-base font-black rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#006633] font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1 font-medium">
                Auto-carried from previous day closing balance ({numLastBalance} articles).
              </p>
            </div>
          </div>

          {/* Section 1B: Received Articles by Category */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 mb-4 gap-2">
              <div>
                <h3 className="font-black text-sm text-gray-900 flex items-center space-x-2">
                  <Inbox className="w-4 h-4 text-[#006633]" />
                  <span>Received Articles by Category (آج وصول شدہ ڈاک بلحاظ کیٹیگری)</span>
                </h3>
                <p className="text-[11px] text-gray-500">
                  مندرجہ ذیل ہر کیٹیگری میں موصول ہونے والے آرٹیکلز درج کریں۔ کل موصول شدہ خودکار حساب ہو گا۔
                </p>
              </div>

              {/* Live Subtotal Badge */}
              <div className="bg-[#00401A] text-white px-3 py-1.5 rounded-lg flex items-center space-x-2 shrink-0 self-start">
                <span className="text-[11px] font-semibold text-emerald-200 uppercase">Total Received:</span>
                <span className="text-sm font-black font-mono text-yellow-300">
                  {formatNumber(totalReceivedToday)}
                </span>
              </div>
            </div>

            {/* Dynamic Category Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeCategories.map((cat) => {
                const val = receivedByCategory[cat.key] || '';
                return (
                  <div
                    key={cat.key}
                    className="p-3 bg-gray-50/80 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-800 truncate" title={cat.label}>
                        {cat.label}
                      </label>
                      {cat.requiresEmtts && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded font-mono">
                          EMTTS
                        </span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-[10px] text-gray-400 mb-1.5 truncate" title={cat.description}>
                        {cat.description}
                      </p>
                    )}
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={val}
                      onChange={(e) => handleReceivedChange(cat.key, e.target.value)}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-bold rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-[#006633] font-mono"
                    />
                  </div>
                );
              })}
            </div>

            {/* Total Available Articles Banner */}
            <div className="mt-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-900">
                Total Available for Delivery (کل قابلِ ترسیل ڈاک = Last Bal {numLastBalance} + Received {totalReceivedToday})
              </span>
              <span className="text-base font-black text-[#006633] font-mono">
                {formatNumber(totalAvailableArticles)} Articles
              </span>
            </div>
          </div>

          {/* Step 1 Actions */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleOpenDeepPreview}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all border border-blue-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Deep Preview (تفصیلی جائزہ)</span>
            </button>

            <button
              type="submit"
              className="bg-[#006633] hover:bg-[#004d26] text-white text-xs font-extrabold px-6 py-2.5 rounded-lg transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              <span>Next: Step 2 - Delivered Articles (اگلا مرحلہ: ترسیل شدہ ڈاک)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* STEP 2: DELIVERED ARTICLES (ترسیل شدہ ڈاک بلحاظ کیٹیگری) */}
      {/* ======================================================== */}
      {currentStep === 2 && (
        <form onSubmit={handleProceedToStep3} className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 mb-4 gap-2">
              <div>
                <h3 className="font-black text-sm text-gray-900 flex items-center space-x-2">
                  <PackageCheck className="w-4 h-4 text-[#006633]" />
                  <span>Delivered Articles by Category (ترسیل شدہ ڈاک بلحاظ کیٹیگری)</span>
                </h3>
                <p className="text-[11px] text-gray-500">
                  (انہی کیٹیگریز میں بتائیں کہ کتنے کتنے آرٹیکلز کی ترسیل ہوئی۔ کل ترسیل خودکار جمع ہو گی)
                </p>
              </div>

              {/* Total Delivered Summary Badge */}
              <div className="flex items-center space-x-2 shrink-0 self-start">
                <div className="bg-[#00401A] text-white px-3 py-1.5 rounded-lg flex items-center space-x-2">
                  <span className="text-[11px] font-semibold text-emerald-200 uppercase">Total Delivered:</span>
                  <span className="text-sm font-black font-mono text-yellow-300">
                    {formatNumber(totalDelivered)}
                  </span>
                </div>
                <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1.5 rounded-lg text-xs font-black font-mono">
                  {deliveryRate}%
                </div>
              </div>
            </div>

            {/* Delivered Category Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeCategories.map((cat) => {
                const recVal = parseInt(receivedByCategory[cat.key] || '0', 10) || 0;
                const delVal = deliveredByCategory[cat.key] || '';
                const numDel = parseInt(delVal, 10) || 0;
                const isOver = recVal > 0 && numDel > recVal && numLastBalance === 0;

                return (
                  <div
                    key={cat.key}
                    className={`p-3 rounded-lg border transition-colors ${
                      isOver ? 'bg-amber-50/70 border-amber-300' : 'bg-gray-50/80 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-gray-800 truncate" title={cat.label}>
                        {cat.label}
                      </label>
                      <span className="text-[10px] bg-emerald-100 text-[#006633] font-bold px-1.5 py-0.5 rounded font-mono">
                        Rec: {recVal}
                      </span>
                    </div>

                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={delVal}
                      onChange={(e) => handleDeliveredChange(cat.key, e.target.value)}
                      className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-bold rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-[#006633] font-mono"
                    />

                    <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                      <span>Rate: {recVal > 0 ? `${((numDel / recVal) * 100).toFixed(0)}%` : '—'}</span>
                      {recVal > numDel && (
                        <span className="text-blue-600 font-semibold">
                          Undelivered: {recVal - numDel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Progress Card */}
            <div className="mt-5 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-extrabold text-gray-800 block">Overall Delivery Performance:</span>
                <span className="text-gray-500">
                  {formatNumber(totalDelivered)} delivered out of {formatNumber(totalAvailableArticles)} available articles.
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-gray-600">
                  Pending: {Math.max(0, totalAvailableArticles - totalDelivered)} articles
                </span>
                <span className="bg-[#006633] text-white px-2.5 py-1 rounded text-xs font-mono font-black">
                  {deliveryRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Step 2 Actions */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all border border-gray-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Step 1 (واپس)</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={handleOpenDeepPreview}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all border border-blue-200 flex items-center space-x-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Deep Preview (تفصیلی جائزہ)</span>
              </button>

              <button
                type="submit"
                className="bg-[#006633] hover:bg-[#004d26] text-white text-xs font-extrabold px-6 py-2.5 rounded-lg transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
              >
                <span>Next: Step 3 - Outcomes & EMTTS (اگلا: واپسی و EMTTS)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* STEP 3: OUTCOMES & EMTTS (واپسی، مسنٹ، ڈیپازٹ اور EMTTS) */}
      {/* ======================================================== */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Section 3A: Dispositions */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <h3 className="font-black text-sm text-gray-900 mb-1 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[#006633]" />
              <span>Dispositions & Balances (واپسی، مسنٹ اور ڈیپازٹ ڈاک)</span>
            </h3>
            <p className="text-[11px] text-gray-500 mb-4">
              (غیر تقسیم شدہ / ڈیپازٹ آرٹیکلز کا حساب خودکار لگایا گیا ہے)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Returned to Sender */}
              <div className="bg-red-50/50 border border-red-200 p-3.5 rounded-lg">
                <label className="block font-bold text-red-800 mb-1">
                  Returned to Sender (واپسی ڈاک)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={returnedToSender}
                  onChange={(e) => setReturnedToSender(e.target.value)}
                  className="w-full bg-white border border-red-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:ring-1 focus:ring-red-500 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">Inadmissible / Refused / Left</span>
              </div>

              {/* Missent Articles */}
              <div className="bg-amber-50/50 border border-amber-200 p-3.5 rounded-lg">
                <label className="block font-bold text-amber-800 mb-1">
                  Missent Articles (غلط روانگی ڈاک)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={missent}
                  onChange={(e) => setMissent(e.target.value)}
                  className="w-full bg-white border border-amber-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:ring-1 focus:ring-amber-500 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">Misdirected to this office</span>
              </div>

              {/* Deposit / Not Delivered */}
              <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-blue-900">
                    Deposit / Not Delivered (ڈیپازٹ ڈاک)
                  </label>
                  <button
                    type="button"
                    onClick={() => setDeposit(String(autoDepositValue))}
                    className="text-[10px] text-blue-700 hover:underline font-extrabold"
                  >
                    Auto ({autoDepositValue})
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder={String(autoDepositValue)}
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="w-full bg-white border border-blue-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-blue-700 mt-1 block font-medium">
                  Auto-calculated: {formatNumber(autoDepositValue)} articles
                </span>
              </div>
            </div>
          </div>

          {/* Section 3B: EMTTS Status (Updated vs Not Updated) */}
          <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-5 shadow-xs text-xs">
            <div className="flex items-center space-x-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <h3 className="font-black text-sm text-gray-900">
                Pakistan Post EMTTS Status (ٹریک اینڈ ٹریس سسٹم اپ ڈیٹ اسٹیٹس)
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 mb-4">
              (ایکسپریس میل ٹریک اینڈ ٹریس سسٹم پر بارکوڈ آرٹیکلز کی اپ ڈیٹ کی تعداد درج کریں)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Updated on EMTTS */}
              <div className="bg-white border border-blue-300 p-3.5 rounded-lg shadow-2xs">
                <label className="block font-bold text-blue-950 mb-1">
                  Updated on EMTTS (No. of articles — سسٹم پر اپ ڈیٹ شدہ ڈاک) *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder={String(totalEmttsTrackableProcessed || totalDelivered)}
                  value={emttsUpdated}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmttsUpdated(val);
                    if (emttsNotUpdatedManual === null) {
                      const num = parseInt(val, 10) || 0;
                      const base = totalEmttsTrackableProcessed || totalDelivered;
                      // auto update
                    }
                  }}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-black rounded-lg p-2 focus:ring-2 focus:ring-[#006633] font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Trackable delivered: {totalEmttsTrackableProcessed} articles
                </span>
              </div>

              {/* Not Updated on EMTTS (Auto) */}
              <div className="bg-white border border-amber-300 p-3.5 rounded-lg shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-amber-950">
                    Not Updated on EMTTS (No. of articles — غیر اپ ڈیٹ شدہ ڈاک)
                  </label>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold uppercase">
                    Auto-Math
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={finalEmttsNotUpdated}
                  onChange={(e) => setEmttsNotUpdatedManual(e.target.value)}
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-black rounded-lg p-2 focus:ring-2 focus:ring-[#006633] font-mono"
                />
                <span className="text-[10px] text-amber-700 mt-1 block">
                  Auto remaining: {autoEmttsNotUpdated} articles pending in EMTTS
                </span>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Remarks / Explanatory Notes (کیفیت یا نوٹس)
            </label>
            <input
              type="text"
              placeholder="e.g. Normal Delivery, Beat 2 road construction delay, etc."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#006633]"
            />
          </div>

          {/* Closing Balance Summary Banner */}
          <div className="bg-[#00401A] text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider block">
                Calculated Closing Balance
              </span>
              <p className="text-xs text-white/90 font-medium">
                Closing = Last Bal ({numLastBalance}) + Rec ({totalReceivedToday}) - Del ({totalDelivered}) - Ret ({numReturned}) - Miss ({numMissent}) - Dep ({numDeposit})
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-yellow-300">
                {formatNumber(calculatedClosingBal)}
              </span>
              <span className="text-[10px] text-emerald-200 block uppercase">Articles Balance</span>
            </div>
          </div>

          {/* Step 3 Actions */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all border border-gray-300 flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Step 2 (واپس)</span>
            </button>

            {/* Deep Preview Trigger Button */}
            <button
              type="button"
              onClick={handleOpenDeepPreview}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold px-6 py-2.5 rounded-lg transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Deep Summary & Submit (تفصیلی جائزہ لیں)</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DEEP PREVIEW MODAL BEFORE FINAL CLOUD SUBMISSION */}
      {/* "Inhi ko use krky deeply sy pehly preview ay." */}
      {/* ======================================================== */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="bg-[#00401A] text-white p-4.5 flex items-center justify-between border-b border-[#005522]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-yellow-400 text-[#00401A] rounded-lg flex items-center justify-center font-black">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase tracking-tight">
                    Daily Delivery Report — Deep Preview (تفصیلی جائزہ)
                  </h3>
                  <p className="text-xs text-emerald-200">
                    {selectedOffice?.name} • Date: {formatDatePK(date)}
                    {selectedPostman ? ` • Postman: ${selectedPostman.name}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Quick Top Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-gray-500 font-bold block uppercase">Last Bal</span>
                  <span className="text-base font-black font-mono text-gray-800">
                    {formatNumber(numLastBalance)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-[#006633] font-bold block uppercase">Received</span>
                  <span className="text-base font-black font-mono text-[#006633]">
                    {formatNumber(totalReceivedToday)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">Delivered</span>
                  <span className="text-base font-black font-mono text-emerald-800">
                    {formatNumber(totalDelivered)} ({deliveryRate}%)
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Deposit / Close</span>
                  <span className="text-base font-black font-mono text-blue-900">
                    {formatNumber(numDeposit)}
                  </span>
                </div>
              </div>

              {/* Detailed Category Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-3.5 py-2 font-black text-gray-800 text-[11px] uppercase flex items-center justify-between border-b border-gray-200">
                  <span>Category Breakdown (بلحاظ کیٹیگری وصولی و ترسیل)</span>
                  <span className="text-gray-500 font-normal">Active Categories: {activeCategories.length}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">Category Name</th>
                      <th className="p-2.5 text-right">Received</th>
                      <th className="p-2.5 text-right">Delivered</th>
                      <th className="p-2.5 text-right">Balance</th>
                      <th className="p-2.5 text-right">Delivery %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                    {activeCategories.map((cat) => {
                      const rec = parseInt(receivedByCategory[cat.key] || '0', 10) || 0;
                      const del = parseInt(deliveredByCategory[cat.key] || '0', 10) || 0;
                      const bal = Math.max(0, rec - del);
                      const rate = rec > 0 ? ((del / rec) * 100).toFixed(0) : '—';
                      return (
                        <tr key={cat.key} className="hover:bg-gray-50/60">
                          <td className="p-2.5 font-bold text-gray-900">
                            {cat.label}
                            {cat.requiresEmtts && (
                              <span className="ml-1.5 text-[9px] text-blue-600 font-mono">EMTTS</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-mono text-[#006633] font-bold">
                            {formatNumber(rec)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-800 font-bold">
                            {formatNumber(del)}
                          </td>
                          <td className="p-2.5 text-right font-mono text-gray-600 font-semibold">
                            {formatNumber(bal)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-gray-700">
                            {rate !== '—' ? `${rate}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-100 font-black border-t-2 border-gray-300 text-gray-900">
                    <tr>
                      <td className="p-2.5 uppercase">Grand Total:</td>
                      <td className="p-2.5 text-right font-mono text-[#006633]">
                        {formatNumber(totalReceivedToday)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-800">
                        {formatNumber(totalDelivered)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-gray-800">
                        {formatNumber(Math.max(0, totalReceivedToday - totalDelivered))}
                      </td>
                      <td className="p-2.5 text-right font-mono text-[#006633]">
                        {deliveryRate}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Outcomes & EMTTS Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1.5">
                  <h4 className="font-bold text-gray-900 text-xs">Dispositions</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Returned to Sender:</span>
                    <strong className="font-mono text-red-700">{formatNumber(numReturned)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Missent:</span>
                    <strong className="font-mono text-amber-700">{formatNumber(numMissent)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deposit / Undelivered:</span>
                    <strong className="font-mono text-blue-700">{formatNumber(numDeposit)}</strong>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-200 space-y-1.5">
                  <h4 className="font-bold text-blue-950 text-xs">EMTTS System Synchronization</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Updated on EMTTS:</span>
                    <strong className="font-mono text-blue-900">{formatNumber(numEmttsUpdated)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Not Updated on EMTTS:</span>
                    <strong className="font-mono text-amber-800">{formatNumber(finalEmttsNotUpdated)}</strong>
                  </div>
                  {remarks && (
                    <div className="pt-1 text-[11px] text-gray-500 italic">
                      Remarks: "{remarks}"
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg border border-gray-300 cursor-pointer"
              >
                Modify / Edit Form (ترمیم کریں)
              </button>

              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-[#006633] hover:bg-[#004d26] text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Cloud Database...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Confirm & Send to Database (ڈیٹا بیس کو ارسال کریں)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
