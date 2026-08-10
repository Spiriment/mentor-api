import * as fs from 'fs';
import { Config } from '@/config';

const SOCIAL_ICONS = ['instagram', 'tiktok', 'x', 'linkedin'] as const;
export type EmailSocialIconName = (typeof SOCIAL_ICONS)[number];

/**
 * Public HTTPS URLs for email images (Gmail, Apple Mail, etc.).
 * Refresh via: npm run upload:email-icons
 */
export const EMAIL_ICON_CDN_URLS: Record<string, string> = {
  instagram:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353761/spiriment/email-icons/instagram.png',
  tiktok:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786355666/spiriment/email-icons/tiktok.png',
  x: 'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353767/spiriment/email-icons/x.png',
  linkedin:
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786353768/spiriment/email-icons/linkedin.png',
  'icon-clock':
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786355669/spiriment/email-icons/icon-clock.png',
  'icon-shield':
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786355670/spiriment/email-icons/icon-shield.png',
  'apple-white':
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786355671/spiriment/email-icons/apple-white.png',
  'google-play':
    'https://res.cloudinary.com/ds01mir9m/image/upload/v1786355673/spiriment/email-icons/google-play.png',
};

/** @deprecated use EMAIL_ICON_CDN_URLS */
export const EMAIL_SOCIAL_ICON_CDN_URLS: Record<EmailSocialIconName, string> = {
  instagram: EMAIL_ICON_CDN_URLS.instagram,
  tiktok: EMAIL_ICON_CDN_URLS.tiktok,
  x: EMAIL_ICON_CDN_URLS.x,
  linkedin: EMAIL_ICON_CDN_URLS.linkedin,
};

const dataUriCache = new Map<string, string>();

function readIconDataUri(fileBase: string): string | null {
  if (dataUriCache.has(fileBase)) {
    return dataUriCache.get(fileBase)!;
  }

  const candidates = [
    `${__dirname}/../mails/assets/email-icons/${fileBase}.png`,
    `${process.cwd()}/dist/mails/assets/email-icons/${fileBase}.png`,
    `${process.cwd()}/src/mails/assets/email-icons/${fileBase}.png`,
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const b64 = fs.readFileSync(filePath).toString('base64');
    const uri = `data:image/png;base64,${b64}`;
    dataUriCache.set(fileBase, uri);
    return uri;
  }

  return null;
}

function cloudinaryUrlFor(fileBase: string): string | null {
  const cloudName = Config.cloudinary?.cloudName;
  if (!cloudName) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/spiriment/email-icons/${fileBase}.png`;
}

export function getEmailIconSrc(fileBase: string, cidFallback: string): string {
  const envBase = process.env.EMAIL_SOCIAL_ICONS_BASE_URL?.replace(/\/$/, '');
  if (envBase) {
    return `${envBase}/${fileBase}.png`;
  }

  const cdn = EMAIL_ICON_CDN_URLS[fileBase]?.trim();
  if (cdn) {
    return cdn;
  }

  const folder = cloudinaryUrlFor(fileBase);
  if (folder) {
    return folder;
  }

  const dataUri = readIconDataUri(fileBase);
  if (dataUri) {
    return dataUri;
  }

  return cidFallback;
}

/** Icons injected into every baseLayout + body partial (OTP tips, footer social, etc.). */
export function getEmailTemplateIconContext(): {
  iconInstagramSrc: string;
  iconTiktokSrc: string;
  iconXSrc: string;
  iconLinkedinSrc: string;
  iconClockSrc: string;
  iconShieldSrc: string;
} {
  return {
    iconInstagramSrc: getEmailIconSrc('instagram', 'cid:icon-instagram'),
    iconTiktokSrc: getEmailIconSrc('tiktok', 'cid:icon-tiktok'),
    iconXSrc: getEmailIconSrc('x', 'cid:icon-x'),
    iconLinkedinSrc: getEmailIconSrc('linkedin', 'cid:icon-linkedin'),
    iconClockSrc: getEmailIconSrc('icon-clock', 'cid:icon-clock'),
    iconShieldSrc: getEmailIconSrc('icon-shield', 'cid:icon-shield'),
  };
}

export function getEmailLayoutSocialIconSources(): ReturnType<
  typeof getEmailTemplateIconContext
> {
  return getEmailTemplateIconContext();
}

export function getEmailSocialIconSrc(name: EmailSocialIconName): string {
  return getEmailIconSrc(name, `cid:icon-${name === 'x' ? 'x' : name}`);
}

export function getEmailStoreBadgeUrls(): {
  appleWhite: string;
  googlePlay: string;
} {
  return {
    appleWhite: getEmailIconSrc('apple-white', 'cid:apple-white'),
    googlePlay: getEmailIconSrc('google-play', 'cid:google-play'),
  };
}
