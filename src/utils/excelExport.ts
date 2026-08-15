import * as XLSX from 'xlsx';
import { DailyReport, PostOffice } from '../types';
import { formatDatePK, summarizeReports } from './calculations';

export function exportDailyReportsToExcel(reports: DailyReport[], filename: string = 'Pakistan_Post_Daily_Reports') {
  const totals = summarizeReports(reports);

  const data = reports.map((r, index) => ({
    'S.No': index + 1,
    'Date': formatDatePK(r.date),
    'Office Name': r.officeName,
    'Last Balance': r.lastBalance,
    'Articles Received': r.receivedToday,
    'Delivered': r.delivered,
    'Returned to Sender': r.returnedToSender,
    'Missent': r.missent,
    'Deposit': r.deposit,
    'Remarks': r.remarks || 'N/A',
    'Submitted At': r.submittedAt,
  }));

  // Add Grand Totals Row
  data.push({
    'S.No': 0,
    'Date': 'GRAND TOTAL',
    'Office Name': `Total Offices: ${reports.length}`,
    'Last Balance': totals.totalLastBalance,
    'Articles Received': totals.totalReceived,
    'Delivered': totals.totalDelivered,
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

export function exportPendingOfficesToExcel(pendingList: { office: PostOffice; lastReportDate?: string }[]) {
  const data = pendingList.map((item, idx) => ({
    'S.No': idx + 1,
    'Office Name': item.office.name,
    'Postmaster Name': item.office.postmasterName,
    'Mobile Number': item.office.mobileNumber,
    'Status': 'PENDING',
    'Last Submitted Date': item.lastReportDate ? formatDatePK(item.lastReportDate) : 'Never Submitted',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Offices');

  XLSX.writeFile(workbook, `Pakistan_Post_Pending_Offices_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
