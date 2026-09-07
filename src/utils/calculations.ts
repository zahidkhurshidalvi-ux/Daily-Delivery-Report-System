import { DailyReport, PostOffice, OfficialHoliday } from '../types';

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
 * Strictly enforces unique IDs and unique office names across the entire directory.
 */
export function cleanAndFilterPostOffices(offices: PostOffice[]): PostOffice[] {
  if (!Array.isArray(offices)) return [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const cleaned: PostOffice[] = [];

  for (const po of offices) {
    if (!po || !po.name) continue;
    const trimmedName = String(po.name).replace(/\s+/g, ' ').trim();
    if (isInvalidPostOfficeName(trimmedName)) continue;

    let pm = String(po.postmasterName || '').trim();
    let mob = String(po.mobileNumber || '').trim();
    let initBal = Number(po.initialBalance) || 0;

    // 1. Sanitize Mobile & Initial Balance:
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

    // Deduplicate by normalized office name (ignoring dots, spaces, case)
    const nameKey = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameKey) continue;

    if (seenNames.has(nameKey)) {
      // If already added, update existing office if incoming has better details
      const existing = cleaned.find(
        (o) => o.name.toLowerCase().replace(/[^a-z0-9]/g, '') === nameKey
      );
      if (existing) {
        if ((!existing.mobileNumber || existing.mobileNumber === '03001234567') && mob && mob !== '03001234567') {
          existing.mobileNumber = mob;
        }
        if ((!existing.postmasterName || existing.postmasterName === 'Postmaster') && pm && pm !== 'Postmaster') {
          existing.postmasterName = pm;
        }
        if (existing.initialBalance === 0 && initBal > 0) {
          existing.initialBalance = initBal;
        }
      }
      continue;
    }

    seenNames.add(nameKey);

    // Strictly guarantee unique ID
    let finalId = po.id ? String(po.id).trim() : '';
    if (!finalId || seenIds.has(finalId)) {
      const candidateId = `po-${nameKey}`;
      if (!seenIds.has(candidateId)) {
        finalId = candidateId;
      } else {
        finalId = `po-${nameKey}-${cleaned.length + 1}`;
      }
    }
    seenIds.add(finalId);

    cleaned.push({
      ...po,
      id: finalId,
      name: trimmedName,
      postmasterName: pm,
      mobileNumber: mob,
      status: po.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      initialBalance: initBal >= 0 && initBal < 10000 ? initBal : 0,
    });
  }

  return cleaned.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  );
}

export const SYSTEM_LAUNCH_DATE = '2026-08-17'; // Official system launch date (17-08-2026)

/**
 * Official declared public holidays.
 * Excluded from missing reports, pendency, explanation notices, and delinquent calculations.
 * Key: YYYY-MM-DD, Value: Holiday title/description
 */
export const DEFAULT_OFFICIAL_HOLIDAYS: Record<string, string> = {
  '2026-08-26': 'Official Public Holiday (26/08/2026)',
};

// Global in-memory cache synchronized with Cloud Firestore in real time
let inMemoryHolidays: Record<string, OfficialHoliday> | null = null;

/**
 * Normalizes various date formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) into standard ISO YYYY-MM-DD.
 */
export function normalizeDateToIso(dateStr: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim().split('T')[0].split(' ')[0];
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }
  return clean;
}

/**
 * Updates the global in-memory holidays cache (called on Firestore real-time snapshot).
 */
export function setInMemoryHolidays(holidays: Record<string, any> | null): void {
  if (!holidays) return;
  const map: Record<string, OfficialHoliday> = {};
  for (const [key, val] of Object.entries(holidays)) {
    const iso = normalizeDateToIso(key);
    if (!iso) continue;
    if (typeof val === 'string') {
      map[iso] = {
        date: iso,
        title: val,
        declaredBy: 'Divisional Administration',
        declaredAt: new Date().toISOString(),
      };
    } else if (val && typeof val === 'object') {
      map[iso] = {
        date: iso,
        title: val.title || 'Official Public Holiday',
        declaredBy: val.declaredBy || 'Divisional Administration',
        declaredAt: val.declaredAt || new Date().toISOString(),
        notes: val.notes || '',
      };
    }
  }
  // Guarantee 2026-08-26 is always preserved
  if (!map['2026-08-26']) {
    map['2026-08-26'] = {
      date: '2026-08-26',
      title: 'Official Public Holiday (26/08/2026)',
      declaredBy: 'Government Gazette Notification',
      declaredAt: '2026-08-25T18:00:00.000Z',
      notes: 'Gazetted Public Holiday - Excluded from all pendency',
    };
  }
  inMemoryHolidays = map;
}

/**
 * Retrieves configured public holidays (default + memory + custom stored in localStorage).
 */
export function getCustomHolidays(): Record<string, string> {
  const result: Record<string, string> = { ...DEFAULT_OFFICIAL_HOLIDAYS };

  // 1. Read from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem('pakpost_holidays');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          for (const [k, v] of Object.entries(parsed)) {
            const iso = normalizeDateToIso(k);
            if (iso) {
              result[iso] = typeof v === 'string' ? v : (v as any)?.title || 'Official Public Holiday';
            }
          }
        }
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // 2. Read from in-memory cache (real-time from Cloud Firestore)
  if (inMemoryHolidays) {
    for (const [k, v] of Object.entries(inMemoryHolidays)) {
      const iso = normalizeDateToIso(k);
      if (iso) {
        result[iso] = v.title || 'Official Public Holiday';
      }
    }
  }

  // Double guarantee: 2026-08-26 is ALWAYS a public holiday
  result['2026-08-26'] = result['2026-08-26'] || 'Official Public Holiday (26/08/2026)';
  return result;
}

/**
 * Retrieves list of all declared holidays as structured OfficialHoliday objects.
 */
export function getAllOfficialHolidays(): OfficialHoliday[] {
  const map = getCustomHolidays();
  const list: OfficialHoliday[] = [];

  for (const [date, title] of Object.entries(map)) {
    const mem = inMemoryHolidays ? inMemoryHolidays[date] : null;
    list.push({
      date,
      title,
      declaredBy: mem?.declaredBy || (date === '2026-08-26' ? 'Government Gazette Notification' : 'Divisional Administration'),
      declaredAt: mem?.declaredAt || '2026-08-25T18:00:00.000Z',
      notes: mem?.notes || (date === '2026-08-26' ? 'Gazetted Public Holiday - Excluded from all pendency' : 'Official Closed'),
    });
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Checks if a date is a declared public holiday (e.g. 2026-08-26).
 */
export function isHoliday(dateStr: string): boolean {
  if (!dateStr) return false;
  const iso = normalizeDateToIso(dateStr);
  if (iso === '2026-08-26') return true; // Hardcoded guarantee
  const holidays = getCustomHolidays();
  return Boolean(holidays[iso]);
}

/**
 * Returns holiday reason/description or null if not a holiday.
 */
export function getHolidayReason(dateStr: string): string | null {
  if (!dateStr) return null;
  const iso = normalizeDateToIso(dateStr);
  if (iso === '2026-08-26') {
    return 'Official Public Holiday (26/08/2026)';
  }
  const holidays = getCustomHolidays();
  return holidays[iso] || null;
}

/**
 * Checks if a date is either a Sunday or an official declared public holiday.
 */
export function isClosedOrHoliday(dateStr: string): boolean {
  return isSunday(dateStr) || isHoliday(dateStr);
}

/**
 * Adds or updates a holiday in custom holidays storage.
 */
export function saveCustomHoliday(
  dateStr: string,
  reason: string,
  declaredBy: string = 'Admin',
  notes: string = ''
): OfficialHoliday | null {
  const iso = normalizeDateToIso(dateStr);
  if (!iso) return null;

  const newHoliday: OfficialHoliday = {
    date: iso,
    title: reason || 'Official Public Holiday',
    declaredBy,
    declaredAt: new Date().toISOString(),
    notes,
  };

  try {
    const current = getCustomHolidays();
    current[iso] = newHoliday.title;
    localStorage.setItem('pakpost_holidays', JSON.stringify(current));
  } catch (e) {
    // ignore
  }

  if (!inMemoryHolidays) inMemoryHolidays = {};
  inMemoryHolidays[iso] = newHoliday;

  return newHoliday;
}

/**
 * Deletes a declared holiday from storage.
 */
export function deleteCustomHoliday(dateStr: string): void {
  const iso = normalizeDateToIso(dateStr);
  if (!iso) return;

  try {
    const current = getCustomHolidays();
    delete current[iso];
    localStorage.setItem('pakpost_holidays', JSON.stringify(current));
  } catch (e) {
    // ignore
  }

  if (inMemoryHolidays) {
    delete inMemoryHolidays[iso];
  }
}

/**
 * Filters and sanitizes DailyReports, removing any rows where officeName or date is a header title.
 * Also ensures numeric fields never hold phone numbers.
 * Excludes legacy/test records prior to official launch date 17-08-2026 (specifically 29/07/2026).
 * Enforces deduplication by office + date and ensures unique IDs across all report items.
 */
export function cleanAndFilterReports(reports: DailyReport[]): DailyReport[] {
  if (!Array.isArray(reports)) return [];
  const officeDateMap = new Map<string, DailyReport>();

  const sanitizeArticleCount = (val: any): number => {
    const num = Number(val) || 0;
    return num >= 0 && num < 50000 ? num : 0;
  };

  for (const r of reports) {
    if (!r || !r.officeName || !r.date) continue;
    const trimmedName = String(r.officeName).replace(/\s+/g, ' ').trim();
    if (isInvalidPostOfficeName(trimmedName)) continue;

    const normalizedDate = normalizeDateToIso(r.date) || r.date;

    // Filter out 29/07/2026 and any dates before the official system launch date (17-08-2026)
    if (normalizedDate === '2026-07-29' || (normalizedDate && normalizedDate < SYSTEM_LAUNCH_DATE)) {
      continue;
    }

    const dStr = String(normalizedDate || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

    const key = `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${normalizedDate}`;
    let sanitizedReport: DailyReport = {
      ...r,
      date: normalizedDate,
      officeName: trimmedName,
      postmasterName: pm,
      lastBalance: lastBal,
      receivedToday: rec,
      delivered: del,
      returnedToSender: ret,
      missent: miss,
      deposit: dep,
      closingBalance: close,
    };

    // If date is a declared public holiday, and report was marked NOT_SUBMITTED,
    // convert it to PUBLIC_HOLIDAY closed record so it never surfaces as pending!
    if (isHoliday(normalizedDate)) {
      if (sanitizedReport.submittedBy === 'NOT_SUBMITTED' || sanitizedReport.remarks?.includes('Report not submitted')) {
        sanitizedReport.submittedBy = 'PUBLIC_HOLIDAY';
        sanitizedReport.remarks = `${getHolidayReason(normalizedDate) || 'Public Holiday'} (Official Closed)`;
        sanitizedReport.closingBalance = sanitizedReport.lastBalance;
        sanitizedReport.deposit = sanitizedReport.lastBalance;
      }
    }

    const existing = officeDateMap.get(key);
    if (!existing) {
      officeDateMap.set(key, sanitizedReport);
    } else {
      // If one report is NOT_SUBMITTED but incoming has real values/submission, prefer the submitted one
      const existingIsMissing = existing.submittedBy === 'NOT_SUBMITTED' || existing.remarks?.includes('Report not submitted');
      const incomingIsMissing = sanitizedReport.submittedBy === 'NOT_SUBMITTED' || sanitizedReport.remarks?.includes('Report not submitted');
      if (existingIsMissing && !incomingIsMissing) {
        officeDateMap.set(key, sanitizedReport);
      } else if (!existingIsMissing && !incomingIsMissing) {
        // Both are submitted, keep the newer submittedAt
        const extTime = new Date(existing.submittedAt || 0).getTime();
        const inTime = new Date(sanitizedReport.submittedAt || 0).getTime();
        if (inTime >= extTime) {
          officeDateMap.set(key, sanitizedReport);
        }
      }
    }
  }

  // Ensure unique IDs across all returned reports
  const seenReportIds = new Set<string>();
  const cleaned: DailyReport[] = [];

  for (const rep of officeDateMap.values()) {
    let finalId = rep.id ? String(rep.id).trim() : '';
    if (!finalId || seenReportIds.has(finalId)) {
      const officeSlug = rep.officeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      finalId = `rep_${officeSlug}_${rep.date}_${cleaned.length + 1}`;
    }
    seenReportIds.add(finalId);
    cleaned.push({ ...rep, id: finalId });
  }

  return cleaned;
}

/**
 * Returns a list of daily reports for a target date, automatically including
 * entries for active post offices that have not submitted a report till 5 PM
 * with remarks 'Report not submitted till 5 PM' (or 'Sunday Holiday' on Sundays).
 * Strictly guarantees unique keys and deduplicated entries for each post office.
 */
export function getCompleteDateReports(
  reports: DailyReport[],
  postOffices: PostOffice[],
  targetDate: string
): DailyReport[] {
  if (!targetDate) return reports;

  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  // If target date is prior to official system launch date (17-08-2026), e.g. 29/07/2026,
  // do not generate artificial missing records
  if (targetDate < SYSTEM_LAUNCH_DATE || targetDate === '2026-07-29') {
    return validReports.filter((r) => r.date === targetDate);
  }

  const isSundayDate = isSunday(targetDate);
  const isHolidayDate = isHoliday(targetDate);
  const holidayReason = getHolidayReason(targetDate);
  const dateReports = validReports.filter((r) => r.date === targetDate);
  const submittedOfficeKeys = new Set(
    dateReports.map((r) => r.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
  );
  const activeOffices = validOffices.filter((po) => po.status === 'ACTIVE');

  // Ensure unique active offices by name
  const seenActiveNames = new Set<string>();
  const uniqueActiveOffices = activeOffices.filter((po) => {
    const key = po.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (seenActiveNames.has(key)) return false;
    seenActiveNames.add(key);
    return true;
  });

  const missingReports: DailyReport[] = uniqueActiveOffices
    .filter((po) => !submittedOfficeKeys.has(po.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')))
    .map((office) => {
      // Find previous submitted report for this office to carry forward last balance if available
      const pastReports = validReports
        .filter(
          (r) =>
            r.officeName.toLowerCase().replace(/[^a-z0-9]/g, '') ===
              office.name.toLowerCase().replace(/[^a-z0-9]/g, '') &&
            r.date < targetDate
        )
        .sort((a, b) => (a.date > b.date ? -1 : 1));

      let carriedBal = office.initialBalance || 0;
      if (pastReports.length > 0) {
        const prev = pastReports[0];
        carriedBal =
          prev.deposit > 0
            ? prev.deposit
            : Math.max(0, prev.lastBalance + prev.receivedToday - prev.delivered - prev.returnedToSender - prev.missent);
      }

      const officeKey = office.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      const safeOfficeId = office.id ? office.id.replace(/[^a-zA-Z0-9_.-]/g, '_') : officeKey;

      if (isSundayDate) {
        return {
          id: `sunday_${safeOfficeId}_${targetDate}`,
          date: targetDate,
          officeName: office.name,
          postmasterName: office.postmasterName || '',
          lastBalance: carriedBal,
          receivedToday: 0,
          delivered: 0,
          returnedToSender: 0,
          missent: 0,
          deposit: carriedBal,
          closingBalance: carriedBal,
          remarks: 'Sunday Holiday (Weekly Closed)',
          submittedBy: 'SUNDAY_HOLIDAY',
          submittedAt: 'Sunday Holiday',
        };
      }

      if (isHolidayDate) {
        return {
          id: `holiday_${safeOfficeId}_${targetDate}`,
          date: targetDate,
          officeName: office.name,
          postmasterName: office.postmasterName || '',
          lastBalance: carriedBal,
          receivedToday: 0,
          delivered: 0,
          returnedToSender: 0,
          missent: 0,
          deposit: carriedBal,
          closingBalance: carriedBal,
          remarks: holidayReason ? `${holidayReason} (Closed)` : 'Official Public Holiday (Closed)',
          submittedBy: 'PUBLIC_HOLIDAY',
          submittedAt: holidayReason || 'Public Holiday',
        };
      }

      return {
        id: `missing_${safeOfficeId}_${targetDate}`,
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

  // Deduplicate combined reports by normalized office name:
  // Actual submitted reports always override any missing/placeholder records
  const officeReportMap = new Map<string, DailyReport>();
  for (const rep of [...dateReports, ...missingReports]) {
    const normOffice = rep.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const existing = officeReportMap.get(normOffice);
    if (!existing) {
      officeReportMap.set(normOffice, rep);
    } else {
      const existingIsMissing = existing.submittedBy === 'NOT_SUBMITTED' || existing.remarks?.includes('Report not submitted');
      const repIsMissing = rep.submittedBy === 'NOT_SUBMITTED' || rep.remarks?.includes('Report not submitted');
      if (existingIsMissing && !repIsMissing) {
        officeReportMap.set(normOffice, rep);
      }
    }
  }

  // If this targetDate is a declared holiday, ensure NO report remains as NOT_SUBMITTED
  if (isHolidayDate) {
    for (const [key, rep] of officeReportMap.entries()) {
      if (rep.submittedBy === 'NOT_SUBMITTED' || rep.remarks?.includes('Report not submitted')) {
        officeReportMap.set(key, {
          ...rep,
          submittedBy: 'PUBLIC_HOLIDAY',
          remarks: holidayReason ? `${holidayReason} (Official Closed)` : 'Official Public Holiday (Closed)',
          closingBalance: rep.lastBalance,
          deposit: rep.lastBalance,
        });
      }
    }
  }

  // Ensure every report has a strictly unique id
  const seenIds = new Set<string>();
  const finalReports: DailyReport[] = [];
  for (const rep of officeReportMap.values()) {
    let safeId = rep.id ? String(rep.id).trim() : '';
    if (!safeId || seenIds.has(safeId)) {
      const officeSlug = rep.officeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      safeId = `${rep.id || 'rep'}_${officeSlug}_${targetDate}_${finalReports.length + 1}`;
    }
    seenIds.add(safeId);
    finalReports.push({ ...rep, id: safeId });
  }

  return finalReports.sort((a, b) =>
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
 * Returns Day of Week string (e.g. 'Monday', 'Sunday') for a date string.
 */
export function getDayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const parts = dateStr.split('T')[0].split(' ')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return days[d.getDay()] || '';
  }
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) ? days[d.getDay()] || '' : '';
}

/**
 * Returns all missing report dates for a specific office up to targetDate,
 * strictly starting from official system launch date (17-08-2026),
 * strictly EXCLUDING dates prior to launch (such as 29/07/2026) and Sundays.
 */
export function getMissingDatesForOffice(
  officeName: string,
  targetDate: string,
  reports: DailyReport[]
): string[] {
  if (!targetDate || !officeName) return [];

  const isoTarget = normalizeDateToIso(targetDate);

  // If targetDate is before system launch date (17-08-2026) or is 29/07/2026, no pendency applies
  if (!isoTarget || isoTarget < SYSTEM_LAUNCH_DATE || isoTarget === '2026-07-29') {
    return [];
  }

  // Get all unique dates present in reports up to targetDate, strictly bounded by SYSTEM_LAUNCH_DATE
  // Excludes 2026-07-29, any dates < SYSTEM_LAUNCH_DATE, Sundays, and declared public holidays (e.g. 26/08/2026)
  const allDates = Array.from(
    new Set([...reports.map((r) => normalizeDateToIso(r.date)), isoTarget])
  )
    .filter(
      (d) =>
        Boolean(d) &&
        d >= SYSTEM_LAUNCH_DATE &&
        d !== '2026-07-29' &&
        d <= isoTarget &&
        !isSunday(d) &&
        !isHoliday(d) &&
        d !== '2026-08-26'
    )
    .sort();

  const targetOfficeNorm = officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  const submittedDates = new Set(
    reports
      .filter((r) => {
        if (!r || !r.officeName || !r.date) return false;
        const norm = r.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (norm !== targetOfficeNorm) return false;
        // Don't count placeholder "NOT_SUBMITTED" or holiday entries as actual submissions
        if (r.submittedBy === 'NOT_SUBMITTED' || r.remarks?.includes('Report not submitted')) {
          return false;
        }
        return true;
      })
      .map((r) => normalizeDateToIso(r.date))
  );

  return allDates.filter(
    (d) => !submittedDates.has(d) && !isSunday(d) && !isHoliday(d) && d !== '2026-08-26'
  );
}

/**
 * Returns complete daily reports for ALL dates present in the system,
 * ensuring every date contains ALL active post offices (both submitted reports
 * AND non-submitted/pending or Sunday holiday entries with carried forward balances).
 * Strictly starting from SYSTEM_LAUNCH_DATE (17-08-2026).
 */
export function getAllDatesCompleteReports(
  reports: DailyReport[],
  postOffices: PostOffice[]
): DailyReport[] {
  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  // Extract all unique dates from existing reports, strictly on or after SYSTEM_LAUNCH_DATE
  const dateSet = new Set<string>(
    validReports
      .map((r) => r.date)
      .filter((d) => Boolean(d) && d >= SYSTEM_LAUNCH_DATE && d !== '2026-07-29')
  );
  if (dateSet.size === 0) {
    dateSet.add(getTodayDateString());
  }

  // Sort dates chronologically ascending (oldest to newest)
  const sortedDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));

  const allCompleteReports: DailyReport[] = [];
  for (const d of sortedDates) {
    const singleDateComplete = getCompleteDateReports(validReports, validOffices, d);
    allCompleteReports.push(...singleDateComplete);
  }

  return allCompleteReports;
}

