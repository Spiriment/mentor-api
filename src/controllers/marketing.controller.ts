import { Request, Response } from 'express';
import { adminBroadcastService } from '@/services/adminBroadcast.service';

export const MarketingController = {
  async unsubscribe(req: Request, res: Response) {
    const email = String(req.query.email ?? '').trim().toLowerCase();
    const token = String(req.query.token ?? '').trim();

    if (!email || !token) {
      return res.status(400).send(renderPage(false, 'Invalid unsubscribe link.'));
    }

    const ok = await adminBroadcastService.unsubscribeEmail(email, token);
    if (!ok) {
      return res.status(400).send(renderPage(false, 'Invalid or expired unsubscribe link.'));
    }

    return res.status(200).send(
      renderPage(
        true,
        'You have been unsubscribed from Spiriment marketing emails. You may still receive account and session notifications.'
      )
    );
  },
};

function renderPage(success: boolean, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spiriment — Email preferences</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 40px 16px; color: #162419; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 12px rgba(0,0,0,.06); text-align: center; }
    h1 { font-size: 22px; color: #3A5A40; margin: 0 0 12px; }
    p { line-height: 1.6; margin: 0; }
    .ok { color: #3A5A40; }
    .err { color: #b42318; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? 'Unsubscribed' : 'Unable to unsubscribe'}</h1>
    <p class="${success ? 'ok' : 'err'}">${message}</p>
  </div>
</body>
</html>`;
}
