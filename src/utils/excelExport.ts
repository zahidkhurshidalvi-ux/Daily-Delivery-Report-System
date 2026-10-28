import { DailyReport, PostOffice } from '../types';
import {
  formatDatePK,
  summarizeReports,
  getDayOfWeek,
  isSunday,
  isHoliday,
  getHolidayReason,
  FINAL_ARTICLE_CATEGORIES,
  DailyPostmanArticleReportData,
  buildDailyPostmanArticleReport,
} from './calculations';

async function getXLSX() {
  const mod = await import('xlsx');
  return mod.default || mod;
}

/**
 * Exports the 31-column Office-Wise & Postman-Wise Daily Article Report to Excel.
 * Strictly adheres to the 31 required columns and excludes EMTTS and Remarks.
 */
export async function exportDailyPostmanArticleReportToExcel(
  reportData: DailyPostmanArticleReportData,
  filename?: string
) {
  const XLSX = await getXLSX();
  const rows: Record<string, any>[] = [];

  for (const row of reportData.allRows) {
    const isSub = row.hasSubmission;
    const recPctStr = row.deliveryPercentage !== null ? `${row.deliveryPercentage.toFixed(1)}%` : '';

    const rowObj: Record<string, any> = {
      'Sr. No.': row.srNo,
      'Office Name': row.officeName,
      'Last Balance': isSub && row.lastBalance !== null ? row.lastBalance : '',
    };

    // 10 Received categories
    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      const val = isSub ? row.received[cat.key] : null;
      rowObj[`Received - ${cat.label}`] = val !== null && val !== undefined ? val : '';
    });
    rowObj['Received Total'] = isSub && row.receivedTotal !== null ? row.receivedTotal : '';

    // 10 Delivered categories
    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      const val = isSub ? row.delivered[cat.key] : null;
      rowObj[`Delivered - ${cat.label}`] = val !== null && val !== undefined ? val : '';
    });
    rowObj['Delivered Total'] = isSub && row.deliveredTotal !== null ? row.deliveredTotal : '';

    rowObj['Returned to Sender'] = isSub && row.returnedToSender !== null ? row.returnedToSender : '';
    rowObj['Missent'] = isSub && row.missent !== null ? row.missent : '';
    rowObj['Deposit / Not Delivered'] = isSub && row.deposit !== null ? row.deposit : '';
    rowObj['Delivery Percentage'] = isSub ? recPctStr : '';
    rowObj['Report Status'] = reportData.isDateRange && row.submissionCount !== undefined
      ? `${row.submissionCount}/${reportData.totalDaysInRange || 1} Days (${row.status})`
      : row.status;

    rows.push(rowObj);
  }

  // Grand Total Row (Summing all offices)
  const grandPctStr =
    reportData.grandTotals.deliveryPercentage !== null
      ? `${reportData.grandTotals.deliveryPercentage.toFixed(1)}%`
      : '0.0%';

  const grandTotalObj: Record<string, any> = {
    'Sr. No.': '★',
    'Office Name': `GRAND TOTAL (${reportData.grandTotals.totalOffices} OFFICES)`,
    'Last Balance': reportData.grandTotals.lastBalance,
  };

  FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
    grandTotalObj[`Received - ${cat.label}`] = reportData.grandTotals.receivedByCategory[cat.key] || 0;
  });
  grandTotalObj['Received Total'] = reportData.grandTotals.receivedTotal;

  FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
    grandTotalObj[`Delivered - ${cat.label}`] = reportData.grandTotals.deliveredByCategory[cat.key] || 0;
  });
  grandTotalObj['Delivered Total'] = reportData.grandTotals.deliveredTotal;

  grandTotalObj['Returned to Sender'] = reportData.grandTotals.returnedToSender;
  grandTotalObj['Missent'] = reportData.grandTotals.missent;
  grandTotalObj['Deposit / Not Delivered'] = reportData.grandTotals.deposit;
  grandTotalObj['Delivery Percentage'] = grandPctStr;
  grandTotalObj['Report Status'] = 'CONSOLIDATED';

  rows.push(grandTotalObj);

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Office Article Report');

  const outName = filename || `Daily_Office_Article_Report_${reportData.reportDate}`;
  XLSX.writeFile(workbook, `${outName}.xlsx`);
}

/**
 * Standard daily report export with postman-level support and backward compatibility.
 */
export async function exportDailyReportsToExcel(
  reports: DailyReport[],
  filename: string = 'Pakistan_Post_Daily_Reports',
  postOffices?: PostOffice[],
  targetDate?: string
) {
  if (postOffices && postOffices.length > 0 && targetDate) {
    const reportData = buildDailyPostmanArticleReport(reports, postOffices, targetDate);
    return exportDailyPostmanArticleReportToExcel(reportData, filename);
  }

  const XLSX = await getXLSX();
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
      'Sr. No.': index + 1,
      'Date': formatDatePK(r.date),
      'Office Name': r.officeName,
      'Postman Name': r.postmanName || 'General',
      'Last Balance': r.lastBalance,
      'Received Total': r.receivedToday,
      'Delivered Total': r.delivered,
      'Delivery Percentage': rowDeliveryRate,
      'Returned to Sender': r.returnedToSender,
      'Missent': r.missent,
      'Deposit / Not Delivered': r.deposit,
      'Report Status': r.submittedBy === 'NOT_SUBMITTED' ? 'Report Not Submitted' : 'Submitted',
    };
  });

  // Add Grand Totals Row
  data.push({
    'Sr. No.': 0,
    'Date': 'GRAND TOTAL',
    'Office Name': `Total Records: ${reports.length}`,
    'Postman Name': '-',
    'Last Balance': totals.totalLastBalance,
    'Received Total': totals.totalReceived,
    'Delivered Total': totals.totalDelivered,
    'Delivery Percentage': grandDeliveryRate,
    'Returned to Sender': totals.totalReturned,
    'Missent': totals.totalMissent,
    'Deposit / Not Delivered': totals.totalDeposit,
    'Report Status': 'CONSOLIDATED',
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Reports');

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Exports all dates historical reports to an Excel workbook with complete metadata and date sorting.
 */
export async function exportAllDatesReportsToExcel(reports: DailyReport[], filename: string = 'Pakistan_Post_All_Dates_Reports') {
  const XLSX = await getXLSX();
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
    const isHol = isHoliday(r.date);
    const holReason = getHolidayReason(r.date);
    const dayName = getDayOfWeek(r.date);
    const displayRemarks = isHol
      ? `${holReason || 'Public Holiday'} (Official Closed)`
      : isSun
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

export async function exportPendingOfficesToExcel(
  pendingList: {
    office: PostOffice;
    lastReportDate?: string;
    missingDates?: string[];
  }[],
  selectedDate?: string
) {
  const XLSX = await getXLSX();
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
