import * as fs from 'fs';
import * as path from 'path';

export type EmailCidAttachment = {
  filename: string;
  path: string;
  cid: string;
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

/**
 * Merge default CID image attachments (logo + email icons) into an existing
 * attachments list. Skips files that are missing or already attached by cid/filename.
 */
export function withDefaultEmailAttachments<T extends Record<string, any>>(
  existing: T[] = []
): Array<T | EmailCidAttachment> {
  const attachments: Array<T | EmailCidAttachment> = [...existing];

  for (const asset of EMBEDDED_ASSETS) {
    const filePath = path.join(ASSETS_DIR, asset.relativePath);
    if (!fs.existsSync(filePath)) {
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
      });
    }
  }

  return attachments;
}
