import { PostOffice, WhatsAppConfig } from '../types';
import { formatDatePK, getTodayDateString } from './calculations';

export function getUrduReminderTemplate(dateOrDates?: string | string[]): string {
  if (Array.isArray(dateOrDates) && dateOrDates.length > 1) {
    const listStr = dateOrDates.map((d) => `• مورخہ ${formatDatePK(d)}`).join('\n');
    return `محترم پوسٹ ماسٹر صاحب،

آپ نے مندرجہ ذیل مورخہ جات کی Daily Delivery Reports ابھی تک اپڈیٹ نہیں کیں:

${listStr}

براہ کرم فوراً اپنے تمام متعلقہ دنوں کی رپورٹس درج کریں۔

شکریہ
Divisional Superintendent (PS)
Gujranwala Division`;
  }

  const singleDate = typeof dateOrDates === 'string'
    ? dateOrDates
    : (Array.isArray(dateOrDates) && dateOrDates.length === 1 ? dateOrDates[0] : getTodayDateString());
  const formattedDate = formatDatePK(singleDate);

  return `محترم پوسٹ ماسٹر صاحب،

آپ نے مورخہ ${formattedDate} کی Daily Delivery Report ابھی تک اپڈیٹ نہیں کی۔

براہ کرم فوراً اپنی رپورٹ درج کریں۔

شکریہ
Divisional Superintendent (PS)
Gujranwala Division`;
}

export function getUrduSummaryTemplate(dateStr?: string): string {
  const formattedDate = dateStr ? formatDatePK(dateStr) : formatDatePK(getTodayDateString());
  return `محترم پوسٹ ماسٹر صاحبان،

براہ کرم مورخہ ${formattedDate} کی Daily Delivery Report بروقت جمع کروائیں تاکہ روزانہ کی کارکردگی مرتب کی جا سکے۔

شکریہ
Divisional Superintendent (PS)
Gujranwala Division`;
}

export const URDU_REMINDER_TEMPLATE = getUrduReminderTemplate();
export const URDU_SUMMARY_TEMPLATE = getUrduSummaryTemplate();

/**
 * Generates a direct WhatsApp web/app link to send a message to a postmaster's phone number
 */
export function generateWhatsAppWebLink(mobileNumber: string, messageText: string, webAppUrl: string): string {
  // Format mobile number to international format e.g. +923001234567 -> 923001234567
  let cleanNumber = mobileNumber.replace(/\D/g, '');
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '92' + cleanNumber.substring(1);
  }

  const fullText = `${messageText}\n\n🌐 System Link:\n${webAppUrl}`;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(fullText)}`;
}

/**
 * Sends a message via WhatsApp Cloud API endpoint (or simulates if credentials are mock)
 */
export async function sendWhatsAppMessageViaCloudApi(
  config: WhatsAppConfig,
  mobileNumber: string,
  messageText: string
): Promise<{ success: boolean; message: string }> {
  let cleanNumber = mobileNumber.replace(/\D/g, '');
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '92' + cleanNumber.substring(1);
  }

  const fullText = `${messageText}\n\n🌐 System Link:\n${config.webAppUrl}`;

  if (!config.phoneNumberId || !config.accessToken || config.accessToken === 'YOUR_WHATSAPP_TOKEN') {
    // Return simulated success with link fallback
    return {
      success: true,
      message: `Simulated Cloud API dispatch to +${cleanNumber}. Credentials not configured, fallback link generated.`,
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { preview_url: true, body: fullText },
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, message: `WhatsApp sent successfully to +${cleanNumber}!` };
    } else {
      return { success: false, message: data.error?.message || 'WhatsApp Cloud API request failed.' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error sending WhatsApp message.' };
  }
}
