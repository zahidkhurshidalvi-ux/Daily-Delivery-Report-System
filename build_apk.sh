#!/bin/bash
set -e

echo "=== PAKISTAN POST DDRS - MODERN SIGNED APK BUILD ==="
BUILD_DIR="/tmp/apk_build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/src/com/pakpost/deliveryreporting"
mkdir -p "$BUILD_DIR/bin"
mkdir -p "$BUILD_DIR/res/drawable"
mkdir -p "$BUILD_DIR/res/values"
mkdir -p "$BUILD_DIR/assets"

ANDROID_JAR="./android-33.jar"

# 1. Copy web app assets into APK assets
echo "Copying web app into APK assets..."
cp -r dist/* "$BUILD_DIR/assets/"
rm -f "$BUILD_DIR/assets/"*.apk* "$BUILD_DIR/assets/"server.cjs*

# 2. Copy App Icon
cp public/icon-192.png "$BUILD_DIR/res/drawable/icon.png"

# 3. Values
cat << 'XML' > "$BUILD_DIR/res/values/strings.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">PakPost DDRS</string>
</resources>
XML

# 4. Modern AndroidManifest for Android 7.0 - 15 (Target SDK 33)
cat << 'XML' > "$BUILD_DIR/AndroidManifest.xml"
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.pakpost.deliveryreporting"
    android:versionCode="2"
    android:versionName="1.1.0"
    android:compileSdkVersion="33"
    android:compileSdkVersionCodename="13">

    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="33" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/icon"
        android:usesCleartextTraffic="true"
        android:hardwareAccelerated="true"
        android:allowBackup="true"
        android:supportsRtl="true">
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
XML

# 5. Native Java Activity with Embedded Asset Interception
cat << 'JAVA' > "$BUILD_DIR/src/com/pakpost/deliveryreporting/MainActivity.java"
package com.pakpost.deliveryreporting;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.graphics.Bitmap;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.view.Gravity;
import android.view.View;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView mWebView;
    private ProgressBar mProgressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(0xFF00401A);

        mWebView = new WebView(this);
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        mProgressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        mProgressBar.setMax(100);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, 8, Gravity.TOP
        );

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://pakpost.local")) {
                    String path = request.getUrl().getPath();
                    if (path == null || path.isEmpty() || path.equals("/")) {
                        path = "index.html";
                    } else if (path.startsWith("/")) {
                        path = path.substring(1);
                    }
                    try {
                        InputStream is = getAssets().open(path);
                        String mime = "application/octet-stream";
                        if (path.endsWith(".html")) mime = "text/html";
                        else if (path.endsWith(".js")) mime = "application/javascript";
                        else if (path.endsWith(".css")) mime = "text/css";
                        else if (path.endsWith(".png")) mime = "image/png";
                        else if (path.endsWith(".svg")) mime = "image/svg+xml";
                        else if (path.endsWith(".json")) mime = "application/json";
                        else if (path.endsWith(".woff2")) mime = "font/woff2";
                        else if (path.endsWith(".woff")) mime = "font/woff";
                        else if (path.endsWith(".ttf")) mime = "font/ttf";

                        Map<String, String> headers = new HashMap<String, String>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Cache-Control", "no-cache");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
                    } catch (Exception e) {
                        return null;
                    }
                }
                return null;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                mProgressBar.setVisibility(View.VISIBLE);
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                mProgressBar.setVisibility(View.GONE);
            }
        });

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                mProgressBar.setProgress(newProgress);
                if (newProgress >= 100) {
                    mProgressBar.setVisibility(View.GONE);
                }
            }
        });

        rootLayout.addView(mWebView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));
        rootLayout.addView(mProgressBar, pbParams);

        setContentView(rootLayout);
        mWebView.loadUrl("https://pakpost.local/index.html?mode=user");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
JAVA

echo "Compiling resources with aapt..."
aapt package -f -m -J "$BUILD_DIR/src" \
  -M "$BUILD_DIR/AndroidManifest.xml" \
  -S "$BUILD_DIR/res" \
  -I "$ANDROID_JAR" \
  --min-sdk-version 24 \
  --target-sdk-version 33

echo "Compiling Java sources..."
javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
  -d "$BUILD_DIR/bin" \
  "$BUILD_DIR/src/com/pakpost/deliveryreporting/"*.java

echo "Converting class files to Dalvik DEX format..."
dx --dex --output="$BUILD_DIR/bin/classes.dex" "$BUILD_DIR/bin"

echo "Packaging complete APK with assets..."
aapt package -f \
  -M "$BUILD_DIR/AndroidManifest.xml" \
  -S "$BUILD_DIR/res" \
  -A "$BUILD_DIR/assets" \
  -I "$ANDROID_JAR" \
  --min-sdk-version 24 \
  --target-sdk-version 33 \
  -F "$BUILD_DIR/unsigned.apk" \
  "$BUILD_DIR/bin"

echo "Aligning APK with zipalign..."
zipalign -v -p 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

echo "Signing APK with Play-compliant Keystore..."
KEYSTORE="$BUILD_DIR/release.keystore"
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -alias pakpost \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass pakpost123 \
  -keypass pakpost123 \
  -dname "CN=Pakistan Post, OU=Postal Services, O=Pakistan Post, L=Islamabad, ST=Islamabad, C=PK"

apksigner sign --ks "$KEYSTORE" \
  --ks-pass pass:pakpost123 \
  --key-pass pass:pakpost123 \
  --ks-key-alias pakpost \
  --out public/PakistanPost_DDRS.apk \
  "$BUILD_DIR/aligned.apk"

# Also sync to old filename
cp public/PakistanPost_DDRS.apk public/PakistanPost_DeliveryReport.apk

echo "Verifying signed APK..."
apksigner verify --verbose public/PakistanPost_DDRS.apk

aapt dump badging public/PakistanPost_DDRS.apk

ls -lh public/PakistanPost_DDRS.apk
echo "=== BUILD FINISHED SUCCESSFULLY ==="
