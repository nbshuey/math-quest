// ☁️ Family account screens: welcome, log in, create an account, the privacy note,
// the family account panel on the Grown-ups page, and saving online in the background.

import { state, save, afterSave, esc, reloadState } from './state.js';
import { saveState, defaultState } from './storage.js';
import { app, show, applyLook, on } from './ui.js';
import { renderHome, renderTopics } from './home.js';
import { cloudOn, session, localOnly, setLocalOnly, signUp, logIn, sendReset, logOut, sync, stamp, familyPlayers, deleteFamily, blank } from './cloud.js';

/* ---------------- Saving online in the background ---------------- */

export const syncStatus = { state: 'idle', at: 0, error: '' };

let timer = null;
let running = null;
let again = 0;

// Online changes are only used on the home and quest-picking screens, so nothing changes
// under a kid in the middle of a round (or under a grown-up changing settings).
const calm = () => !!app.querySelector('.profiles, .topics-head');

export function syncSoon(delay) {
  if (!cloudOn() || !session()) return;
  clearTimeout(timer);
  // While a kid is playing, wait for a quiet moment (fewer saves online).
  timer = setTimeout(syncNow, delay ?? (calm() ? 1500 : 15000));
}

export function syncNow({ force = false } = {}) {
  if (!cloudOn() || !session()) return Promise.resolve();
  if (running) {
    again = Math.max(again, 1);
    return running;
  }
  clearTimeout(timer);
  syncStatus.state = 'syncing';
  running = (async () => {
    try {
      stamp(state);
      const changed = await sync(state, { canApply: force ? () => true : calm });
      saveState(state);
      Object.assign(syncStatus, { state: 'saved', at: Date.now(), error: '' });
      again = 0;
      if (changed && calm()) (app.querySelector('.profiles') ? renderHome : renderTopics)();
    } catch (e) {
      if (e.code === 'conflict' && again < 3) again++;
      else Object.assign(syncStatus, { state: e.code === 'offline' ? 'offline' : e.code === 'signedOut' ? 'signedOut' : 'error', error: e.message });
    } finally {
      running = null;
      updateCloudLine();
      if (again && syncStatus.state !== 'signedOut') syncSoon(800);
    }
  })();
  return running;
}

export function startCloud() {
  if (!cloudOn()) return;
  afterSave.push(() => syncSoon());
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  stamp(state);
  syncNow();
}

/* ---------------- The line on the home screen ---------------- */

const since = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} hr ago`;
};

export function cloudLine() {
  if (!cloudOn()) return '';
  const s = session();
  let text;
  if (!s) text = localOnly() ? '' : '☁️ Not logged in to a family account. <button class="link-btn" data-action="cloudLogin">Log in</button>';
  else if (syncStatus.state === 'offline') text = '☁️ No internet right now. Progress is saved here and goes online when the internet is back.';
  else if (syncStatus.state === 'error') text = `☁️ Couldn’t save online: ${esc(syncStatus.error)}`;
  else if (syncStatus.state === 'signedOut') text = '☁️ Logged out of the family account. <button class="link-btn" data-action="cloudLogin">Log in again</button>';
  else text = `☁️ ${esc(s.email)} · ${syncStatus.state === 'saved' ? `saved ${since(syncStatus.at)}` : 'saving…'}`;
  return text ? `<p class="cloud-line" id="cloudLine">${text}</p>` : '';
}

export function bindCloudLine() {
  on('[data-action="cloudLogin"]', () => renderLogIn());
}

function updateCloudLine() {
  const el = app.querySelector('#cloudLine');
  if (!el) return;
  el.outerHTML = cloudLine() || '<span id="cloudLine"></span>';
  bindCloudLine();
}

/* ---------------- Welcome, log in, create an account ---------------- */

export const PRIVACY = `
  <ul class="privacy">
    <li><strong>What’s saved:</strong> the grown-up’s email and password (Google keeps the password; Math Quest never sees it), and for each player: the name, grade, avatar, birthday month and day if added, practice results, coins, stickers and shop items. Grown-up logins on the Grown-ups page are saved too, with their passcodes scrambled.</li>
    <li><strong>Kids never type an email or contact details.</strong> Use first names or nicknames for players.</li>
    <li><strong>Who can see it:</strong> only people logged in to your family account. It’s stored with Google Firebase. The person who runs Math Quest can manage the database, but won’t look at or share your family’s data.</li>
    <li><strong>No ads, no tracking,</strong> and nothing is sold or shared.</li>
    <li><strong>Delete it any time:</strong> Grown-ups page → Family account → Delete our family account removes everything right away.</li>
  </ul>`;

const backButton = '<div class="topbar"><button class="icon-btn" data-action="back" aria-label="Back">←</button></div>';

export function renderWelcome() {
  applyLook(null);
  show(`
    <div class="screen">
      <h1 class="title">Math Quest</h1>
      <div class="panel welcome">
        <h2>👋 Welcome!</h2>
        <p class="panel-note">With a free family account, your kids’ progress is saved online, and you can play on any phone, tablet or computer.</p>
        <div class="welcome-actions">
          <button class="btn" data-action="login">Log in</button>
          <button class="btn" data-action="signup">Create a family account</button>
          <button class="btn secondary" data-action="local">Play on this device only</button>
        </div>
        <details class="privacy-box"><summary>🔒 What’s saved, and who can see it</summary>${PRIVACY}</details>
      </div>
    </div>`);
  on('[data-action="login"]', () => renderLogIn());
  on('[data-action="signup"]', () => renderSignUp());
  on('[data-action="local"]', () => {
    setLocalOnly(true);
    renderHome();
  });
}

const back = () => (session() || localOnly() ? renderHome() : renderWelcome());

function busy(button, text) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = text;
  return () => {
    button.disabled = false;
    button.textContent = label;
  };
}

const tell = (kind, text) => {
  const el = app.querySelector('#cloudFeedback');
  el.className = `feedback ${kind}`;
  el.textContent = text;
};

export function renderLogIn() {
  applyLook(null);
  show(`
    <div class="screen">
      ${backButton}
      <div class="panel login">
        <h2>☁️ Log in to your family account</h2>
        <label class="field-label" for="email">Email</label>
        <input id="email" class="text-input" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(session()?.email ?? '')}" />
        <label class="field-label" for="password">Password</label>
        <input id="password" class="text-input" type="password" autocomplete="current-password" />
        <div class="feedback" id="cloudFeedback"></div>
        <div class="panel-actions">
          <button class="link-btn" data-action="forgot">Forgot password?</button>
          <button class="btn" data-action="go">Log in</button>
        </div>
        <p class="panel-note small-note">No account yet? <button class="link-btn" data-action="signup">Create a family account</button></p>
      </div>
    </div>`);
  const go = async () => {
    const done = busy(app.querySelector('[data-action="go"]'), 'Logging in…');
    try {
      await logIn(app.querySelector('#email').value, app.querySelector('#password').value);
      await joinFamily();
    } catch (e) {
      done();
      tell('try', e.message);
    }
  };
  app.querySelector('#email').focus();
  app.querySelectorAll('.login input').forEach((el) => el.addEventListener('keydown', (e) => e.key === 'Enter' && go()));
  on('[data-action="back"]', back);
  on('[data-action="go"]', go);
  on('[data-action="signup"]', () => renderSignUp());
  on('[data-action="forgot"]', async () => {
    const email = app.querySelector('#email').value;
    if (!email.trim()) return tell('try', 'Type your email first, then tap Forgot password.');
    try {
      await sendReset(email);
    } catch (e) {
      if (e.code === 'offline') return tell('try', e.message);
    }
    tell('good', 'If there’s an account for that email, a link to set a new password is on its way. Check your email (and the spam folder).');
  });
}

// Right after logging in: use the family's players, and decide about any on this device.
async function joinFamily() {
  const family = await familyPlayers();
  const mine = state.profiles.filter((p) => !blank(p) && !family.some((f) => f.id === p.id));
  const finish = async (keep) => {
    const before = state.profiles;
    // With players already in the account, they come from there (on the sync); this device's
    // own stay only if the grown-up said so. A new, empty account gets this device's players.
    if (family.length) state.profiles = keep ? mine : [];
    state.currentId = null;
    await syncNow({ force: true });
    if (syncStatus.state !== 'saved') {
      state.profiles = before;
      logOut();
      alert(`Couldn’t get your family’s players: ${syncStatus.error || 'no internet'}. Please try again.`);
      return renderLogIn();
    }
    if (!state.profiles.length) state.profiles = defaultState().profiles;
    save();
    renderHome();
  };
  if (!family.length || !mine.length) return finish(true);
  show(`
    <div class="screen">
      <div class="panel">
        <h2>👪 Players on this device</h2>
        <p class="panel-note">Your family account has ${family.map((p) => `<strong>${esc(p.name)}</strong>`).join(', ')}. This device also has ${mine.map((p) => `<strong>${esc(p.name)}</strong>`).join(', ')}, with their progress.</p>
        <div class="welcome-actions">
          <button class="btn" data-keep="yes">Add them to our family account</button>
          <button class="btn secondary" data-keep="no">Remove them from this device</button>
        </div>
      </div>
    </div>`);
  on('[data-keep]', (el) => finish(el.dataset.keep === 'yes'));
}

export function renderSignUp() {
  applyLook(null);
  const players = state.profiles.filter((p) => !blank(p));
  show(`
    <div class="screen">
      ${backButton}
      <div class="panel login">
        <h2>☁️ Create a family account</h2>
        <p class="panel-note">One account for the whole family. A grown-up sets it up; kids just play.${players.length ? ` The players on this device (${players.map((p) => esc(p.name)).join(', ')}) and their progress move into the account.` : ''}</p>
        <label class="field-label" for="email">Grown-up’s email</label>
        <input id="email" class="text-input" type="email" autocomplete="username" autocapitalize="off" spellcheck="false" />
        <label class="field-label" for="password">Password (at least 6 characters)</label>
        <input id="password" class="text-input" type="password" autocomplete="new-password" />
        <label class="field-label" for="again">Type it again</label>
        <input id="again" class="text-input" type="password" autocomplete="new-password" />
        <details class="privacy-box" open><summary>🔒 What’s saved, and who can see it</summary>${PRIVACY}</details>
        <button class="toggle-opt" data-action="agree"><span class="check"></span><span>I’m the child’s parent or guardian, and I’ve read what’s saved.</span></button>
        <div class="feedback" id="cloudFeedback"></div>
        <div class="panel-actions"><button class="btn" data-action="go">Create account</button></div>
        <p class="panel-note small-note">Already have one? <button class="link-btn" data-action="login">Log in</button></p>
      </div>
    </div>`);
  let agreed = false;
  on('[data-action="agree"]', (el) => {
    agreed = !agreed;
    el.classList.toggle('selected', agreed);
  });
  on('[data-action="back"]', back);
  on('[data-action="login"]', () => renderLogIn());
  on('[data-action="go"]', async () => {
    const [email, password, again2] = ['#email', '#password', '#again'].map((id) => app.querySelector(id).value);
    if (password !== again2) return tell('try', 'The two passwords don’t match.');
    if (!agreed) return tell('try', 'Please tick the box to say you’re the parent or guardian.');
    const done = busy(app.querySelector('[data-action="go"]'), 'Creating…');
    try {
      await signUp(email, password);
      state.currentId = null;
      saveState(state);
      await syncNow({ force: true });
      renderHome();
    } catch (e) {
      done();
      tell('try', e.message);
    }
  });
}

/* ---------------- On the Grown-ups page ---------------- */

export function accountPanel() {
  if (!cloudOn()) return '';
  const s = session();
  if (!s) {
    return `
      <div class="panel">
        <h2>☁️ Family account</h2>
        <p class="panel-note">Progress is only saved on this device. With a free family account it’s saved online, and you can play on any device.</p>
        <div class="pin-row">
          <button class="btn" data-action="cloudLogin">Log in</button>
          <button class="btn secondary" data-action="cloudSignup">Create a family account</button>
        </div>
      </div>`;
  }
  return `
    <div class="panel" id="account">
      <h2>☁️ Family account</h2>
      <p class="panel-note">Logged in as <strong>${esc(s.email)}</strong>. Players, progress and grown-up logins are saved online, so every device logged in to this account sees the same kids.</p>
      ${cloudLine()}
      <div class="pin-row">
        <button class="btn secondary" data-action="syncNow">Save now</button>
        <button class="btn secondary" data-action="cloudLogout">Log this device out</button>
      </div>
      <details class="privacy-box"><summary>🔒 What’s saved, and who can see it</summary>${PRIVACY}</details>
      <details class="danger-box">
        <summary>Delete our family account</summary>
        <p class="panel-note">This deletes every player, all progress and the account itself, on every device. It can’t be undone. Save a backup file first if you might want it later.</p>
        <label class="field-label" for="deletePassword">Type the account password to confirm</label>
        <input id="deletePassword" class="text-input" type="password" autocomplete="current-password" />
        <div class="panel-actions"><button class="btn danger" data-action="deleteFamily">Delete everything</button></div>
      </details>
      <div class="feedback" id="cloudFeedback"></div>
    </div>`;
}

// Puts this device back to a fresh start (after logging out or deleting the account).
function freshDevice(onDone) {
  saveState(defaultState());
  reloadState();
  onDone();
}

export function bindAccount(leaveParents) {
  if (!cloudOn()) return;
  bindCloudLine();
  on('[data-action="cloudSignup"]', () => renderSignUp());
  on('[data-action="syncNow"]', async (el) => {
    const done = busy(el, 'Saving…');
    await syncNow();
    done();
    tell(syncStatus.state === 'saved' ? 'good' : 'try', syncStatus.state === 'saved' ? '✓ Saved online' : syncStatus.error || 'Not saved yet.');
  });
  on('[data-action="cloudLogout"]', async (el) => {
    const done = busy(el, 'Saving first…');
    await syncNow();
    done();
    const warn = syncStatus.state === 'saved'
      ? 'Log this device out of the family account? The players leave this device, but stay safe in the account.'
      : 'Some progress isn’t saved online yet (no internet). If you log out now, it’s lost. Log out anyway?';
    if (!confirm(warn)) return;
    logOut();
    leaveParents();
    freshDevice(renderWelcome);
  });
  on('[data-action="deleteFamily"]', async (el) => {
    const password = app.querySelector('#deletePassword').value;
    if (!password) return tell('try', 'Type the account password first.');
    if (!confirm('Delete your family account and everything in it, on every device? This can’t be undone.')) return;
    const done = busy(el, 'Deleting…');
    try {
      await deleteFamily(password);
      leaveParents();
      setLocalOnly(false);
      freshDevice(renderWelcome);
    } catch (e) {
      done();
      tell('try', e.message);
    }
  });
}
