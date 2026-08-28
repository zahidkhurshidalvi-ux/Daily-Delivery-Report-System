import * as XLSX from 'xlsx';
import { DailyReport, PostOffice } from '../types';
import { formatDatePK, summarizeReports, getDayOfWeek, isSunday } from './calculations';

export function exportDailyReportsToExcel(reports: DailyReport[], filename: string = 'Pakistan_Post_Daily_Reports') {
  const totals = summarizeReports(reports);
  const grandDeliveryRate =
    totals.totalReceived > 0
      ? `${((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)}%`
      : '0.0%';

  const data = reports.map((r, index) => {
    const rowDeliveryRate =
      r.receivedToday > 0
        ? `${((r.delivered / r.receivedToday) * 100).toFixed(1)}%`
        : '0.0%';

    const isSun = isSunday(r.date);
    const dayName = getDayOfWeek(r.date);
    const displayRemarks = isSun
      ? 'Sunday Holiday (Weekly Closed)'
      : (r.remarks || (r.submittedBy === 'NOT_SUBMITTED' ? 'Report not submitted till 5 PM' : 'N/A'));

    return {
      'S.No': index + 1,
      'Date': formatDatePK(r.date),
      'Day': dayName,
      'Office Name': r.officeName,
      'Last Balance': r.lastBalance,
      'Articles Received': r.receivedToday,
      'Delivered': r.delivered,
      'Delivery %': rowDeliveryRate,
      'Returned to Sender': r.returnedToSender,
      'Missent': r.missent,
      'Deposit': r.deposit,
      'Closing Balance': r.closingBalance,
      'Remarks': displayRemarks,
      'Submitted At': r.submittedAt || '-',
    };
  });

  // Add Grand Totals Row
  data.push({
    'S.No': 0,
    'Date': 'GRAND TOTAL',
    'Day': '-',
    'Office Name': `Total Records: ${reports.length}`,
    'Last Balance': totals.totalLastBalance,
    'Articles Received': totals.totalReceived,
    'Delivered': totals.totalDelivered,
    'Delivery %': grandDeliveryRate,
    'Returned to Sender': totals.totalReturned,
    'Missent': totals.totalMissent,
    'Deposit': totals.totalDeposit,
    'Closing Balance': totals.totalClosingBalance,
    'Remarks': 'SYSTEM CONSOLIDATED SUMMARY',
    'Submitted At': new Date().toLocaleString(),
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Reports');

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Exports all dates historical reports to an Excel workbook with complete metadata and date sorting.
 */
export function exportAllDatesReportsToExcel(reports: DailyReport[], filename: string = 'Pakistan_Post_All_Dates_Reports') {
  // Sort by date ascending, then office name
  const sortedReports = [...reports].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.officeName.localeCompare(b.officeName);
  });

  const totals = summarizeReports(sortedReports);
  const grandDeliveryRate =
    totals.totalReceived > 0
      ? `${((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)}%`
      : '0.0%';

  const uniqueDates = Array.from(new Set(sortedReports.map((r) => r.date))).filter(Boolean);

  const data = sortedReports.map((r, index) => {
    const rowDeliveryRate =
      r.receivedToday > 0
        ? `${((r.delivered / r.receivedToday) * 100).toFixed(1)}%`
        : '0.0%';

    const isSun = isSunday(r.date);
    const dayName = getDayOfWeek(r.date);
    const displayRemarks = isSun
      ? 'Sunday Holiday (Weekly Closed)'
      : (r.remarks || (r.submittedBy === 'NOT_SUBMITTED' ? 'Report not submitted till 5 PM' : '-'));

    return {
      'S.No': index + 1,
      'Date': formatDatePK(r.date),
      'Day': dayName,
      'Office Name': r.officeName,
      'Postmaster / Incharge': r.postmasterName || 'Postmaster',
      'Last Balance': r.lastBalance,
      'Articles Received': r.receivedToday,
      'Delivered': r.delivered,
      'Delivery %': rowDeliveryRate,
      'Returned to Sender': r.returnedToSender,
      'Missent': r.missent,
      'Deposit': r.deposit,
      'Closing Balance': r.closingBalance,
      'Remarks': displayRemarks,
      'Submitted By': r.submittedBy || 'N/A',
      'Submitted At': r.submittedAt || '-',
    };
  });

  // Add Grand Summary Row
  data.push({
    'S.No': 0,
    'Date': `TOTAL DATES: ${uniqueDates.length}`,
    'Day': 'ALL DATES',
    'Office Name': `Total Records: ${sortedReports.length}`,
    'Postmaster / Incharge': 'GRAND TOTAL',
    'Last Balance': totals.totalLastBalance,
    'Articles Received': totals.totalReceived,
    'Delivered': totals.totalDelivered,
    'Delivery %': grandDeliveryRate,
    'Returned to Sender': totals.totalReturned,
    'Missent': totals.totalMissent,
    'Deposit': totals.totalDeposit,
    'Closing Balance': totals.totalClosingBalance,
    'Remarks': 'ALL DATES MASTER CONSOLIDATED REPORT',
    'Submitted By': 'SUPERINTENDENT POSTAL SERVICES',
    'Submitted At': new Date().toLocaleString(),
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'All Dates Master Report');

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportPendingOfficesToExcel(
  pendingList: {
    office: PostOffice;
    lastReportDate?: string;
    missingDates?: string[];
  }[],
  selectedDate?: string
) {
  let totalMissingCount = 0;

  const data = pendingList.map((item, idx) => {
    const dates = item.missingDates || (selectedDate ? [selectedDate] : []);
    const count = dates.length > 0 ? dates.length : 1;
    totalMissingCount += count;
    const missingDatesStr = dates.map((d) => formatDatePK(d)).join(', ');

    return {
      'S.No': idx + 1,
      'Office Name': item.office.name,
      'Postmaster / Incharge': item.office.postmasterName || 'N/A',
      'Mobile Number': item.office.mobileNumber || '-',
      'Pending Reports Count': count,
      'Missing Dates (مورخہ جات)': missingDatesStr,
      'Last Submitted Date': item.lastReportDate ? formatDatePK(item.lastReportDate) : 'Never Submitted',
      'Status': 'PENDING / DEFAULTER',
    };
  });

  // Add Summary Total Row
  data.push({
    'S.No': 0,
    'Office Name': `TOTAL PENDING OFFICES: ${pendingList.length}`,
    'Postmaster / Incharge': '',
    'Mobile Number': '',
    'Pending Reports Count': totalMissingCount,
    'Missing Dates (مورخہ جات)': 'COMBINED SUPERVISOR SUMMARY',
    'Last Submitted Date': '',
    'Status': 'ACTION REQUIRED',
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Offices List');

  const fileDate = selectedDate || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `Pakistan_Post_Supervisor_Pending_List_${fileDate}.xlsx`);
}
