import React, { useState, useEffect } from 'react';
import { getAdMobConfig } from '../utils/admob';
import { X, Sparkles, ShieldCheck, ExternalLink } from 'lucide-react';

interface AdMobInterstitialProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const AdMobInterstitial: React.FC<AdMobInterstitialProps> = ({
  isOpen,
  onClose,
  title = 'Report Submitted Successfully',
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const config = getAdMobConfig();

  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(5);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !config.interstitialEnabled) return null;

  const canClose = secondsRemaining === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 select-none animate-in fade-in duration-200"
      id="admob-interstitial-modal"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between max-w-lg mx-auto w-full text-white/90">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded border border-white/30">
            Ad · Google AdMob
          </span>
          <span className="text-xs font-semibold text-gray-300">
            Sponsored Interstitial
          </span>
        </div>

        {/* Skip / Close Button */}
        <button
          onClick={() => {
            if (canClose) onClose();
          }}
          disabled={!canClose}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer ${
            canClose
              ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-md ring-2 ring-emerald-500'
              : 'bg-white/20 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Close Ad"
        >
          {canClose ? (
            <>
              <span>Skip / Close</span>
              <X className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Reward in {secondsRemaining}s</span>
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
            </>
          )}
        </button>
      </div>

      {/* Main Interstitial Ad Body */}
      <div className="max-w-md mx-auto w-full bg-white rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center justify-center my-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#00401A] text-yellow-400 flex items-center justify-center shadow-lg border-2 border-yellow-400/30">
          <Sparkles className="w-8 h-8 text-yellow-300" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
            Pakistan Post Official Partner
          </span>
          <h3 className="text-xl font-black text-gray-900 pt-1">
            Fast Track Digital Remittance & Tracking
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
            Experience next-generation domestic express, parcel tracking, and secure postal pension disbursement.
          </p>
        </div>

        <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between text-left">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Verified Partner Service</p>
              <p className="text-[10px] text-gray-500 font-mono">
                Unit: {config.interstitialAdUnitId.slice(0, 24)}...
              </p>
            </div>
          </div>
          <a
            href="https://ep.gov.pk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#00401A] hover:underline flex items-center space-x-1"
          >
            <span>Learn</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-[#00401A] hover:bg-[#003014] text-white font-extrabold rounded-xl text-sm transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Continue to Application</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="max-w-lg mx-auto w-full text-center text-[10.5px] text-gray-400">
        Google AdMob Interstitial • {title}
      </div>
    </div>
  );
};
