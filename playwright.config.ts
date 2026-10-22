import { chromium, defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser', workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:18741',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (process.env.CI ? chromium.executablePath() : '/snap/bin/chromium'), args: ['--no-sandbox'] },
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1280, height: 800 } } },
    // Browser emulation only: this does not replace native APK/emulator acceptance.
    { name: 'android-mobile-web', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'python3 -m http.server 18741 --bind 127.0.0.1 --directory dist', url: 'http://127.0.0.1:18741', reuseExistingServer: false },
});
