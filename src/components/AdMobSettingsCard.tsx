import React, { useState, useEffect } from 'react';
import { AdMobConfig } from '../types';
import { DEFAULT_ADMOB_CONFIG, getAdMobConfig, updateAdMobConfig, subscribeToLocalAdMobConfig } from '../utils/admob';
import { Sparkles, Save, CheckCircle2, Play, Shield, RefreshCw } from 'lucide-react';

interface AdMobSettingsCardProps {
  onShowInterstitialTest?: () => void;
  onSaveToCloud?: (config: AdMobConfig) => Promise<void> | void;
}

export const AdMobSettingsCard: React.FC<AdMobSettingsCardProps> = ({
  onShowInterstitialTest,
  onSaveToCloud,
}) => {
  const current = getAdMobConfig();
  const [appId, setAppId] = useState(current.appId);
  const [bannerId, setBannerId] = useState(current.bannerAdUnitId);
  const [interstitialId, setInterstitialId] = useState(current.interstitialAdUnitId);
  const [testMode, setTestMode] = useState(current.testMode);
  const [bannerEnabled, setBannerEnabled] = useState(current.bannerEnabled);
  const [interstitialEnabled, setInterstitialEnabled] = useState(current.interstitialEnabled);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const unsub = subscribeToLocalAdMobConfig((cfg) => {
      setAppId(cfg.appId);
      setBannerId(cfg.bannerAdUnitId);
      setInterstitialId(cfg.interstitialAdUnitId);
      setTestMode(cfg.testMode);
      setBannerEnabled(cfg.bannerEnabled);
      setInterstitialEnabled(cfg.interstitialEnabled);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AdMobConfig = {
      appId: appId.trim() || DEFAULT_ADMOB_CONFIG.appId,
      bannerAdUnitId: bannerId.trim() || DEFAULT_ADMOB_CONFIG.bannerAdUnitId,
      interstitialAdUnitId: interstitialId.trim() || DEFAULT_ADMOB_CONFIG.interstitialAdUnitId,
      testMode,
      bannerEnabled,
      interstitialEnabled,
    };
    updateAdMobConfig(updated);
    if (onSaveToCloud) {
      await onSaveToCloud(updated);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLoadTestIds = () => {
    setAppId(DEFAULT_ADMOB_CONFIG.appId);
    setBannerId(DEFAULT_ADMOB_CONFIG.bannerAdUnitId);
    setInterstitialId(DEFAULT_ADMOB_CONFIG.interstitialAdUnitId);
    setTestMode(true);
  };

  return (
    <div className="bg-white border border-gray-200 p-5 rounded-lg shadow-sm space-y-5" id="admob-settings-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-gray-900 leading-tight">
                Google AdMob Configuration & IDs (گوگل ایڈموب آئی ڈیز)
              </h2>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                testMode
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {testMode ? 'Test Mode' : 'Live Production'}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              Android Mobile App & Web App shared monetization settings. Enter your production AdMob IDs or use Google test IDs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleLoadTestIds}
            className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-md border border-gray-300 font-bold flex items-center space-x-1 transition-colors cursor-pointer"
            title="Reset to Google Official Test IDs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Load Test IDs</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-md text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Google AdMob IDs saved successfully! Updated across Web and Android Mobile App.</span>
        </div>
      )}

      {/* Form for AdMob IDs */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AdMob Application ID */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-extrabold text-gray-700">
              1. AdMob Application ID (ایپ آئی ڈی)
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="ca-app-pub-3940256099942544~3347511713"
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-mono font-bold rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005522]"
            />
            <p className="text-[11px] text-gray-500">
              Matches your Android App ID from your AdMob Console (format: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">ca-app-pub-XXXX~YYYY</code>).
            </p>
          </div>

          {/* Banner Ad Unit ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-gray-700">
              2. Banner Ad Unit ID (بینر ایڈ یونٹ آئی ڈی)
            </label>
            <input
              type="text"
              value={bannerId}
              onChange={(e) => setBannerId(e.target.value)}
              placeholder="ca-app-pub-3940256099942544/6300978111"
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-mono font-bold rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005522]"
            />
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Standard 320x50 Banner ID</span>
              <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={bannerEnabled}
                  onChange={(e) => setBannerEnabled(e.target.checked)}
                  className="rounded text-[#005522] focus:ring-[#005522]"
                />
                <span>Banner Active</span>
              </label>
            </div>
          </div>

          {/* Interstitial Ad Unit ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-extrabold text-gray-700">
              3. Interstitial Ad Unit ID (انٹرسٹیشل ایڈ یونٹ آئی ڈی)
            </label>
            <input
              type="text"
              value={interstitialId}
              onChange={(e) => setInterstitialId(e.target.value)}
              placeholder="ca-app-pub-3940256099942544/1033173712"
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs font-mono font-bold rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005522]"
            />
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>Full-screen Interstitial ID</span>
              <label className="flex items-center space-x-1.5 cursor-pointer font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={interstitialEnabled}
                  onChange={(e) => setInterstitialEnabled(e.target.checked)}
                  className="rounded text-[#005522] focus:ring-[#005522]"
                />
                <span>Interstitial Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Mode Selector & Action Buttons */}
        <div className="pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="admobMode"
                checked={testMode}
                onChange={() => setTestMode(true)}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span>Google Test Ads (Safe Testing)</span>
            </label>
            <label className="flex items-center space-x-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="radio"
                name="admobMode"
                checked={!testMode}
                onChange={() => setTestMode(false)}
                className="text-emerald-600 focus:ring-emerald-500"
              />
              <span>Live Production Ads</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            {onShowInterstitialTest && (
              <button
                type="button"
                onClick={onShowInterstitialTest}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-3 py-2 rounded-lg border border-amber-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Test Interstitial Ad</span>
              </button>
            )}

            <button
              type="submit"
              className="bg-[#005522] hover:bg-[#00401A] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save AdMob IDs</span>
            </button>
          </div>
        </div>
      </form>

      {/* Helper Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
        <div className="flex items-center space-x-1.5 font-bold text-gray-800">
          <Shield className="w-3.5 h-3.5 text-[#005522]" />
          <span>Google Play Store Compliance Note:</span>
        </div>
        <p className="text-[11.5px] leading-relaxed">
          While building and testing, always use Google Test IDs. When publishing to Google Play Store, change the radio button to <strong>Live Production Ads</strong> with your genuine AdMob IDs. All IDs are protected and loaded securely via client & cloud configuration.
        </p>
      </div>
    </div>
  );
};
