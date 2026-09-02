// ---- Configuration ----------------------------------------------------
// Update this to the email address that should receive enquiries.
const BUSINESS_EMAIL = "jonahquartey584@gmail.com";

// ---- Light / dark theme -------------------------------------------------
const themeToggle = document.getElementById("themeToggle");

function syncThemeToggle() {
  if (!themeToggle) return;
  const isLight = document.documentElement.dataset.theme === "light";
  themeToggle.setAttribute("aria-pressed", String(isLight));
  themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
  const label = themeToggle.querySelector(".theme-toggle__label");
  if (label) label.textContent = isLight ? "Dark" : "Light";
}

syncThemeToggle();
themeToggle?.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem("qpTheme", nextTheme); } catch (_) {}
  syncThemeToggle();
});

// ---- Mobile nav toggle --------------------------------------------------
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close the menu after tapping a link (mobile)
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// ---- Reveal-on-scroll ------------------------------------------------
// Progressive enhancement: elements marked [data-reveal] fade/slide in as
// they enter the viewport. Skipped entirely if the visitor prefers
// reduced motion, or if IntersectionObserver isn't available.
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealTargets = document.querySelectorAll("[data-reveal]");

if (revealTargets.length && !prefersReducedMotion && "IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  // No animation support (or motion is disabled) — just show everything.
  revealTargets.forEach((el) => el.classList.add("is-visible"));
}

// ---- Hero rotator ----------------------------------------------------
// The box beside the hero copy that cycles through "why you need this"
// reasons every few seconds. Content lives here so there's one place to
// edit it — index.html just has the empty slots this fills in.
const HERO_ROTATOR_ITEMS = [
  {
    headline: "You're invisible until you're found.",
    text: "Most people check online before they ever pick up the phone.",
  },
  {
    headline: "A missed call is a lost customer.",
    text: "They don't leave a voicemail — they just call the next name on the list.",
  },
  {
    headline: "Cold leads don't wait.",
    text: "Whoever replies first usually wins the job, not whoever's cheapest.",
  },
  {
    headline: "You can't fix what you can't see.",
    text: "No dashboard means guessing which leads and bookings are actually converting.",
  },
  {
    headline: "Manual admin is a hidden cost.",
    text: "Every hour spent chasing bookings by hand is an hour not spent on paid work.",
  },
  {
    headline: "If Google can't find you, neither can they.",
    text: "Great service doesn't matter if you don't show up in local search.",
  },
];

const heroRotatorBody = document.getElementById("heroRotatorBody");
const heroRotatorIndexEl = document.getElementById("heroRotatorIndex");
const heroRotatorHeadline = document.getElementById("heroRotatorHeadline");
const heroRotatorText = document.getElementById("heroRotatorText");
const heroRotatorProgressBar = document.getElementById("heroRotatorProgressBar");

if (heroRotatorBody && heroRotatorHeadline && heroRotatorText) {
  const HERO_ROTATE_MS = 5000;
  const HERO_ROTATE_FADE_MS = 250; // keep in sync with the CSS transition on .hero__rotator-headline etc.
  let heroRotatorIndex = 0;

  function renderHeroRotatorItem(index) {
    const item = HERO_ROTATOR_ITEMS[index];
    if (heroRotatorIndexEl) {
      heroRotatorIndexEl.textContent = String(index + 1).padStart(2, "0");
    }
    heroRotatorHeadline.textContent = item.headline;
    heroRotatorText.textContent = item.text;
  }

  function restartHeroRotatorProgress() {
    if (!heroRotatorProgressBar) return;
    heroRotatorProgressBar.classList.remove("is-animating");
    void heroRotatorProgressBar.offsetWidth; // force reflow so the animation restarts from 0
    heroRotatorProgressBar.classList.add("is-animating");
  }

  renderHeroRotatorItem(heroRotatorIndex);

  if (prefersReducedMotion) {
    // Static: show the first reason only, no auto-advancing and no
    // animated bar — avoids surprising motion for visitors who've asked
    // not to see it.
    if (heroRotatorProgressBar) heroRotatorProgressBar.style.width = "100%";
  } else {
    restartHeroRotatorProgress();
    setInterval(() => {
      heroRotatorBody.classList.add("is-fading");
      setTimeout(() => {
        heroRotatorIndex = (heroRotatorIndex + 1) % HERO_ROTATOR_ITEMS.length;
        renderHeroRotatorItem(heroRotatorIndex);
        heroRotatorBody.classList.remove("is-fading");
        restartHeroRotatorProgress();
      }, HERO_ROTATE_FADE_MS);
    }, HERO_ROTATE_MS);
  }
}

// ---- Footer year ---------------------------------------------------------
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// ---- Enquiry form --------------------------------------------------------
// POST directly to the Qp Digital backend. The enquiry is persisted in the
// authenticated admin inbox before any optional email notifications run.
const enquiryForm = document.getElementById("enquiryForm");
const formNote = document.getElementById("formNote");

if (enquiryForm) {
  enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(enquiryForm);
    const enquiry = {
      name: (data.get("name") || "").toString().trim(),
      business: (data.get("business") || "").toString().trim(),
      address: (data.get("address") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      phone: (data.get("phone") || "").toString().trim(),
      service: (data.get("service") || "").toString().trim(),
      details: (data.get("details") || "").toString().trim(),
      negotiate: Boolean(data.get("negotiate")),
    };

    if (!enquiry.name || !enquiry.email || !enquiry.service) {
      if (formNote) {
        formNote.textContent = "Please fill in your name, email and choose a service.";
        formNote.style.color = "#ff8a8a";
      }
      return;
    }

    const submitBtn = enquiryForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (formNote) {
      formNote.textContent = "Sending…";
      formNote.style.color = "";
    }

    try {
      const response = await fetch("api/enquiry.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enquiry),
      });
      const result = await response.json();

      if (response.ok && result.status === "ok" && result.saved) {
        if (formNote) {
          formNote.textContent = "Thanks — your enquiry has been sent directly to the Qp Digital team. We’ll respond as quickly as possible.";
          formNote.style.color = "";
        }
        enquiryForm.reset();
      } else {
        throw new Error(result.message || "Enquiry could not be sent");
      }
    } catch (err) {
      if (formNote) {
        formNote.textContent = "We couldn’t send your enquiry just now. Please try again in a moment.";
        formNote.style.color = "#ff8a8a";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ---- AI help centre ----------------------------------------------------
(() => {
  const launcher = document.getElementById("aiHelpLauncher");
  const panel = document.getElementById("aiHelpPanel");
  const closeButton = document.getElementById("aiHelpClose");
  const form = document.getElementById("aiHelpForm");
  const input = document.getElementById("aiHelpInput");
  const messagesElement = document.getElementById("aiHelpMessages");
  const quickQuestions = document.querySelectorAll("[data-ai-question]");
  const handoffButton = document.querySelector("[data-ai-handoff]");
  const handoffForm = document.getElementById("aiHelpHandoff");
  const handoffCancel = document.querySelector("[data-ai-handoff-cancel]");
  const handoffNote = document.getElementById("aiHelpHandoffNote");

  if (!launcher || !panel || !closeButton || !form || !input || !messagesElement) return;

  const conversation = [];
  let pending = false;
  let agentSession = null;
  let agentSeenLength = 0;
  let agentPollTimer = null;

  const setOpen = (open) => {
    panel.hidden = !open;
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => input.focus(), 60);
    else launcher.focus();
  };

  const addMessage = (role, content) => {
    const message = document.createElement("div");
    message.className = `ai-help-message ai-help-message--${role}`;
    message.textContent = content;
    messagesElement.appendChild(message);
    messagesElement.scrollTop = messagesElement.scrollHeight;
    return message;
  };

  const addTyping = () => {
    const typing = document.createElement("div");
    typing.className = "ai-help-message ai-help-message--assistant ai-help-typing";
    typing.setAttribute("aria-label", "Assistant is typing");
    for (let index = 0; index < 3; index += 1) typing.appendChild(document.createElement("span"));
    messagesElement.appendChild(typing);
    messagesElement.scrollTop = messagesElement.scrollHeight;
    return typing;
  };

  const showHandoff = () => {
    setOpen(true);
    if (handoffForm) {
      handoffForm.hidden = false;
      document.getElementById("aiHelpLeadName")?.focus();
    }
  };

  const setAgentMode = () => {
    input.placeholder = "Message the Qp Digital team…";
    const title = panel.querySelector(".ai-help-title strong");
    if (title) title.textContent = "Qp Digital Team";
    const subtitle = panel.querySelector(".ai-help-title span");
    if (subtitle) subtitle.textContent = "LIVE AGENT CHAT · CONNECTED";
    document.querySelector(".ai-help-quick")?.setAttribute("hidden", "");
  };

  const resetAgentMode = () => {
    agentSession = null;
    agentSeenLength = 0;
    if (agentPollTimer) window.clearInterval(agentPollTimer);
    agentPollTimer = null;
    try { sessionStorage.removeItem("qpAgentChat"); } catch (_) {}
    input.placeholder = "Ask Qp Digital anything…";
    const title = panel.querySelector(".ai-help-title strong");
    if (title) title.textContent = "Qp Digital Assistant";
    const subtitle = panel.querySelector(".ai-help-title span");
    if (subtitle) subtitle.textContent = "AI HELP CENTRE · ONLINE";
    document.querySelector(".ai-help-quick")?.removeAttribute("hidden");
  };

  const saveAgentSession = () => {
    try {
      sessionStorage.setItem("qpAgentChat", JSON.stringify({ ...agentSession, seen: agentSeenLength }));
    } catch (_) {}
  };

  const pollAgentChat = async () => {
    if (!agentSession) return;
    try {
      const url = `/api/agent-requests?key=${encodeURIComponent(agentSession.key)}&token=${encodeURIComponent(agentSession.visitorToken)}`;
      const response = await fetch(url);
      if (response.status === 401 || response.status === 404) {
        resetAgentMode();
        return;
      }
      if (!response.ok) throw new Error("Chat unavailable");
      const result = await response.json();
      const transcript = Array.isArray(result.transcript) ? result.transcript : [];
      transcript.slice(agentSeenLength).forEach((message) => {
        if (message.role === "agent") addMessage("agent", `Qp Digital team: ${message.content}`);
      });
      agentSeenLength = transcript.length;
      saveAgentSession();
    } catch {
      // Retry quietly on the next interval.
    }
  };

  const startAgentPolling = () => {
    if (agentPollTimer) window.clearInterval(agentPollTimer);
    setAgentMode();
    pollAgentChat();
    agentPollTimer = window.setInterval(pollAgentChat, 5000);
  };

  const sendAgentMessage = async (text) => {
    if (!agentSession || pending) return;
    pending = true;
    input.value = "";
    input.disabled = true;
    form.querySelector("button").disabled = true;
    addMessage("user", text);
    try {
      const response = await fetch("/api/agent-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: agentSession.key, visitorToken: agentSession.visitorToken, content: text }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 404) {
        resetAgentMode();
        conversation.push({ role: "user", content: text });
        const typing = addTyping();
        const assistantResponse = await fetch("/api/ai-help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: conversation.slice(-8) }),
        });
        const assistantData = await assistantResponse.json().catch(() => ({}));
        typing.remove();
        if (!assistantResponse.ok || typeof assistantData.reply !== "string") throw new Error("Assistant unavailable");
        addMessage("assistant", assistantData.reply);
        conversation.push({ role: "assistant", content: assistantData.reply });
        return;
      }
      if (!response.ok) throw new Error("Message failed");
      conversation.push({ role: "user", content: text });
      agentSeenLength = Number(result.transcriptLength) || agentSeenLength + 1;
      saveAgentSession();
    } catch {
      addMessage(
        "assistant",
        agentSession
          ? "That message could not be sent. Please try again."
          : "That previous agent chat has ended. I’ve reopened the Qp Digital help assistant — how can I help?"
      );
    } finally {
      pending = false;
      input.disabled = false;
      form.querySelector("button").disabled = false;
      input.focus();
    }
  };

  const sendQuestion = async (question) => {
    const text = question.trim();
    if (!text || pending) return;
    if (agentSession) {
      await sendAgentMessage(text);
      return;
    }
    if (/\b(speak|talk|contact|call)\b.*\b(agent|person|human|team|someone)\b|\b(agent|person|human)\b.*\b(speak|talk|contact|call)\b/i.test(text)) {
      addMessage("user", text);
      conversation.push({ role: "user", content: text });
      const handoffReply = "Of course — leave your name and contact details below. A Qp Digital agent will join this chat and be with you soon.";
      addMessage("assistant", handoffReply);
      conversation.push({ role: "assistant", content: handoffReply });
      showHandoff();
      return;
    }

    pending = true;
    input.value = "";
    input.disabled = true;
    form.querySelector("button").disabled = true;
    addMessage("user", text);
    conversation.push({ role: "user", content: text });
    const typing = addTyping();

    try {
      const response = await fetch("/api/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation.slice(-8) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.reply !== "string") throw new Error("Assistant unavailable");
      typing.remove();
      addMessage("assistant", data.reply);
      conversation.push({ role: "assistant", content: data.reply });
    } catch {
      typing.remove();
      const fallbackReply = "I’m temporarily unavailable. Please call 020 3750 8659 or email jonahquartey584@gmail.com and the Qp Digital team will help.";
      addMessage("assistant", fallbackReply);
      conversation.push({ role: "assistant", content: fallbackReply });
    } finally {
      pending = false;
      input.disabled = false;
      form.querySelector("button").disabled = false;
      input.focus();
    }
  };

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", (event) => { event.preventDefault(); sendQuestion(input.value); });
  quickQuestions.forEach((button) => button.addEventListener("click", () => { setOpen(true); sendQuestion(button.dataset.aiQuestion || button.textContent || ""); }));
  handoffButton?.addEventListener("click", () => {
    const handoffReply = "Leave your details below. A Qp Digital agent will join this chat and be with you soon.";
    addMessage("assistant", handoffReply);
    conversation.push({ role: "assistant", content: handoffReply });
    showHandoff();
  });
  handoffCancel?.addEventListener("click", () => { if (handoffForm) handoffForm.hidden = true; input.focus(); });
  handoffForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("aiHelpLeadName")?.value.trim() || "";
    const contact = document.getElementById("aiHelpLeadContact")?.value.trim() || "";
    const message = document.getElementById("aiHelpLeadMessage")?.value.trim() || "";
    const submit = handoffForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    handoffNote.textContent = "Sending your request…";
    try {
      const response = await fetch("/api/agent-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, message, transcript: conversation.slice(-24) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.key || !result.visitorToken) throw new Error("Request failed");
      agentSession = { key: result.key, visitorToken: result.visitorToken };
      agentSeenLength = Number(result.transcriptLength) || conversation.length;
      saveAgentSession();
      handoffForm.reset();
      handoffForm.hidden = true;
      addMessage("assistant", "Your request has been sent. A Qp Digital agent will join this chat and be with you soon — please keep this page open.");
      startAgentPolling();
    } catch {
      handoffNote.textContent = "Couldn’t send that request. Please call 020 3750 8659 or email jonahquartey584@gmail.com.";
    } finally {
      submit.disabled = false;
    }
  });
  try {
    const savedAgentSession = JSON.parse(sessionStorage.getItem("qpAgentChat") || "null");
    if (savedAgentSession?.key && savedAgentSession?.visitorToken) {
      agentSession = { key: savedAgentSession.key, visitorToken: savedAgentSession.visitorToken };
      agentSeenLength = Number(savedAgentSession.seen) || 0;
      startAgentPolling();
    }
  } catch (_) {}
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) setOpen(false); });
})();
