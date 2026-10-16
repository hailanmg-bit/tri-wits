import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 上架前确认：Bundle ID 一旦在 App Store / Google Play 建档就不能再改
  appId: 'com.triwits.game',
  appName: 'TriWits',
  webDir: 'dist',
  backgroundColor: '#0F3D35',
  ios: { contentInset: 'never', backgroundColor: '#0F3D35' },
  android: { backgroundColor: '#0F3D35' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: '#0F3D35', showSpinner: false },
    StatusBar: { style: 'DARK' },
    // 安卓：网页按 viewport-fit=cover 铺满屏幕，用 env(safe-area-inset-*) 自己留边
    SystemBars: { insetsHandling: 'css', style: 'DARK', initialViewportFitValueHint: 'cover' }
  }
};

export default config;
