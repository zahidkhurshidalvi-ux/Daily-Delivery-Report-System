import React, { useState } from 'react';
import { getAdMobConfig } from '../utils/admob';
import { Info, Sparkles } from 'lucide-react';

interface AdMobBannerProps {
  className?: string;
  position?: 'bottom' | 'inline';
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  className = '',
  position = 'bottom',
}) => {
  const [closed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const config = getAdMobConfig();

  if (closed || !config.bannerEnabled) return null;

  const isTest = config.testMode;
  const bannerUnitId = config.bannerAdUnitId;

  return (
    <div
      className={`w-full flex flex-col items-center justify-center transition-all select-none no-print ${
        position === 'bottom'
          ? 'sticky bottom-0 z-20 bg-gray-50/95 backdrop-blur-xs border-t border-gray-200 py-1.5 shadow-2xs'
          : 'my-3'
      } ${className}`}
      id="admob-banner-container"
    >
      {/* Banner Card */}
      <div className="w-full max-w-[360px] sm:max-w-[468px] bg-white border border-gray-300 rounded-lg p-2 shadow-xs flex items-center justify-between gap-2 overflow-hidden relative">
        {/* Ad Tag & AdChoices */}
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-9 h-9 rounded-md bg-[#00401A] text-yellow-400 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-700 px-1 py-0.2 rounded border border-gray-300">
                Ad
              </span>
              <span className="text-[10px] font-bold text-gray-500 truncate">
                Google AdMob
              </span>
              {isTest && (
                <span className="text-[8.5px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200">
                  Test Unit
                </span>
              )}
            </div>
            <p className="text-xs font-extrabold text-gray-900 truncate mt-0.5">
              Postal Express & Financial Services
            </p>
            <p className="text-[10.5px] text-gray-500 truncate">
              Fast, Secure & Digital Delivery Across Pakistan
            </p>
          </div>
        </div>

        {/* Action / Ad Info */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            title="Ad Details"
            aria-label="Ad Details"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ad Details popover */}
      {showDetails && (
        <div className="text-[9.5px] text-gray-500 mt-1 font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-center max-w-xs">
          AdMob Unit: <span className="font-bold text-gray-700">{bannerUnitId}</span>
        </div>
      )}
    </div>
  );
};
