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

type ConfigListener = (config: AdMobConfig) => void;
const listeners: Set<ConfigListener> = new Set();

let activeAdMobConfig: AdMobConfig = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('pakpost_admob_config') || localStorage.getItem('pakpost_admob_config_permanent');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_ADMOB_CONFIG,
          ...parsed,
          appId: parsed.appId || DEFAULT_ADMOB_CONFIG.appId,
          bannerAdUnitId: parsed.bannerAdUnitId || DEFAULT_ADMOB_CONFIG.bannerAdUnitId,
          interstitialAdUnitId: parsed.interstitialAdUnitId || DEFAULT_ADMOB_CONFIG.interstitialAdUnitId,
        };
      }
    } catch (e) {
      console.warn('Could not parse saved AdMob config:', e);
    }
  }
  return { ...DEFAULT_ADMOB_CONFIG };
})();

export function getAdMobConfig(): AdMobConfig {
  return activeAdMobConfig;
}

export function subscribeToLocalAdMobConfig(listener: ConfigListener): () => void {
  listeners.add(listener);
  listener(activeAdMobConfig);
  return () => {
    listeners.delete(listener);
  };
}

export function updateAdMobConfig(newConfig: Partial<AdMobConfig>): AdMobConfig {
  // Guard: NEVER overwrite valid custom IDs with empty strings or undefined
  const cleaned: Partial<AdMobConfig> = {};
  if (newConfig.appId && typeof newConfig.appId === 'string' && newConfig.appId.trim().length > 0) {
    cleaned.appId = newConfig.appId.trim();
  }
  if (newConfig.bannerAdUnitId && typeof newConfig.bannerAdUnitId === 'string' && newConfig.bannerAdUnitId.trim().length > 0) {
    cleaned.bannerAdUnitId = newConfig.bannerAdUnitId.trim();
  }
  if (newConfig.interstitialAdUnitId && typeof newConfig.interstitialAdUnitId === 'string' && newConfig.interstitialAdUnitId.trim().length > 0) {
    cleaned.interstitialAdUnitId = newConfig.interstitialAdUnitId.trim();
  }
  if (typeof newConfig.testMode === 'boolean') {
    cleaned.testMode = newConfig.testMode;
  }
  if (typeof newConfig.bannerEnabled === 'boolean') {
    cleaned.bannerEnabled = newConfig.bannerEnabled;
  }
  if (typeof newConfig.interstitialEnabled === 'boolean') {
    cleaned.interstitialEnabled = newConfig.interstitialEnabled;
  }

  activeAdMobConfig = { ...activeAdMobConfig, ...cleaned };

  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(activeAdMobConfig);
      localStorage.setItem('pakpost_admob_config', serialized);
      localStorage.setItem('pakpost_admob_config_permanent', serialized);
    } catch (e) {
      // ignore
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(activeAdMobConfig);
    } catch (e) {
      // ignore
    }
  });

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
