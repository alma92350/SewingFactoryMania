import './ui/style.css';
import { App } from './ui/app';

const app = new App();
(window as unknown as { __app: App }).__app = app;

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
