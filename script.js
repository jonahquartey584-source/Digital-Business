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
  const HERO_ROTATE_MS = 3000;
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
// No backend is wired up yet, so submitting the form builds a pre-filled
// email (via a mailto: link) addressed to BUSINESS_EMAIL and opens the
// visitor's email client. Swap this out for a real form handler
// (e.g. Netlify Forms, Formspree, or your own API) when you're ready.
const enquiryForm = document.getElementById("enquiryForm");
const formNote = document.getElementById("formNote");

if (enquiryForm) {
  enquiryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(enquiryForm);
    const name = (data.get("name") || "").toString().trim();
    const business = (data.get("business") || "").toString().trim();
    const address = (data.get("address") || "").toString().trim();
    const email = (data.get("email") || "").toString().trim();
    const phone = (data.get("phone") || "").toString().trim();
    const service = (data.get("service") || "").toString().trim();
    const details = (data.get("details") || "").toString().trim();
    const negotiate = data.get("negotiate") ? "Yes" : "No";

    if (!name || !email || !service) {
      if (formNote) {
        formNote.textContent = "Please fill in your name, email and choose a service.";
        formNote.style.color = "#ff8a8a";
      }
      return;
    }

    const subject = `Enquiry: ${service}`;
    const bodyLines = [
      `Name: ${name}`,
      business ? `Business: ${business}` : null,
      address ? `Address: ${address}` : null,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      `Service: ${service}`,
      `Open to negotiating price: ${negotiate}`,
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
  });
}
