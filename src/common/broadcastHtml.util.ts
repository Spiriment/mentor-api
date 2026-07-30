/** Email clients need absolute https URLs on every <img>. */
export function assertBroadcastImagesReady(html: string): void {
  const tags = [...html.matchAll(/<img\b([^>]*)>/gi)];
  const broken = tags.filter((m) => {
    const src = m[1].match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1]?.trim();
    return !src || src.startsWith('blob:') || src.startsWith('data:');
  });
  if (broken.length > 0) {
    throw new Error(
      `${broken.length} image(s) are missing a public URL. Use "Upload iPhone / tablet screenshot" in the broadcast editor (images must upload to Cloudinary, not stay as empty placeholders).`
    );
  }
}

export function injectScreenshotUrl(
  html: string,
  slot: 'iphone' | 'tablet',
  url: string
): string {
  const needle =
    slot === 'iphone' ? /iphone/i : /ipad|tablet/i;

  let replaced = false;
  const withAlt = html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (replaced) return full;
    if (!needle.test(attrs)) return full;
    replaced = true;
    return patchImgSrc(full, attrs, url);
  });
  if (replaced) return withAlt;

  const brokenIndex = slot === 'iphone' ? 0 : 1;
  let n = 0;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1]?.trim();
    const broken = !src;
    if (!broken) return full;
    if (n++ !== brokenIndex) return full;
    return patchImgSrc(full, attrs, url);
  });
}

function patchImgSrc(full: string, attrs: string, url: string): string {
  if (/\bsrc\s*=/i.test(attrs)) {
    return full.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${url}"`);
  }
  return `<img src="${url}" ${attrs.trim()}>`;
}

/** Turn `/email-icons/…` and legacy Wikimedia icon URLs into absolute public URLs for email clients. */
export function prepareBroadcastHtmlForSend(html: string): string {
  const base = (
    process.env.API_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    process.env.APP_URL ||
    ''
  )
    .replace(/\/$/, '');

  let out = html;

  if (base) {
    out = out.replace(
      /(\bsrc\s*=\s*["'])\/email-icons\//gi,
      `$1${base}/email-icons/`
    );
    const appleIcon = `${base}/email-icons/apple-white.png`;
    const playIcon = `${base}/email-icons/google-play.png`;
    out = out.replace(
      /https?:\/\/upload\.wikimedia\.org\/[^"']*Apple_logo_white[^"']*/gi,
      appleIcon
    );
    out = out.replace(
      /https?:\/\/upload\.wikimedia\.org\/[^"']*Google_Play[^"']*/gi,
      playIcon
    );
  }

  return out;
}
