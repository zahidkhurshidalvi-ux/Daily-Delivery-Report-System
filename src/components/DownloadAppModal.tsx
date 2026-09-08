import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Share2,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  RefreshCw,
  AlertCircle,
  FileCheck,
  Send,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAppUrl?: string;
}

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({
  isOpen,
  onClose,
  userAppUrl,
}) => {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa' | 'ios'>('apk');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const appUrl =
    userAppUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?mode=user`
      : '');

  const apkDownloadUrl = typeof window !== 'undefined' ? `${window.location.origin}/PakistanPost_DDRS.apk` : '/PakistanPost_DDRS.apk';

  const handleDownloadApk = () => {
    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = '/PakistanPost_DDRS.apk';
      link.setAttribute('download', 'PakistanPost_DDRS.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 8000);
    } catch (e) {
      console.error('Download error:', e);
      window.location.href = '/PakistanPost_DDRS.apk';
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const message = `*پاکستان پوسٹ - روزانہ ترسیل رپورٹ (Pakistan Post DDRS App)*\n\nبرانچ پوسٹ ماسٹرز اور عملہ کے لیے موبائل ایپ:\n\n1️⃣ ڈائریکٹ APK ڈاؤن لوڈ کریں:\n${apkDownloadUrl}\n\n2️⃣ یا موبائل پر ڈائریکٹ اوپن کریں:\n${appUrl}\n\nنوٹ: یہ ایپ انسٹالیشن کے دوران کوئی پرمیشن نہیں مانگتی اور 1-کلک میں انسٹال ہو جاتی ہے!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await installApp();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(apkDownloadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00401A] to-[#005522] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
              <Smartphone className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight leading-snug">
                Download Pakistan Post APK
              </h2>
              <p className="text-xs text-green-200 font-urdu">
                سنگل کلک ڈاؤن لوڈ اور واٹس ایپ شیئرنگ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guarantee Banner */}
        <div className="bg-emerald-50 text-emerald-900 px-4 py-2.5 text-xs font-medium border-b border-emerald-200 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold text-emerald-950 block">
              Zero Permissions • 1-Click Install • Verified Signed APK
            </span>
            <span className="text-[11px] text-emerald-800 leading-tight block mt-0.5">
              یہ اینڈرائیڈ APK انسٹالیشن کے دوران کوئی پرمیشن نہیں مانگے گی اور بغیر کسی ایرر کے فوری انسٹال ہو جائے گی۔
            </span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'border-[#00401A] text-[#00401A] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download APK (اینڈرائیڈ)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-[#00401A] text-[#00401A] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Chrome Install</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ios'
                ? 'border-[#00401A] text-[#00401A] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>iPhone</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          {activeTab === 'apk' && (
            <div className="space-y-4">
              {/* Primary Download Card */}
              <div className="bg-gradient-to-br from-[#00401A] to-[#005522] text-white rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                      Pakistan Post Official APK
                    </span>
                  </div>
                  <span className="bg-white/10 text-yellow-300 text-[10px] font-mono px-2 py-0.5 rounded-full">
                    Size: ~830 KB (مکمل ایپ)
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white leading-tight">
                    PakistanPost_DDRS.apk (v1.1.0)
                  </h3>
                  <p className="text-xs text-emerald-200 mt-1">
                    تصدیق شدہ آفیشل APK فائل، براہ راست اینڈرائیڈ 13-15 جدید پروٹیکشن کے مطابق۔ اوپن کرتے ہی براہِ راست ڈیلی ترسیل رپورٹ فارم کھلتا ہے (کوئی گوگل لاگ ان پیج نہیں آئے گا)۔
                  </p>
                </div>

                {downloaded && (
                  <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>APK فائل ڈاؤن لوڈ ہو گئی ہے! اپنے فون کے Downloads میں جا کر صرف 'Install' دبائیں۔</span>
                  </div>
                )}

                {/* Big Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadApk}
                    disabled={downloading}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black py-3.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-sm text-center"
                  >
                    <Download className={`w-5 h-5 ${downloading ? 'animate-bounce' : ''}`} />
                    <span>
                      {downloading ? 'Downloading APK...' : 'Download APK Now (سنگل کلک ڈاؤن لوڈ)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-black py-3 px-4 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-xs text-center"
                  >
                    <Send className="w-4 h-4" />
                    <span>Share APK Link on WhatsApp (واٹس ایپ پر شیئر کریں)</span>
                  </button>
                </div>
              </div>

              {/* Three Key Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center text-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />
                  <strong className="text-slate-900 text-xs">No Permissions</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5">انسٹالیشن کے وقت کوئی پرمیشن نہیں مانگے گی</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center text-center">
                  <FileCheck className="w-5 h-5 text-blue-600 mb-1" />
                  <strong className="text-slate-900 text-xs">Digitally Signed</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5">v1, v2, v3 سائنڈ، زیرو پارس ایرر</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center text-center">
                  <RefreshCw className="w-5 h-5 text-purple-600 mb-1" />
                  <strong className="text-slate-900 text-xs">Auto-Update</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5">ہر نئی تبدیلی پر خود بخود اپڈیٹ ہو گی</span>
                </div>
              </div>

              {/* Installation Guide */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-[11px] text-amber-900">
                <div className="font-extrabold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>انسٹالیشن کا طریقہ (صرف 2 آسان سٹیپس):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-amber-800">
                  <li>ڈاؤن لوڈ مکمل ہونے کے بعد موبائل کی نوٹیفکیشن بار یا <strong>Downloads</strong> فولڈر سے <code>PakistanPost_DDRS.apk</code> پر ٹیپ کریں۔</li>
                  <li>اگر پلے پروٹیکٹ سکرین دکھائے تو <strong>"Install anyway"</strong> (یا <strong>More details ➔ Install anyway</strong>) پر ٹیپ کریں۔</li>
                  <li>ایپ فوری انسٹال ہو جائے گی اور کھولنے پر بغیر کسی گوگل لاگ ان کے سیدھا پاکستان پوسٹ ڈیلی ترسیل رپورٹ فارم اوپن ہو جائے گا!</li>
                </ol>
              </div>

              {/* Direct Link Copier */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={apkDownloadUrl}
                  className="w-full bg-slate-50 border border-slate-300 px-3 py-2 rounded-lg text-[11px] font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-xs whitespace-nowrap cursor-pointer"
                >
                  {copied ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs">
                  گوگل کروم سے ڈائریکٹ انسٹال کرنے کا طریقہ (بغیر APK فائل ڈاؤن لوڈ کیے):
                </h4>
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00401A] text-yellow-300 flex items-center justify-center font-bold text-[10px]">1</span>
                    <span>کروم میں اوپر دائیں طرف موجود <strong>تین نقطوں ( ⋮ )</strong> پر کلک کریں۔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00401A] text-yellow-300 flex items-center justify-center font-bold text-[10px]">2</span>
                    <span>لسٹ میں سے <strong>"Install app"</strong> یا <strong>"Add to Home screen"</strong> منتخب کریں۔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00401A] text-yellow-300 flex items-center justify-center font-bold text-[10px]">3</span>
                    <span><strong>Install</strong> دبائیں، ایپ آپ کے فون کی سکرین پر آ جائے گی۔</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full bg-[#00401A] hover:bg-[#005522] text-white font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer text-xs flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-yellow-300" />
                  <span>{isInstalled ? 'App Already Installed' : 'Trigger Chrome Install'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-[11px]">
                <h4 className="font-bold text-slate-900 text-xs">
                  iPhone / Safari پر انسٹالیشن:
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">1</span>
                    <span>سفاری میں ایپ کھول کر نیچے <strong>Share</strong> بٹن دبائیں۔</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#00401A] text-yellow-300 flex items-center justify-center font-bold text-[10px]">2</span>
                    <span><strong>"Add to Home Screen"</strong> پر کلک کریں۔</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="text-emerald-700 hover:text-emerald-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send on WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
