import React, { useState, useEffect, useRef } from 'react';
import { PostOffice, DailyReport, User } from '../types';
import {
  formatDatePK,
  getTodayDateString,
  cleanAndFilterPostOffices,
  cleanAndFilterReports,
  getMissingDatesForOffice,
} from '../utils/calculations';
import {
  Download,
  Printer,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  Eye,
  Filter,
  Layers,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react';
import jsPDF from 'jspdf';

interface IssueExplanationProps {
  postOffices: PostOffice[];
  reports: DailyReport[];
  selectedDate: string;
  currentUser: User | null;
  onLogAction?: (action: string, details: string) => void;
}

export const IssueExplanation: React.FC<IssueExplanationProps> = ({
  postOffices,
  reports,
  selectedDate,
  currentUser,
  onLogAction,
}) => {
  const activeOffices = cleanAndFilterPostOffices(postOffices).filter(
    (p) => p.status === 'ACTIVE'
  );
  const cleanReports = cleanAndFilterReports(reports);

  // Target evaluation date (defaults to selectedDate or today)
  const [targetDate, setTargetDate] = useState<string>(
    selectedDate || getTodayDateString()
  );

  // Search & Filter in list
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(true);

  // Selected office for detailed editing & live preview
  const [selectedOfficeName, setSelectedOfficeName] = useState<string>(
    activeOffices[0]?.name || ''
  );

  const currentOffice =
    activeOffices.find((po) => po.name === selectedOfficeName) || activeOffices[0];

  // Editable Letter Fields
  const [postmasterName, setPostmasterName] = useState<string>('');
  const [honorific, setHonorific] = useState<'Mr.' | 'Miss' | 'Mrs.'>('Mr.');
  const [refNumber, setRefNumber] = useState<string>(
    `No. Staff/Exp-Delivery/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [issueDate, setIssueDate] = useState<string>(getTodayDateString());
  const [timeToReplyDays, setTimeToReplyDays] = useState<number>(3);
  const [divisionName, setDivisionName] = useState<string>('Gujranwala Division');

  // Signature image option (optional custom image upload)
  const [signatureImage, setSignatureImage] = useState<string | null>(() => {
    return localStorage.getItem('pakpost_admin_signature') || null;
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calculate missing dates for an office up to targetDate (EXCLUDING SUNDAYS)
  const getOfficePendingDates = (officeName: string): string[] => {
    return getMissingDatesForOffice(officeName, targetDate, cleanReports);
  };

  // Missing dates for currently selected office
  const [selectedMissingDates, setSelectedMissingDates] = useState<string[]>([]);

  // Update postmaster and missing dates when office or targetDate changes
  useEffect(() => {
    if (currentOffice) {
      setPostmasterName(currentOffice.postmasterName || 'Postmaster');
      const missing = getOfficePendingDates(currentOffice.name);
      setSelectedMissingDates(missing);
    }
  }, [selectedOfficeName, targetDate, postOffices, reports]);

  // Handle signature upload
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setSignatureImage(base64);
      localStorage.setItem('pakpost_admin_signature', base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setSignatureImage(null);
    localStorage.removeItem('pakpost_admin_signature');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Standard, clean official body wording
  const generateLetterBody = (dates: string[], days: number = timeToReplyDays) => {
    const datesStr =
      dates.length > 0
        ? dates.map((d, i) => `   ${i + 1}. ${formatDatePK(d)}`).join('\n')
        : `   1. ${formatDatePK(targetDate)}`;

    return `You have not submitted the Daily Delivery Report of your Post Office for the following date(s) (excluding Sunday holiday):

${datesStr}

You are directed to submit your written explanation within ${days} days from the receipt of this letter, explaining the reasons for not submitting the report on time.

In case of failure to submit the explanation within the stipulated time, disciplinary action will be taken against you under the rules.`;
  };

  // Helper to construct a single doc's jsPDF content
  const buildPdfDocForOffice = (
    doc: jsPDF,
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const pmName = customPmName || office.postmasterName || 'Postmaster';
    const dates = missingDates.length > 0 ? missingDates : [targetDate];

    // Standard Official A4 Header
    // 1. Header Banner - Clean Official Government Styling
    doc.setFillColor(0, 64, 26);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 20, 210, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PAKISTAN POST', 105, 8.5, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}`,
      105,
      15,
      { align: 'center' }
    );

    // Reference & Date Line
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(refNumber, 20, 32);
    doc.text(`Dated: ${formatDatePK(issueDate)}`, 190, 32, { align: 'right' });

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.line(20, 35, 190, 35);

    // 2. Addressee Block (Format: To, The Mr./Miss [Name], Postmaster, [Office] Post Office, Gujranwala Division)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('To,', 20, 43);

    doc.text(`The ${honorific} ${pmName},`, 26, 49);
    doc.text(`Postmaster,`, 26, 54.5);
    doc.text(`${office.name} Post Office,`, 26, 60);
    doc.text(`${divisionName}.`, 26, 65.5);

    // 3. Subject Box - Clean "SUBJECT: EXPLANATION"
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.3);
    doc.roundedRect(20, 71, 170, 10, 1.5, 1.5, 'FD');

    doc.setTextColor(185, 28, 28);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBJECT:', 24, 77.5);
    doc.setTextColor(153, 27, 27);
    doc.text('EXPLANATION', 48, 77.5);

    // 4. Main Simple Letter Body
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    let curY = 90;
    const bodyContent = generateLetterBody(dates, timeToReplyDays);
    const bodyParagraphs = bodyContent.split('\n\n');

    bodyParagraphs.forEach((para) => {
      const lines = doc.splitTextToSize(para.trim(), 170);
      doc.text(lines, 20, curY);
      curY += lines.length * 5.2 + 4;
    });

    // 5. Signature Section (Placed with compact, natural spacing immediately after body)
    const bottomY = curY + 12;

    if (signatureImage) {
      try {
        doc.addImage(signatureImage, 'PNG', 135, bottomY - 12, 42, 12);
      } catch (_) {}
    }

    // Standard Official Designation & Office
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 64, 26);
    doc.text(
      'Divisional Superintendent (PS)',
      155,
      bottomY,
      { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(divisionName, 155, bottomY + 4.5, {
      align: 'center',
    });

    // 6. Copy to Endorsement: "Copy to Assistant Superintendent Postal Service"
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Copy forwarded for information and necessary compliance to:', 20, bottomY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(`1. The Assistant Superintendent Postal Services concerned.`, 24, bottomY + 20.5);
    doc.text(`2. Office record / Staff Personal File.`, 24, bottomY + 25.5);
  };

  // Generate Standard Printable A4 PDF for single office
  const generatePDFForOffice = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    buildPdfDocForOffice(doc, office, missingDates, customPmName);

    doc.save(
      `Pakistan_Post_Explanation_${office.name.replace(/\s+/g, '_')}_${issueDate}.pdf`
    );

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_LETTER_PDF',
        `Generated Explanation PDF for ${office.name} (Postmaster: ${customPmName || office.postmasterName})`
      );
    }
  };

  // Generate Combined PDF for ALL Pending Offices (One page per office)
  const generateAllPDFs = () => {
    const pendingList = officeEntries.filter((item) => item.pendingCount > 0);
    if (pendingList.length === 0) {
      alert('No pending offices found to generate explanation letters.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    pendingList.forEach((item, index) => {
      if (index > 0) {
        doc.addPage('a4', 'portrait');
      }
      buildPdfDocForOffice(doc, item.office, item.pendingDates);
    });

    doc.save(`Pakistan_Post_ALL_Explanations_${issueDate}.pdf`);

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_ALL_PDF',
        `Generated Combined Explanation PDF for ${pendingList.length} pending sub-offices`
      );
    }
  };

  // Construct Word Document HTML for an office
  const buildWordHtml = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const pmName = customPmName || office.postmasterName || 'Postmaster';
    const dates = missingDates.length > 0 ? missingDates : [targetDate];
    const bodyContent = generateLetterBody(dates, timeToReplyDays);

    return `
      <div class="header-title">PAKISTAN POST</div>
      <div class="sub-header">OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}</div>

      <table class="ref-table">
        <tr>
          <td style="font-weight:bold;">${refNumber}</td>
          <td style="text-align:right; font-weight:bold;">Dated: ${formatDatePK(issueDate)}</td>
        </tr>
      </table>

      <div class="to-block">
        <strong>To,</strong><br>
        <strong>The ${honorific} ${pmName},</strong><br>
        Postmaster,<br>
        <strong>${office.name} Post Office</strong>,<br>
        ${divisionName}.
      </div>

      <div class="subject-box">
        SUBJECT: EXPLANATION
      </div>

      <div class="content-p">
        ${bodyContent.replace(/\n\n/g, '</div><div class="content-p">').replace(/\n/g, '<br>')}
      </div>

      <table class="sig-table">
        <tr>
          <td style="width:50%;"></td>
          <td style="width:50%; text-align:center; vertical-align:bottom;">
            <div style="width:260px; margin:0 auto;">
              <strong style="color:#00401A; font-size:11pt;">Divisional Superintendent (PS)</strong><br>
              <div style="color:#333333; font-size:10pt; font-weight:bold; margin-top:2px;">${divisionName}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="margin-top:24px; font-size:9.5pt;">
        <strong>Copy forwarded for information and necessary compliance to:</strong><br>
        1. The Assistant Superintendent Postal Services concerned.<br>
        2. Office record / Staff Personal File.
      </div>
    `;
  };

  // Generate Standard Printable Word Document (.doc format) for single office
  const generateWordForOffice = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const wordBody = buildWordHtml(office, missingDates, customPmName);
    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Pakistan Post - Explanation Letter</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4 portrait;
            margin: 20mm;
          }
          body {
            font-family: Arial, 'Times New Roman', Calibri, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #000000;
          }
          .header-title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            color: #00401A;
            margin-bottom: 2px;
          }
          .sub-header {
            text-align: center;
            font-size: 10pt;
            font-weight: bold;
            color: #333333;
            border-bottom: 2px solid #00401A;
            padding-bottom: 5px;
            margin-bottom: 16px;
          }
          .ref-table {
            width: 100%;
            margin-bottom: 16px;
          }
          .to-block {
            margin-bottom: 16px;
            font-size: 11pt;
          }
          .subject-box {
            background-color: #fef2f2;
            border: 1px solid #dc2626;
            padding: 7px 12px;
            font-weight: bold;
            color: #991b1b;
            margin-bottom: 16px;
          }
          .content-p {
            margin-bottom: 12px;
            text-align: justify;
          }
          .sig-table {
            width: 100%;
            margin-top: 25px;
          }
        </style>
      </head>
      <body>
        ${wordBody}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pakistan_Post_Explanation_${office.name.replace(/\s+/g, '_')}_${issueDate}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_LETTER_DOC',
        `Generated Word Explanation document for ${office.name}`
      );
    }
  };

  // Generate Combined Word Document for ALL Pending Offices
  const generateAllWord = () => {
    const pendingList = officeEntries.filter((item) => item.pendingCount > 0);
    if (pendingList.length === 0) {
      alert('No pending offices found to generate explanation letters.');
      return;
    }

    const pagesHtml = pendingList
      .map((item, index) => {
        const pageContent = buildWordHtml(item.office, item.pendingDates);
        return `
          <div class="office-page" style="${index > 0 ? 'page-break-before: always;' : ''}">
            ${pageContent}
          </div>
        `;
      })
      .join('\n<hr style="page-break-before: always; visibility: hidden; clear: both;" />\n');

    const wordContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Pakistan Post - All Explanation Letters</title>
        <meta charset="utf-8">
        <style>
          @page Section1 {
            size: A4 portrait;
            margin: 20mm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          body {
            font-family: Arial, 'Times New Roman', Calibri, sans-serif;
            font-size: 11pt;
            line-height: 1.45;
            color: #000000;
          }
          .header-title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            color: #00401A;
            margin-bottom: 2px;
          }
          .sub-header {
            text-align: center;
            font-size: 10pt;
            font-weight: bold;
            color: #333333;
            border-bottom: 2px solid #00401A;
            padding-bottom: 5px;
            margin-bottom: 16px;
          }
          .ref-table {
            width: 100%;
            margin-bottom: 16px;
          }
          .to-block {
            margin-bottom: 16px;
            font-size: 11pt;
          }
          .subject-box {
            background-color: #fef2f2;
            border: 1px solid #dc2626;
            padding: 7px 12px;
            font-weight: bold;
            color: #991b1b;
            margin-bottom: 16px;
          }
          .content-p {
            margin-bottom: 12px;
            text-align: justify;
          }
          .sig-table {
            width: 100%;
            margin-top: 25px;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          ${pagesHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', wordContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pakistan_Post_ALL_Explanations_${issueDate}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_ALL_WORD',
        `Generated Combined Word Explanation document for ${pendingList.length} pending sub-offices`
      );
    }
  };

  // Helper to build clean printable HTML block for single letter
  const buildPrintLetterHtml = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const pmName = customPmName || office.postmasterName || 'Postmaster';
    const dates = missingDates.length > 0 ? missingDates : [targetDate];
    const datesList = dates
      .map((d, i) => `<div>${i + 1}. ${formatDatePK(d)}</div>`)
      .join('');

    return `
      <div class="letter-sheet">
        <div>
          <div class="letter-header">
            <div class="brand-title">PAKISTAN POST</div>
            <div class="brand-sub">OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}</div>
          </div>

          <div class="ref-row">
            <div>${refNumber}</div>
            <div>Dated: ${formatDatePK(issueDate)}</div>
          </div>

          <div class="to-section">
            <strong>To,</strong><br>
            <div style="margin-left: 16px; margin-top: 4px;">
              <strong>The ${honorific} ${pmName},</strong><br>
              Postmaster,<br>
              <strong>${office.name} Post Office</strong>,<br>
              ${divisionName}.
            </div>
          </div>

          <div class="subject-tag">
            SUBJECT: <u>EXPLANATION</u>
          </div>

          <div class="letter-p">
            You have not submitted the Daily Delivery Report of your Post Office for the following date(s) (excluding Sunday holiday):
          </div>

          <div class="dates-callout">
            ${datesList}
          </div>

          <div class="letter-p">
            You are directed to submit your written explanation within <strong>${timeToReplyDays} days</strong> from the receipt of this letter, explaining the reasons for not submitting the report on time.
          </div>

          <div class="letter-p">
            In case of failure to submit the explanation within the stipulated time, disciplinary action will be taken against you under the rules.
          </div>
        </div>

        <div>
          <div class="signature-container">
            <div class="signature-box">
              ${signatureImage ? `<div style="height:36px; display:flex; align-items:center; justify-content:center; margin-bottom:4px;"><img src="${signatureImage}" style="max-height:36px; max-width:180px; object-fit:contain;" /></div>` : ''}
              <div class="sig-name">Divisional Superintendent (PS)</div>
              <div class="sig-dept">${divisionName}</div>
            </div>
          </div>

          <div class="cc-block">
            <strong>Copy forwarded for information and necessary compliance to:</strong><br>
            1. The Assistant Superintendent Postal Services concerned.<br>
            2. Office record / Staff Personal File.
          </div>
        </div>
      </div>
    `;
  };

  // Dedicated Print Function using clean print window
  const printLettersInWindow = (htmlBody: string, title: string) => {
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      alert('Please allow popups to open the standard printable view.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 20mm;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page-break { page-break-after: always; break-after: page; }
            }
            body {
              font-family: Arial, Helvetica, 'Times New Roman', sans-serif;
              font-size: 11pt;
              line-height: 1.45;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .letter-sheet {
              max-width: 170mm;
              margin: 0 auto;
              min-height: 245mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 6mm 0;
              box-sizing: border-box;
            }
            .letter-header {
              text-align: center;
              border-bottom: 2.5px solid #00401A;
              padding-bottom: 8px;
              margin-bottom: 16px;
            }
            .brand-title {
              font-size: 17pt;
              font-weight: 900;
              color: #00401A;
              letter-spacing: 2px;
              margin: 0;
            }
            .brand-sub {
              font-size: 9.5pt;
              font-weight: bold;
              color: #333;
              margin-top: 4px;
            }
            .ref-row {
              display: flex;
              justify-content: space-between;
              font-size: 10pt;
              font-weight: bold;
              border-bottom: 1px solid #ccc;
              padding-bottom: 6px;
              margin-bottom: 16px;
            }
            .to-section {
              margin-bottom: 16px;
              font-size: 11pt;
              line-height: 1.4;
            }
            .subject-tag {
              background-color: #fef2f2;
              border: 1.5px solid #dc2626;
              padding: 6px 12px;
              font-weight: bold;
              color: #991b1b;
              margin-bottom: 16px;
              border-radius: 4px;
            }
            .letter-p {
              font-size: 10.5pt;
              text-align: justify;
              line-height: 1.5;
              margin-bottom: 12px;
            }
            .dates-callout {
              background-color: #f8fafc;
              border-left: 4px solid #dc2626;
              padding: 8px 14px;
              margin: 12px 0;
              font-family: monospace;
              font-weight: bold;
              color: #991b1b;
              font-size: 10.5pt;
            }
            .signature-container {
              margin-top: 25px;
              display: flex;
              justify-content: flex-end;
            }
            .signature-box {
              text-align: center;
              width: 260px;
            }
            .sig-name {
              font-weight: bold;
              font-size: 11pt;
              color: #00401A;
              margin-bottom: 2px;
            }
            .sig-dept {
              font-size: 9.5pt;
              font-weight: bold;
              color: #333333;
            }
            .cc-block {
              margin-top: 24px;
              border-top: 1px solid #ddd;
              padding-top: 10px;
              font-size: 9pt;
              color: #444;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          ${htmlBody}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Direct Standard Print for single office
  const handlePrintSingleOffice = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const html = buildPrintLetterHtml(office, missingDates, customPmName);
    printLettersInWindow(html, `Explanation_${office.name}_${issueDate}`);

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_PRINT_SINGLE',
        `Printed Explanation Letter for ${office.name}`
      );
    }
  };

  // Direct Standard Print for ALL Pending Offices at once
  const handlePrintAllPending = () => {
    const pendingList = officeEntries.filter((item) => item.pendingCount > 0);
    if (pendingList.length === 0) {
      alert('No pending offices found to print explanation letters.');
      return;
    }

    const combinedHtml = pendingList
      .map((item, index) => {
        const letterHtml = buildPrintLetterHtml(item.office, item.pendingDates);
        return `
          <div class="${index < pendingList.length - 1 ? 'page-break' : ''}">
            ${letterHtml}
          </div>
        `;
      })
      .join('\n');

    printLettersInWindow(
      combinedHtml,
      `Pakistan_Post_ALL_Explanations_${issueDate}`
    );

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_PRINT_ALL',
        `Triggered Print All Explanation Letters for ${pendingList.length} pending sub-offices`
      );
    }
  };

  // Send WhatsApp Explanation Message to Postmaster
  const handleWhatsAppSend = (
    office: PostOffice,
    missingDates: string[],
    customPmName?: string
  ) => {
    const pmName = customPmName || office.postmasterName || 'Postmaster';
    const dates = missingDates.length > 0 ? missingDates : [targetDate];
    const datesFormatted = dates.map((d, i) => `   ${i + 1}. ${formatDatePK(d)}`).join('\n');

    const message = `*🇵🇰 PAKISTAN POST - EXPLANATION NOTICE*
*OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES ${divisionName.toUpperCase()}*

*Ref No:* ${refNumber}
*Dated:* ${formatDatePK(issueDate)}

*To:*
*The ${honorific} ${pmName}*
Postmaster, *${office.name} Post Office*, ${divisionName}

*SUBJECT: EXPLANATION (استفسار برائے عدم ارسال رپورٹ)*

محترم پوسٹ ماسٹر صاحب،
آپ نے مندرجہ ذیل مورخہ جات کی Daily Delivery Report تاحال جمع نہیں کروائی:

${datesFormatted}

آپ کو ہدایت کی جاتی ہے کہ یہ نوٹس موصول ہونے کے *${timeToReplyDays} دن* کے اندر اپنی تحریری وضاحت (Written Explanation) پیش کریں کہ رپورٹ بروقت کیوں نہیں جمع کروائی گئی۔

بروقت تسلی بخش جواب نہ ملنے کی صورت میں قواعد کے مطابق تادیبی کارروائی عمل میں لائی جائے گی۔

*Divisional Superintendent (PS)*
${divisionName}`;

    let mobile = (office.mobileNumber || '').replace(/\D/g, '');
    if (mobile.startsWith('0')) {
      mobile = '92' + mobile.substring(1);
    }

    const url = mobile
      ? `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');

    if (onLogAction) {
      onLogAction(
        'EXPLANATION_WHATSAPP',
        `Dispatched WhatsApp Explanation Notice to ${office.name} (Postmaster: ${pmName}, Mobile: ${office.mobileNumber || 'N/A'})`
      );
    }
  };

  // Build full list of all offices with their pending status
  const officeEntries = activeOffices
    .map((office) => {
      const pendingDates = getOfficePendingDates(office.name);
      return {
        office,
        pendingDates,
        pendingCount: pendingDates.length,
      };
    })
    .sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      return a.office.name.localeCompare(b.office.name);
    });

  // Filtered offices for the table view
  const filteredOfficeEntries = officeEntries.filter((item) => {
    if (filterPendingOnly && item.pendingCount === 0) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.office.name.toLowerCase().includes(term) ||
      (item.office.postmasterName || '').toLowerCase().includes(term) ||
      (item.office.mobileNumber || '').includes(term)
    );
  });

  const totalPendingOffices = officeEntries.filter((e) => e.pendingCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Screen-Only Control Banners */}
      <div className="print:hidden space-y-6">
        {/* Top Banner */}
        <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-red-700 text-white font-bold text-[10px] px-2.5 py-0.5 rounded uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                <AlertTriangle className="w-3 h-3 text-yellow-300" />
                <span>Official Disciplinary Notice Generator</span>
              </span>
              <span className="text-gray-500 text-xs font-mono">Standard A4 Printable</span>
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight mt-1.5">
              Issue Explanation Notices (استفسار برائے عدم ارسال رپورٹ)
            </h2>
            <p className="text-xs text-gray-600 mt-0.5 font-medium">
              Standard official notice formatting. Print All, Download All Word / PDF, or WhatsApp directly to each Postmaster.
            </p>
          </div>

          {/* Action Buttons: Evaluation Date + PRINT ALL + DOWNLOAD ALL PDF/WORD */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs">
              <span className="text-gray-600 font-bold px-2">Evaluation Date:</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded px-2 py-1"
              />
            </div>

            {/* PRINT ALL BUTTON */}
            <button
              onClick={handlePrintAllPending}
              className="bg-gray-900 hover:bg-black text-white font-black text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer border border-gray-950"
              title={`Print all ${totalPendingOffices} pending explanation letters in standard A4 portrait pages`}
            >
              <Printer className="w-3.5 h-3.5 text-yellow-400" />
              <span>Print All ({totalPendingOffices})</span>
            </button>

            {/* DOWNLOAD ALL PDF BUTTON */}
            <button
              onClick={generateAllPDFs}
              className="bg-red-800 hover:bg-red-900 text-white font-black text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer border border-red-950"
              title={`Download a single combined PDF with all ${totalPendingOffices} pending office letters`}
            >
              <Layers className="w-3.5 h-3.5 text-yellow-300" />
              <span>Download All PDF ({totalPendingOffices})</span>
            </button>

            {/* DOWNLOAD ALL WORD BUTTON */}
            <button
              onClick={generateAllWord}
              className="bg-[#00401A] hover:bg-[#002b11] text-white font-black text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-950"
              title={`Download a single combined Word document with all ${totalPendingOffices} pending office letters`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-yellow-300" />
              <span>Download All Word ({totalPendingOffices})</span>
            </button>
          </div>
        </div>

        {/* Global Configuration Bar (Dispatch Details & Optional Signature) */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Dispatch Ref Number</label>
              <input
                type="text"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-mono rounded-md p-1.5"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Reply Deadline (Days)</label>
              <input
                type="number"
                min={1}
                max={14}
                value={timeToReplyDays}
                onChange={(e) => setTimeToReplyDays(Number(e.target.value) || 3)}
                className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-md p-1.5"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Scanned Signature Image (Optional)</label>
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleSignatureUpload}
                  className="text-[11px] text-gray-500 file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                />
                {signatureImage && (
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="text-[10px] text-red-600 hover:underline font-bold shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Office-Wise List Table & Live Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Side: Office-Wise Interactive List (7 cols on XL) - Hidden on Print */}
        <div className="xl:col-span-7 space-y-4 print:hidden">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
            {/* Table Header & Search Filter */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-[#006633]" />
                <div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                    Sub Offices Explanation List ({filteredOfficeEntries.length})
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">
                    {totalPendingOffices} offices have missing reports. Print, WhatsApp, Word or PDF for each office.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search office, postmaster, mobile..."
                    className="bg-white border border-gray-300 text-gray-900 text-xs rounded-md pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-[#006633] w-48"
                  />
                </div>

                {/* Filter Pending Toggle */}
                <button
                  onClick={() => setFilterPendingOnly(!filterPendingOnly)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md border transition-colors flex items-center space-x-1 cursor-pointer ${
                    filterPendingOnly
                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                  title="Toggle between showing only pending offices or all offices"
                >
                  <Filter className="w-3 h-3" />
                  <span>{filterPendingOnly ? 'Pending Only' : 'All Offices'}</span>
                </button>
              </div>
            </div>

            {/* Offices List Table */}
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-8">#</th>
                    <th className="p-3">Office & Postmaster</th>
                    <th className="p-3">Pending Dates</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center w-60">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOfficeEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                        No offices match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOfficeEntries.map((item, idx) => {
                      const isSelected = selectedOfficeName === item.office.name;
                      const hasPending = item.pendingCount > 0;

                      return (
                        <tr
                          key={item.office.id}
                          onClick={() => setSelectedOfficeName(item.office.name)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-green-50/80 border-l-4 border-[#006633]'
                              : hasPending
                              ? 'hover:bg-red-50/40'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-black text-gray-900 flex items-center space-x-1.5">
                              <span>{item.office.name}</span>
                              {isSelected && (
                                <span className="bg-[#006633] text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                                  Previewing
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-600 font-medium flex items-center space-x-2 mt-0.5">
                              <span>Postmaster: <strong className="text-gray-800">{item.office.postmasterName || 'Postmaster'}</strong></span>
                              {item.office.mobileNumber && (
                                <span className="text-[10px] text-gray-500 font-mono flex items-center">
                                  <Phone className="w-2.5 h-2.5 mr-0.5 text-gray-400" />
                                  {item.office.mobileNumber}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Pending Dates Column */}
                          <td className="p-3">
                            {hasPending ? (
                              <div className="space-y-1">
                                <div className="text-red-700 font-bold text-[11px] flex items-center space-x-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>{item.pendingCount} Day(s) Missing:</span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {item.pendingDates.slice(0, 4).map((d) => (
                                    <span
                                      key={d}
                                      className="bg-red-100 text-red-800 border border-red-200 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                                    >
                                      {formatDatePK(d)}
                                    </span>
                                  ))}
                                  {item.pendingDates.length > 4 && (
                                    <span className="text-[10px] text-red-600 font-bold self-center">
                                      +{item.pendingDates.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-green-700 font-bold text-[11px] flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Up to Date</span>
                              </span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="p-3 text-center">
                            {hasPending ? (
                              <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                                Defaulter
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-800 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                Submitted
                              </span>
                            )}
                          </td>

                          {/* Action Buttons: Print, WhatsApp, PDF & Word for each office */}
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center space-x-1">
                              {/* 1. Print Button */}
                              <button
                                onClick={() =>
                                  handlePrintSingleOffice(
                                    item.office,
                                    item.pendingDates,
                                    isSelected ? postmasterName : item.office.postmasterName
                                  )
                                }
                                className="bg-gray-800 hover:bg-black text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                                title={`Print Explanation Notice for ${item.office.name}`}
                              >
                                <Printer className="w-3 h-3 text-yellow-400" />
                                <span>Print</span>
                              </button>

                              {/* 2. WhatsApp Button */}
                              <button
                                onClick={() =>
                                  handleWhatsAppSend(
                                    item.office,
                                    item.pendingDates,
                                    isSelected ? postmasterName : item.office.postmasterName
                                  )
                                }
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                                title={`Send Official Explanation Notice to Postmaster (${item.office.mobileNumber || 'WhatsApp'})`}
                              >
                                <MessageCircle className="w-3 h-3 text-white" />
                                <span>WhatsApp</span>
                              </button>

                              {/* 3. Download PDF Button */}
                              <button
                                onClick={() =>
                                  generatePDFForOffice(
                                    item.office,
                                    item.pendingDates,
                                    isSelected ? postmasterName : item.office.postmasterName
                                  )
                                }
                                className="bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs transition-colors flex items-center space-x-0.5 cursor-pointer"
                                title={`Download PDF for ${item.office.name}`}
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF</span>
                              </button>

                              {/* 4. Download Word Button */}
                              <button
                                onClick={() =>
                                  generateWordForOffice(
                                    item.office,
                                    item.pendingDates,
                                    isSelected ? postmasterName : item.office.postmasterName
                                  )
                                }
                                className="bg-[#005522] hover:bg-[#00401A] text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs transition-colors flex items-center space-x-0.5 cursor-pointer"
                                title={`Download Word Document for ${item.office.name}`}
                              >
                                <FileSpreadsheet className="w-3 h-3 text-yellow-300" />
                                <span>Word</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Live A4 Portrait Preview & Actions (5 cols on XL) */}
        <div className="xl:col-span-5 space-y-4 print:w-full print:col-span-12">
          <div className="print:hidden bg-white border border-gray-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-2 gap-2">
              <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight flex items-center space-x-1.5">
                <Eye className="w-4 h-4 text-[#006633]" />
                <span>Live Preview ({currentOffice?.name})</span>
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Print Button on preview */}
                <button
                  onClick={() =>
                    handlePrintSingleOffice(currentOffice, selectedMissingDates, postmasterName)
                  }
                  className="bg-gray-900 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-xs flex items-center space-x-1 cursor-pointer"
                  title="Print this letter directly"
                >
                  <Printer className="w-3 h-3 text-yellow-300" />
                  <span>Print</span>
                </button>

                {/* WhatsApp Button on preview */}
                <button
                  onClick={() =>
                    handleWhatsAppSend(currentOffice, selectedMissingDates, postmasterName)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-xs flex items-center space-x-1 cursor-pointer"
                  title="Send notice to Postmaster via WhatsApp"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp</span>
                </button>

                {/* Word Button on preview */}
                <button
                  onClick={() =>
                    generateWordForOffice(currentOffice, selectedMissingDates, postmasterName)
                  }
                  className="bg-[#005522] hover:bg-[#00401A] text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs flex items-center space-x-1 cursor-pointer"
                  title="Download .doc Word file"
                >
                  <FileSpreadsheet className="w-3 h-3 text-yellow-300" />
                  <span>Word</span>
                </button>

                {/* PDF Button on preview */}
                <button
                  onClick={() =>
                    generatePDFForOffice(currentOffice, selectedMissingDates, postmasterName)
                  }
                  className="bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold px-2 py-1 rounded shadow-xs flex items-center space-x-1 cursor-pointer"
                  title="Download PDF"
                >
                  <Download className="w-3 h-3" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Quick Edit Inputs for Live Preview */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label className="block text-gray-500 font-bold mb-0.5">Honorific</label>
                <select
                  value={honorific}
                  onChange={(e) => setHonorific(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-gray-800 font-bold"
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Miss">Miss</option>
                  <option value="Mrs.">Mrs.</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-gray-500 font-bold mb-0.5">Postmaster Name</label>
                <input
                  type="text"
                  value={postmasterName}
                  onChange={(e) => setPostmasterName(e.target.value)}
                  placeholder="e.g. Muhammad Aslam"
                  className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-gray-900 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Standard A4 Portrait Letter Sheet Representation */}
          <div className="bg-white border-2 border-gray-300 rounded-lg shadow-md p-6 sm:p-8 text-gray-900 font-sans text-xs space-y-4 max-w-[210mm] mx-auto min-h-[500px]">
            {/* 1. Header Banner */}
            <div className="text-center border-b-2 border-[#00401A] pb-3">
              <div className="text-base sm:text-lg font-black tracking-widest text-[#00401A] uppercase">
                PAKISTAN POST
              </div>
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-tight mt-0.5">
                OFFICE OF THE DIVISIONAL SUPERINTENDENT POSTAL SERVICES {divisionName.toUpperCase()}
              </div>
            </div>

            {/* 2. Reference & Date Line */}
            <div className="flex justify-between items-center text-[11px] font-mono border-b border-gray-200 pb-2">
              <span className="font-bold text-gray-800">{refNumber}</span>
              <span className="font-bold text-gray-800">Dated: {formatDatePK(issueDate)}</span>
            </div>

            {/* 3. Addressee Block */}
            <div className="text-xs space-y-0.5 font-medium">
              <div className="font-bold text-gray-900">To,</div>
              <div className="pl-4 font-bold text-gray-900">
                The {honorific} {postmasterName || currentOffice?.postmasterName || 'Postmaster'},
              </div>
              <div className="pl-4 text-gray-700">Postmaster,</div>
              <div className="pl-4 font-bold text-gray-900">{currentOffice?.name} Post Office,</div>
              <div className="pl-4 text-gray-700">{divisionName}.</div>
            </div>

            {/* 4. Subject Box */}
            <div className="bg-red-50 border border-red-300 text-red-800 font-bold px-3 py-1.5 rounded-sm text-xs flex items-center space-x-2">
              <span className="tracking-wider">SUBJECT:</span>
              <span className="underline decoration-red-600 font-black">EXPLANATION</span>
            </div>

            {/* 5. Letter Body */}
            <div className="space-y-3 text-xs leading-relaxed text-gray-800 text-justify">
              <p>
                You have not submitted the Daily Delivery Report of your Post Office for the following date(s) (excluding Sunday holiday):
              </p>

              {/* Missing Dates Callout Box */}
              <div className="bg-gray-50 border-l-4 border-red-600 p-2.5 my-2 font-mono text-red-900 font-bold text-[11px] space-y-1">
                {selectedMissingDates.length > 0 ? (
                  selectedMissingDates.map((d, idx) => (
                    <div key={d}>
                      {idx + 1}. {formatDatePK(d)}
                    </div>
                  ))
                ) : (
                  <div>1. {formatDatePK(targetDate)}</div>
                )}
              </div>

              <p>
                You are directed to submit your written explanation within <strong className="text-red-700">{timeToReplyDays} days</strong> from the receipt of this letter, explaining the reasons for not submitting the report on time.
              </p>

              <p>
                In case of failure to submit the explanation within the stipulated time, disciplinary action will be taken against you under the rules.
              </p>
            </div>

            {/* 6. Signature Block (Right aligned, natural and tight spacing) */}
            <div className="pt-4 flex justify-end">
              <div className="text-center w-56 space-y-1">
                {signatureImage && (
                  <div className="h-10 flex items-center justify-center mb-1">
                    <img
                      src={signatureImage}
                      alt="Signature"
                      className="max-h-10 max-w-[160px] object-contain"
                    />
                  </div>
                )}
                <div className="font-extrabold text-xs text-[#00401A]">
                  Divisional Superintendent (PS)
                </div>
                <div className="text-[11px] text-gray-800 font-bold">
                  {divisionName}
                </div>
              </div>
            </div>

            {/* 7. Copy to Endorsement Block */}
            <div className="border-t border-gray-200 pt-3 text-[10px] text-gray-600 space-y-0.5">
              <div className="font-bold text-gray-700">
                Copy forwarded for information and necessary compliance to:
              </div>
              <div className="pl-3">1. The Assistant Superintendent Postal Services concerned.</div>
              <div className="pl-3">2. Office record / Staff Personal File.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
