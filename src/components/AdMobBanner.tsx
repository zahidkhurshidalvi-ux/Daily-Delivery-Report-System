import React from 'react';
import { AdMobConfig } from '../types';
import { Sparkles } from 'lucide-react';

interface AdMobBannerProps {
  config: AdMobConfig;
  position?: 'top' | 'bottom';
  className?: string;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  config,
  position = 'bottom',
  className = '',
}) => {
  if (!config.enabled) return null;

  return (
    <div
      className={`w-full max-w-md mx-auto bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 shadow-sm overflow-hidden text-xs my-2 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5 text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="bg-yellow-400 text-black font-extrabold px-1 rounded text-[9px]">
            Ad
          </span>
          <span className="font-semibold text-slate-300">Google AdMob Banner</span>
        </div>
        <span className="font-mono text-[9px] text-slate-500 truncate max-w-[150px]">
          {config.bannerAdUnitId || 'ca-app-pub-3940256099942544/6300978111'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 bg-slate-800/60 rounded px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-[#006633] rounded text-white shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-slate-200 text-[11px] leading-tight">
              Pakistan Post Digital Services
            </div>
            <div className="text-[10px] text-slate-400">
              Official Nationwide Postal Network
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
              (window as any).AndroidBridge.onBannerClicked?.();
            }
          }}
          className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-extrabold text-[10px] px-2 py-1 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          Install App
        </button>
      </div>
    </div>
  );
};
