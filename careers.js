// Careers page — "Apply for the Cold Caller Role" form. POSTs straight to
// /api/job-application (netlify/functions/job-application.mts), same
// pattern as script.js's enquiry form.

const applicationForm = document.getElementById("applicationForm");
const applicationFormNote = document.getElementById("applicationFormNote");

if (applicationForm) {
  applicationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(applicationForm);
    const application = {
      role: "Cold Caller",
      name: (data.get("name") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      phone: (data.get("phone") || "").toString().trim(),
      message: (data.get("message") || "").toString().trim(),
    };

    if (!application.name || (!application.email && !application.phone)) {
      if (applicationFormNote) {
        applicationFormNote.textContent = "Please add your name and an email or phone number so we can reach you.";
        applicationFormNote.style.color = "#ff8a8a";
      }
      return;
    }

    const submitBtn = applicationForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    if (applicationFormNote) {
      applicationFormNote.textContent = "Sending…";
      applicationFormNote.style.color = "";
    }

    try {
      const response = await fetch("/api/job-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(application),
      });
      const result = await response.json();

      if (response.ok && result.status === "ok") {
        if (applicationFormNote) {
          applicationFormNote.textContent = "Thanks — your application has been sent directly to the Qp Digital team. We'll be in touch if it's a good fit.";
          applicationFormNote.style.color = "";
        }
        applicationForm.reset();
      } else {
        throw new Error(result.message || "Application could not be sent");
      }
    } catch (err) {
      if (applicationFormNote) {
        applicationFormNote.textContent = err.message || "We couldn't send your application just now. Please try again in a moment.";
        applicationFormNote.style.color = "#ff8a8a";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
