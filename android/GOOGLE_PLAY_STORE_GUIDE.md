# Pakistan Post DDRS - Google Play Store Publishing Guide

This guide details how to publish the **Pakistan Post Daily Delivery Reporting System (PakPost DDRS)** Android mobile application to the **Google Play Store**.

---

## 1. App Identity & Package Details
* **App Name**: `PakPost DDRS` (Full: `Pakistan Post - Daily Delivery Reporting`)
* **Package Name**: `com.pakpost.deliveryreporting`
* **Version Code**: `2`
* **Version Name**: `1.1.0`
* **Minimum Android SDK**: `24` (Android 7.0 Nougat)
* **Target Android SDK**: `34` (Android 14 / Android 15 ready - Google Play 2024/2025 mandate)
* **Default Category**: `Business` / `Productivity`

---

## 2. Google AdMob Integration & Policy Compliance
The app includes native Google AdMob Banner and Interstitial placements with secure credential isolation:
* **Test AdMob Application ID**: `ca-app-pub-3940256099942544~3347511713`
* **Test Banner Unit ID**: `ca-app-pub-3940256099942544/6300978111`
* **Test Interstitial Unit ID**: `ca-app-pub-3940256099942544/1033173712`

### To switch to Production AdMob IDs:
1. Log into your [Google AdMob Console](https://admob.google.com).
2. Create an App under **Android** named `Pakistan Post DDRS`.
3. Copy your unique **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`).
4. Create a **Banner** ad unit and an **Interstitial** ad unit.
5. In `.env` / environment settings, update:
   ```env
   VITE_ADMOB_APP_ID="your-production-app-id"
   VITE_ADMOB_BANNER_ID="your-production-banner-id"
   VITE_ADMOB_INTERSTITIAL_ID="your-production-interstitial-id"
   ```
6. Update the `com.google.android.gms.ads.APPLICATION_ID` in `android/app/src/main/AndroidManifest.xml`.
7. Link your AdMob App to your Google Play Console entry under **AdMob > App Settings > App Store details**.

---

## 3. Google Play Console Data Safety Questionnaire
When submitting the app in Google Play Console:
* **Data collected**:
  * Postal Office Identification, postmaster names, daily mail delivery statistics (last balance, received, delivered, RTS, missent, deposit).
* **Data transfer**:
  * All data is encrypted in transit using standard HTTPS / TLS / WSS.
* **Is data shared with third parties?**:
  * No personal or postal data is sold or shared with external third-party advertisers.
* **Ads policy**:
  * Select **"Yes, my app contains ads"** (required due to AdMob).
* **Target Audience**:
  * Select **18 and over** (Postal employees, postmasters, postal inspectors).

---

## 4. Generating Signed Android App Bundle (.aab)
For submission to Google Play Console:
1. Open the `/android` folder in **Android Studio** (or use `./gradlew bundleRelease`).
2. Go to **Build > Generate Signed Bundle / APK...**
3. Choose **Android App Bundle (.aab)**.
4. Select or create your release keystore.
5. Google Play will optimize and distribute the APK to all compatible Android devices.

The direct-download APK for immediate device testing is also pre-built in `/public/PakistanPost_DDRS.apk`.
