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

  // Exact header titles that must be discarded
  const exactHeaders = new Set([
    'postofficename',
    'postoffice',
    'officename',
    'nameofpostoffice',
    'nameofthepostoffice',
    'postoffices',
    'poname',
    'po',
    'postmasterinchargename',
    'postmasterincharge',
    'postmastername',
    'postmaster',
    'inchargename',
    'incharge',
    'mobilenumberwhatsapp',
    'mobilenumber',
    'mobilenowhatsapp',
    'whatsappnumber',
    'mobilenumberphone',
    'mobile',
    'phone',
    'cell',
    'whatsapp',
    'contact',
    'contactnumber',
    'contactno',
    'pakistanpost',
    'pakpost',
    'reportnotsubmittedtill5pm',
    'reportnotsubmitted',
    'notsubmitted',
    'notsubmittedtill5pm',
    'submittill5pm',
    'pendingreports',
    'deliveryreport',
    'deliveryreports',
    'dailydeliveryreport',
    'dailydeliveryreports',
    'receivedtoday',
    'lastbalance',
    'closingbalance',
    'initialbalance',
    'openingbalance',
    'deposit',
    'delivered',
    'totalbalance',
    'subtotal',
    'grandtotal',
    'srno',
    'serialnumber',
    'sr',
    'sno',
    'id',
    'officeid',
    'reportid',
    'status',
    'state',
    'active',
    'inactive',
    'action',
    'actions',
    'remarks',
    'date',
    'reportdate',
    'timestamp',
    'submittedat',
    'submittedby',
    'user',
    'username',
    'password',
  ]);

  if (exactHeaders.has(n)) {
    return true;
  }

  // Check if it's a reminder placeholder line
  if (n.includes('reportnotsubmitted') || n.includes('notsubmittedtill') || n.startsWith('reportnot') || n.includes('till5pm')) {
    return true;
  }

  // Check if it's a table header starting with "sr#" or "srno"
  if (/^(sr|sno|serial|id|no)[\#\.\:\s\-_0-9]*$/.test(name.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Filters and sanitizes a list of PostOffices, removing any header rows, duplicates, or empty entries.
 * Ensures phone numbers are NEVER stored as initial balances.
 */
export function cleanAndFilterPostOffices(offices: PostOffice[]): PostOffice[] {
  if (!Array.isArray(offices)) return [];
  const seen = new Set<string>();
  const cleaned: PostOffice[] = [];

  for (const po of offices) {
    if (!po || !po.name) continue;
    const trimmedName = String(po.name).trim();
    if (isInvalidPostOfficeName(trimmedName)) continue;

    let pm = String(po.postmasterName || '').trim();
    let mob = String(po.mobileNumber || '').trim();
    let initBal = Number(po.initialBalance) || 0;

    // 1. Sanitize Mobile & Initial Balance:
    // If initialBalance contains a mobile phone number (e.g. >= 10000 or 7+ digits)
    if (initBal >= 10000 || String(po.initialBalance || '').length >= 7) {
      const potentialPhone = String(po.initialBalance).trim();
      if (!mob || mob === '03001234567' || mob === '03000000000' || isInvalidPostOfficeName(mob)) {
        mob = potentialPhone.startsWith('0') ? potentialPhone : (potentialPhone.length === 10 ? '0' + potentialPhone : potentialPhone);
      }
      initBal = 0; // Reset initial balance back to 0 articles
    }

    // 2. Check if postmasterName is actually a phone number (e.g. 03001234567)
    if (/^(\+92|92|0)?3[0-9]{9}$/.test(pm.replace(/[\s\-]/g, ''))) {
      if (!mob || mob === '03001234567' || mob === '03000000000') {
        mob = pm;
      }
      pm = 'Postmaster';
    }

    // 3. Check if PM is a header string
    if (
      !pm ||
      pm.toLowerCase().includes('postmaster / incharge') ||
      pm.toLowerCase().includes('incharge name') ||
      pm.toLowerCase().includes('postmaster name') ||
      isInvalidPostOfficeName(pm)
    ) {
      pm = 'Postmaster';
    }

    // 4. Check if Mobile is a header string
    if (
      !mob ||
      mob.toLowerCase().includes('mobile') ||
      mob.toLowerCase().includes('whatsapp') ||
      mob.toLowerCase().includes('phone') ||
      mob.toLowerCase().includes('number') ||
      isInvalidPostOfficeName(mob)
    ) {
      mob = '03001234567';
    }

    const key = trimmedName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push({
        ...po,
        id: po.id || `po-${Date.now()}-${cleaned.length + 1}`,
        name: trimmedName,
        postmasterName: pm,
        mobileNumber: mob,
        status: po.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        initialBalance: initBal >= 0 && initBal < 10000 ? initBal : 0,
      });
    }
  }

  return cleaned.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );
}

/**
 * Filters and sanitizes DailyReports, removing any rows where officeName or date is a header title.
 * Also ensures numeric fields never hold phone numbers.
 */
export function cleanAndFilterReports(reports: DailyReport[]): DailyReport[] {
  if (!Array.isArray(reports)) return [];
  const cleaned: DailyReport[] = [];

  const sanitizeArticleCount = (val: any): number => {
    const num = Number(val) || 0;
    return num >= 0 && num < 50000 ? num : 0;
  };

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

    const lastBal = sanitizeArticleCount(r.lastBalance);
    const rec = sanitizeArticleCount(r.receivedToday);
    const del = sanitizeArticleCount(r.delivered);
    const ret = sanitizeArticleCount(r.returnedToSender);
    const miss = sanitizeArticleCount(r.missent);
    const dep = sanitizeArticleCount(r.deposit);
    const close = sanitizeArticleCount(r.closingBalance) || Math.max(0, lastBal + rec - del - ret - miss - dep);

    cleaned.push({
      ...r,
      officeName: trimmedName,
      postmasterName: pm,
      lastBalance: lastBal,
      receivedToday: rec,
      delivered: del,
      returnedToSender: ret,
      missent: miss,
      deposit: dep,
      closingBalance: close,
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
 * Checks if a given date string (YYYY-MM-DD) is Sunday.
 */
export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.getDay() === 0;
  }
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d.getDay() === 0;
}

/**
 * Returns all missing report dates for a specific office up to targetDate,
 * strictly EXCLUDING Sundays (Sunday Holiday / Weekly Closed).
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
    .filter((d) => d <= targetDate && !isSunday(d)) // Strictly exclude Sundays
    .sort();

  const submittedDates = new Set(
    reports.filter((r) => r.officeName === officeName).map((r) => r.date)
  );

  return allDates.filter((d) => !submittedDates.has(d));
}

