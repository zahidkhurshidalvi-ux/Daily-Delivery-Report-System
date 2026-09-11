import React from 'react';
import { X, Download, ShieldCheck, Smartphone, CheckCircle, Sparkles } from 'lucide-react';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      id="apk-download-modal"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="bg-[#00401A] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border-2 border-yellow-400 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight">Pakistan Post Mobile App</h2>
              <p className="text-xs text-emerald-200 font-medium">
                Official Android APK (v1.1.0) • Google Play Ready
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-900 font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Unified Database with Web Application</span>
            </div>
            <p className="text-emerald-800 leading-relaxed text-[11.5px]">
              Every report submitted from the mobile app instantly updates the live web dashboard, and vice-versa. No data discrepancies!
            </p>
          </div>

          {/* App Specifications */}
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-500 font-medium">Package Name:</span>
              <span className="font-mono font-bold text-gray-800">com.pakpost.deliveryreporting</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-500 font-medium">Target Platforms:</span>
              <span className="font-bold text-gray-800">Android 7.0 to Android 15 (SDK 34)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-500 font-medium">Monetization:</span>
              <span className="font-bold text-emerald-700 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-yellow-500" />
                <span>Google AdMob Banner & Interstitial</span>
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500 font-medium">Status:</span>
              <span className="font-bold text-emerald-800 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Signed Release Keystore APK</span>
              </span>
            </div>
          </div>

          {/* Download Button */}
          <a
            href="/PakistanPost_DDRS.apk"
            download="PakistanPost_DDRS.apk"
            className="w-full py-3.5 px-4 bg-[#00401A] hover:bg-[#003014] text-white rounded-xl font-black text-sm flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer"
          >
            <Download className="w-5 h-5 text-yellow-400" />
            <span>Download Android APK (Direct)</span>
          </a>

          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            After downloading, tap the notification or file to install on your Android device. Allow "Install from unknown sources" if prompted.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
