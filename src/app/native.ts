/* 原生壳（Capacitor）相关：存档持久化、震动、状态栏、安卓返回键。网页版下全部是空操作。 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();

/**
 * WebView 的 localStorage 可能被系统清理（iOS 存储紧张时），原生端以 Preferences 为准：
 * 启动时把 Preferences 里的存档写回 localStorage，之后每次保存同时写两份。
 */
export async function restoreSave(key: string): Promise<void> {
  if (!isNative) return;
  try {
    const { value } = await Preferences.get({ key });
    if (value) localStorage.setItem(key, value);
    else {
      const local = localStorage.getItem(key);
      if (local) await Preferences.set({ key, value: local });
    }
  } catch { /* 读取失败时沿用 localStorage */ }
}

export function persistSave(key: string, value: string): void {
  if (isNative) Preferences.set({ key, value }).catch(() => {});
}

/** 震动：原生端用系统触感反馈，网页端退回 navigator.vibrate */
export function nativeBuzz(pattern: number | number[]): boolean {
  if (!isNative) return false;
  const ms = Array.isArray(pattern) ? Math.max(...pattern) : pattern;
  const style = ms >= 30 ? ImpactStyle.Medium : ImpactStyle.Light;
  Haptics.impact({ style }).catch(() => {});
  if (Array.isArray(pattern) && pattern.length > 1) setTimeout(() => Haptics.impact({ style }).catch(() => {}), 120);
  return true;
}

export function initNativeShell(onBack: () => void): void {
  if (!isNative) return;
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  CapApp.addListener('backButton', onBack);
}

export const exitApp = () => CapApp.exitApp();
