import { brandLogoUrl, wrapInLayout } from './mail-layout';

describe('wrapInLayout', () => {
  it('uses the brand colours and shows the logo', () => {
    const html = wrapInLayout({
      bodyHtml: '<p>Hi</p>',
      logoUrl: 'https://app.test/brand/logo.png',
    });
    expect(html).toContain('border-top:4px solid #ea8c32');
    expect(html).toContain('a{color:#a8570f}');
    expect(html).toContain(
      '<img src="https://app.test/brand/logo.png" alt="Bay State Bullets Lacrosse"',
    );
  });

  it('omits the logo when none is given', () => {
    expect(wrapInLayout({ bodyHtml: '<p>Hi</p>' })).not.toContain('<img');
  });
});

describe('brandLogoUrl', () => {
  it('prefers the configured logo and falls back to the logo served by the web app', () => {
    expect(brandLogoUrl('https://cdn.test/x.png', 'https://app.test')).toBe(
      'https://cdn.test/x.png',
    );
    expect(brandLogoUrl(null, 'https://app.test')).toBe(
      'https://app.test/brand/logo.png',
    );
  });
});
