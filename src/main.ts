import './style.css';
import { startApp } from './app';
import { games } from './games';
import { watchForProblems } from './report';

watchForProblems();

startApp(document.getElementById('app')!, games);
