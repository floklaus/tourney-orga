import { convert } from 'html-to-text';

export interface LayoutOptions {
  bodyHtml: string;
  logoUrl?: string | null;
  footerHtml?: string | null;
  unsubscribeUrl?: string | null;
}

const escapeAttr = (value: string) => value.replace(/"/g, '&quot;');

/** Bay State Bullets brand colours (see frontend globals.css): accent orange and accessible link orange. */
const BRAND = {
  orange: '#ea8c32',
  link: '#a8570f',
  text: '#1f1f1f',
  muted: '#6b6b6b',
  background: '#f5f5f5',
};

/** Logo served by the web app (frontend/public/brand/logo.png). */
export const BRAND_LOGO_PATH = '/brand/logo.png';

/** The configured logo, or the Bay State Bullets logo served by the web app. */
export function brandLogoUrl(
  configured: string | null | undefined,
  appUrl: string,
): string {
  return configured || `${appUrl.replace(/\/$/, '')}${BRAND_LOGO_PATH}`;
}

/** Wraps sanitized body HTML in the shared email layout (logo, footer, unsubscribe link). */
export function wrapInLayout({
  bodyHtml,
  logoUrl,
  footerHtml,
  unsubscribeUrl,
}: LayoutOptions): string {
  const logo = logoUrl
    ? `<p style="margin:0 0 16px"><img src="${escapeAttr(logoUrl)}" alt="Bay State Bullets Lacrosse" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0"></p>`
    : '';
  const unsubscribe = unsubscribeUrl
    ? `<p><a href="${escapeAttr(unsubscribeUrl)}" style="color:${BRAND.muted}">Unsubscribe from these emails</a></p>`
    : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>a{color:${BRAND.link}}</style></head>
<body style="margin:0;padding:24px;background:${BRAND.background};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text}">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;border-top:4px solid ${BRAND.orange}">
${logo}${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
<div style="font-size:12px;color:${BRAND.muted}">${footerHtml ?? ''}${unsubscribe}</div>
</div></body></html>`;
}

/**
 * Body plus footer and unsubscribe link, without the outer document and styling:
 * meant for pasting into a mail program when sending manually.
 */
export function copyableBody({
  bodyHtml,
  footerHtml,
  unsubscribeUrl,
}: LayoutOptions): string {
  const unsubscribe = unsubscribeUrl
    ? `<p><a href="${escapeAttr(unsubscribeUrl)}">Unsubscribe from these emails</a></p>`
    : '';
  return `${bodyHtml}<p>--</p>${footerHtml ?? ''}${unsubscribe}`;
}

export function htmlToText(html: string): string {
  return convert(html, {
    wordwrap: 100,
    selectors: [{ selector: 'img', format: 'skip' }],
  });
}
