import * as fs from 'fs';
import { Config } from '@/config';

const ICON_FILES = ['instagram', 'tiktok', 'x', 'linkedin'] as const;
export type EmailSocialIconName = (typeof ICON_FILES)[number];

/**
 * Public HTTPS URLs for footer social icons (Gmail, Apple Mail, etc.).
 * Set after running: npm run upload:email-icons
 * Or override with EMAIL_SOCIAL_ICONS_BASE_URL (no trailing slash).
 */
export const EMAIL_SOCIAL_ICON_CDN_URLS: Record<EmailSocialIconName, string> = {
  instagram:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353205/spiriment/email-icons/instagram.png',
  tiktok:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353206/spiriment/email-icons/tiktok.png',
  x: 'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353207/spiriment/email-icons/x.png',
  linkedin:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353208/spiriment/email-icons/linkedin.png',
};

const dataUriCache = new Map<EmailSocialIconName, string>();

function readIconDataUri(name: EmailSocialIconName): string | null {
  if (dataUriCache.has(name)) {
    return dataUriCache.get(name)!;
  }

  const candidates = [
    `${__dirname}/../mails/assets/email-icons/${name}.png`,
    `${process.cwd()}/dist/mails/assets/email-icons/${name}.png`,
    `${process.cwd()}/src/mails/assets/email-icons/${name}.png`,
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const b64 = fs.readFileSync(filePath).toString('base64');
    const uri = `data:image/png;base64,${b64}`;
    dataUriCache.set(name, uri);
    return uri;
  }

  return null;
}

function cloudinaryFolderBaseUrl(): string | null {
  const cloudName = Config.cloudinary?.cloudName;
  if (!cloudName) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/spiriment/email-icons`;
}

/** Do not use api.spiriment.com — that host returns 403 for image fetches from mail clients. */
export function getEmailSocialIconSrc(name: EmailSocialIconName): string {
  const envBase = process.env.EMAIL_SOCIAL_ICONS_BASE_URL?.replace(/\/$/, '');
  if (envBase) {
    return `${envBase}/${name}.png`;
  }

  const cdn = EMAIL_SOCIAL_ICON_CDN_URLS[name]?.trim();
  if (cdn) {
    return cdn;
  }

  const folder = cloudinaryFolderBaseUrl();
  if (folder) {
    return `${folder}/${name}.png`;
  }

  const dataUri = readIconDataUri(name);
  if (dataUri) {
    return dataUri;
  }

  return `cid:icon-${name === 'x' ? 'x' : name}`;
}

export function getEmailLayoutSocialIconSources(): {
  iconInstagramSrc: string;
  iconTiktokSrc: string;
  iconXSrc: string;
  iconLinkedinSrc: string;
} {
  return {
    iconInstagramSrc: getEmailSocialIconSrc('instagram'),
    iconTiktokSrc: getEmailSocialIconSrc('tiktok'),
    iconXSrc: getEmailSocialIconSrc('x'),
    iconLinkedinSrc: getEmailSocialIconSrc('linkedin'),
  };
}
