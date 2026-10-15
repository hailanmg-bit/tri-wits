import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/outfit';
import './styles/app.css';
import { App } from './app/App';
import { setLang } from './app/i18n';
import { store } from './app/store';

setLang(store.get().lang);
render(<App />, document.getElementById('app')!);
