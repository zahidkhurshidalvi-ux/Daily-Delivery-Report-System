import jsPDF from 'jspdf';

import { DailyReport } from '../types';
import { formatDatePK, formatNumber, summarizeReports } from './calculations';

export function generateDailyReportPDF(
  reports: DailyReport[],
  reportDate: string,
  divisionName: string = 'Gujranwala Division'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const totals = summarizeReports(reports);

  // Header Colors: Dark Green #006633, Gold Accent #D4AF37
  doc.setFillColor(0, 102, 51); // Pakistan Post Green
  doc.rect(0, 0, 297, 24, 'F');

  // Gold Stripe
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 24, 297, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PAKISTAN POST - DAILY DELIVERY REPORT', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${divisionName.toUpperCase()}`, 14, 18);

  // Date Badge Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`DATE: ${formatDatePK(reportDate)}`, 283, 14, { align: 'right' });

  // Summary Banner Card
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 248, 245);
  doc.roundedRect(14, 30, 269, 18, 2, 2, 'FD');

  doc.setTextColor(0, 102, 51);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  const bannerY = 38;
  doc.text(`Total Offices: ${reports.length}`, 20, bannerY);
  doc.text(`Last Bal: ${formatNumber(totals.totalLastBalance)}`, 55, bannerY);
  doc.text(`Received: ${formatNumber(totals.totalReceived)}`, 95, bannerY);
  doc.text(`Delivered: ${formatNumber(totals.totalDelivered)}`, 135, bannerY);
  doc.text(`Returned: ${formatNumber(totals.totalReturned)}`, 175, bannerY);
  doc.text(`Missent: ${formatNumber(totals.totalMissent)}`, 215, bannerY);
  doc.text(`Deposit: ${formatNumber(totals.totalDeposit)}`, 248, bannerY);

  // Table Headers
  const startY = 54;
  const colWidths = [12, 48, 22, 23, 23, 23, 23, 23, 72];
  const headers = [
    'S#',
    'Office Name',
    'Last Bal',
    'Received',
    'Delivered',
    'Returned',
    'Missent',
    'Deposit',
    'Remarks',
  ];

  doc.setFillColor(0, 102, 51);
  doc.rect(14, startY, 269, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');

  let currentX = 14;
  headers.forEach((h, idx) => {
    const align = idx >= 2 && idx <= 7 ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidths[idx] - 2 : currentX + 2;
    doc.text(h, textX, startY + 5.5, { align });
    currentX += colWidths[idx];
  });

  // Table Rows
  let currentY = startY + 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);

  reports.forEach((rep, index) => {
    // Page overflow check
    if (currentY > 170) {
      doc.addPage();
      currentY = 20;
    }

    const isNotSubmitted = rep.submittedBy === 'NOT_SUBMITTED' || rep.remarks?.includes('Report not submitted');

    // Row background
    if (isNotSubmitted) {
      doc.setFillColor(254, 242, 242); // light red
      doc.rect(14, currentY, 269, 7, 'F');
    } else if (index % 2 === 1) {
      doc.setFillColor(248, 250, 248);
      doc.rect(14, currentY, 269, 7, 'F');
    }

    // Row border bottom
    doc.setDrawColor(230, 230, 230);
    doc.line(14, currentY + 7, 283, currentY + 7);

    let xPos = 14;
    const rowData = [
      (index + 1).toString(),
      rep.officeName,
      formatNumber(rep.lastBalance),
      formatNumber(rep.receivedToday),
      formatNumber(rep.delivered),
      formatNumber(rep.returnedToSender),
      formatNumber(rep.missent),
      formatNumber(rep.deposit),
      isNotSubmitted ? 'Report not submitted till 5 PM' : (rep.remarks || '-'),
    ];

    rowData.forEach((val, colIdx) => {
      const align = colIdx >= 2 && colIdx <= 7 ? 'right' : 'left';
      const textX = align === 'right' ? xPos + colWidths[colIdx] - 2 : xPos + 2;

      if (isNotSubmitted && colIdx === 8) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28); // red color for unsubmitted
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }

      doc.text(val, textX, currentY + 5, { align });
      xPos += colWidths[colIdx];
    });

    currentY += 7;
  });

  // Grand Totals Row
  doc.setFillColor(225, 238, 228);
  doc.rect(14, currentY, 269, 8, 'F');
  doc.setDrawColor(0, 102, 51);
  doc.rect(14, currentY, 269, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 102, 51);

  let xTot = 14;
  const totalsRowData = [
    '',
    'GRAND TOTALS',
    formatNumber(totals.totalLastBalance),
    formatNumber(totals.totalReceived),
    formatNumber(totals.totalDelivered),
    formatNumber(totals.totalReturned),
    formatNumber(totals.totalMissent),
    formatNumber(totals.totalDeposit),
    '',
  ];

  totalsRowData.forEach((val, colIdx) => {
    const align = colIdx >= 2 && colIdx <= 7 ? 'right' : 'left';
    const textX = align === 'right' ? xTot + colWidths[colIdx] - 2 : xTot + 2;
    doc.text(val, textX, currentY + 5.5, { align });
    xTot += colWidths[colIdx];
  });

  // Signature Section
  const sigY = Math.min(currentY + 22, 185);

  doc.setDrawColor(120, 120, 120);
  doc.line(20, sigY, 80, sigY);
  doc.line(200, sigY, 270, sigY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Prepared By: System Admin / In-Charge', 20, sigY + 5);
  doc.text('Divisional Superintendent Postal Services', 200, sigY + 5);
  doc.text('Pakistan Post, Gujranwala Division', 200, sigY + 9);

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated via Pakistan Post Daily Delivery System | ${new Date().toLocaleString()}`,
    14,
    202
  );

  return doc;
}

/**
 * Printable HTML document popover/trigger
 */
export function triggerPrintableWindow(reports: DailyReport[], dateStr: string) {
  const totals = summarizeReports(reports);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pakistan Post - Daily Delivery Report (${dateStr})</title>

        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #1a1a1a; }
          .header { background: #006633; color: white; padding: 15px 20px; border-bottom: 3px solid #D4AF37; margin-bottom: 20px; border-radius: 4px; }
          .header h1 { margin: 0; font-size: 20px; }
          .header p { margin: 5px 0 0 0; font-size: 13px; opacity: 0.9; }
          .summary-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; background: #f4f8f4; padding: 12px; border: 1px solid #d0e0d0; border-radius: 6px; margin-bottom: 20px; text-align: center; font-size: 11px; }
          .summary-grid div strong { display: block; color: #006633; font-size: 13px; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }
          th { background-color: #006633; color: white; text-align: left; padding: 8px 6px; font-weight: 600; }
          th.num, td.num { text-align: right; }
          td { padding: 6px; border-bottom: 1px solid #e0e0e0; }
          tr:nth-child(even) { background-color: #f9fbf9; }
          .grand-total { background-color: #e1eee4 !important; font-weight: bold; border-top: 2px solid #006633; border-bottom: 2px solid #006633; color: #006633; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; padding: 0 20px; }
          .sig-line { border-top: 1px solid #666; width: 220px; text-align: center; padding-top: 5px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px;">
          <button onclick="window.print()" style="background:#006633; color:white; border:none; padding:10px 20px; font-weight:bold; cursor:pointer; border-radius:4px;">🖨️ Print Document</button>
        </div>

        <div class="header">
          <h1>PAKISTAN POST - DAILY DELIVERY REPORT</h1>
          <p>GUJRANWALA DIVISION | DATE: ${formatDatePK(dateStr)}</p>
        </div>

        <div class="summary-grid" style="grid-template-columns: repeat(7, 1fr);">
          <div>Offices<strong>${reports.length}</strong></div>
          <div>Last Bal<strong>${formatNumber(totals.totalLastBalance)}</strong></div>
          <div>Received<strong>${formatNumber(totals.totalReceived)}</strong></div>
          <div>Delivered<strong>${formatNumber(totals.totalDelivered)}</strong></div>
          <div>Returned<strong>${formatNumber(totals.totalReturned)}</strong></div>
          <div>Missent<strong>${formatNumber(totals.totalMissent)}</strong></div>
          <div>Deposit<strong>${formatNumber(totals.totalDeposit)}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Office Name</th>
              <th class="num">Last Bal</th>
              <th class="num">Received</th>
              <th class="num">Delivered</th>
              <th class="num">Returned</th>
              <th class="num">Missent</th>
              <th class="num">Deposit</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${reports
              .map(
                (r, idx) => {
                  const isMissing = r.submittedBy === 'NOT_SUBMITTED' || r.remarks?.includes('Report not submitted');
                  return `
              <tr style="${isMissing ? 'background-color: #fef2f2;' : ''}">
                <td>${idx + 1}</td>
                <td><strong>${r.officeName}</strong></td>
                <td class="num">${formatNumber(r.lastBalance)}</td>
                <td class="num">${formatNumber(r.receivedToday)}</td>
                <td class="num">${formatNumber(r.delivered)}</td>
                <td class="num">${formatNumber(r.returnedToSender)}</td>
                <td class="num">${formatNumber(r.missent)}</td>
                <td class="num">${formatNumber(r.deposit)}</td>
                <td style="${isMissing ? 'color: #b91c1c; font-weight: bold;' : ''}">${isMissing ? 'Report not submitted till 5 PM' : (r.remarks || '-')}</td>
              </tr>
            `;
                }
              )
              .join('')}
            <tr class="grand-total">
              <td></td>
              <td>GRAND TOTALS</td>
              <td class="num">${formatNumber(totals.totalLastBalance)}</td>
              <td class="num">${formatNumber(totals.totalReceived)}</td>
              <td class="num">${formatNumber(totals.totalDelivered)}</td>
              <td class="num">${formatNumber(totals.totalReturned)}</td>
              <td class="num">${formatNumber(totals.totalMissent)}</td>
              <td class="num">${formatNumber(totals.totalDeposit)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-line">In-Charge / Reporting Officer</div>
          <div class="sig-line">
            Divisional Superintendent Postal Services<br>
            <small>Pakistan Post, Gujranwala Division</small>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
