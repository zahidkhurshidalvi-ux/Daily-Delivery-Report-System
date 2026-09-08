import React, { useState, useEffect } from 'react';
import { X, Volume2, VolumeX, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import { AdMobConfig } from '../types';

interface AdMobPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AdMobConfig;
  adType?: 'INTERSTITIAL' | 'REWARDED' | 'BANNER';
  onReward?: () => void;
}

export const AdMobPlayerModal: React.FC<AdMobPlayerModalProps> = ({
  isOpen,
  onClose,
  config,
  adType = 'INTERSTITIAL',
  onReward,
}) => {
  const [countdown, setCountdown] = useState<number>(5);
  const [canSkip, setCanSkip] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [rewardGranted, setRewardGranted] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialSeconds = adType === 'REWARDED' ? 8 : 5;
    setCountdown(initialSeconds);
    setCanSkip(false);
    setRewardGranted(false);

    // If native Android Bridge is available (running inside custom Android WebView APK)
    if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
      try {
        if (adType === 'REWARDED') {
          (window as any).AndroidBridge.showRewardedAd?.();
        } else {
          (window as any).AndroidBridge.showInterstitialAd?.();
        }
      } catch (e) {
        console.warn('Native Android bridge call error:', e);
      }
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanSkip(true);
          if (adType === 'REWARDED') {
            setRewardGranted(true);
            if (onReward) onReward();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, adType, onReward]);

  if (!isOpen) return null;

  const currentAdUnitId =
    adType === 'REWARDED'
      ? config.rewardedAdUnitId
      : adType === 'BANNER'
      ? config.bannerAdUnitId
      : config.interstitialAdUnitId;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top AdMob Header Bar */}
        <div className="bg-slate-950 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-black font-extrabold text-[10px] px-1.5 py-0.5 rounded tracking-wide">
              AdMob
            </span>
            <span className="text-slate-300 font-medium text-[11px]">
              {adType === 'REWARDED' ? 'Rewarded Video Ad' : 'Interstitial Ad (فل سکرین اشتہار)'}
            </span>
            {config.testMode && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] px-1.5 py-0.2 rounded">
                Test Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {canSkip ? (
              <button
                type="button"
                onClick={onClose}
                className="bg-white/20 hover:bg-white text-white hover:text-black text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>Skip</span>
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[11px] font-mono text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                Reward in {countdown}s
              </span>
            )}
          </div>
        </div>

        {/* Ad Video / Graphic Body */}
        <div className="p-6 bg-gradient-to-b from-slate-900 to-[#00240f] flex flex-col items-center justify-center text-center relative min-h-[300px]">
          {/* Animated Glow Circle */}
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center mb-4 relative">
            <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400/10" />
            <Sparkles className="w-10 h-10 text-emerald-400" />
          </div>

          <h3 className="text-base font-bold text-white tracking-tight">
            Pakistan Post Digital Services
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            Fast, secure and reliable mail delivery, Express Post, and financial postal savings across 13,000+ locations in Pakistan.
          </p>

          <div className="mt-5 w-full bg-white/5 border border-white/10 rounded-lg p-3 text-left">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Ad Unit ID:</span>
              <span className="font-mono text-yellow-300 text-[10px] truncate max-w-[200px]">
                {currentAdUnitId || 'ca-app-pub-3940256099942544/1033173712'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>App Status:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Live Synced with Firestore
              </span>
            </div>
          </div>

          {rewardGranted && (
            <div className="mt-4 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-3 py-1.5 rounded-full text-xs font-semibold animate-bounce">
              ✓ Reward Granted! Daily Delivery Form Unlocked
            </div>
          )}
        </div>

        {/* AdMob Bottom Action Bar */}
        <div className="bg-slate-950 p-4 flex items-center justify-between border-t border-slate-800">
          <div className="text-[11px] text-slate-400">
            <span className="block font-semibold text-white">Google AdMob Interactive</span>
            <span className="text-[10px]">Tap below to open or skip</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Continue to Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
