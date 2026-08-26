// ---- Configuration ----------------------------------------------------
// Update this to the email address that should receive enquiries.
const BUSINESS_EMAIL = "hello@qpdigital.com";

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
