import * as XLSX from 'xlsx';
import { DailyReport, PostOffice } from '../types';
import { formatDatePK, summarizeReports } from './calculations';

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

    return {
      'S.No': index + 1,
      'Date': formatDatePK(r.date),
      'Office Name': r.officeName,
      'Last Balance': r.lastBalance,
      'Articles Received': r.receivedToday,
      'Delivered': r.delivered,
      'Delivery %': rowDeliveryRate,
      'Returned to Sender': r.returnedToSender,
      'Missent': r.missent,
      'Deposit': r.deposit,
      'Remarks': r.remarks || 'N/A',
      'Submitted At': r.submittedAt,
    };
  });

  // Add Grand Totals Row
  data.push({
    'S.No': 0,
    'Date': 'GRAND TOTAL',
    'Office Name': `Total Offices: ${reports.length}`,
    'Last Balance': totals.totalLastBalance,
    'Articles Received': totals.totalReceived,
    'Delivered': totals.totalDelivered,
    'Delivery %': grandDeliveryRate,
    'Returned to Sender': totals.totalReturned,
    'Missent': totals.totalMissent,
    'Deposit': totals.totalDeposit,
    'Remarks': 'SYSTEM SUMMARY',
    'Submitted At': new Date().toISOString(),
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Reports');

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
