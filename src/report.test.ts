import { afterEach, describe, expect, it } from 'vitest';
import { save } from './core/storage';
import {
  FEEDBACK_EMAIL,
  feedbackLink,
  mailtoLink,
  MAX_BODY,
  problemReportLink,
  recentProblems,
  recordProblem,
  reportProblem,
  watchForProblems,
} from './report';

const body = (href: string) => decodeURIComponent(href.split('&body=')[1]);
const banner = () => document.querySelector<HTMLElement>('.problem-banner');

let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  stop = undefined;
});

describe('mailtoLink', () => {
  it('addresses the email to the maker with the subject and body filled in', () => {
    const href = mailtoLink('Hi there', 'Line 1\nLine 2 & more');
    expect(href).toBe(`mailto:${FEEDBACK_EMAIL}?subject=Hi%20there&body=Line%201%0ALine%202%20%26%20more`);
  });

  it('cuts long bodies so phones still open the email', () => {
    const text = body(mailtoLink('x', 'a'.repeat(5000)));
    expect(text).toHaveLength(MAX_BODY);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('problem log', () => {
  it('notes the error, screen and time, keeping the last five', () => {
    history.replaceState(null, '', '#/hearts');
    for (let i = 1; i <= 7; i++) recordProblem(new TypeError(`oops ${i}`));
    const log = recentProblems();
    expect(log.map((p) => p.message)).toEqual(['TypeError: oops 3', 'TypeError: oops 4', 'TypeError: oops 5', 'TypeError: oops 6', 'TypeError: oops 7']);
    expect(log[0].where).toBe('#/hearts');
    expect(log[0].stack).toContain('oops 3');
    expect(Date.parse(log[0].time)).not.toBeNaN();
  });

  it('records things thrown that are not errors', () => {
    expect(recordProblem('just a string')).toMatchObject({ message: 'just a string', stack: undefined, where: '#/' });
  });

  it('ignores a damaged log', () => {
    save('problems', { not: 'a list' });
    expect(recentProblems()).toEqual([]);
  });
});

describe('report emails', () => {
  it('puts the problem details under a space for the player to write', () => {
    const text = body(problemReportLink(recordProblem(new Error('boom'))));
    expect(text.startsWith('What were you doing when it happened? (optional)')).toBe(true);
    expect(text).toContain('Screen: #/');
    expect(text).toContain('Error: Error: boom');
    expect(text).toContain('Device: ');
  });

  it('adds recent problems to feedback, when there are any', () => {
    expect(body(feedbackLink())).not.toContain('Recent problems');
    for (let i = 1; i <= 4; i++) recordProblem(new Error(`e${i}`));
    const text = body(feedbackLink());
    expect(text).toContain('Recent problems on this device:');
    expect(text).not.toContain('Error: e1');
    expect(text).toContain('Error: e4');
  });
});

describe('problem banner', () => {
  it('appears on an uncaught error and links to a report of it', () => {
    stop = watchForProblems();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('first'), message: 'first' }));
    expect(banner()!.getAttribute('role')).toBe('alertdialog');
    expect(banner()!.textContent).toContain('something went wrong');
    expect(body(banner()!.querySelector<HTMLAnchorElement>('[data-report]')!.href)).toContain('Error: first');
  });

  it('shows one banner, reporting the latest problem', () => {
    stop = watchForProblems();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('first') }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    expect(document.querySelectorAll('.problem-banner')).toHaveLength(1);
    expect(body(banner()!.querySelector<HTMLAnchorElement>('[data-report]')!.href)).toContain('Error: Script error.');
  });

  it('catches failed promises too', () => {
    stop = watchForProblems();
    const e = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(e, 'reason', { value: new Error('async') });
    window.dispatchEvent(e);
    expect(body(banner()!.querySelector<HTMLAnchorElement>('[data-report]')!.href)).toContain('Error: async');
  });

  it('closes after reporting or dismissing', () => {
    reportProblem(new Error('x'));
    banner()!.querySelector<HTMLElement>('[data-report]')!.dispatchEvent(new MouseEvent('click', { cancelable: true }));
    expect(banner()).toBeNull();
    reportProblem(new Error('y'));
    banner()!.querySelector<HTMLButtonElement>('[data-dismiss]')!.click();
    expect(banner()).toBeNull();
  });

  it('stops watching when asked', () => {
    watchForProblems()();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('ignored') }));
    expect(banner()).toBeNull();
  });

  it('stays quiet if noting the problem fails', () => {
    reportProblem({
      toString() {
        throw new Error('cannot describe');
      },
    });
    expect(banner()).toBeNull();
  });
});
