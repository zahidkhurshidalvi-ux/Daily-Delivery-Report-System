import { AdMobConfig } from '../types';

// Default Official Google AdMob Test Ad Unit IDs for Android
// https://developers.google.com/admob/android/test-ads
export const DEFAULT_ADMOB_CONFIG: AdMobConfig = {
  appId: ((import.meta as any).env?.VITE_ADMOB_APP_ID as string) || 'ca-app-pub-3940256099942544~3347511713',
  bannerAdUnitId: ((import.meta as any).env?.VITE_ADMOB_BANNER_ID as string) || 'ca-app-pub-3940256099942544/6300978111',
  interstitialAdUnitId: ((import.meta as any).env?.VITE_ADMOB_INTERSTITIAL_ID as string) || 'ca-app-pub-3940256099942544/1033173712',
  testMode: true,
  bannerEnabled: true,
  interstitialEnabled: true,
};

let activeAdMobConfig: AdMobConfig = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('pakpost_admob_config');
      if (saved) {
        return { ...DEFAULT_ADMOB_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      // ignore
    }
  }
  return { ...DEFAULT_ADMOB_CONFIG };
})();

export function getAdMobConfig(): AdMobConfig {
  return activeAdMobConfig;
}

export function updateAdMobConfig(newConfig: Partial<AdMobConfig>): AdMobConfig {
  activeAdMobConfig = { ...activeAdMobConfig, ...newConfig };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('pakpost_admob_config', JSON.stringify(activeAdMobConfig));
    } catch (e) {
      // ignore
    }
  }
  return activeAdMobConfig;
}

// Global interface for Android WebView AdMob JavaScript Bridge
declare global {
  interface Window {
    AndroidAdMob?: {
      showInterstitial: () => void;
      loadBanner: (adUnitId: string) => void;
      hideBanner: () => void;
      isNativeApp: () => boolean;
    };
  }
}

// In-memory frequency limiter to prevent disruptive ad spam (Google Play Policy compliance)
let lastInterstitialTime = 0;
const INTERSTITIAL_COOLDOWN_MS = 60 * 1000; // 60 seconds minimum between interstitials

export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Boolean(window.AndroidAdMob && window.AndroidAdMob.isNativeApp && window.AndroidAdMob.isNativeApp()) ||
    window.location.search.includes('platform=android') ||
    window.location.search.includes('mode=user') ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function canShowInterstitial(): boolean {
  const now = Date.now();
  if (now - lastInterstitialTime < INTERSTITIAL_COOLDOWN_MS) {
    return false;
  }
  return true;
}

export function recordInterstitialShown(): void {
  lastInterstitialTime = Date.now();
}

export function triggerNativeOrWebInterstitial(onCompleted?: () => void): boolean {
  if (!canShowInterstitial()) {
    if (onCompleted) onCompleted();
    return false;
  }

  // If running inside Android WebView with native AdMob SDK bridge
  if (window.AndroidAdMob && typeof window.AndroidAdMob.showInterstitial === 'function') {
    try {
      window.AndroidAdMob.showInterstitial();
      recordInterstitialShown();
      if (onCompleted) {
        setTimeout(onCompleted, 1000);
      }
      return true;
    } catch (e) {
      console.warn('Native AdMob bridge failed, falling back to web ad:', e);
    }
  }

  recordInterstitialShown();
  return true;
}
