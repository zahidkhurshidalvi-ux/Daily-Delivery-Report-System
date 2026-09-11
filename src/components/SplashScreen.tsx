import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Shield, Wifi } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  isOnline?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, isOnline = true }) => {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(25);
  const [statusText, setStatusText] = useState('Initializing Pakistan Post DDRS...');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(60);
      setStatusText('Connecting to Central Cloud Database...');
    }, 400);

    const t2 = setTimeout(() => {
      setProgress(90);
      setStatusText('Syncing post offices and balance records...');
    }, 850);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('System Ready!');
    }, 1200);

    const t4 = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div
      onClick={() => {
        setVisible(false);
        if (onFinish) onFinish();
      }}
      className="fixed inset-0 z-50 bg-[#00401A] text-white flex flex-col items-center justify-between p-6 select-none cursor-pointer transition-opacity duration-300"
      id="app-splash-screen"
    >
      {/* Top Status */}
      <div className="w-full flex items-center justify-between text-xs text-emerald-200">
        <div className="flex items-center space-x-1.5">
          <Shield className="w-4 h-4 text-yellow-400" />
          <span className="font-bold tracking-wide">Official Postal System</span>
        </div>
        <div className="flex items-center space-x-1">
          <Wifi className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[11px] font-mono">{isOnline ? 'Cloud Synced' : 'Offline Mode'}</span>
        </div>
      </div>

      {/* Center Crest & Brand */}
      <div className="flex flex-col items-center text-center space-y-4 my-auto">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-white/10 border-4 border-yellow-400 flex items-center justify-center shadow-2xl p-4 animate-pulse">
            <Mail className="w-12 h-12 text-yellow-400" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 border-2 border-[#00401A]">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white">
            PAKISTAN POST
          </h1>
          <p className="text-xs sm:text-sm font-bold text-yellow-300 tracking-wide uppercase">
            Daily Delivery Reporting System (DDRS)
          </p>
          <p className="text-[11px] text-emerald-200 font-medium">
            Divisional Superintendent Postal Services
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="w-64 max-w-xs space-y-2 pt-4">
          <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden p-0.5 border border-white/20">
            <div
              className="bg-yellow-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-emerald-200 font-mono text-center truncate">
            {statusText}
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center text-[10.5px] text-emerald-300/80 space-y-0.5">
        <p>Web & Android Mobile Unified Edition • Google Play Compliant</p>
        <p className="text-[9.5px] text-emerald-400">Tap anywhere to skip</p>
      </div>
    </div>
  );
};
