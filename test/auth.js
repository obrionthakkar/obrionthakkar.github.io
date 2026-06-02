// Guest login gate — name lookup treated as authentication
const SESSION_KEY = 'weddingGuestSession';

function saveSession(guestName, partyData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    guestName,
    partyData,
    loggedInAt: Date.now()
  }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function getStoredGuestName() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw).guestName || null;
  } catch {
    return null;
  }
}

async function lookupGuest(name) {
  const response = await fetch(`${MODAL_LOOKUP_URL}?name=${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    const message = data.error === 'party not found'
      ? "We couldn't find your invitation. Please check the spelling of your name."
      : data.error;
    return { error: message };
  }
  return { data };
}

function showGuestSite() {
  const loginSection = document.getElementById('login');
  const guestSite = document.getElementById('guest-site');
  if (loginSection) loginSection.hidden = true;
  if (guestSite) {
    guestSite.hidden = false;
    guestSite.removeAttribute('aria-hidden');
  }
}

function hideGuestSite() {
  const loginSection = document.getElementById('login');
  const guestSite = document.getElementById('guest-site');
  if (loginSection) loginSection.hidden = false;
  if (guestSite) {
    guestSite.hidden = true;
    guestSite.setAttribute('aria-hidden', 'true');
  }
}

function onLoginSuccess(data, guestName, scrollTarget) {
  currentPartyData = data;
  saveSession(guestName, data);
  showGuestSite();

  if (typeof renderEvents === 'function') {
    renderEvents(data);
  }
  if (typeof initRsvpFromPartyData === 'function') {
    initRsvpFromPartyData(data);
  }

  if (scrollTarget) {
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loginWithName(name, options = {}) {
  const result = await lookupGuest(name);
  if (result.error) {
    return { error: result.error };
  }
  onLoginSuccess(result.data, name, options.scrollTarget || null);
  return { data: result.data };
}

function logout() {
  clearSession();
  currentPartyData = null;
  hideGuestSite();
  hideLoginError();

  const loginForm = document.getElementById('loginForm');
  const guestNameInput = document.getElementById('guestName');
  if (loginForm) loginForm.reset();
  if (guestNameInput) guestNameInput.disabled = false;

  const lookupButton = document.getElementById('lookupButton');
  if (lookupButton) {
    lookupButton.classList.remove('loading');
    const buttonText = lookupButton.querySelector('.button-text');
    const buttonSpinner = lookupButton.querySelector('.button-spinner');
    if (buttonText) buttonText.textContent = 'View My Invitation';
    if (buttonSpinner) buttonSpinner.style.display = 'none';
  }

  document.getElementById('login')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function restoreSession() {
  const guestName = getStoredGuestName();
  if (!guestName) return;

  try {
    const result = await lookupGuest(guestName);
    if (result.error) {
      clearSession();
      showLoginError(result.error);
      return;
    }
    onLoginSuccess(result.data, guestName, null);
  } catch {
    clearSession();
    showLoginError('Something went wrong restoring your session. Please log in again.');
  }
}

function showLoginError(message) {
  const el = document.getElementById('loginError');
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}

function hideLoginError() {
  const el = document.getElementById('loginError');
  if (el) {
    el.classList.remove('show');
  }
}

function setLoginLoading(loading) {
  const lookupButton = document.getElementById('lookupButton');
  const guestNameInput = document.getElementById('guestName');
  if (lookupButton) {
    lookupButton.classList.toggle('loading', loading);
    const buttonText = lookupButton.querySelector('.button-text');
    const buttonSpinner = lookupButton.querySelector('.button-spinner');
    if (buttonText) buttonText.textContent = loading ? 'Please Wait' : 'View My Invitation';
    if (buttonSpinner) buttonSpinner.style.display = loading ? 'inline-block' : 'none';
  }
  if (guestNameInput) guestNameInput.disabled = loading;
}

function initAuth() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const guestNameInput = document.getElementById('guestName');
    const guestName = guestNameInput?.value.trim();
    if (!guestName) {
      showLoginError('Please enter your name');
      return;
    }

    hideLoginError();
    setLoginLoading(true);

    try {
      const result = await loginWithName(guestName, {
        scrollTarget: document.getElementById('story')
      });
      if (result.error) {
        showLoginError(result.error);
      }
    } catch {
      showLoginError('Something went wrong. Please try again later.');
    } finally {
      setLoginLoading(false);
    }
  });

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  restoreSession();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
