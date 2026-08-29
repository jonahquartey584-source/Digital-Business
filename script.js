// ---- Configuration ----------------------------------------------------
// Update this to the email address that should receive enquiries.
const BUSINESS_EMAIL = "jonahquartey584@gmail.com";

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
// Primary path: POST to api/enquiry.php, which sends the visitor an
// automatic confirmation email (and the business a notification) — see
// api/enquiry.php / netlify/functions/enquiry.mts.
//
// Fallback: if that can't be reached, or responds but couldn't actually
// send email (e.g. RESEND_API_KEY isn't configured yet), fall back to
// building a pre-filled email (via a mailto: link) addressed to
// BUSINESS_EMAIL and opening the visitor's own email client — the same
// behavior this form had before the backend existed, so an enquiry is
// never silently lost.
const enquiryForm = document.getElementById("enquiryForm");
const formNote = document.getElementById("formNote");

function openEnquiryMailtoFallback({ name, business, address, email, phone, service, details, negotiate }) {
  const subject = `Enquiry: ${service}`;
  const bodyLines = [
    `Name: ${name}`,
    business ? `Business: ${business}` : null,
    address ? `Address: ${address}` : null,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Service: ${service}`,
    `Open to negotiating price: ${negotiate ? "Yes" : "No"}`,
    "",
    "Details:",
    details || "(none provided)",
  ].filter(Boolean);

  const mailtoUrl =
    `mailto:${BUSINESS_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(bodyLines.join("\n"))}`;

  window.location.href = mailtoUrl;

  if (formNote) {
    formNote.textContent = "Opening your email client to send this enquiry…";
    formNote.style.color = "";
  }
}

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

      if (response.ok && result.status === "ok" && result.emailSent) {
        if (formNote) {
          formNote.textContent = `Thanks — we've sent a confirmation to ${enquiry.email}. Our team will respond as quickly as possible.`;
          formNote.style.color = "";
        }
        enquiryForm.reset();
      } else {
        // Reached the backend, but it couldn't actually send email (most
        // likely RESEND_API_KEY isn't set up yet) — fall back rather than
        // leave the visitor thinking nothing happened.
        openEnquiryMailtoFallback(enquiry);
      }
    } catch (err) {
      // Backend not reachable at all.
      openEnquiryMailtoFallback(enquiry);
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

  const sendQuestion = async (question) => {
    const text = question.trim();
    if (!text || pending) return;
    if (/\b(speak|talk|contact|call)\b.*\b(agent|person|human|team|someone)\b|\b(agent|person|human)\b.*\b(speak|talk|contact|call)\b/i.test(text)) {
      addMessage("user", text);
      addMessage("assistant", "Of course — leave your name and an email address or phone number below, and the Qp Digital team can contact you.");
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
      if (conversation.length > 8) conversation.splice(0, conversation.length - 8);
    } catch {
      typing.remove();
      addMessage("assistant", "I’m temporarily unavailable. Please call 07544 856633 or email jonahquartey584@gmail.com and the Qp Digital team will help.");
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
    addMessage("assistant", "Leave your details below and a member of the Qp Digital team can contact you.");
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
        body: JSON.stringify({ name, contact, message }),
      });
      if (!response.ok) throw new Error("Request failed");
      handoffForm.reset();
      handoffForm.hidden = true;
      addMessage("assistant", "Your request has been sent to the Qp Digital team. They’ll use the contact details you provided to get back to you.");
    } catch {
      handoffNote.textContent = "Couldn’t send that request. Please call 07544 856633 or email jonahquartey584@gmail.com.";
    } finally {
      submit.disabled = false;
    }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) setOpen(false); });
})();
