import { test, expect } from '@playwright/test';

test.describe('PWA assets', () => {
  test('manifest link is present and manifest.webmanifest returns valid JSON', async ({ page, request, baseURL }) => {
    await page.goto('/');

    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveCount(1);
    const href = await manifestLink.getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');

    const response = await request.get(`${baseURL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  test('iOS meta tags are present in HTML', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'default');
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'nSuns');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  });

  test('static PWA assets are reachable via HTTP', async ({ request, baseURL }) => {
    const iconResponse = await request.get(`${baseURL}/apple-touch-icon.png`);
    expect(iconResponse.status()).toBe(200);
    const iconContentType = iconResponse.headers()['content-type'];
    expect(iconContentType).toContain('image/png');

    const icon192Response = await request.get(`${baseURL}/icon-192.png`);
    expect(icon192Response.status()).toBe(200);
    expect(icon192Response.headers()['content-type']).toContain('image/png');

    const icon512Response = await request.get(`${baseURL}/icon-512.png`);
    expect(icon512Response.status()).toBe(200);
    expect(icon512Response.headers()['content-type']).toContain('image/png');

    const swResponse = await request.get(`${baseURL}/sw.js`);
    expect(swResponse.status()).toBe(200);
    const swContentType = swResponse.headers()['content-type'];
    expect(swContentType).toMatch(/javascript/);
  });
});
