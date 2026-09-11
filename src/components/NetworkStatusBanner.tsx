import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { testFirestoreConnection } from '../firebase';

export const NetworkStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnectedNotice, setReconnectedNotice] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnectedNotice(true);
      const timer = setTimeout(() => setReconnectedNotice(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setReconnectedNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualCheck = async () => {
    setChecking(true);
    const connected = await testFirestoreConnection();
    setIsOnline(connected);
    if (connected) {
      setReconnectedNotice(true);
      setTimeout(() => setReconnectedNotice(false), 3000);
    }
    setChecking(false);
  };

  if (reconnectedNotice) {
    return (
      <div
        className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs transition-all no-print"
        id="network-reconnected-banner"
      >
        <div className="flex items-center space-x-2">
          <Wifi className="w-4 h-4 text-yellow-300 shrink-0" />
          <span>✓ Internet Restored: Back online & synchronized with Central Cloud Database.</span>
        </div>
        <button
          type="button"
          onClick={() => setReconnectedNotice(false)}
          className="text-white/80 hover:text-white text-xs underline cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs transition-all no-print"
      id="network-offline-banner"
    >
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 text-yellow-300 shrink-0 animate-pulse" />
        <div>
          <span className="font-extrabold">انٹرنیٹ منقطع ہے (Offline Mode): </span>
          <span className="text-amber-100">
            آپ کے تمام ریکارڈز آف لائن کیشے میں محفوظ ہیں۔ انٹرنیٹ بحال ہوتے ہی کلاؤڈ ڈیٹا بیس میں خودکار ہم آہنگ (Sync) ہو جائیں گے۔
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleManualCheck}
        disabled={checking}
        className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-md flex items-center space-x-1.5 self-start sm:self-center transition-all cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
        <span>{checking ? 'Checking...' : 'Check Connection'}</span>
      </button>
    </div>
  );
};
