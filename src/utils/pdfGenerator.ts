import jsPDF from 'jspdf';

import { DailyReport } from '../types';
import { formatDatePK, formatNumber, summarizeReports } from './calculations';

export function generateDailyReportPDF(
  reports: DailyReport[],
  reportDate: string,
  divisionName: string = 'Gujranwala Division',
  customTitle?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const totals = summarizeReports(reports);
  const deliveryRate =
    totals.totalReceived > 0
      ? ((totals.totalDelivered / totals.totalReceived) * 100).toFixed(1)
      : '0.0';

  // Header Colors: Dark Green #00401A / #006633, Gold Accent #D4AF37
  doc.setFillColor(0, 64, 26); // Pakistan Post Dark Green
  doc.rect(0, 0, 297, 24, 'F');

  // Gold Stripe
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 24, 297, 2, 'F');

  // Title Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(customTitle || 'PAKISTAN POST - DAILY DELIVERY REPORT', 14, 11);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}`,
    14,
    18
  );

  // Date Badge Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const dateLabel = reportDate.includes('TO') || reportDate.includes('FROM')
    ? reportDate
    : `DATE: ${formatDatePK(reportDate)}`;
  doc.text(dateLabel, 283, 14, { align: 'right' });

  // Summary Banner Card
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 248, 245);
  doc.roundedRect(14, 29, 269, 16, 2, 2, 'FD');

  doc.setTextColor(0, 102, 51);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');

  const bannerY = 39;
  doc.text(`Reports: ${reports.length}`, 18, bannerY);
  doc.text(`Last Bal: ${formatNumber(totals.totalLastBalance)}`, 48, bannerY);
  doc.text(`Received: ${formatNumber(totals.totalReceived)}`, 85, bannerY);
  doc.text(`Delivered: ${formatNumber(totals.totalDelivered)}`, 125, bannerY);
  doc.text(`Deliv %: ${deliveryRate}%`, 165, bannerY);
  doc.text(`Returned: ${formatNumber(totals.totalReturned)}`, 198, bannerY);
  doc.text(`Missent: ${formatNumber(totals.totalMissent)}`, 232, bannerY);
  doc.text(`Deposit: ${formatNumber(totals.totalDeposit)}`, 260, bannerY);

  // Table Headers
  const startY = 48;
  const colWidths = [10, 48, 20, 22, 22, 18, 22, 20, 20, 67];
  const headers = [
    'S#',
    'Office Name',
    'Last Bal',
    'Received',
    'Delivered',
    'Deliv %',
    'Returned',
    'Missent',
    'Deposit',
    'Remarks / Status',
  ];

  doc.setFillColor(0, 64, 26);
  doc.rect(14, startY, 269, 7.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  let currentX = 14;
  headers.forEach((h, idx) => {
    const align = idx >= 2 && idx <= 8 ? 'right' : 'left';
    const textX = align === 'right' ? currentX + colWidths[idx] - 2 : currentX + 2;
    doc.text(h, textX, startY + 5, { align });
    currentX += colWidths[idx];
  });

  // Table Rows
  let currentY = startY + 7.5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(7.5);

  reports.forEach((rep, index) => {
    // Page overflow check
    if (currentY > 172) {
      doc.addPage();
      currentY = 16;
    }

    const isNotSubmitted =
      rep.submittedBy === 'NOT_SUBMITTED' ||
      rep.remarks?.includes('Report not submitted');

    const rowRate =
      rep.receivedToday > 0
        ? `${((rep.delivered / rep.receivedToday) * 100).toFixed(0)}%`
        : '0%';

    // Row background
    if (isNotSubmitted) {
      doc.setFillColor(254, 242, 242); // light red
      doc.rect(14, currentY, 269, 6.5, 'F');
    } else if (index % 2 === 1) {
      doc.setFillColor(248, 250, 248);
      doc.rect(14, currentY, 269, 6.5, 'F');
    }

    // Row border bottom
    doc.setDrawColor(220, 220, 220);
    doc.line(14, currentY + 6.5, 283, currentY + 6.5);

    let xPos = 14;
    const rowData = [
      (index + 1).toString(),
      rep.officeName,
      formatNumber(rep.lastBalance),
      formatNumber(rep.receivedToday),
      formatNumber(rep.delivered),
      rowRate,
      formatNumber(rep.returnedToSender),
      formatNumber(rep.missent),
      formatNumber(rep.deposit),
      isNotSubmitted ? 'Report not submitted till 5 PM' : (rep.remarks || '-'),
    ];

    rowData.forEach((val, colIdx) => {
      const align = colIdx >= 2 && colIdx <= 8 ? 'right' : 'left';
      const textX = align === 'right' ? xPos + colWidths[colIdx] - 2 : xPos + 2;

      if (isNotSubmitted && colIdx === 9) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
      } else if (colIdx === 5) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 102, 51);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
      }

      doc.text(val, textX, currentY + 4.5, { align });
      xPos += colWidths[colIdx];
    });

    currentY += 6.5;
  });

  // Grand Totals Row
  doc.setFillColor(225, 238, 228);
  doc.rect(14, currentY, 269, 7.5, 'F');
  doc.setDrawColor(0, 64, 26);
  doc.rect(14, currentY, 269, 7.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 64, 26);

  let xTot = 14;
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
    const textX = align === 'right' ? xTot + colWidths[colIdx] - 2 : xTot + 2;
    doc.text(val, textX, currentY + 5, { align });
    xTot += colWidths[colIdx];
  });

  // Signature Section
  const sigY = Math.min(currentY + 18, 186);

  doc.setDrawColor(120, 120, 120);
  doc.line(20, sigY, 80, sigY);
  doc.line(200, sigY, 270, sigY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  doc.text('Prepared By: System Admin / In-Charge', 20, sigY + 4);
  doc.text('Divisional Superintendent Postal Services', 200, sigY + 4);
  doc.text('Pakistan Post, Gujranwala Division', 200, sigY + 8);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated via Pakistan Post Daily Delivery System | Gujranwala Division | ${new Date().toLocaleString()}`,
    14,
    202
  );

  return doc;
}

/**
 * Printable HTML document trigger that reliably works in both standard browser windows and iframes
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
            Divisional Superintendent Postal Services<br>
            <small>Pakistan Post, Gujranwala Division</small>
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

