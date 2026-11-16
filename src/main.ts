import './style.css';
import { startApp } from './app';
import { games } from './games';
import { watchForProblems } from './report';
import { applyAppearance } from './core/theme';

watchForProblems();
applyAppearance(); // index.html already did this before drawing; this keeps the two in step

startApp(document.getElementById('app')!, games);
