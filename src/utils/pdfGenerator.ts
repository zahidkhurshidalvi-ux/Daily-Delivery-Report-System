import jsPDF from 'jspdf';

import { DailyReport, PostOffice } from '../types';
import { formatDatePK, formatNumber, summarizeReports, isSunday, getDayOfWeek } from './calculations';

export function generateDailyReportPDF(
  reports: DailyReport[],
  reportDate: string,
  divisionName: string = 'Gujranwala Division',
  customTitle?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totals = summarizeReports(reports);
  const deliveryRate =
    totals.totalReceived > 0
      ? ((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)
      : '0.0';

  const isSun = isSunday(reportDate);

  // Header Colors: Dark Green #00401A / #006633, Gold Accent #D4AF37 (A4 Portrait width: 210mm)
  doc.setFillColor(0, 64, 26); // Pakistan Post Dark Green
  doc.rect(0, 0, 210, 24, 'F');

  // Gold Stripe
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 24, 210, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(customTitle || 'PAKISTAN POST - DAILY DELIVERY REPORT', 10, 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}`,
    10,
    16
  );

  // Date Badge Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const dateLabel = reportDate.includes('TO') || reportDate.includes('FROM')
    ? reportDate
    : `DATE: ${formatDatePK(reportDate)}${isSun ? ' (SUNDAY HOLIDAY)' : ''}`;
  doc.text(dateLabel, 200, 13, { align: 'right' });

  // Summary Banner Card (Portrait 190mm wide)
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 248, 245);
  doc.roundedRect(10, 28, 190, 13, 2, 2, 'FD');

  doc.setTextColor(0, 102, 51);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  const bannerY = 36;
  doc.text(`Offices: ${reports.length}`, 13, bannerY);
  doc.text(`Last Bal: ${formatNumber(totals.totalLastBalance)}`, 38, bannerY);
  doc.text(`Recv: ${formatNumber(totals.totalReceived)}`, 67, bannerY);
  doc.text(`Deliv: ${formatNumber(totals.totalDelivered)}`, 93, bannerY);
  doc.text(`Rate: ${deliveryRate}%`, 121, bannerY);
  doc.text(`Ret: ${formatNumber(totals.totalReturned)}`, 146, bannerY);
  doc.text(`Miss: ${formatNumber(totals.totalMissent)}`, 167, bannerY);
  doc.text(`Dep: ${formatNumber(totals.totalDeposit)}`, 187, bannerY);

  // Table Headers (Portrait Total width = 190mm: 7 + 45 + 16 + 16 + 16 + 14 + 15 + 15 + 15 + 31 = 190)
  const startY = 44;
  const colWidths = [7, 45, 16, 16, 16, 14, 15, 15, 15, 31];
  const headers = [
    '#',
    'Office Name',
    'Last Bal',
    'Received',
    'Delivered',
    'Deliv %',
    'Returned',
    'Missent',
    'Deposit',
    'Remarks',
  ];

  doc.setFillColor(0, 64, 26);
  doc.rect(10, startY, 190, 6.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');

  let currentX = 10;
  headers.forEach((h, idx) => {
    const align = idx >= 2 && idx <= 8 ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidths[idx] - 1.5 : currentX + 1.5;
    doc.text(h, textX, startY + 4.5, { align });
    currentX += colWidths[idx];
  });

  // Table Rows
  let currentY = startY + 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(6.5);

  reports.forEach((rep, index) => {
    // Page overflow check (A4 Portrait height is 297mm)
    if (currentY > 260) {
      doc.addPage();
      currentY = 14;
      
      // Print table header on subsequent pages
      doc.setFillColor(0, 64, 26);
      doc.rect(10, currentY, 190, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let pageX = 10;
      headers.forEach((h, idx) => {
        const align = idx >= 2 && idx <= 8 ? 'right' : 'left';
        const textX = align === 'right' ? pageX + colWidths[idx] - 1.5 : pageX + 1.5;
        doc.text(h, textX, currentY + 4.5, { align });
        pageX += colWidths[idx];
      });
      currentY += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(6.5);
    }

    const rowIsSun = isSunday(rep.date) || isSun;
    const isNotSubmitted =
      !rowIsSun &&
      (rep.submittedBy === 'NOT_SUBMITTED' ||
      rep.remarks?.includes('Report not submitted'));

    const rowRate =
      rep.receivedToday > 0
        ? `${((rep.delivered / rep.receivedToday) * 100).toFixed(0)}%`
        : '0%';

    // Row background
    if (rowIsSun) {
      doc.setFillColor(254, 249, 195); // light yellow for Sunday
      doc.rect(10, currentY, 190, 5.5, 'F');
    } else if (isNotSubmitted) {
      doc.setFillColor(254, 242, 242); // light red
      doc.rect(10, currentY, 190, 5.5, 'F');
    } else if (index % 2 === 1) {
      doc.setFillColor(248, 250, 248);
      doc.rect(10, currentY, 190, 5.5, 'F');
    }

    // Row border bottom
    doc.setDrawColor(220, 220, 220);
    doc.line(10, currentY + 5.5, 200, currentY + 5.5);

    let xPos = 10;
    const displayRemarks = rowIsSun
      ? 'Sunday Holiday'
      : isNotSubmitted
      ? 'Pending (Not submitted)'
      : rep.remarks
      ? (rep.remarks.length > 20 ? rep.remarks.substring(0, 18) + '..' : rep.remarks)
      : '-';

    const rowData = [
      (index + 1).toString(),
      rep.officeName.length > 28 ? rep.officeName.substring(0, 26) + '..' : rep.officeName,
      formatNumber(rep.lastBalance),
      formatNumber(rep.receivedToday),
      formatNumber(rep.delivered),
      rowRate,
      formatNumber(rep.returnedToSender),
      formatNumber(rep.missent),
      formatNumber(rep.deposit),
      displayRemarks,
    ];

    rowData.forEach((val, colIdx) => {
      const align = colIdx >= 2 && colIdx <= 8 ? 'right' : 'left';
      const textX = align === 'right' ? xPos + colWidths[colIdx] - 1.5 : xPos + 1.5;

      if (rowIsSun && colIdx === 9) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(161, 98, 7); // amber
      } else if (isNotSubmitted && colIdx === 9) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
      } else if (colIdx === 5) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 51);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }

      doc.text(val, textX, currentY + 3.8, { align });
      xPos += colWidths[colIdx];
    });

    currentY += 5.5;
  });

  // Grand Totals Row
  if (currentY > 260) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFillColor(225, 238, 228);
  doc.rect(10, currentY, 190, 6.5, 'F');
  doc.setDrawColor(0, 64, 26);
  doc.rect(10, currentY, 190, 6.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 64, 26);

  let xTot = 10;
  const totalsRowData = [
    '',
    'GRAND TOTALS',
    formatNumber(totals.totalLastBalance),
    formatNumber(totals.totalReceived),
    formatNumber(totals.totalDelivered),
    `${deliveryRate}%`,
    formatNumber(totals.totalReturned),
    formatNumber(totals.totalMissent),
    formatNumber(totals.totalDeposit),
    '',
  ];

  totalsRowData.forEach((val, colIdx) => {
    const align = colIdx >= 2 && colIdx <= 8 ? 'right' : 'left';
    const textX = align === 'right' ? xTot + colWidths[colIdx] - 1.5 : xTot + 1.5;
    doc.text(val, textX, currentY + 4.5, { align });
    xTot += colWidths[colIdx];
  });

  // Signature Section
  const sigY = Math.min(currentY + 16, 275);

  doc.setDrawColor(120, 120, 120);
  doc.line(15, sigY, 70, sigY);
  doc.line(135, sigY, 195, sigY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Prepared By: System Admin / In-Charge', 15, sigY + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Divisional Superintendent (PS)', 135, sigY + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.text(divisionName, 135, sigY + 7);

  // Footer
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated via Pakistan Post Daily Delivery System | Gujranwala Division | ${new Date().toLocaleString()}`,
    10,
    290
  );

  return doc;
}

/**
 * Generates an official A4 Portrait PDF summary of ALL DATES consolidated delivery records.
 */
export function generateAllDatesReportPDF(
  reports: DailyReport[],
  divisionName: string = 'Gujranwala Division'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Sort by date ascending, then office name
  const sortedReports = [...reports].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.officeName.localeCompare(b.officeName);
  });

  const totals = summarizeReports(sortedReports);
  const deliveryRate =
    totals.totalReceived > 0
      ? ((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)
      : '0.0';

  const uniqueDates = Array.from(new Set(sortedReports.map((r) => r.date))).filter(Boolean);

  // Header Colors: Dark Green #00401A
  doc.setFillColor(0, 64, 26);
  doc.rect(0, 0, 210, 24, 'F');

  // Gold Stripe
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 24, 210, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAKISTAN POST - ALL DATES CONSOLIDATED DELIVERY REPORT', 10, 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}`,
    10,
    16
  );

  // Date Badge Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`TOTAL DATES: ${uniqueDates.length} | RECORDS: ${sortedReports.length}`, 200, 13, { align: 'right' });

  // Summary Banner Card (Portrait 190mm wide)
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 248, 245);
  doc.roundedRect(10, 28, 190, 13, 2, 2, 'FD');

  doc.setTextColor(0, 102, 51);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');

  const bannerY = 36;
  doc.text(`Dates: ${uniqueDates.length}`, 12, bannerY);
  doc.text(`Records: ${sortedReports.length}`, 32, bannerY);
  doc.text(`Last Bal: ${formatNumber(totals.totalLastBalance)}`, 57, bannerY);
  doc.text(`Recv: ${formatNumber(totals.totalReceived)}`, 83, bannerY);
  doc.text(`Deliv: ${formatNumber(totals.totalDelivered)}`, 108, bannerY);
  doc.text(`Rate: ${deliveryRate}%`, 133, bannerY);
  doc.text(`Ret: ${formatNumber(totals.totalReturned)}`, 153, bannerY);
  doc.text(`Dep: ${formatNumber(totals.totalDeposit)}`, 173, bannerY);

  // Table Headers (Portrait Total width = 190mm)
  // Widths: 7 + 18 + 42 + 14 + 14 + 14 + 12 + 12 + 12 + 13 + 32 = 190
  const startY = 44;
  const colWidths = [7, 18, 42, 14, 14, 14, 12, 12, 12, 13, 32];
  const headers = [
    '#',
    'Date',
    'Office Name',
    'Last Bal',
    'Received',
    'Delivered',
    'Deliv %',
    'Returned',
    'Missent',
    'Deposit',
    'Remarks',
  ];

  doc.setFillColor(0, 64, 26);
  doc.rect(10, startY, 190, 6.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');

  let currentX = 10;
  headers.forEach((h, idx) => {
    const align = idx >= 3 && idx <= 9 ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidths[idx] - 1.5 : currentX + 1.5;
    doc.text(h, textX, startY + 4.5, { align });
    currentX += colWidths[idx];
  });

  // Table Rows
  let currentY = startY + 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(6.5);

  sortedReports.forEach((rep, index) => {
    if (currentY > 260) {
      doc.addPage();
      currentY = 14;
      
      doc.setFillColor(0, 64, 26);
      doc.rect(10, currentY, 190, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let pageX = 10;
      headers.forEach((h, idx) => {
        const align = idx >= 3 && idx <= 9 ? 'right' : 'left';
        const textX = align === 'right' ? pageX + colWidths[idx] - 1.5 : pageX + 1.5;
        doc.text(h, textX, currentY + 4.5, { align });
        pageX += colWidths[idx];
      });
      currentY += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(6.5);
    }

    const isSun = isSunday(rep.date);
    const isNotSubmitted =
      !isSun &&
      (rep.submittedBy === 'NOT_SUBMITTED' ||
      rep.remarks?.includes('Report not submitted'));

    const rowRate =
      rep.receivedToday > 0
        ? `${((rep.delivered / rep.receivedToday) * 100).toFixed(0)}%`
        : '0%';

    if (isSun) {
      doc.setFillColor(254, 249, 195); // light yellow for Sunday
      doc.rect(10, currentY, 190, 5.5, 'F');
    } else if (isNotSubmitted) {
      doc.setFillColor(254, 242, 242);
      doc.rect(10, currentY, 190, 5.5, 'F');
    } else if (index % 2 === 1) {
      doc.setFillColor(248, 250, 248);
      doc.rect(10, currentY, 190, 5.5, 'F');
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(10, currentY + 5.5, 200, currentY + 5.5);

    let xPos = 10;
    const displayRemarks = isSun
      ? 'Sunday Holiday'
      : isNotSubmitted
      ? 'Pending (Not submitted)'
      : rep.remarks
      ? (rep.remarks.length > 22 ? rep.remarks.substring(0, 20) + '..' : rep.remarks)
      : '-';

    const rowData = [
      (index + 1).toString(),
      formatDatePK(rep.date),
      rep.officeName.length > 25 ? rep.officeName.substring(0, 23) + '..' : rep.officeName,
      formatNumber(rep.lastBalance),
      formatNumber(rep.receivedToday),
      formatNumber(rep.delivered),
      rowRate,
      formatNumber(rep.returnedToSender),
      formatNumber(rep.missent),
      formatNumber(rep.deposit),
      displayRemarks,
    ];

    rowData.forEach((val, colIdx) => {
      const align = colIdx >= 3 && colIdx <= 9 ? 'right' : 'left';
      const textX = align === 'right' ? xPos + colWidths[colIdx] - 1.5 : xPos + 1.5;

      if (isSun && colIdx === 10) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(161, 98, 7); // amber
      } else if (isNotSubmitted && colIdx === 10) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
      } else if (colIdx === 6) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 51);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }

      doc.text(val, textX, currentY + 3.8, { align });
      xPos += colWidths[colIdx];
    });

    currentY += 5.5;
  });

  // Grand Totals Row
  if (currentY > 260) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFillColor(225, 238, 228);
  doc.rect(10, currentY, 190, 6.5, 'F');
  doc.setDrawColor(0, 64, 26);
  doc.rect(10, currentY, 190, 6.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 64, 26);

  let xTot = 10;
  const totalsRowData = [
    '',
    `ALL DATES`,
    `GRAND TOTALS (${sortedReports.length})`,
    formatNumber(totals.totalLastBalance),
    formatNumber(totals.totalReceived),
    formatNumber(totals.totalDelivered),
    `${deliveryRate}%`,
    formatNumber(totals.totalReturned),
    formatNumber(totals.totalMissent),
    formatNumber(totals.totalDeposit),
    '',
  ];

  totalsRowData.forEach((val, colIdx) => {
    const align = colIdx >= 3 && colIdx <= 9 ? 'right' : 'left';
    const textX = align === 'right' ? xTot + colWidths[colIdx] - 1.5 : xTot + 1.5;
    doc.text(val, textX, currentY + 4.5, { align });
    xTot += colWidths[colIdx];
  });

  // Signature Section
  const sigY = Math.min(currentY + 16, 275);

  doc.setDrawColor(120, 120, 120);
  doc.line(15, sigY, 70, sigY);
  doc.line(135, sigY, 195, sigY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Prepared By: System Admin / In-Charge', 15, sigY + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Divisional Superintendent (PS)', 135, sigY + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.text(divisionName, 135, sigY + 7);

  // Footer
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated via Pakistan Post Daily Delivery System | Gujranwala Division | ${new Date().toLocaleString()}`,
    10,
    290
  );

  return doc;
}

/**
 * Printable HTML document trigger that reliably works in both standard browser windows and iframes
 */
/**
 * Generates an official A4 Portrait PDF summary of all pending post offices for Divisional Supervisors.
 */
export function generatePendingReportPDF(
  pendingList: {
    office: PostOffice;
    lastReportDate?: string;
    missingDates: string[];
  }[],
  reportDate: string,
  divisionName: string = 'Gujranwala Division'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Colors: Dark Red #991B1B & Gold #D4AF37 for Pending/Defaulter Notices
  doc.setFillColor(153, 27, 27); // Dark Red
  doc.rect(0, 0, 210, 24, 'F');

  // Gold Stripe
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 24, 210, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PAKISTAN POST - PENDING OFFICES COMPLIANCE REPORT', 10, 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}`,
    10,
    16
  );

  // Date Badge Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`DATE: ${formatDatePK(reportDate)}`, 200, 13, { align: 'right' });

  // Summary Banner Card
  doc.setDrawColor(220, 38, 38);
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(10, 28, 190, 12, 2, 2, 'FD');

  const totalMissingSubmissions = pendingList.reduce(
    (acc, p) => acc + (p.missingDates.length > 0 ? p.missingDates.length : 1),
    0
  );

  doc.setTextColor(153, 27, 27);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const bannerY = 35.5;
  doc.text(`Total Pending Offices: ${pendingList.length}`, 14, bannerY);
  doc.text(`Total Missing Dates/Reports: ${totalMissingSubmissions}`, 85, bannerY);
  doc.text(`Status: IMMEDIATE ACTION REQUIRED`, 150, bannerY);

  // Table Headers (Total Width: 190mm -> 8 + 48 + 36 + 26 + 18 + 54 = 190)
  const startY = 43;
  const colWidths = [8, 48, 36, 26, 18, 54];
  const headers = [
    '#',
    'Post Office Name',
    'Postmaster / Incharge',
    'Mobile Number',
    'Pending',
    'Pending Dates (مورخہ جات)',
  ];

  doc.setFillColor(153, 27, 27);
  doc.rect(10, startY, 190, 6.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');

  let currentX = 10;
  headers.forEach((h, idx) => {
    const align = idx === 4 ? 'center' : idx === 0 ? 'center' : 'left';
    const textX =
      align === 'center'
        ? currentX + colWidths[idx] / 2
        : currentX + 1.5;
    doc.text(h, textX, startY + 4.5, { align });
    currentX += colWidths[idx];
  });

  // Table Rows
  let currentY = startY + 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(6.5);

  pendingList.forEach((item, index) => {
    // Check page overflow
    if (currentY > 260) {
      doc.addPage();
      currentY = 14;

      doc.setFillColor(153, 27, 27);
      doc.rect(10, currentY, 190, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      let pageX = 10;
      headers.forEach((h, idx) => {
        const align = idx === 4 ? 'center' : idx === 0 ? 'center' : 'left';
        const textX =
          align === 'center'
            ? pageX + colWidths[idx] / 2
            : pageX + 1.5;
        doc.text(h, textX, currentY + 4.5, { align });
        pageX += colWidths[idx];
      });
      currentY += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(6.5);
    }

    if (index % 2 === 1) {
      doc.setFillColor(254, 242, 242);
      doc.rect(10, currentY, 190, 5.5, 'F');
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(10, currentY + 5.5, 200, currentY + 5.5);

    const datesFormatted =
      item.missingDates.length > 0
        ? item.missingDates.map((d) => formatDatePK(d)).join(', ')
        : formatDatePK(reportDate);

    const rowData = [
      (index + 1).toString(),
      item.office.name.length > 30 ? item.office.name.substring(0, 28) + '..' : item.office.name,
      item.office.postmasterName || 'N/A',
      item.office.mobileNumber || '-',
      (item.missingDates.length > 0 ? item.missingDates.length : 1).toString(),
      datesFormatted.length > 38 ? datesFormatted.substring(0, 36) + '..' : datesFormatted,
    ];

    let xPos = 10;
    rowData.forEach((val, colIdx) => {
      const align = colIdx === 4 ? 'center' : colIdx === 0 ? 'center' : 'left';
      const textX =
        align === 'center'
          ? xPos + colWidths[colIdx] / 2
          : xPos + 1.5;

      if (colIdx === 1) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(153, 27, 27);
      } else if (colIdx === 4) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }

      doc.text(val, textX, currentY + 3.8, { align });
      xPos += colWidths[colIdx];
    });

    currentY += 5.5;
  });

  // Total Summary Footer Row
  if (currentY > 260) {
    doc.addPage();
    currentY = 14;
  }

  doc.setFillColor(254, 226, 226);
  doc.rect(10, currentY, 190, 6.5, 'F');
  doc.setDrawColor(153, 27, 27);
  doc.rect(10, currentY, 190, 6.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(153, 27, 27);
  doc.text(`TOTAL PENDING OFFICES: ${pendingList.length}`, 14, currentY + 4.5);
  doc.text(`TOTAL PENDING DATES COUNT: ${totalMissingSubmissions}`, 118, currentY + 4.5);

  // Signature Section
  const sigY = Math.min(currentY + 16, 275);
  doc.setDrawColor(120, 120, 120);
  doc.line(15, sigY, 70, sigY);
  doc.line(135, sigY, 195, sigY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Prepared By: Monitoring In-Charge', 15, sigY + 3.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Divisional Superintendent (PS)', 135, sigY + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.text(divisionName, 135, sigY + 7);

  // Footer
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated via Pakistan Post Daily Delivery System | Gujranwala Division | ${new Date().toLocaleString()}`,
    10,
    290
  );

  return doc;
}

/**
 * Printable HTML document trigger for Supervisor Combined Pending List (A4 Portrait)
 */
export function triggerPrintablePendingWindow(
  pendingList: {
    office: PostOffice;
    lastReportDate?: string;
    missingDates: string[];
  }[],
  selectedDate: string,
  divisionName: string = 'Gujranwala Division'
) {
  const totalMissing = pendingList.reduce(
    (acc, p) => acc + (p.missingDates.length > 0 ? p.missingDates.length : 1),
    0
  );

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pakistan Post - Pending Offices Compliance List (${selectedDate})</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            padding: 10px; 
            color: #000; 
            background: #fff;
            margin: 0;
          }
          .header { 
            text-align: center;
            border-bottom: 2px solid #b91c1c;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header h1 { margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 1px; color: #991b1b; }
          .header h2 { margin: 3px 0 0 0; font-size: 11px; font-weight: 800; }
          .header .title-badge { 
            display: inline-block; 
            font-size: 11.5px; 
            font-weight: 900; 
            border-top: 1px solid #991b1b; 
            border-bottom: 1px solid #991b1b; 
            padding: 2px 14px; 
            margin-top: 6px;
            background: #fee2e2;
            color: #991b1b;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            font-weight: bold;
            border-top: 1px solid #999;
            padding-top: 4px;
            margin-top: 6px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 6px; 
            margin-top: 8px;
            text-align: center; 
            font-size: 9px; 
          }
          .summary-grid div {
            border: 1px solid #b91c1c;
            background: #fef2f2;
            padding: 4px;
          }
          .summary-grid div strong { 
            display: block; 
            font-size: 13px; 
            margin-top: 1px; 
            font-weight: 900;
            color: #991b1b;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9px; 
            margin-top: 10px;
            margin-bottom: 15px; 
          }
          th, td { 
            border: 1px solid #000; 
            padding: 4px 6px; 
          }
          th { 
            background-color: #fee2e2; 
            color: #991b1b;
            font-weight: 800; 
            text-align: left;
            font-size: 8.5px;
            text-transform: uppercase;
          }
          th.num, td.num { text-align: center; }
          .grand-total td { 
            background-color: #fee2e2; 
            font-weight: 900; 
            color: #991b1b;
            border-top: 2px solid #991b1b; 
            border-bottom: 2px solid #991b1b; 
          }
          .date-pill {
            display: inline-block;
            background: #fecaca;
            border: 1px solid #f87171;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 8px;
            font-family: monospace;
            font-weight: bold;
            margin: 1px;
          }
          .signatures { 
            margin-top: 30px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 9.5px; 
            font-weight: bold;
          }
          .sig-line { 
            border-top: 1px solid #000; 
            width: 200px; 
            text-align: center; 
            padding-top: 4px; 
          }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; display: flex; gap: 8px;">
          <button onclick="window.print()" style="background:#991B1B; color:white; border:none; padding:8px 16px; font-weight:bold; cursor:pointer; border-radius:4px; font-size:12px;">🖨️ Print Pending List (A4 Portrait)</button>
        </div>

        <div class="header">
          <h1>PAKISTAN POST</h1>
          <h2>OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}</h2>
          <div>
            <span class="title-badge">PENDING POST OFFICES COMPLIANCE LIST (زیر التواء دفاتر کی تفصیلی فہرست)</span>
          </div>
          <div class="meta-bar">
            <div>DIVISION: <u>${divisionName.toUpperCase()}</u></div>
            <div>TARGET DATE: <u>${formatDatePK(selectedDate)}</u></div>
            <div>GENERATED: <u>${new Date().toLocaleString('en-GB')}</u></div>
          </div>
        </div>

        <div class="summary-grid">
          <div>Pending Post Offices<strong>${pendingList.length}</strong></div>
          <div>Total Missing Reports<strong>${totalMissing}</strong></div>
          <div>Compliance Status<strong>ACTION REQUIRED</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:24px;">#</th>
              <th>Post Office Name</th>
              <th>Postmaster / Incharge Name</th>
              <th>Mobile Number</th>
              <th class="num" style="width:50px;">Pending Count</th>
              <th>Missing Dates (زیر التواء مورخہ جات)</th>
            </tr>
          </thead>
          <tbody>
            ${pendingList
              .map((item, idx) => {
                const datesFormatted =
                  item.missingDates.length > 0
                    ? item.missingDates
                        .map((d) => `<span class="date-pill">${formatDatePK(d)}</span>`)
                        .join(' ')
                    : `<span class="date-pill">${formatDatePK(selectedDate)}</span>`;

                return `
              <tr>
                <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
                <td><strong style="color:#991b1b;">${item.office.name}</strong></td>
                <td>${item.office.postmasterName || 'N/A'}</td>
                <td style="font-family:monospace; font-weight:bold;">${item.office.mobileNumber || '-'}</td>
                <td class="num"><strong style="color:#b91c1c;">${item.missingDates.length > 0 ? item.missingDates.length : 1}</strong></td>
                <td>${datesFormatted}</td>
              </tr>
            `;
              })
              .join('')}
            <tr class="grand-total">
              <td></td>
              <td>TOTAL DEFAULTER OFFICES: ${pendingList.length}</td>
              <td colspan="2"></td>
              <td class="num">${totalMissing}</td>
              <td>All Pending Records Listed Above</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">Prepared By: Compliance Monitor<br><small>${divisionName}</small></div>
          <div class="sig-line">
            <strong>Divisional Superintendent (PS)</strong><br>
            <span>${divisionName}</span>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const printWindow = window.open('', '_blank');
    if (printWindow && !printWindow.closed) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
      return;
    }
  } catch (e) {
    console.warn('Popup blocked, using hidden iframe printing mechanism:', e);
  }

  // Fallback iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (_) {}
      }, 2000);
    }, 400);
  } else {
    window.print();
  }
}

/**
 * Printable HTML document trigger that reliably works in both standard browser windows and iframes (A4 Portrait)
 */
export function triggerPrintableWindow(reports: DailyReport[], dateStr: string, officeName?: string) {
  const totals = summarizeReports(reports);
  const deliveryRate =
    totals.totalReceived > 0
      ? ((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)
      : '0.0';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pakistan Post - Daily Delivery Report (${dateStr})</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, Helvetica, sans-serif; 
            padding: 10px; 
            color: #000; 
            background: #fff;
            margin: 0;
          }
          .header { 
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .header h1 { margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 1px; }
          .header h2 { margin: 3px 0 0 0; font-size: 11px; font-weight: 800; }
          .header .title-badge { 
            display: inline-block; 
            font-size: 12px; 
            font-weight: 900; 
            border-top: 1px solid #000; 
            border-bottom: 1px solid #000; 
            padding: 2px 14px; 
            margin-top: 6px;
            background: #f0f0f0;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            font-size: 9.5px;
            font-weight: bold;
            border-top: 1px solid #999;
            padding-top: 4px;
            margin-top: 6px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(7, 1fr); 
            gap: 4px; 
            margin-top: 8px;
            text-align: center; 
            font-size: 8.5px; 
          }
          .summary-grid div {
            border: 1px solid #000;
            padding: 3px;
          }
          .summary-grid div strong { 
            display: block; 
            font-size: 10px; 
            margin-top: 1px; 
            font-weight: 900;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9px; 
            margin-top: 10px;
            margin-bottom: 15px; 
          }
          th, td { 
            border: 1px solid #000; 
            padding: 4px 5px; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: 800; 
            text-align: left;
            font-size: 8.5px;
            text-transform: uppercase;
          }
          th.num, td.num { text-align: right; }
          .grand-total td { 
            background-color: #e5e5e5; 
            font-weight: 900; 
            border-top: 2px solid #000; 
            border-bottom: 2px solid #000; 
          }
          .signatures { 
            margin-top: 25px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 9.5px; 
            font-weight: bold;
          }
          .sig-line { 
            border-top: 1px solid #000; 
            width: 200px; 
            text-align: center; 
            padding-top: 4px; 
          }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; display: flex; gap: 8px;">
          <button onclick="window.print()" style="background:#00401A; color:white; border:none; padding:8px 16px; font-weight:bold; cursor:pointer; border-radius:4px; font-size:12px;">🖨️ Print Document (A4)</button>
        </div>

        <div class="header">
          <h1>PAKISTAN POST</h1>
          <h2>OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES GUJRANWALA DIVISION</h2>
          <div>
            <span class="title-badge">DAILY DELIVERY REPORT</span>
          </div>
          <div class="meta-bar">
            <div>POST OFFICE: <u>${officeName || 'ALL POST OFFICES (GUJRANWALA DIVISION)'}</u></div>
            <div>DATE / PERIOD: <u>${dateStr}</u></div>
            <div>PRINTED: <u>${new Date().toLocaleDateString('en-GB')}</u></div>
          </div>
        </div>

        <div class="summary-grid">
          <div>Last Bal<strong>${formatNumber(totals.totalLastBalance)}</strong></div>
          <div>Received<strong>${formatNumber(totals.totalReceived)}</strong></div>
          <div>Delivered<strong>${formatNumber(totals.totalDelivered)}</strong></div>
          <div style="background:#f0f0f0;">Deliv %<strong>${deliveryRate}%</strong></div>
          <div>Returned<strong>${formatNumber(totals.totalReturned)}</strong></div>
          <div>Missent<strong>${formatNumber(totals.totalMissent)}</strong></div>
          <div>Deposit<strong>${formatNumber(totals.totalDeposit)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:24px;">#</th>
              <th>Office Name</th>
              <th class="num">Last Bal</th>
              <th class="num">Received</th>
              <th class="num">Delivered</th>
              <th class="num">Deliv %</th>
              <th class="num">Returned</th>
              <th class="num">Missent</th>
              <th class="num">Deposit</th>
            </tr>
          </thead>
          <tbody>
            ${reports
              .map((r, idx) => {
                const rowRate =
                  r.receivedToday > 0
                    ? `${((r.delivered / r.receivedToday) * 100).toFixed(0)}%`
                    : '0%';
                return `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${r.officeName}</strong></td>
                <td class="num">${formatNumber(r.lastBalance)}</td>
                <td class="num">${formatNumber(r.receivedToday)}</td>
                <td class="num">${formatNumber(r.delivered)}</td>
                <td class="num" style="font-weight:bold;">${rowRate}</td>
                <td class="num">${formatNumber(r.returnedToSender)}</td>
                <td class="num">${formatNumber(r.missent)}</td>
                <td class="num">${formatNumber(r.deposit)}</td>
              </tr>
            `;
              })
              .join('')}
            <tr class="grand-total">
              <td></td>
              <td>TOTAL (${reports.length} OFFICES)</td>
              <td class="num">${formatNumber(totals.totalLastBalance)}</td>
              <td class="num">${formatNumber(totals.totalReceived)}</td>
              <td class="num">${formatNumber(totals.totalDelivered)}</td>
              <td class="num">${deliveryRate}%</td>
              <td class="num">${formatNumber(totals.totalReturned)}</td>
              <td class="num">${formatNumber(totals.totalMissent)}</td>
              <td class="num">${formatNumber(totals.totalDeposit)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">Prepared By: In-Charge / Data Operator<br><small>Gujranwala Division</small></div>
          <div class="sig-line">
            <strong>Divisional Superintendent (PS)</strong><br>
            <span>Gujranwala Division</span>
          </div>
        </div>
      </body>
    </html>
  `;

  // First try direct window.print if in same window
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow && !printWindow.closed) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
      return;
    }
  } catch (e) {
    console.warn('Popup blocked, using hidden iframe printing mechanism:', e);
  }

  // Fallback: Use dynamic hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (_) {}
      }, 2000);
    }, 400);
  } else {
    // If iframe fails, trigger window.print()
    window.print();
  }
}

/**
 * Triggers a browser print window for the ALL DATES consolidated report.
 */
export function triggerPrintableAllDatesWindow(
  reports: DailyReport[],
  divisionName: string = 'Gujranwala Division'
) {
  const sortedReports = [...reports].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.officeName.localeCompare(b.officeName);
  });

  const totals = summarizeReports(sortedReports);
  const deliveryRate =
    totals.totalReceived > 0
      ? ((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)
      : '0.0';

  const uniqueDates = Array.from(new Set(sortedReports.map((r) => r.date))).filter(Boolean);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>All Dates Delivery Report - Pakistan Post</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            margin: 0; 
            padding: 10px;
            color: #111; 
            font-size: 8.5px;
            line-height: 1.2;
          }
          .header { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #00401A; padding-bottom: 6px; }
          .header h1 { font-size: 14px; font-weight: 900; margin: 0; color: #00401A; }
          .header h2 { font-size: 9.5px; font-weight: bold; margin: 2px 0; color: #333; }
          .title-badge { 
            display: inline-block; 
            background: #00401A; 
            color: white; 
            font-weight: 800; 
            font-size: 9px; 
            padding: 2px 8px; 
            border-radius: 3px; 
            margin-top: 3px;
          }
          .meta-bar {
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            font-weight: bold;
            border-top: 1px solid #ccc;
            padding-top: 4px;
            margin-top: 6px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(8, 1fr); 
            gap: 3px; 
            margin-top: 6px;
            text-align: center; 
            font-size: 8px; 
          }
          .summary-grid div {
            border: 1px solid #00401A;
            padding: 3px;
            background: #f9fbf9;
          }
          .summary-grid div strong { 
            display: block; 
            font-size: 9.5px; 
            margin-top: 1px; 
            font-weight: 900;
            color: #00401A;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 8px; 
            margin-top: 8px;
            margin-bottom: 12px; 
          }
          th, td { 
            border: 1px solid #999; 
            padding: 3px 4px; 
          }
          th { 
            background-color: #00401A; 
            color: white;
            font-weight: 800; 
            text-align: left;
            font-size: 7.5px;
            text-transform: uppercase;
          }
          th.num, td.num { text-align: right; }
          tr.sunday-row { background-color: #fef9c3; }
          tr.missing-row { background-color: #fee2e2; }
          .grand-total td { 
            background-color: #e1eee4; 
            font-weight: 900; 
            color: #00401A;
            border-top: 2px solid #00401A; 
            border-bottom: 2px solid #00401A; 
          }
          .signatures { 
            margin-top: 20px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 8.5px; 
            font-weight: bold;
          }
          .sig-line { 
            border-top: 1px solid #000; 
            width: 180px; 
            text-align: center; 
            padding-top: 4px; 
          }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 12px; display: flex; gap: 8px;">
          <button onclick="window.print()" style="background:#00401A; color:white; border:none; padding:8px 16px; font-weight:bold; cursor:pointer; border-radius:4px; font-size:12px;">🖨️ Print All Dates (A4 Portrait)</button>
        </div>

        <div class="header">
          <h1>PAKISTAN POST</h1>
          <h2>OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}</h2>
          <div>
            <span class="title-badge">ALL DATES MASTER CONSOLIDATED DELIVERY REPORT</span>
          </div>
          <div class="meta-bar">
            <div>DIVISION: <u>${divisionName.toUpperCase()}</u></div>
            <div>DATES: <u>${uniqueDates.length} DATES (${sortedReports.length} ENTRIES)</u></div>
            <div>PRINTED: <u>${new Date().toLocaleDateString('en-GB')}</u></div>
          </div>
        </div>

        <div class="summary-grid">
          <div>Dates<strong>${uniqueDates.length}</strong></div>
          <div>Records<strong>${sortedReports.length}</strong></div>
          <div>Last Bal<strong>${formatNumber(totals.totalLastBalance)}</strong></div>
          <div>Received<strong>${formatNumber(totals.totalReceived)}</strong></div>
          <div>Delivered<strong>${formatNumber(totals.totalDelivered)}</strong></div>
          <div>Deliv %<strong>${deliveryRate}%</strong></div>
          <div>Returned<strong>${formatNumber(totals.totalReturned)}</strong></div>
          <div>Deposit<strong>${formatNumber(totals.totalDeposit)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:20px;">#</th>
              <th style="width:60px;">Date</th>
              <th>Office Name</th>
              <th class="num" style="width:45px;">Last Bal</th>
              <th class="num" style="width:45px;">Received</th>
              <th class="num" style="width:45px;">Delivered</th>
              <th class="num" style="width:40px;">Deliv %</th>
              <th class="num" style="width:40px;">Returned</th>
              <th class="num" style="width:40px;">Missent</th>
              <th class="num" style="width:45px;">Deposit</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${sortedReports
              .map((r, idx) => {
                const isSun = isSunday(r.date);
                const isNotSubmitted =
                  !isSun &&
                  (r.submittedBy === 'NOT_SUBMITTED' ||
                  r.remarks?.includes('Report not submitted'));

                const rowRate =
                  r.receivedToday > 0
                    ? `${((r.delivered / r.receivedToday) * 100).toFixed(0)}%`
                    : '0%';

                const displayRemarks = isSun
                  ? '<strong style="color:#b45309;">Sunday Holiday</strong>'
                  : isNotSubmitted
                  ? '<strong style="color:#b91c1c;">Pending</strong>'
                  : r.remarks || '-';

                const rowClass = isSun ? 'class="sunday-row"' : isNotSubmitted ? 'class="missing-row"' : '';

                return `
              <tr ${rowClass}>
                <td>${idx + 1}</td>
                <td><strong>${formatDatePK(r.date)}</strong></td>
                <td><strong>${r.officeName}</strong></td>
                <td class="num">${formatNumber(r.lastBalance)}</td>
                <td class="num">${formatNumber(r.receivedToday)}</td>
                <td class="num">${formatNumber(r.delivered)}</td>
                <td class="num" style="font-weight:bold; color:#006633;">${rowRate}</td>
                <td class="num">${formatNumber(r.returnedToSender)}</td>
                <td class="num">${formatNumber(r.missent)}</td>
                <td class="num">${formatNumber(r.deposit)}</td>
                <td>${displayRemarks}</td>
              </tr>
            `;
              })
              .join('')}
            <tr class="grand-total">
              <td></td>
              <td>ALL DATES</td>
              <td>GRAND TOTALS (${sortedReports.length} ENTRIES)</td>
              <td class="num">${formatNumber(totals.totalLastBalance)}</td>
              <td class="num">${formatNumber(totals.totalReceived)}</td>
              <td class="num">${formatNumber(totals.totalDelivered)}</td>
              <td class="num">${deliveryRate}%</td>
              <td class="num">${formatNumber(totals.totalReturned)}</td>
              <td class="num">${formatNumber(totals.totalMissent)}</td>
              <td class="num">${formatNumber(totals.totalDeposit)}</td>
              <td>CONSOLIDATED</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">Prepared By: System Admin / In-Charge<br><small>${divisionName}</small></div>
          <div class="sig-line">
            <strong>Divisional Superintendent (PS)</strong><br>
            <span>${divisionName}</span>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const printWindow = window.open('', '_blank');
    if (printWindow && !printWindow.closed) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 400);
      return;
    }
  } catch (e) {
    console.warn('Popup blocked, using hidden iframe printing mechanism:', e);
  }

  // Fallback: Use dynamic hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (_) {}
      }, 2000);
    }, 400);
  } else {
    window.print();
  }
}

