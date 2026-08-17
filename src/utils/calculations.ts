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
 * Strictly avoids UTC timezone midnight rollback
 */
export function formatDatePK(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  
  // Handle ISO strings with T or space
  const datePart = clean.split('T')[0].split(' ')[0];

  // Directly split YYYY-MM-DD
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD/MM/YYYY
        const [day, month, year] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
  }

  // Handle slashes
  if (datePart.includes('/')) {
    const parts = datePart.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD -> DD/MM/YYYY
        const [year, month, day] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      } else {
        // Already DD/MM/YYYY or D/M/YYYY
        const [day, month, year] = parts;
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      }
    }
    return clean;
  }

  const d = new Date(clean);
  if (isNaN(d.getTime())) return clean;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Returns today's date in YYYY-MM-DD format using Pakistan Standard Time (PKT, UTC+5)
 * or local timezone, ensuring it matches the exact current operational day.
 */
export function getTodayDateString(timeZone: string = 'Asia/Karachi'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Formats as YYYY-MM-DD in PKT!
  } catch (e) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
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
 * Detects if a string is a table header, column title, or placeholder rather than an actual post office name.
 */
export function isInvalidPostOfficeName(rawName: any): boolean {
  if (!rawName) return true;
  const name = String(rawName).trim();
  if (!name || name.length < 2) return true;

  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const bannedKeywords = [
    'postofficename',
    'postoffice',
    'officename',
    'nameofpostoffice',
    'postmasterinchargename',
    'postmasterincharge',
    'postmaster',
    'inchargename',
    'incharge',
    'mobilenumberwhatsapp',
    'mobilenumber',
    'whatsappnumber',
    'pakistanpost',
    'reportnotsubmitted',
    'notsubmitted',
    'submittill',
    'pendingreports',
    'deliveryreport',
    'receivedtoday',
    'lastbalance',
    'closingbalance',
    'initialbalance',
    'openingbalance',
    'dailydelivery',
    'totalbalance',
    'subtotal',
    'grandtotal',
    'srno',
    'serialnumber',
  ];

  for (const keyword of bannedKeywords) {
    if (n === keyword || n.startsWith(keyword) || n.endsWith(keyword) || (keyword.length >= 7 && n.includes(keyword))) {
      return true;
    }
  }

  // Exact matches
  const exactHeaders = new Set([
    'name',
    'office',
    'status',
    'mobile',
    'phone',
    'whatsapp',
    'balance',
    'date',
    'total',
    'remarks',
    'sr',
    'sno',
    'id',
    'action',
    'actions',
    'active',
    'inactive',
  ]);

  if (exactHeaders.has(n)) {
    return true;
  }

  return false;
}

/**
 * Filters and sanitizes a list of PostOffices, removing any header rows, duplicates, or empty entries.
 */
export function cleanAndFilterPostOffices(offices: PostOffice[]): PostOffice[] {
  if (!Array.isArray(offices)) return [];
  const seen = new Set<string>();
  const cleaned: PostOffice[] = [];

  for (const po of offices) {
    if (!po || !po.name) continue;
    const trimmedName = String(po.name).trim();
    if (isInvalidPostOfficeName(trimmedName)) continue;

    // Check if postmasterName or mobileNumber is a header
    let pm = String(po.postmasterName || '').trim();
    if (
      !pm ||
      pm.toLowerCase().includes('postmaster / incharge') ||
      pm.toLowerCase().includes('incharge name') ||
      pm.toLowerCase().includes('postmaster name') ||
      isInvalidPostOfficeName(pm)
    ) {
      pm = 'Postmaster';
    }

    let mob = String(po.mobileNumber || '').trim();
    if (
      !mob ||
      mob.toLowerCase().includes('mobile') ||
      mob.toLowerCase().includes('whatsapp') ||
      mob.toLowerCase().includes('phone') ||
      mob.toLowerCase().includes('number')
    ) {
      mob = '03001234567';
    }

    const key = trimmedName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push({
        ...po,
        name: trimmedName,
        postmasterName: pm,
        mobileNumber: mob,
        status: po.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        initialBalance: Number(po.initialBalance) || 0,
      });
    }
  }

  return cleaned.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );
}

/**
 * Filters and sanitizes DailyReports, removing any rows where officeName or date is a header title.
 */
export function cleanAndFilterReports(reports: DailyReport[]): DailyReport[] {
  if (!Array.isArray(reports)) return [];
  const cleaned: DailyReport[] = [];

  for (const r of reports) {
    if (!r || !r.officeName) continue;
    const trimmedName = String(r.officeName).trim();
    if (isInvalidPostOfficeName(trimmedName)) continue;

    const dStr = String(r.date || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (dStr.includes('date') || dStr.includes('reportdate') || dStr.includes('day')) continue;

    let pm = String(r.postmasterName || '').trim();
    if (!pm || pm.toLowerCase().includes('postmaster / incharge') || pm.toLowerCase().includes('incharge name')) {
      pm = 'Postmaster';
    }

    cleaned.push({
      ...r,
      officeName: trimmedName,
      postmasterName: pm,
    });
  }

  return cleaned;
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

  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  const dateReports = validReports.filter((r) => r.date === targetDate);
  const submittedOfficeNames = new Set(dateReports.map((r) => r.officeName));
  const activeOffices = validOffices.filter((po) => po.status === 'ACTIVE');

  const missingReports: DailyReport[] = activeOffices
    .filter((po) => !submittedOfficeNames.has(po.name))
    .map((office) => {
      // Find previous submitted report for this office to carry forward last balance if available
      const pastReports = validReports
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

