import { DailyReport, PostOffice, OfficialHoliday, Postman } from '../types';

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

export interface ReportSummaryTotals {
  totalLastBalance: number;
  totalReceived: number;
  totalDelivered: number;
  totalReturned: number;
  totalMissent: number;
  totalDeposit: number;
  totalClosingBalance: number;
}

/**
 * Summarizes an array of daily reports for aggregate displays.
 */
export function summarizeReports(reports: DailyReport[]): ReportSummaryTotals {
  let totalLastBalance = 0;
  let totalReceived = 0;
  let totalDelivered = 0;
  let totalReturned = 0;
  let totalMissent = 0;
  let totalDeposit = 0;
  let totalClosingBalance = 0;

  for (const r of reports) {
    totalLastBalance += Number(r.lastBalance) || 0;
    totalReceived += Number(r.receivedToday) || 0;
    totalDelivered += Number(r.delivered) || 0;
    totalReturned += Number(r.returnedToSender) || 0;
    totalMissent += Number(r.missent) || 0;
    totalDeposit += Number(r.deposit) || 0;
    totalClosingBalance += Number(r.closingBalance) || 0;
  }

  return {
    totalLastBalance,
    totalReceived,
    totalDelivered,
    totalReturned,
    totalMissent,
    totalDeposit,
    totalClosingBalance,
  };
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

export interface FinalArticleCategory {
  key: string;
  label: string;
  code: string;
}

export const FINAL_ARTICLE_CATEGORIES: FinalArticleCategory[] = [
  { key: 'rgl', label: 'RGL', code: 'RGL' },
  { key: 'parcel', label: 'Parcel', code: 'PARCEL' },
  { key: 'ums', label: 'UMS', code: 'UMS' },
  { key: 'ordinary', label: 'Ordinary', code: 'ORD' },
  { key: 'excise', label: 'Excise', code: 'EXCISE' },
  { key: 'vpp', label: 'VPP/VPL', code: 'VPP' },
  { key: 'mo', label: 'MO', code: 'MO' },
  { key: 'echallan', label: 'E-Challan', code: 'ECHALLAN' },
  { key: 'cod', label: 'COD', code: 'COD' },
  { key: 'medical', label: 'Medical', code: 'MED' },
];

/**
 * Returns normalized count for an article category from CategoryBreakdown.
 * Automatically combines historical RGL subcategories (Intl + Domestic + Insured)
 * and Parcel subcategories (Intl + Domestic + Insured) safely without double counting.
 */
export function getCategoryCount(breakdown?: Record<string, any>, catKey: string = ''): number {
  if (!breakdown || typeof breakdown !== 'object') return 0;

  if (catKey === 'rgl') {
    if (breakdown.rgl !== undefined && breakdown.rgl !== null && breakdown.rgl !== '') {
      return Math.max(0, Number(breakdown.rgl) || 0);
    }
    const intl = Number(breakdown.rgl_international || breakdown.rgl_intl) || 0;
    const dom = Number(breakdown.rgl_domestic || breakdown.rgl_dom) || 0;
    const ins = Number(breakdown.rgl_insured || breakdown.rgl_ins) || 0;
    return Math.max(0, intl + dom + ins);
  }

  if (catKey === 'parcel') {
    if (breakdown.parcel !== undefined && breakdown.parcel !== null && breakdown.parcel !== '') {
      return Math.max(0, Number(breakdown.parcel) || 0);
    }
    const intl = Number(breakdown.parcel_international || breakdown.parcel_intl) || 0;
    const dom = Number(breakdown.parcel_domestic || breakdown.parcel_dom) || 0;
    const ins = Number(breakdown.parcel_insured || breakdown.parcel_ins) || 0;
    return Math.max(0, intl + dom + ins);
  }

  if (catKey === 'mo') {
    return Math.max(0, Number(breakdown.mo ?? breakdown.money_order ?? breakdown.emo) || 0);
  }

  if (catKey === 'echallan') {
    return Math.max(0, Number(breakdown.echallan ?? breakdown.e_challan ?? breakdown['e-challan']) || 0);
  }

  if (catKey === 'vpp') {
    return Math.max(0, Number(breakdown.vpp ?? breakdown.vpp_vpl ?? breakdown['vpp/vpl']) || 0);
  }

  if (catKey === 'medical') {
    return Math.max(0, Number(breakdown.medical ?? breakdown.med) || 0);
  }

  return Math.max(0, Number(breakdown[catKey]) || 0);
}

export type ReportSubmissionStatus = 'Submitted' | 'Report Not Submitted' | 'Incomplete';

export interface PostmanReportRow {
  srNo: number;
  officeName: string;
  postmanId?: string;
  postmanName: string;
  isRegisteredPostman: boolean;
  status: ReportSubmissionStatus;
  hasSubmission: boolean;
  report?: DailyReport;
  lastBalance: number | null;
  received: Record<string, number | null>;
  receivedTotal: number | null;
  delivered: Record<string, number | null>;
  deliveredTotal: number | null;
  totalAvailable: number | null;
  returnedToSender: number | null;
  missent: number | null;
  deposit: number | null;
  deliveryPercentage: number | null;
  submissionCount?: number;
}

export interface OfficeReportGroup {
  officeName: string;
  office: PostOffice;
  postmanRows: PostmanReportRow[];
  totalRegisteredPostmen: number;
  submittedCount: number;
  notSubmittedCount: number;
  incompleteCount: number;
  completionRate: number; // percentage (0 - 100)
  totals: {
    lastBalance: number;
    receivedByCategory: Record<string, number>;
    receivedTotal: number;
    deliveredByCategory: Record<string, number>;
    deliveredTotal: number;
    totalAvailable: number;
    returnedToSender: number;
    missent: number;
    deposit: number;
    deliveryPercentage: number | null;
  };
}

export interface DailyPostmanArticleReportData {
  reportDate: string;
  startDate?: string;
  endDate?: string;
  isDateRange?: boolean;
  totalDaysInRange?: number;
  officeGroups: OfficeReportGroup[];
  allRows: PostmanReportRow[];
  grandTotals: {
    totalOffices: number;
    totalRegisteredPostmen: number;
    submittedCount: number;
    notSubmittedCount: number;
    incompleteCount: number;
    completionRate: number;
    lastBalance: number;
    receivedByCategory: Record<string, number>;
    receivedTotal: number;
    deliveredByCategory: Record<string, number>;
    deliveredTotal: number;
    totalAvailable: number;
    returnedToSender: number;
    missent: number;
    deposit: number;
    deliveryPercentage: number | null;
  };
}

/**
 * Builds the comprehensive Office-Wise & Postman-Wise Article Report.
 * Supports single date and multi-date / date range consolidation.
 * Includes EVERY registered postman for each active office.
 */
export function buildDailyPostmanArticleReport(
  reports: DailyReport[],
  postOffices: PostOffice[],
  targetDate: string,
  endDate?: string
): DailyPostmanArticleReportData {
  const validOffices = cleanAndFilterPostOffices(postOffices);
  const validReports = cleanAndFilterReports(reports);

  const iso1 = normalizeDateToIso(targetDate) || targetDate;
  const iso2 = endDate ? normalizeDateToIso(endDate) || endDate : iso1;
  const [minDate, maxDate] = iso1 <= iso2 ? [iso1, iso2] : [iso2, iso1];
  const isDateRange = Boolean(endDate && iso1 !== iso2);

  // Active offices applicable for the date/period
  const activeOffices = validOffices.filter((po) => {
    if (po.status !== 'ACTIVE') return false;
    const start = getOfficeEffectiveStartDate(po, validReports);
    return maxDate >= start;
  });

  // Filter reports within the date range
  const relevantReports = validReports.filter((r) => {
    const rDate = normalizeDateToIso(r.date) || r.date;
    if (!rDate) return false;
    if (isDateRange) {
      return rDate >= minDate && rDate <= maxDate;
    }
    return rDate === minDate;
  });

  const normKey = (s: string) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  let globalSrNo = 1;
  const officeGroups: OfficeReportGroup[] = [];
  const allRows: PostmanReportRow[] = [];

  for (const office of activeOffices) {
    const officeNorm = normKey(office.name);
    const officeReports = relevantReports.filter((r) => normKey(r.officeName) === officeNorm);

    // Get active registered postmen for this office
    const registeredPostmen = (office.postmen || []).filter((pm) => pm.status !== 'INACTIVE');
    const postmanRows: PostmanReportRow[] = [];

    if (isDateRange) {
      // MULTI-DATE DATE RANGE AGGREGATION
      if (registeredPostmen.length > 0) {
        for (const pm of registeredPostmen) {
          const pmNorm = normKey(pm.name);
          const pReports = officeReports.filter((r) => {
            if (r.postmanId && r.postmanId === pm.id) return true;
            if (r.postmanName && normKey(r.postmanName) === pmNorm) return true;
            return false;
          });

          const row = createPostmanRangeRow(globalSrNo++, office.name, pm.name, pm.id, true, pReports);
          postmanRows.push(row);
          allRows.push(row);
        }
      } else if (officeReports.length > 0) {
        // Group by distinct postman names or general submissions
        const pmMap = new Map<string, DailyReport[]>();
        for (const rep of officeReports) {
          const k = normKey(rep.postmanName || rep.postmanId || 'incharge');
          if (!pmMap.has(k)) pmMap.set(k, []);
          pmMap.get(k)!.push(rep);
        }
        for (const reps of pmMap.values()) {
          const pmName = reps[0].postmanName || (office.postmasterName ? `${office.postmasterName} (Incharge)` : 'General Postman / Incharge');
          const row = createPostmanRangeRow(globalSrNo++, office.name, pmName, reps[0].postmanId, false, reps);
          postmanRows.push(row);
          allRows.push(row);
        }
      } else {
        const pmName = office.postmasterName ? `${office.postmasterName} (Incharge)` : 'Incharge / General Postman';
        const row = createPostmanRangeRow(globalSrNo++, office.name, pmName, undefined, false, []);
        postmanRows.push(row);
        allRows.push(row);
      }
    } else {
      // SINGLE DATE MODE
      if (registeredPostmen.length > 0) {
        for (const pm of registeredPostmen) {
          const pmNorm = normKey(pm.name);
          const rep = officeReports.find((r) => {
            if (r.postmanId && r.postmanId === pm.id) return true;
            if (r.postmanName && normKey(r.postmanName) === pmNorm) return true;
            return false;
          });

          const row = createPostmanRow(globalSrNo++, office.name, pm.name, pm.id, true, rep);
          postmanRows.push(row);
          allRows.push(row);
        }
      } else if (officeReports.length > 0) {
        for (const rep of officeReports) {
          const pmName = rep.postmanName || (office.postmasterName ? `${office.postmasterName} (Incharge)` : 'General Postman / Incharge');
          const row = createPostmanRow(globalSrNo++, office.name, pmName, rep.postmanId, false, rep);
          postmanRows.push(row);
          allRows.push(row);
        }
      } else {
        const pmName = office.postmasterName ? `${office.postmasterName} (Incharge)` : 'Incharge / General Postman';
        const row = createPostmanRow(globalSrNo++, office.name, pmName, undefined, false, undefined);
        postmanRows.push(row);
        allRows.push(row);
      }
    }

    // Calculate Office Summary
    const totalRegisteredPostmen = registeredPostmen.length > 0 ? registeredPostmen.length : (postmanRows.length || 1);
    let submittedCount = 0;
    let notSubmittedCount = 0;
    let incompleteCount = 0;

    const officeTotals = {
      lastBalance: 0,
      receivedByCategory: {} as Record<string, number>,
      receivedTotal: 0,
      deliveredByCategory: {} as Record<string, number>,
      deliveredTotal: 0,
      totalAvailable: 0,
      returnedToSender: 0,
      missent: 0,
      deposit: 0,
      deliveryPercentage: null as number | null,
    };

    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      officeTotals.receivedByCategory[cat.key] = 0;
      officeTotals.deliveredByCategory[cat.key] = 0;
    });

    for (const row of postmanRows) {
      if (row.status === 'Submitted') submittedCount++;
      else if (row.status === 'Incomplete') incompleteCount++;
      else notSubmittedCount++;

      if (row.hasSubmission) {
        officeTotals.lastBalance += row.lastBalance || 0;
        officeTotals.receivedTotal += row.receivedTotal || 0;
        officeTotals.deliveredTotal += row.deliveredTotal || 0;
        officeTotals.totalAvailable += row.totalAvailable || 0;
        officeTotals.returnedToSender += row.returnedToSender || 0;
        officeTotals.missent += row.missent || 0;
        officeTotals.deposit += row.deposit || 0;

        FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
          officeTotals.receivedByCategory[cat.key] += row.received[cat.key] || 0;
          officeTotals.deliveredByCategory[cat.key] += row.delivered[cat.key] || 0;
        });
      }
    }

    const completionRate = totalRegisteredPostmen > 0 ? (submittedCount / totalRegisteredPostmen) * 100 : 0;
    if (officeTotals.totalAvailable > 0) {
      officeTotals.deliveryPercentage = (officeTotals.deliveredTotal / officeTotals.totalAvailable) * 100;
    }

    officeGroups.push({
      officeName: office.name,
      office,
      postmanRows,
      totalRegisteredPostmen,
      submittedCount,
      notSubmittedCount,
      incompleteCount,
      completionRate,
      totals: officeTotals,
    });
  }

  // Calculate Grand Totals across all offices
  const grandTotals = {
    totalOffices: officeGroups.length,
    totalRegisteredPostmen: 0,
    submittedCount: 0,
    notSubmittedCount: 0,
    incompleteCount: 0,
    completionRate: 0,
    lastBalance: 0,
    receivedByCategory: {} as Record<string, number>,
    receivedTotal: 0,
    deliveredByCategory: {} as Record<string, number>,
    deliveredTotal: 0,
    totalAvailable: 0,
    returnedToSender: 0,
    missent: 0,
    deposit: 0,
    deliveryPercentage: null as number | null,
  };

  FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
    grandTotals.receivedByCategory[cat.key] = 0;
    grandTotals.deliveredByCategory[cat.key] = 0;
  });

  for (const group of officeGroups) {
    grandTotals.totalRegisteredPostmen += group.totalRegisteredPostmen;
    grandTotals.submittedCount += group.submittedCount;
    grandTotals.notSubmittedCount += group.notSubmittedCount;
    grandTotals.incompleteCount += group.incompleteCount;

    grandTotals.lastBalance += group.totals.lastBalance;
    grandTotals.receivedTotal += group.totals.receivedTotal;
    grandTotals.deliveredTotal += group.totals.deliveredTotal;
    grandTotals.totalAvailable += group.totals.totalAvailable;
    grandTotals.returnedToSender += group.totals.returnedToSender;
    grandTotals.missent += group.totals.missent;
    grandTotals.deposit += group.totals.deposit;

    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      grandTotals.receivedByCategory[cat.key] += group.totals.receivedByCategory[cat.key] || 0;
      grandTotals.deliveredByCategory[cat.key] += group.totals.deliveredByCategory[cat.key] || 0;
    });
  }

  if (grandTotals.totalRegisteredPostmen > 0) {
    grandTotals.completionRate = (grandTotals.submittedCount / grandTotals.totalRegisteredPostmen) * 100;
  }
  if (grandTotals.totalAvailable > 0) {
    grandTotals.deliveryPercentage = (grandTotals.deliveredTotal / grandTotals.totalAvailable) * 100;
  }

  const daysDiff = isDateRange
    ? Math.max(1, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;

  return {
    reportDate: isDateRange ? `${minDate} to ${maxDate}` : minDate,
    startDate: minDate,
    endDate: maxDate,
    isDateRange,
    totalDaysInRange: daysDiff,
    officeGroups,
    allRows,
    grandTotals,
  };
}

function createPostmanRow(
  srNo: number,
  officeName: string,
  postmanName: string,
  postmanId: string | undefined,
  isRegisteredPostman: boolean,
  report?: DailyReport
): PostmanReportRow {
  const isMissingReport = !report || report.submittedBy === 'NOT_SUBMITTED' || report.remarks?.includes('Report not submitted');

  if (isMissingReport) {
    const emptyRec: Record<string, number | null> = {};
    const emptyDel: Record<string, number | null> = {};
    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      emptyRec[cat.key] = null;
      emptyDel[cat.key] = null;
    });

    return {
      srNo,
      officeName,
      postmanId,
      postmanName,
      isRegisteredPostman,
      status: 'Report Not Submitted',
      hasSubmission: false,
      report,
      lastBalance: null,
      received: emptyRec,
      receivedTotal: null,
      delivered: emptyDel,
      deliveredTotal: null,
      totalAvailable: null,
      returnedToSender: null,
      missent: null,
      deposit: null,
      deliveryPercentage: null,
    };
  }

  // Populate actual figures
  const lastBal = Number(report.lastBalance) || 0;
  const recMap: Record<string, number | null> = {};
  const delMap: Record<string, number | null> = {};
  let recSum = 0;
  let delSum = 0;

  FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
    const rVal = getCategoryCount(report.receivedBreakdown, cat.key);
    recMap[cat.key] = rVal;
    recSum += rVal;

    const dVal = getCategoryCount(report.deliveredBreakdown, cat.key);
    delMap[cat.key] = dVal;
    delSum += dVal;
  });

  // If breakdown was completely empty, fallback to legacy top-level totals
  if (recSum === 0 && (Number(report.receivedToday) || 0) > 0) {
    recSum = Number(report.receivedToday) || 0;
  }
  if (delSum === 0 && (Number(report.delivered) || 0) > 0) {
    delSum = Number(report.delivered) || 0;
  }

  const totalAvail = lastBal + recSum;
  const retVal = report.returnedToSender !== undefined && report.returnedToSender !== null ? Number(report.returnedToSender) || 0 : null;
  const misVal = report.missent !== undefined && report.missent !== null ? Number(report.missent) || 0 : null;

  // Deposit / Not Delivered = Total Available - Delivered - Returned - Missent
  const calcDeposit = totalAvail - delSum - (retVal || 0) - (misVal || 0);
  const finalDeposit = report.deposit !== undefined && report.deposit !== null ? Number(report.deposit) : calcDeposit;

  const delPct = totalAvail > 0 ? (delSum / totalAvail) * 100 : 0;

  // Check if Incomplete
  let status: ReportSubmissionStatus = 'Submitted';
  if (lastBal < 0 || recSum < 0 || delSum < 0 || (retVal !== null && retVal < 0) || (misVal !== null && misVal < 0)) {
    status = 'Incomplete';
  }

  return {
    srNo,
    officeName,
    postmanId,
    postmanName,
    isRegisteredPostman,
    status,
    hasSubmission: true,
    report,
    lastBalance: lastBal,
    received: recMap,
    receivedTotal: recSum,
    delivered: delMap,
    deliveredTotal: delSum,
    totalAvailable: totalAvail,
    returnedToSender: retVal,
    missent: misVal,
    deposit: finalDeposit,
    deliveryPercentage: delPct,
  };
}

/**
 * Creates an aggregated PostmanReportRow across a date range.
 */
function createPostmanRangeRow(
  srNo: number,
  officeName: string,
  postmanName: string,
  postmanId: string | undefined,
  isRegisteredPostman: boolean,
  pReports: DailyReport[]
): PostmanReportRow {
  const valid = pReports.filter(
    (r) => r && r.submittedBy !== 'NOT_SUBMITTED' && !r.remarks?.includes('Report not submitted')
  );

  if (valid.length === 0) {
    const emptyRec: Record<string, number | null> = {};
    const emptyDel: Record<string, number | null> = {};
    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      emptyRec[cat.key] = null;
      emptyDel[cat.key] = null;
    });

    return {
      srNo,
      officeName,
      postmanId,
      postmanName,
      isRegisteredPostman,
      status: 'Report Not Submitted',
      hasSubmission: false,
      lastBalance: null,
      received: emptyRec,
      receivedTotal: null,
      delivered: emptyDel,
      deliveredTotal: null,
      totalAvailable: null,
      returnedToSender: null,
      missent: null,
      deposit: null,
      deliveryPercentage: null,
      submissionCount: 0,
    };
  }

  // Sort chronological ascending
  const sorted = [...valid].sort((a, b) => {
    const da = normalizeDateToIso(a.date) || a.date;
    const db = normalizeDateToIso(b.date) || b.date;
    return da.localeCompare(db);
  });

  // Opening balance is the lastBalance of the earliest submission in the range
  const openingLastBal = Number(sorted[0].lastBalance) || 0;

  const recMap: Record<string, number | null> = {};
  const delMap: Record<string, number | null> = {};
  FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
    recMap[cat.key] = 0;
    delMap[cat.key] = 0;
  });

  let recSum = 0;
  let delSum = 0;
  let retSum = 0;
  let misSum = 0;

  for (const r of sorted) {
    let dayRec = 0;
    let dayDel = 0;
    FINAL_ARTICLE_CATEGORIES.forEach((cat) => {
      const rv = getCategoryCount(r.receivedBreakdown, cat.key);
      const dv = getCategoryCount(r.deliveredBreakdown, cat.key);
      (recMap[cat.key] as number) += rv;
      (delMap[cat.key] as number) += dv;
      dayRec += rv;
      dayDel += dv;
    });

    if (dayRec === 0 && (Number(r.receivedToday) || 0) > 0) {
      dayRec = Number(r.receivedToday) || 0;
    }
    if (dayDel === 0 && (Number(r.delivered) || 0) > 0) {
      dayDel = Number(r.delivered) || 0;
    }

    recSum += dayRec;
    delSum += dayDel;
    retSum += Number(r.returnedToSender) || 0;
    misSum += Number(r.missent) || 0;
  }

  const totalAvail = openingLastBal + recSum;
  const deposit = totalAvail - delSum - retSum - misSum;
  const delPct = totalAvail > 0 ? (delSum / totalAvail) * 100 : 0;

  return {
    srNo,
    officeName,
    postmanId,
    postmanName,
    isRegisteredPostman,
    status: 'Submitted',
    hasSubmission: true,
    report: sorted[sorted.length - 1],
    lastBalance: openingLastBal,
    received: recMap,
    receivedTotal: recSum,
    delivered: delMap,
    deliveredTotal: delSum,
    totalAvailable: totalAvail,
    returnedToSender: retSum,
    missent: misSum,
    deposit,
    deliveryPercentage: delPct,
    submissionCount: sorted.length,
  };
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
        if (!existing.createdDate && po.createdDate) {
          existing.createdDate = po.createdDate;
        }
        // Preserve and merge postmen so postmen are never lost during deduplication
        if (Array.isArray(po.postmen) && po.postmen.length > 0) {
          const exList = Array.isArray(existing.postmen) ? existing.postmen : [];
          const pmMap = new Map<string, Postman>();
          exList.forEach((p) => {
            const k = p.id || (p.name || '').toLowerCase().trim();
            if (k) pmMap.set(k, { ...p });
          });
          po.postmen.forEach((p) => {
            const k = p.id || (p.name || '').toLowerCase().trim();
            if (k) {
              const prev = pmMap.get(k);
              pmMap.set(k, { ...(prev || {}), ...p });
            }
          });
          existing.postmen = Array.from(pmMap.values());
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
      createdDate: po.createdDate ? normalizeDateToIso(po.createdDate) || po.createdDate : undefined,
      postmen: Array.isArray(po.postmen) ? po.postmen : [],
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

    // Filter out 29/07/2026, dates before the official launch date, and future dates
    const todayIso = getTodayDateString();
    if (
      normalizedDate === '2026-07-29' ||
      (normalizedDate && normalizedDate < SYSTEM_LAUNCH_DATE) ||
      (normalizedDate && normalizedDate > todayIso)
    ) {
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
 * Determines the effective start/joining date for a Post Office.
 * Missing reports, pendency, and reminders are strictly calculated starting from this date onwards.
 * If office has an explicit createdDate (>= SYSTEM_LAUNCH_DATE), uses it.
 * If createdDate is not present:
 *   - If office already has submitted reports in `reports`, the earliest submitted report date (or SYSTEM_LAUNCH_DATE) is used.
 *   - If office has NO submitted reports at all, it is considered newly added! Defaults to today's date so past backlog is never shown.
 */
const officeEarliestDateCache = new Map<string, string>();
let lastReportsRefForEarliest: DailyReport[] | null = null;

export function getOfficeEffectiveStartDate(
  office: PostOffice | { name: string; createdDate?: string },
  reports: DailyReport[] = []
): string {
  if (office.createdDate) {
    const isoCreated = normalizeDateToIso(office.createdDate) || office.createdDate;
    if (isoCreated >= SYSTEM_LAUNCH_DATE) {
      return isoCreated;
    }
  }

  const officeNorm = (office.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  if (!officeNorm) return SYSTEM_LAUNCH_DATE;

  // Single fast O(N) indexing when reports changes
  if (lastReportsRefForEarliest !== reports) {
    officeEarliestDateCache.clear();
    lastReportsRefForEarliest = reports;
    for (const r of reports) {
      if (!r || !r.officeName || !r.date) continue;
      if (r.submittedBy === 'NOT_SUBMITTED' || r.remarks?.includes('Report not submitted')) continue;
      const rNorm = r.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const rDate = normalizeDateToIso(r.date) || r.date;
      if (!rDate || rDate < SYSTEM_LAUNCH_DATE || rDate === '2026-07-29') continue;
      const prev = officeEarliestDateCache.get(rNorm);
      if (!prev || rDate < prev) {
        officeEarliestDateCache.set(rNorm, rDate);
      }
    }
  }

  const cached = officeEarliestDateCache.get(officeNorm);
  if (cached) return cached;

  return getTodayDateString();
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
  const dateReports = validReports.filter((r) => (normalizeDateToIso(r.date) || r.date) === targetDate);
  const submittedOfficeKeys = new Set(
    dateReports.map((r) => r.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
  );
  const activeOffices = validOffices.filter((po) => po.status === 'ACTIVE');

  // Pre-index the latest past report before targetDate for all offices in one single O(N) pass
  const latestPastReportByOffice = new Map<string, DailyReport>();
  for (const r of validReports) {
    const rDate = normalizeDateToIso(r.date) || r.date;
    if (!rDate || rDate >= targetDate) continue;
    const rNorm = r.officeName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const current = latestPastReportByOffice.get(rNorm);
    const currDate = current ? (normalizeDateToIso(current.date) || current.date) : '';
    if (!current || rDate > currDate) {
      latestPastReportByOffice.set(rNorm, r);
    }
  }

  // Ensure unique active offices by name
  const seenActiveNames = new Set<string>();
  const uniqueActiveOffices = activeOffices.filter((po) => {
    const key = po.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (seenActiveNames.has(key)) return false;
    seenActiveNames.add(key);
    return true;
  });

  const missingReports: DailyReport[] = uniqueActiveOffices
    .filter((po) => {
      // Office must only be considered from its effective start/added date onwards!
      const officeStartDate = getOfficeEffectiveStartDate(po, validReports);
      if (targetDate < officeStartDate) {
        return false;
      }
      return !submittedOfficeKeys.has(po.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
    })
    .map((office) => {
      const officeNorm = office.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      let carriedBal = office.initialBalance || 0;
      const prev = latestPastReportByOffice.get(officeNorm);
      if (prev) {
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
 * strictly starting from the office's effective addition/creation date (or SYSTEM_LAUNCH_DATE),
 * strictly EXCLUDING dates prior to addition, dates prior to launch (such as 29/07/2026),
 * Sundays, and declared public holidays.
 */
export function getMissingDatesForOffice(
  officeName: string,
  targetDate: string,
  reports: DailyReport[],
  createdDateOrOffice?: string | PostOffice
): string[] {
  if (!targetDate || !officeName) return [];

  const isoTarget = normalizeDateToIso(targetDate);
  const todayIso = getTodayDateString();

  let effectiveStartDate = SYSTEM_LAUNCH_DATE;
  if (typeof createdDateOrOffice === 'string' && createdDateOrOffice) {
    const norm = normalizeDateToIso(createdDateOrOffice) || createdDateOrOffice;
    if (norm >= SYSTEM_LAUNCH_DATE) {
      effectiveStartDate = norm;
    }
  } else if (createdDateOrOffice && typeof createdDateOrOffice === 'object') {
    effectiveStartDate = getOfficeEffectiveStartDate(createdDateOrOffice, reports);
  } else {
    effectiveStartDate = getOfficeEffectiveStartDate({ name: officeName } as PostOffice, reports);
  }

  // If targetDate is before system launch date (17-08-2026), is 29/07/2026, or before office effective start date,
  // no pendency applies
  if (!isoTarget || isoTarget < SYSTEM_LAUNCH_DATE || isoTarget === '2026-07-29' || isoTarget < effectiveStartDate) {
    return [];
  }

  // Strict upper bound: cannot be in the future beyond today
  const effectiveTarget = isoTarget > todayIso ? todayIso : isoTarget;

  // Get all unique dates present in reports up to effectiveTarget, strictly bounded by effectiveStartDate
  // Excludes 2026-07-29, any dates < effectiveStartDate, Sundays, and declared public holidays (e.g. 26/08/2026)
  const allDates = Array.from(
    new Set([...reports.map((r) => normalizeDateToIso(r.date)), effectiveTarget])
  )
    .filter(
      (d) =>
        Boolean(d) &&
        d >= effectiveStartDate &&
        d !== '2026-07-29' &&
        d <= effectiveTarget &&
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

