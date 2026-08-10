/**
 * Upload footer social PNGs to Cloudinary (public HTTPS — works in Gmail).
 * Run from mentor-backend: npm run upload:email-icons
 *
 * After success, paste the printed URLs into EMAIL_SOCIAL_ICON_CDN_URLS in
 * src/common/emailSocialIcons.ts (or set EMAIL_SOCIAL_ICONS_BASE_URL in .env).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';

const ICONS = ['instagram', 'tiktok', 'x', 'linkedin'] as const;
const ASSETS = path.join(__dirname, '../src/mails/assets/email-icons');

async function main() {
  const cloudName = process.env.CLOUDINARY_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('Missing CLOUDINARY_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET');
    process.exit(1);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const urls: Record<string, string> = {};

  for (const name of ICONS) {
    const filePath = path.join(ASSETS, `${name}.png`);
    if (!fs.existsSync(filePath)) {
      console.error('Missing file:', filePath);
      process.exit(1);
    }

    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'spiriment/email-icons',
      public_id: name,
      overwrite: true,
      resource_type: 'image',
    });

    urls[name] = result.secure_url;
    console.log(`${name}: ${result.secure_url}`);
  }

  console.log('\nAdd to src/common/emailSocialIcons.ts EMAIL_SOCIAL_ICON_CDN_URLS:');
  console.log(JSON.stringify(urls, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
