import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  // 兼容旧手机的系统 WebView（安卓 9 出厂为 Chrome 66）与 iOS 14：新语法编译成旧写法
  build: { target: ['chrome64', 'safari14'], cssTarget: ['chrome64', 'safari14'] },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] }
} as never);
