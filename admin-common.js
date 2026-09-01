// Shared by every admin-*.html page: session storage, auth headers and a
// couple of small helpers, so the token format (and where it's stored)
// only lives in one place. Load this before each page's own script.
//
// admin.html is the only page with an actual login form / the "am I
// signed in as ADMIN_EMAIL already?" auto-recognition check — every other
// admin-*.html page just calls requireAdminSession() at the top and gets
// bounced back to admin.html if there's no valid session.

const ADMIN_SESSION_STORAGE_KEY = "qpAdminSession";

function adminGetSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function adminSaveSession(token, email, remember) {
  const value = JSON.stringify({ token, email });
  try {
    // Only one copy at a time — otherwise logging out of a "remembered"
    // session but leaving a stale sessionStorage copy (or vice versa) could
    // resurrect it on the next page load.
    if (remember) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, value);
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } else {
      sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, value);
      localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
  } catch (err) {
    // Storage blocked (e.g. private browsing) — the session just won't
    // persist across a reload; the tool still works for the current page.
  }
}

function adminClearSession() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch (err) {
    // Storage blocked — nothing to clear.
  }
}

// Decodes the token's own `exp` claim so the UI can proactively show the
// login screen again — this is just for a smooth UI, not what actually
// enforces expiry (the backend re-verifies the signature and exp on every
// request regardless).
function adminIsTokenExpired(token) {
  try {
    const [payload] = token.split(".");
    const { exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof exp !== "number" || exp * 1000 <= Date.now();
  } catch (err) {
    return true;
  }
}

function adminAuthHeader() {
  const session = adminGetSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

// Called by every page other than admin.html when the server says the
// session is invalid/expired (or there was never one to begin with) — back
// to the hub to log in again instead of silently failing.
function adminHandleSessionRejected() {
  adminClearSession();
  window.location.href = "admin.html";
}

// Every admin-*.html page except admin.html itself calls this immediately:
// bounces back to the hub/login if there's no valid session, otherwise
// hands back { token, email } and shows the page's own content.
function requireAdminSession() {
  const session = adminGetSession();
  if (!session || adminIsTokenExpired(session.token)) {
    adminHandleSessionRejected();
    return null;
  }
  return session;
}

function adminEscapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}
