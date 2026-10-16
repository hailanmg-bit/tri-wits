import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/outfit';
import './styles/app.css';
import { App } from './app/App';
import { setLang } from './app/i18n';
import { SAVE_KEY, store } from './app/store';
import { unlockAudio } from './app/sound';
import { initNativeShell, restoreSave } from './app/native';
import { installFlexGapFallback } from './app/compat';

// 浏览器只允许在用户手势之后播放声音
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
// 安卓返回键：交给界面处理（关面板 / 返回上一页 / 首页退出）
initNativeShell(() => window.dispatchEvent(new Event('tw-back')));

restoreSave(SAVE_KEY).finally(() => {
  store.reload();
  setLang(store.get().lang);
  render(<App />, document.getElementById('app')!);
  installFlexGapFallback();
});
