// Admin Dashboard hub: log in (or get silently recognised as the site's
// head admin) then show four cards, each linking to its own full page —
// New Client Setup, Members, AI Agent Requests, Website Enquiries. None of
// those tools' own logic lives here any more; see admin-new-client.js,
// admin-members.js, admin-agent-requests.js and admin-enquiries.js.
//
// Session handling (adminGetSession/adminSaveSession/...) lives in
// admin-common.js, loaded before this file — every other admin-*.html page
// uses those same functions to check the session this page created.

const loginSection = document.getElementById("loginSection");
const adminToolSection = document.getElementById("adminToolSection");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginNote = document.getElementById("loginNote");
const loggedInEmail = document.getElementById("loggedInEmail");
const logoutBtn = document.getElementById("logoutBtn");

function showLoginScreen(message) {
  if (loginSection) loginSection.hidden = false;
  if (adminToolSection) adminToolSection.hidden = true;
  if (loginNote) {
    loginNote.textContent = message || "";
    loginNote.style.color = message ? "#ff8a8a" : "";
  }
  if (loginForm) loginForm.reset();
}

function showAdminTool(email) {
  if (loginSection) loginSection.hidden = true;
  if (adminToolSection) adminToolSection.hidden = false;
  if (loggedInEmail) loggedInEmail.textContent = email;
}

(async function restoreSession() {
  const session = adminGetSession();
  if (session && !adminIsTokenExpired(session.token)) {
    showAdminTool(session.email);
    return;
  }
  adminClearSession();

  // No admin token saved yet — but if this browser is already signed into
  // the Members Portal (Netlify Identity) as the site's ADMIN_EMAIL, skip
  // the password form entirely. Same-origin, so that Identity session's
  // cookie is already attached to this plain fetch.
  try {
    const response = await fetch("/api/admin_auto_session.php");
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.status === "ok" && data.token) {
      adminSaveSession(data.token, data.email, true);
      showAdminTool(data.email);
      return;
    }
  } catch (err) {
    // Ignore — falls through to the ordinary login form.
  }

  showLoginScreen();
})();

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value;
    const remember = loginForm.loginRemember.checked;

    loginBtn.disabled = true;
    loginNote.textContent = "Logging in…";
    loginNote.style.color = "";

    try {
      const response = await fetch("api/admin_login.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const result = await response.json();

      if (response.ok && result.status === "ok") {
        adminSaveSession(result.token, email, remember);
        showAdminTool(email);
      } else {
        loginNote.textContent = result.message || "Wrong email or password.";
        loginNote.style.color = "#ff8a8a";
      }
    } catch (err) {
      loginNote.textContent = "Couldn't reach api/admin_login.php — is the backend deployed?";
      loginNote.style.color = "#ff8a8a";
    } finally {
      loginBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    adminClearSession();
    showLoginScreen();
  });
}
