// Problem reports and feedback, by email. The app never sends anything itself: it opens
// the player's email app with a message they can read, change or discard (docs/LEGAL.md,
// "Privacy"). Crashes are noted on this device so a report can still be sent later.
import { load, save } from './core/storage';

export const FEEDBACK_EMAIL = 'aarontkennedy@gmail.com';

const LOG_KEY = 'problems';
const LOG_SIZE = 5;
/** Some phones refuse very long mailto links, so report bodies are cut to this. */
export const MAX_BODY = 1500;

export interface Problem {
  time: string;
  /** The screen it happened on, e.g. "#/hearts". */
  where: string;
  message: string;
  stack?: string;
}

const where = () => location.hash || '#/';

export function mailtoLink(subject: string, body: string): string {
  const cut = body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(cut)}`;
}

/** Problems noted on this device, newest last. */
export function recentProblems(): Problem[] {
  const log = load<unknown>(LOG_KEY, []);
  return Array.isArray(log) ? (log as Problem[]) : [];
}

/** Notes a problem on this device, keeping only the last few. */
export function recordProblem(error: unknown): Problem {
  const problem: Problem = {
    time: new Date().toISOString(),
    where: where(),
    message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  save(LOG_KEY, [...recentProblems(), problem].slice(-LOG_SIZE));
  return problem;
}

const deviceLine = () => `Device: ${navigator.userAgent}`;

/** An email reporting one problem, with the details needed to find the bug. */
export function problemReportLink(problem: Problem): string {
  const body = [
    'What were you doing when it happened? (optional)',
    '',
    '',
    '---',
    `Time: ${problem.time}`,
    `Screen: ${problem.where}`,
    deviceLine(),
    `Error: ${problem.message}`,
    problem.stack ?? '',
  ].join('\n');
  return mailtoLink('Games problem report', body);
}

/** An email for bugs, ideas and questions, with any problems noted on this device. */
export function feedbackLink(): string {
  const problems = recentProblems()
    .slice(-3)
    .map((p) => `${p.time} ${p.where} ${p.message}`);
  const body = [
    'Your bug report, idea or question:',
    '',
    '',
    '---',
    deviceLine(),
    ...(problems.length ? ['Recent problems on this device:', ...problems] : []),
  ].join('\n');
  return mailtoLink('Games feedback', body);
}

/** Tells the player something went wrong and offers to email a report. */
export function reportProblem(error: unknown): void {
  let problem: Problem;
  try {
    problem = recordProblem(error);
  } catch {
    return; // never let reporting a problem cause another one
  }
  let banner = document.querySelector<HTMLElement>('.problem-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'problem-banner';
    banner.setAttribute('role', 'alertdialog');
    banner.setAttribute('aria-labelledby', 'problem-title');
    banner.innerHTML = `
      <p id="problem-title">Sorry, something went wrong. Emailing a report helps get it fixed.</p>
      <div class="problem-actions">
        <a class="btn" data-report>Email a report</a>
        <button class="btn secondary" data-dismiss>Not now</button>
      </div>`;
    const close = () => banner!.remove();
    banner.querySelector('[data-report]')!.addEventListener('click', close);
    banner.querySelector('[data-dismiss]')!.addEventListener('click', close);
    document.body.append(banner);
  }
  banner.querySelector<HTMLAnchorElement>('[data-report]')!.href = problemReportLink(problem);
}

/** Shows the problem banner for any uncaught error. Returns a stop function. */
export function watchForProblems(target: Window = window): () => void {
  const onError = (e: ErrorEvent) => reportProblem(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => reportProblem(e.reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
