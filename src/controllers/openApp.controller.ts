import { Request, Response } from 'express';
import {
  ANDROID_PLAY_STORE_URL,
  IOS_APP_STORE_URL,
  normalizeAppDeepPath,
} from '@/common/constants/appEmailLinks';

const ALLOWED_PREFIXES = [
  'onboarding',
  'home',
  'profile',
  'sessions',
  'mentors',
  'notifications',
  'schedule',
  'reports',
  'chat',
  'browse-mentors',
  'group-sessions',
  'subscription',
];

function isAllowedAppPath(path: string): boolean {
  if (!path || path.length > 256) return false;
  if (/[<>"']/.test(path)) return false;
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** GET /open-app?to=onboarding — email-safe redirect into the Spiriment app. */
export function openAppHandler(req: Request, res: Response): void {
  const raw = typeof req.query.to === 'string' ? req.query.to : 'onboarding';
  const appPath = normalizeAppDeepPath(raw);
  const safePath = isAllowedAppPath(appPath) ? appPath : 'onboarding';
  const deepLink = `spiriment://${safePath}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Open Spiriment</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F4F7F3; color: #162419; margin: 0; padding: 32px 20px;
      text-align: center; }
    .card { max-width: 420px; margin: 0 auto; background: #fff; border-radius: 16px;
      padding: 32px 24px; box-shadow: 0 4px 24px rgba(22,36,25,.08); }
    h1 { font-size: 22px; color: #3A5A40; margin: 0 0 12px; }
    p { font-size: 15px; line-height: 1.6; color: #35502F; margin: 0 0 20px; }
    a.btn { display: inline-block; background: #3A5A40; color: #fff !important;
      text-decoration: none; padding: 14px 28px; border-radius: 999px;
      font-weight: 600; font-size: 15px; margin: 6px; }
    a.secondary { background: transparent; color: #3A5A40 !important; border: 1.5px solid #3A5A40; }
    .stores { margin-top: 20px; font-size: 13px; }
    .stores a { color: #3A5A40; }
  </style>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var iosStore = ${JSON.stringify(IOS_APP_STORE_URL)};
      var androidStore = ${JSON.stringify(ANDROID_PLAY_STORE_URL)};
      var ua = navigator.userAgent || '';
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      var isAndroid = /Android/i.test(ua);
      var storeUrl = isIOS ? iosStore : isAndroid ? androidStore : iosStore;

      function openApp() {
        window.location.href = deepLink;
        setTimeout(function () {
          window.location.href = storeUrl;
        }, 1800);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', openApp);
      } else {
        openApp();
      }
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>Opening Spiriment…</h1>
    <p>If the app doesn't open automatically, tap below.</p>
    <p>
      <a class="btn" href="${deepLink}">Open Spiriment app</a>
    </p>
    <p class="stores">
      Don't have the app?
      <a href="${IOS_APP_STORE_URL}">App Store</a>
      ·
      <a href="${ANDROID_PLAY_STORE_URL}">Google Play</a>
    </p>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(html);
}
