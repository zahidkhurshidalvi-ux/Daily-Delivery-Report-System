import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  Smartphone,
  CheckCircle,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  Loader2,
  Share2,
} from 'lucide-react';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const apkUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/PakistanPost_DDRS.apk`
    : '/PakistanPost_DDRS.apk';

  const handleDirectDownload = async () => {
    setDownloading(true);
    try {
      // First try blob download to bypass iframe download blocking
      const response = await fetch('/PakistanPost_DDRS.apk');
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.setAttribute('download', 'PakistanPost_DDRS.apk');
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      // Fallback: Open directly in a new window/tab
      window.open(apkUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(apkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('On Android: Tap browser 3 dots (⋮) and select "Install App" or "Add to Home screen".');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-150 overflow-y-auto"
      id="apk-download-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 my-auto">
        {/* Modal Header */}
        <div className="bg-[#00401A] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border-2 border-yellow-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black leading-tight">Pakistan Post Mobile App</h2>
                <span className="bg-yellow-400 text-[#00401A] text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                  v1.1.0
                </span>
              </div>
              <p className="text-xs text-emerald-200 font-medium">
                Android Package (APK) & Instant Mobile App Installation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Status Box */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Unified Database with Web Portal (ایک ہی ڈیٹا بیس)</span>
            </div>
            <p className="text-emerald-800 leading-relaxed text-[11.5px]">
              موبائل ایپ سے سبمٹ کی جانے والی رپورٹس فورا ویب ڈیش بورڈ میں لائیو نظر آئیں گی، اور ویب پر موجود تمام ریکارڈز موبائل ایپ میں بھی ہم آہنگ رہیں گے۔
            </p>
          </div>

          {/* Primary Action 1: Direct Download APK */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleDirectDownload}
              disabled={downloading}
              className="w-full py-3 px-4 bg-[#00401A] hover:bg-[#003014] text-white rounded-xl font-black text-sm flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer disabled:opacity-75"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                  <span>Downloading APK File (822 KB)...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 text-yellow-400" />
                  <span>Download Android APK (براہ راست ڈاؤنلوڈ)</span>
                </>
              )}
            </button>

            {/* Alternative options if iframe blocks download */}
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="/PakistanPost_DDRS.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 border border-gray-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                <span>Open Link in New Tab</span>
              </a>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 border border-gray-300 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-gray-600" />
                    <span>Copy APK Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Direct Mobile Home Screen Install (PWA Option) */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-black text-amber-950">
                  Instant Mobile Installation (1-Click PWA App)
                </h4>
              </div>
              <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded">
                Recommended
              </span>
            </div>
            <p className="text-[11.5px] text-amber-900 leading-relaxed">
              اگر موبائل میں APK فائل ڈاؤنلوڈ یا انسٹال کا مسئلہ ہو، تو بغیر کسی وارننگ کے 1 کلک میں ایپ موبائل کی ہوم سکرین پر انسٹال کریں۔
            </p>
            <button
              type="button"
              onClick={handleInstallPwa}
              className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Install to Android Home Screen (ہوم سکرین پر لگائیں)</span>
            </button>
          </div>

          {/* Installation Instructions Toggle */}
          <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between font-bold text-gray-800 transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-[#00401A]" />
                <span>انسٹالیشن کا آسان طریقہ (Installation Guide)</span>
              </div>
              <span className="text-xs text-[#00401A] font-bold">
                {showGuide ? 'Hide' : 'Show'}
              </span>
            </button>

            {showGuide && (
              <div className="p-3.5 bg-white space-y-2.5 text-gray-700 border-t border-gray-200 text-[11.5px] leading-relaxed">
                <div className="space-y-1">
                  <p className="font-extrabold text-gray-900">1. موبائل فون پر ڈاؤنلوڈ کریں:</p>
                  <p className="text-gray-600 pl-3">
                    اوپر دیے گئے <strong>Copy APK Link</strong> کے بٹن سے لنک کاپی کریں اور اپنے موبائل فون کے کروم براؤزر (Chrome) یا واٹس ایپ پر بھیج کر کھولیں، ڈاؤنلوڈ شروع ہو جائے گا۔
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-extrabold text-gray-900">2. انسٹال کریں (Install Unknown Sources):</p>
                  <p className="text-gray-600 pl-3">
                    ڈاؤنلوڈ مکمل ہونے پر فائل مینیجر یا نوٹیفکیشن سے <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold">PakistanPost_DDRS.apk</code> پر کلک کریں۔ اگر موبائل "Install unknown apps" مانگے تو Allow کریں۔
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-extrabold text-gray-900">3. Play Protect تصدیق:</p>
                  <p className="text-gray-600 pl-3">
                    اگر گوگل پلے پروٹیکٹ وارننگ دے، تو <strong>"Install anyway"</strong> پر کلک کریں۔
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* AdMob IDs Persistence Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11.5px] text-blue-900 space-y-1">
            <div className="flex items-center space-x-1.5 font-black text-blue-950">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>AdMob IDs ہمیشہ محفوظ رہیں گی (Permanent Persistence)</span>
            </div>
            <p className="leading-relaxed">
              ایڈمن پینل کے "WhatsApp & AdMob IDs" میں محفوظ کی گئی تمام AdMob IDs کلاؤڈ ڈیٹابیس کے مخصوص محفوظ ریکارڈ میں محفوظ ہیں اور کسی بھی ایپ اپڈیٹ پر ضائع نہیں ہوں گی۔
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            com.pakpost.deliveryreporting
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
