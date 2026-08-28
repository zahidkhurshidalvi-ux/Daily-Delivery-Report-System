import React, { useState, useEffect } from 'react';
import { DailyReport, PostOffice, User } from '../types';
import {
  calculateClosingBalance,
  validateReportFields,
  formatNumber,
  getTodayDateString,
  formatDatePK,
  cleanAndFilterPostOffices,
  isSunday,
} from '../utils/calculations';
import { AlertCircle, CheckCircle2, Calculator, Save, FileText } from 'lucide-react';

interface DailyReportFormProps {
  currentUser: User | null;
  postOffices: PostOffice[];
  reports: DailyReport[];
  onSubmitReport: (report: Omit<DailyReport, 'id' | 'submittedAt'>, isEdit: boolean) => void;
  editingReport?: DailyReport | null;
  onCancelEdit?: () => void;
}

export const DailyReportForm: React.FC<DailyReportFormProps> = ({
  currentUser,
  postOffices,
  reports,
  onSubmitReport,
  editingReport,
  onCancelEdit,
}) => {
  const today = getTodayDateString();

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

  const [date, setDate] = useState<string>(editingReport ? editingReport.date : today);
  const [selectedOfficeName, setSelectedOfficeName] = useState<string>(initialOfficeName);
  const [lastBalance, setLastBalance] = useState<string>(
    editingReport ? String(editingReport.lastBalance) : ''
  );
  const [receivedToday, setReceivedToday] = useState<string>(
    editingReport ? String(editingReport.receivedToday) : ''
  );
  const [delivered, setDelivered] = useState<string>(
    editingReport ? String(editingReport.delivered) : ''
  );
  const [returnedToSender, setReturnedToSender] = useState<string>(
    editingReport ? String(editingReport.returnedToSender) : ''
  );
  const [missent, setMissent] = useState<string>(
    editingReport ? String(editingReport.missent) : ''
  );
  const [deposit, setDeposit] = useState<string>(
    editingReport ? String(editingReport.deposit) : ''
  );
  const [remarks, setRemarks] = useState<string>(editingReport ? editingReport.remarks : '');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      // Newly added office without previous reports defaults strictly to 0 articles
      const initBal =
        office.initialBalance && Number(office.initialBalance) < 10000
          ? Math.max(0, Number(office.initialBalance))
          : 0;
      setLastBalance(String(initBal));
    }
  }, [selectedOfficeName, date, reports, postOffices, editingReport]);

  const selectedOffice = postOffices.find((po) => po.name === selectedOfficeName);

  // Parsed numeric values for calculation
  const numLastBal = parseInt(lastBalance, 10) || 0;
  const numReceived = parseInt(receivedToday, 10) || 0;
  const numDelivered = parseInt(delivered, 10) || 0;
  const numReturned = parseInt(returnedToSender, 10) || 0;
  const numMissent = parseInt(missent, 10) || 0;

  // Live Auto Calculations:
  // Total Articles = Last Balance + Received Today
  const totalArticles = numLastBal + numReceived;
  // Total Disposed = Delivered + Returned + Missent
  const totalDisposed = numDelivered + numReturned + numMissent;
  // Remaining Calculated Deposit = Total Articles - Total Disposed
  const calculatedRemainingDeposit = Math.max(0, totalArticles - totalDisposed);

  const handleAutoFillDeposit = () => {
    setDeposit(String(calculatedRemainingDeposit));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedLastBalance = parseInt(lastBalance, 10) || 0;
    const parsedReceivedToday = parseInt(receivedToday, 10) || 0;
    const parsedDelivered = parseInt(delivered, 10) || 0;
    const parsedReturned = parseInt(returnedToSender, 10) || 0;
    const parsedMissent = parseInt(missent, 10) || 0;
    const parsedDeposit = deposit === '' ? calculatedRemainingDeposit : parseInt(deposit, 10) || 0;

    // 0. Sunday check: Sundays are official weekly closed holidays
    if (isSunday(date)) {
      setErrorMessage(
        'Sunday is an official weekly closed holiday. Daily report submission is not required for Sundays.'
      );
      return;
    }

    // 1. Validation check
    const valError = validateReportFields({
      date,
      officeCode: selectedOfficeName,
      lastBalance: parsedLastBalance,
      receivedToday: parsedReceivedToday,
      delivered: parsedDelivered,
      returnedToSender: parsedReturned,
      missent: parsedMissent,
      deposit: parsedDeposit,
    });

    if (valError) {
      setErrorMessage(valError);
      return;
    }

    if (!selectedOffice) {
      setErrorMessage('Please select a valid Post Office from the dropdown list.');
      return;
    }

    // 2. Determine if it is a new submission or update
    const existing = reports.find((r) => r.officeName === selectedOfficeName && r.date === date);
    const isEdit = Boolean(editingReport) || Boolean(existing);

    // Calculate accurate Closing Balance
    const calculatedClosingBal = calculateClosingBalance(
      parsedLastBalance,
      parsedReceivedToday,
      parsedDelivered,
      parsedReturned,
      parsedMissent,
      parsedDeposit
    );

    // Create report object
    const newReport: Omit<DailyReport, 'id' | 'submittedAt'> = {
      date,
      officeName: selectedOffice.name,
      postmasterName: selectedOffice.postmasterName || '',
      lastBalance: parsedLastBalance,
      receivedToday: parsedReceivedToday,
      delivered: parsedDelivered,
      returnedToSender: parsedReturned,
      missent: parsedMissent,
      deposit: parsedDeposit,
      closingBalance: calculatedClosingBal,
      remarks,
      submittedBy: currentUser
        ? currentUser.username
        : `office_${(selectedOffice?.name || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
    };

    onSubmitReport(newReport, isEdit);
    setSuccessMessage(
      `Daily Delivery Report for ${selectedOffice.name} (${formatDatePK(date)}) ${
        isEdit ? 'updated' : 'submitted'
      } successfully!`
    );

    // Reset form fields
    if (!isEdit) {
      setReceivedToday('');
      setDelivered('');
      setReturnedToSender('');
      setMissent('');
      setDeposit('');
      setRemarks('');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-green-50 border border-green-200 text-[#006633] rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 uppercase tracking-tight">
              {editingReport ? 'Edit Daily Delivery Report' : 'Submit Daily Delivery Report'}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Official Form for Divisional Superintendent (PS)
            </p>
          </div>
        </div>

        {editingReport && onCancelEdit && (
          <button
            onClick={onCancelEdit}
            className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-300 font-medium"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {/* Error & Success Banners */}
      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start space-x-3 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Validation Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-start space-x-3 text-xs">
          <CheckCircle2 className="w-5 h-5 text-[#006633] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Submission Successful</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Date & Post Office Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Report Date *
              </label>
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
              onChange={(e) => {
                const newDate = e.target.value;
                setDate(newDate);
                if (isSunday(newDate) && !remarks) {
                  setRemarks('Sunday Holiday / Closed');
                }
              }}
              disabled={Boolean(editingReport)}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#006633]"
              required
            />
            {isSunday(date) && (
              <p className="text-[11px] text-amber-700 font-bold mt-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center">
                <span>⚠️ Sunday Holiday (Weekly Closed) — Excluded from missing reports & explanation notices.</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Select Post Office *
            </label>

            <select
              value={selectedOfficeName}
              onChange={(e) => setSelectedOfficeName(e.target.value)}
              disabled={Boolean(editingReport)}
              className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#006633]"
            >
              {sortedPostOffices.map((po) => (
                <option key={po.id} value={po.name}>
                  {po.name} {po.status === 'INACTIVE' ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
            {selectedOffice && (
              <p className="text-[10px] text-gray-500 mt-1 font-medium flex items-center justify-between">
                <span>Postmaster: <strong className="text-gray-700">{selectedOffice.postmasterName}</strong></span>
                <span>Contact: <strong className="text-gray-700">{selectedOffice.mobileNumber}</strong></span>
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Articles Data Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Last Balance */}
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Last Balance (Brought Forward)
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={lastBalance}
              onChange={(e) => setLastBalance(e.target.value)}
              disabled={currentUser?.role !== 'ADMIN'}
              className="w-full bg-white border border-gray-300 text-gray-900 text-sm font-bold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#006633]"
            />
            <p className="text-[10px] text-gray-500 mt-1 font-medium">
              {currentUser?.role === 'ADMIN' ? 'Editable by Admin' : 'Auto-carried from previous day deposit balance'}
            </p>
          </div>

          {/* Articles Received Today */}
          <div className="bg-green-50/50 border border-green-200 p-3 rounded-lg">
            <label className="block text-xs font-bold text-[#006633] mb-1">
              Articles Received Today *
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={receivedToday}
              onChange={(e) => setReceivedToday(e.target.value)}
              className="w-full bg-white border border-green-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#006633]"
              required
            />
          </div>

          {/* Delivered */}
          <div className="bg-green-50/50 border border-green-200 p-3 rounded-lg">
            <label className="block text-xs font-bold text-emerald-800 mb-1">
              Articles Delivered *
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={delivered}
              onChange={(e) => setDelivered(e.target.value)}
              className="w-full bg-white border border-green-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#006633]"
              required
            />
          </div>

          {/* Returned to Sender */}
          <div className="bg-red-50/50 border border-red-200 p-3 rounded-lg">
            <label className="block text-xs font-bold text-red-700 mb-1">
              Returned to Sender *
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={returnedToSender}
              onChange={(e) => setReturnedToSender(e.target.value)}
              className="w-full bg-white border border-red-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Missent */}
          <div className="bg-amber-50/50 border border-amber-200 p-3 rounded-lg">
            <label className="block text-xs font-bold text-amber-800 mb-1">
              Missent Articles *
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={missent}
              onChange={(e) => setMissent(e.target.value)}
              className="w-full bg-white border border-amber-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Deposit */}
          <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-blue-800">
                Deposit Articles *
              </label>
              <button
                type="button"
                onClick={handleAutoFillDeposit}
                className="text-[10px] text-blue-700 hover:underline font-extrabold"
                title="Auto calculate deposit"
              >
                Auto-Fill ({calculatedRemainingDeposit})
              </button>
            </div>
            <input
              type="number"
              min="0"
              placeholder={String(calculatedRemainingDeposit)}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              className="w-full bg-white border border-blue-300 text-gray-900 text-sm font-extrabold rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-blue-600 mt-1 font-medium">
              Calculated Remaining: <strong className="font-bold">{formatNumber(calculatedRemainingDeposit)}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
          <button
            type="submit"
            className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all shadow-xs flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{editingReport ? 'Update Daily Report' : 'Submit Today\'s Report'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
