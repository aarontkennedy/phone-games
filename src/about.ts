// The About page: what the app is, how to install it, privacy, and copyright.
// Keep it in step with LICENSE, docs/LEGAL.md and public/THIRD_PARTY_NOTICES.txt.
import { FEEDBACK_EMAIL, feedbackLink } from './report';

/** Copyright holder, as named in LICENSE. */
export const OWNER = 'aarontkennedy';
export const YEAR = 2026;

const NOTICES_URL = 'THIRD_PARTY_NOTICES.txt';

const html = `
  <p>A small collection of classic games, made by ${OWNER}. No ads, no accounts and no
  tracking. After your first visit, it works without an internet connection.</p>

  <h2>Add it to your phone</h2>
  <p>Add Games to your home screen and it opens full screen like any other app, without
  the browser's address bar.</p>

  <h3>iPhone or iPad</h3>
  <ol>
    <li>Open this page in <b>Safari</b>.</li>
    <li>Tap the <b>Share</b> button: a square with an arrow pointing up. It's at the
      bottom of the screen on iPhone and at the top on iPad.</li>
    <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
    <li>If you see <b>Open as Web App</b>, make sure it's switched on.</li>
    <li>Tap <b>Add</b>.</li>
  </ol>

  <h3>Android</h3>
  <ol>
    <li>Open this page in <b>Chrome</b>.</li>
    <li>Tap the menu button: three dots in the top corner.</li>
    <li>Tap <b>Add to home screen</b> or <b>Install app</b>, then <b>Install</b>.</li>
  </ol>
  <p>In Samsung Internet, tap the menu button (three lines), then <b>Add page to</b> and
  <b>Home screen</b>.</p>

  <p>From then on, open Games from its icon on your home screen. Open it once while
  you're online, and after that it works anywhere.</p>

  <p>To send Games to someone else, tap <b>Share</b> on the home screen. You can send it
  by text or email.</p>

  <h2>Feedback</h2>
  <p>Found a bug, or have an idea or a game you'd like to see? Send an email.</p>
  <p><a class="btn feedback-link" data-feedback>Email feedback</a></p>
  <p>Or write to <b>${FEEDBACK_EMAIL}</b>.</p>

  <h2>Privacy</h2>
  <p>Your games, scores and settings are saved only on this device. The app doesn't
  collect or send anything by itself. Its files are delivered by GitHub Pages, like any
  website.</p>
  <p>If something goes wrong, the app keeps a short note of the error on this device and
  offers to put it in an email to ${OWNER}. You see the email first, and nothing is sent
  unless you send it.</p>

  <h2>Copyright</h2>
  <p>&copy; ${YEAR} ${OWNER}. All rights reserved.</p>
  <p>You're welcome to play. The app's code, artwork and text may not be copied,
  changed or shared without permission.</p>
  <p>The rules of classic games belong to no one. The game names here are generic and
  aren't connected to any company's products.</p>

  <h2>Third-party software</h2>
  <p>Offline support uses Workbox by Google, under the MIT License.</p>
  <details>
    <summary>Show the license notices</summary>
    <pre data-notices></pre>
  </details>`;

/** Renders the About page into `main`. The license notices load when first opened. */
export function mountAbout(main: HTMLElement): void {
  main.innerHTML = html;
  main.querySelector<HTMLAnchorElement>('[data-feedback]')!.href = feedbackLink();
  const details = main.querySelector('details')!;
  const notices = main.querySelector<HTMLElement>('[data-notices]')!;

  let loaded = false;
  details.addEventListener('toggle', async () => {
    if (!details.open || loaded) return;
    notices.textContent = 'Loading…';
    try {
      const res = await fetch(NOTICES_URL);
      if (!res.ok) throw new Error(String(res.status));
      notices.textContent = await res.text();
      loaded = true;
    } catch {
      notices.textContent = "Couldn't load the notices. Connect to the internet once and try again.";
    }
  });
}
