import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

declare global {
  interface Window {
    __appLoaded?: boolean;
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    window.__appLoaded = true;
  } catch (error: any) {
    console.error('Fatal initialization error in createRoot:', error);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #F0F2F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #00401A; text-align: center; padding: 20px;">
        <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 6px 0;">پاکستان پوسٹ — سسٹم لوڈنگ نوٹس</h2>
        <p style="font-size: 13px; font-weight: 600; margin: 0 0 12px 0; color: #334155;">Pakistan Post • Daily Delivery Reporting System</p>
        <div style="background-color: #ffffff; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #b91c1c; max-width: 500px; word-break: break-word; text-align: left;">
          ${error?.message || 'Application initialization error'}
        </div>
        <button onclick="try{localStorage.clear();sessionStorage.clear();}catch(e){}window.location.reload();" style="margin-top: 16px; padding: 10px 24px; background-color: #00401A; color: #ffffff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">
          کیچ صاف کر کے دوبارہ لوڈ کریں (Reset & Reload)
        </button>
      </div>
    `;
  }
}
