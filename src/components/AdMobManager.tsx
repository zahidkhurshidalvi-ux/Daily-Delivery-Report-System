import React, { useState } from 'react';
import { AdMobConfig } from '../types';
import { AdMobPlayerModal } from './AdMobPlayerModal';
import { AdMobBanner } from './AdMobBanner';
import { saveAppConfigToCloud } from '../services/cloudDatabase';
import {
  Play,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Copy,
  CheckCircle2,
  ExternalLink,
  Settings,
  Code2,
  Share2,
  Layers,
  Zap,
  Save,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

interface AdMobManagerProps {
  config: AdMobConfig;
  onUpdateConfig: (newConfig: AdMobConfig) => void;
  onOpenUserAppView?: () => void;
}

// Google Official AdMob Test Unit IDs
const GOOGLE_TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerAdUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialAdUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917',
};

export const AdMobManager: React.FC<AdMobManagerProps> = ({
  config,
  onUpdateConfig,
  onOpenUserAppView,
}) => {
  const [formData, setFormData] = useState<AdMobConfig>(config);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Test Ad Player Modal States
  const [testPlayerOpen, setTestPlayerOpen] = useState<boolean>(false);
  const [testAdType, setTestAdType] = useState<'INTERSTITIAL' | 'REWARDED' | 'BANNER'>('INTERSTITIAL');

  const userAppUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?mode=user`
      : 'https://pakpost-delivery.web.app/?mode=user';

  const handlePlayAd = (type: 'INTERSTITIAL' | 'REWARDED' | 'BANNER') => {
    setTestAdType(type);
    setTestPlayerOpen(true);
  };

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await saveAppConfigToCloud({ adMobConfig: formData });
      onUpdateConfig(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to save AdMob config:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTestIds = () => {
    setFormData((prev) => ({
      ...prev,
      ...GOOGLE_TEST_IDS,
      testMode: true,
    }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(userAppUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  const handleCopySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(id);
      setTimeout(() => setCopiedCode(null), 3000);
    });
  };

  const ANDROID_WEBVIEW_CODE = `// MainActivity.java for Android Studio
package com.pakpost.delivery;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private InterstitialAd mInterstitialAd;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Initialize Google Mobile Ads SDK
        MobileAds.initialize(this, initializationStatus -> loadInterstitialAd());

        webView = findViewById(R.id.webview);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);

        // Bridge so JavaScript can trigger AdMob
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());

        // Load the User App URL
        webView.loadUrl("${userAppUrl}");
    }

    private void loadInterstitialAd() {
        AdRequest adRequest = new AdRequest.Builder().build();
        InterstitialAd.load(this, "${formData.interstitialAdUnitId || GOOGLE_TEST_IDS.interstitialAdUnitId}", adRequest,
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                    mInterstitialAd = interstitialAd;
                }
            });
    }

    public class WebAppInterface {
        @JavascriptInterface
        public void showInterstitialAd() {
            runOnUiThread(() -> {
                if (mInterstitialAd != null) {
                    mInterstitialAd.show(MainActivity.this);
                    loadInterstitialAd();
                }
            });
        }
    }
}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#00401A] to-[#005a26] text-white p-6 rounded-lg shadow-sm border border-[#005522]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-white/10 rounded-lg shrink-0">
              <Smartphone className="w-8 h-8 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Google AdMob & User Android App Management (ایڈموب و موبائل ایپ)
                </h1>
                <span className="bg-yellow-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Ad Monetization & Cloud
                </span>
              </div>
              <p className="text-xs text-green-100 mt-1 max-w-2xl leading-relaxed">
                Connect your Google AdMob account to monetize the User Delivery Report Mobile App while maintaining 100% real-time data sync with the existing Cloud Firestore database. Test and play ads directly below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 text-yellow-300" />
              <span>{copiedLink ? 'Copied!' : 'Copy User App Link'}</span>
            </button>

            {onOpenUserAppView && (
              <button
                type="button"
                onClick={onOpenUserAppView}
                className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open User App View</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS NOTIFICATION */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg flex items-center gap-3 text-xs shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">AdMob configurations successfully saved and synchronized with Cloud Firestore!</span>
        </div>
      )}

      {/* SECTION 1: THE REQUESTED "AD PLAY" CONSOLE */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-[#006633]" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
              Live Ad Play & Test Console (ایڈ چلائیں / لائیو ٹیسٹ)
            </h2>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>Interactive Simulator</span>
          </span>
        </div>

        <p className="text-xs text-gray-600">
          Click any button below to instantly trigger and experience the ad playback as branch postmasters will see it on their mobile phones:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Play Interstitial Ad */}
          <button
            type="button"
            onClick={() => handlePlayAd('INTERSTITIAL')}
            className="bg-gradient-to-br from-[#006633] to-[#004d26] hover:from-[#005522] hover:to-[#00381b] text-white p-4 rounded-xl shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <Play className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              </div>
              <span className="bg-yellow-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                AdMob Interstitial
              </span>
            </div>
            <div>
              <div className="font-black text-sm">▶ Play Interstitial Ad</div>
              <div className="text-[11px] text-green-100 mt-0.5">
                فل سکرین اشتہار چلائیں (فارم کھلنے پر)
              </div>
            </div>
          </button>

          {/* Play Rewarded Ad */}
          <button
            type="button"
            onClick={() => handlePlayAd('REWARDED')}
            className="bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white p-4 rounded-xl shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5 text-yellow-200 fill-yellow-200" />
              </div>
              <span className="bg-white text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                Rewarded Video
              </span>
            </div>
            <div>
              <div className="font-black text-sm">▶ Play Rewarded Ad</div>
              <div className="text-[11px] text-amber-100 mt-0.5">
                انعامی ویڈیو اشتہار چلائیں (رپورٹ جمع ہونے پر)
              </div>
            </div>
          </button>

          {/* Preview Banner Ad */}
          <button
            type="button"
            onClick={() => handlePlayAd('BANNER')}
            className="bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white p-4 rounded-xl shadow-sm text-left transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="bg-yellow-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                Smart Banner
              </span>
            </div>
            <div>
              <div className="font-black text-sm">▶ Preview Banner Ad</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                موبائل اسکرین بینر کا لائیو نمونہ دیکھیں
              </div>
            </div>
          </button>
        </div>

        {/* Live Banner Preview Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Live Banner Container Preview (موجودہ بینر ایڈ نمونہ)
          </span>
          <AdMobBanner config={formData} position="bottom" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION 2: ADMOB UNIT CONFIGURATION */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#006633]" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                Google AdMob Configuration (ایڈ یونٹس کی ترتیبات)
              </h2>
            </div>
            <button
              type="button"
              onClick={handleLoadTestIds}
              className="text-[11px] text-[#006633] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Google Official Test IDs</span>
            </button>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            {/* Master Toggle */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between">
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  Enable Google AdMob in User App (اشتہارات فعال کریں)
                </span>
                <span className="text-[11px] text-slate-500">
                  When enabled, banner and interstitial ads will be displayed in the user mobile app.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#006633]"></div>
              </label>
            </div>

            {/* AdMob App ID */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                AdMob App ID (Android: ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy)
              </label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                placeholder="ca-app-pub-3940256099942544~3347511713"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-[#006633] outline-none"
              />
            </div>

            {/* Banner Ad Unit ID */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Banner Ad Unit ID (بینر ایڈ یونٹ آئی ڈی)
              </label>
              <input
                type="text"
                value={formData.bannerAdUnitId}
                onChange={(e) => setFormData({ ...formData, bannerAdUnitId: e.target.value })}
                placeholder="ca-app-pub-3940256099942544/6300978111"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-[#006633] outline-none"
              />
            </div>

            {/* Interstitial Ad Unit ID */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Interstitial Ad Unit ID (انٹرسٹیشل ایڈ یونٹ آئی ڈی)
              </label>
              <input
                type="text"
                value={formData.interstitialAdUnitId}
                onChange={(e) => setFormData({ ...formData, interstitialAdUnitId: e.target.value })}
                placeholder="ca-app-pub-3940256099942544/1033173712"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-[#006633] outline-none"
              />
            </div>

            {/* Rewarded Ad Unit ID */}
            <div>
              <label className="block font-bold text-gray-700 mb-1">
                Rewarded Ad Unit ID (اختیاری)
              </label>
              <input
                type="text"
                value={formData.rewardedAdUnitId}
                onChange={(e) => setFormData({ ...formData, rewardedAdUnitId: e.target.value })}
                placeholder="ca-app-pub-3940256099942544/5224354917"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-[#006633] outline-none"
              />
            </div>

            {/* Trigger Options */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <span className="font-bold text-gray-800 block">Ad Display Triggers (اشتہار کب چلے):</span>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showOnFormOpen}
                  onChange={(e) => setFormData({ ...formData, showOnFormOpen: e.target.checked })}
                  className="rounded text-[#006633] focus:ring-[#006633]"
                />
                <span className="text-gray-700">
                  Play Interstitial Ad when user clicks <strong>"Daily Delivery Report"</strong> tab
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.showOnReportSubmit}
                  onChange={(e) => setFormData({ ...formData, showOnReportSubmit: e.target.checked })}
                  className="rounded text-[#006633] focus:ring-[#006633]"
                />
                <span className="text-gray-700">
                  Play Rewarded / Interstitial Ad after user submits Daily Delivery Report
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.testMode}
                  onChange={(e) => setFormData({ ...formData, testMode: e.target.checked })}
                  className="rounded text-[#006633] focus:ring-[#006633]"
                />
                <span className="text-gray-700">
                  Enable Test Mode (Google Test Ads safe for development)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-[#006633] hover:bg-[#005522] text-white font-bold py-2.5 px-4 rounded shadow transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save AdMob Settings to Cloud Firestore</span>
            </button>
          </form>
        </div>

        {/* SECTION 3: ANDROID APK & WEB LINKS */}
        <div className="lg:col-span-1 space-y-4">
          {/* Web Links Box */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3 text-xs">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
              <Share2 className="w-4 h-4 text-[#006633]" />
              <h3 className="font-bold text-gray-900 uppercase">Shareable Web & App Links</h3>
            </div>

            <div>
              <label className="block text-gray-600 font-semibold mb-1">
                Direct User Side Link (برائے ڈاکخانہ جات):
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  readOnly
                  value={userAppUrl}
                  className="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono text-[11px] text-gray-700 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="bg-[#006633] hover:bg-[#005522] text-white p-2 rounded transition-colors shrink-0 cursor-pointer"
                  title="Copy Link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copiedLink && (
                <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                  ✓ Link Copied to Clipboard!
                </span>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 leading-relaxed">
              <strong>Tip for Branch Postmasters:</strong> Send this link on WhatsApp. When opened on mobile, tapping <em>"Daily Delivery Report"</em> automatically opens the report form with auto-calculated balances.
            </div>
          </div>

          {/* Android Studio Integration Snippet */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#006633]" />
                <h3 className="font-bold text-gray-900 uppercase">Android Studio Code</h3>
              </div>
              <button
                type="button"
                onClick={() => handleCopySnippet(ANDROID_WEBVIEW_CODE, 'android-code')}
                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-2 py-1 rounded transition-colors cursor-pointer"
              >
                {copiedCode === 'android-code' ? 'Copied!' : 'Copy Code'}
              </button>
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed">
              Wrap this web link into an Android Studio WebView project with Google Mobile Ads SDK for native AdMob monetization:
            </p>

            <pre className="bg-slate-900 text-slate-200 p-3 rounded text-[10px] font-mono overflow-x-auto max-h-44">
              {ANDROID_WEBVIEW_CODE}
            </pre>
          </div>
        </div>
      </div>

      {/* Ad Player Modal */}
      <AdMobPlayerModal
        isOpen={testPlayerOpen}
        onClose={() => setTestPlayerOpen(false)}
        config={formData}
        adType={testAdType}
      />
    </div>
  );
};
