import './ui/style.css';
import { App } from './ui/app';

const param = Number(new URLSearchParams(location.search).get('seed'));
const today = new Date();
const daily = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
const app = new App(Number.isFinite(param) && param > 0 ? Math.floor(param) : daily);
(window as unknown as { __app: App }).__app = app;
