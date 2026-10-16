import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/outfit';
import './styles/app.css';
import { App } from './app/App';
import { setLang } from './app/i18n';
import { store } from './app/store';
import { unlockAudio } from './app/sound';

setLang(store.get().lang);
// 浏览器只允许在用户手势之后播放声音
window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
render(<App />, document.getElementById('app')!);
