import { DailyReport, PostOffice } from '../types';

/**
 * Calculates Today's Closing Balance using the official formula:
 * Closing Balance = Last Balance + Received - Delivered - Returned to Sender - Missent - Deposit
 */
export function calculateClosingBalance(
  lastBalance: number,
  receivedToday: number,
  delivered: number,
  returnedToSender: number,
  missent: number,
  deposit: number
): number {
  const lb = Number(lastBalance) || 0;
  const rec = Number(receivedToday) || 0;
  const del = Number(delivered) || 0;
  const ret = Number(returnedToSender) || 0;
  const mis = Number(missent) || 0;
  const dep = Number(deposit) || 0;

  return lb + rec - del - ret - mis - dep;
}

/**
 * Validates a daily report entry.
 * Returns an error message string if invalid, or null if valid.
 */
export function validateReportFields(fields: {
  date: string;
  officeCode: string;
  lastBalance: number;
  receivedToday: number;
  delivered: number;
  returnedToSender: number;
  missent: number;
  deposit: number;
}): string | null {
  if (!fields.date || fields.date.trim() === '') {
    return 'Date is required.';
  }
  if (!fields.officeCode || fields.officeCode.trim() === '') {
    return 'Office selection is required.';
  }

  // Check for negative numbers
  const values = [
    { name: 'Last Balance', val: fields.lastBalance },
    { name: 'Articles Received', val: fields.receivedToday },
    { name: 'Delivered', val: fields.delivered },
    { name: 'Returned to Sender', val: fields.returnedToSender },
    { name: 'Missent', val: fields.missent },
    { name: 'Deposit', val: fields.deposit },
  ];

  for (const v of values) {
    if (isNaN(v.val) || v.val < 0) {
      return `${v.name} cannot be a negative value.`;
    }
  }

  // Check if items processed exceeds available (Last Balance + Received)
  const available = Number(fields.lastBalance) + Number(fields.receivedToday);
  const totalOut = Number(fields.delivered) + Number(fields.returnedToSender) + Number(fields.missent) + Number(fields.deposit);

  if (totalOut > available) {
    return `Total processed articles (${totalOut}) exceeds available articles (${available} = Last Balance ${fields.lastBalance} + Received ${fields.receivedToday}).`;
  }

  return null;
}

/**
 * Formats a number with commas for display
 */
export function formatNumber(val: number): string {
  if (isNaN(val)) return '0';
  return val.toLocaleString('en-PK');
}

/**
 * Formats date to localized Pakistani format: DD/MM/YYYY
 */
export function formatDatePK(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Returns today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Summarize totals for a list of reports
 */
export function summarizeReports(reports: DailyReport[]) {
  return reports.reduce(
    (acc, curr) => {
      acc.totalLastBalance += curr.lastBalance;
      acc.totalReceived += curr.receivedToday;
      acc.totalDelivered += curr.delivered;
      acc.totalReturned += curr.returnedToSender;
      acc.totalMissent += curr.missent;
      acc.totalDeposit += curr.deposit;
      acc.totalClosingBalance += curr.closingBalance;
      return acc;
    },
    {
      totalLastBalance: 0,
      totalReceived: 0,
      totalDelivered: 0,
      totalReturned: 0,
      totalMissent: 0,
      totalDeposit: 0,
      totalClosingBalance: 0,
    }
  );
}

/**
 * Returns a list of daily reports for a target date, automatically including
 * entries for active post offices that have not submitted a report till 5 PM
 * with remarks 'Report not submitted till 5 PM'.
 */
export function getCompleteDateReports(
  reports: DailyReport[],
  postOffices: PostOffice[],
  targetDate: string
): DailyReport[] {
  if (!targetDate) return reports;

  const dateReports = reports.filter((r) => r.date === targetDate);
  const submittedOfficeNames = new Set(dateReports.map((r) => r.officeName));
  const activeOffices = postOffices.filter((po) => po.status === 'ACTIVE');

  const missingReports: DailyReport[] = activeOffices
    .filter((po) => !submittedOfficeNames.has(po.name))
    .map((office) => {
      // Find previous submitted report for this office to carry forward last balance if available
      const pastReports = reports
        .filter((r) => r.officeName === office.name && r.date < targetDate)
        .sort((a, b) => (a.date > b.date ? -1 : 1));

      let carriedBal = office.initialBalance || 0;
      if (pastReports.length > 0) {
        const prev = pastReports[0];
        carriedBal =
          prev.deposit > 0
            ? prev.deposit
            : Math.max(0, prev.lastBalance + prev.receivedToday - prev.delivered - prev.returnedToSender - prev.missent);
      }

      return {
        id: `missing_${office.id}_${targetDate}`,
        date: targetDate,
        officeName: office.name,
        postmasterName: office.postmasterName || '',
        lastBalance: carriedBal,
        receivedToday: 0,
        delivered: 0,
        returnedToSender: 0,
        missent: 0,
        deposit: carriedBal,
        closingBalance: 0,
        remarks: 'Report not submitted till 5 PM',
        submittedBy: 'NOT_SUBMITTED',
        submittedAt: 'Pending (5 PM)',
      };
    });

  return [...dateReports, ...missingReports].sort((a, b) =>
    a.officeName.localeCompare(b.officeName)
  );
}

/**
 * Returns all missing report dates for a specific office up to targetDate.
 */
export function getMissingDatesForOffice(
  officeName: string,
  targetDate: string,
  reports: DailyReport[]
): string[] {
  if (!targetDate) return [];

  // Get all unique dates present in reports up to targetDate, including targetDate
  const allDates = Array.from(
    new Set([...reports.map((r) => r.date), targetDate])
  )
    .filter((d) => d <= targetDate)
    .sort();

  const submittedDates = new Set(
    reports.filter((r) => r.officeName === officeName).map((r) => r.date)
  );

  return allDates.filter((d) => !submittedDates.has(d));
}

