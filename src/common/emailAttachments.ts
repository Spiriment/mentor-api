import * as fs from 'fs';
import * as path from 'path';

export type EmailCidAttachment = {
  filename: string;
  path: string;
  cid: string;
  contentType: string;
  contentDisposition: 'inline';
};

const ASSETS_DIR = path.join(__dirname, '../mails/assets');

/** Logo + footer/social + verification tip icons embedded via CID. */
const EMBEDDED_ASSETS: Array<{ relativePath: string; cid: string }> = [
  { relativePath: 'logo.png', cid: 'logo' },
  { relativePath: 'email-icons/instagram.png', cid: 'icon-instagram' },
  { relativePath: 'email-icons/tiktok.png', cid: 'icon-tiktok' },
  { relativePath: 'email-icons/x.png', cid: 'icon-x' },
  { relativePath: 'email-icons/linkedin.png', cid: 'icon-linkedin' },
  { relativePath: 'email-icons/icon-clock.png', cid: 'icon-clock' },
  { relativePath: 'email-icons/icon-shield.png', cid: 'icon-shield' },
];

function resolveAssetPath(relativePath: string): string | null {
  const primary = path.join(ASSETS_DIR, relativePath);
  if (fs.existsSync(primary)) return primary;

  // Fallback when running from unexpected build layouts
  const alt = path.join(process.cwd(), 'src/mails/assets', relativePath);
  if (fs.existsSync(alt)) return alt;

  const altDist = path.join(process.cwd(), 'dist/mails/assets', relativePath);
  if (fs.existsSync(altDist)) return altDist;

  return null;
}

/** Public base for hosted email icons (`/email-icons/...`) — broadcasts only; do not use for transactional mail (api host may block image fetches). */
export function getEmailIconsBaseUrl(): string {
  const base = (
    process.env.API_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    process.env.EMAIL_ASSETS_BASE_URL ||
    ''
  ).replace(/\/$/, '');

  if (!base) return '';

  // Localhost URLs are unreachable from recipient mail clients — keep CID instead.
  try {
    const host = new URL(base).hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return '';
    }
  } catch {
    return '';
  }

  return `${base}/email-icons`;
}

/**
 * Merge default CID image attachments (logo + email icons) into an existing
 * attachments list. Skips files that are missing or already attached by cid/filename.
 */
export function withDefaultEmailAttachments<T extends Record<string, any>>(
  existing: T[] = []
): Array<T | EmailCidAttachment> {
  const attachments: Array<T | EmailCidAttachment> = [...existing];

  for (const asset of EMBEDDED_ASSETS) {
    const filePath = resolveAssetPath(asset.relativePath);
    if (!filePath) {
      continue;
    }

    const filename = path.basename(asset.relativePath);
    const alreadyAttached = attachments.some(
      (att) => att.cid === asset.cid || att.filename === filename
    );

    if (!alreadyAttached) {
      attachments.push({
        filename,
        path: filePath,
        cid: asset.cid,
        contentType: 'image/png',
        contentDisposition: 'inline',
      });
    }
  }

  return attachments;
}
