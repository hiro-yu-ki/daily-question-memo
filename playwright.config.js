export default {
  testDir: './e2e',
  timeout: 30000,
  use: { baseURL: process.env.BASE_URL || 'http://localhost:8787', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'iphone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ]
};
