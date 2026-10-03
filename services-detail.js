/* Detail panels for the service cards on the homepage.
 *
 * The copy here expands the one-line description already on each card; the
 * screenshots are the real ones from examples.html, mapped to the service
 * they actually belong to. Services with no screenshot say so rather than
 * borrowing someone else's — four of the eleven have nothing to show yet,
 * and an invented example is worse than an honest gap.
 */
(function () {
  var SERVICES = {
    websites: {
      lead: "A site built around one job: turning the people who land on it into enquiries. Custom-built, not a template, and fast on a phone because that is where most of your visitors are.",
      list: ["Designed and built from scratch around your business",
             "Fast and readable on a phone, not just a desktop",
             "Written to get people to contact you, not just to look nice",
             "Set up so Google can read it properly from day one",
             "You own it outright"],
      shots: [["assets/showcase-site-florist.webp", "Website built for a florist"],
              ["assets/showcase-site-plumbing.webp", "Website built for a trades business"]]
    },
    crm: {
      lead: "One place where every lead, customer and conversation lives, so nothing depends on remembering which inbox it came through.",
      list: ["Every enquiry in one pipeline, whatever channel it arrived on",
             "See who is waiting on a reply and who has gone quiet",
             "Notes and history against each customer",
             "Tasks and follow-ups so nothing sits forgotten",
             "Reporting on where your work actually comes from"],
      shots: [["assets/showcase-crm.webp", "The CRM sales pipeline"]]
    },
    management: {
      lead: "The part most people skip. Your site gets updates, hosting, security patches, fixes and ongoing SEO, so it does not quietly rot a year after launch.",
      list: ["Hosting and domain handled",
             "Security updates and backups",
             "Content changes when you need them",
             "Ongoing SEO so you stay findable",
             "Someone to call when something breaks"],
      note: "No screenshot for this one — it is ongoing work rather than a thing you look at."
    },
    booking: {
      lead: "Customers book themselves in, at the times you actually have free, at eleven at night if that is when they are looking.",
      list: ["Your real availability, not a guess",
             "Confirmations and reminders sent automatically",
             "Fewer no-shows and fewer phone calls",
             "Works on a phone",
             "Feeds straight into the CRM"],
      shots: [["assets/showcase-booking.webp", "The booking system calendar"]]
    },
    branding: {
      lead: "Logo, identity and the print that goes with it, so the business looks like one business everywhere someone meets it.",
      list: ["Logo and full brand identity",
             "Colours and type that work on screen and in print",
             "Business cards and flyers",
             "Files in every format you will be asked for",
             "Applied consistently across your site and socials"],
      shots: [["assets/showcase-brand-bloom.webp", "Brand identity for a coffee roastery"],
              ["assets/showcase-brand-willow.webp", "Brand identity for a creative studio"]]
    },
    social: {
      lead: "Posts, captions and content on a schedule, so the account does not go three months without a word.",
      list: ["A posting schedule you can actually keep to",
             "Captions and copy written for you",
             "Content that matches the brand",
             "Planned ahead rather than panicked on the day"],
      note: "Examples are account-specific — ask and I will show you live work."
    },
    reporting: {
      lead: "Leads, calls, bookings and sales on one screen, instead of three spreadsheets and a guess.",
      list: ["Enquiries, bookings and sales in one view",
             "Where your leads are actually coming from",
             "What is converting and what is not",
             "Updated automatically, not by hand"],
      note: "Built on your own numbers, so there is nothing generic to show here."
    },
    automation: {
      lead: "The repetitive admin handled by the system, so nothing depends on someone remembering to do it.",
      list: ["Enquiries routed and logged automatically",
             "Confirmations, reminders and receipts sent for you",
             "Data moved between tools without copy-paste",
             "Fewer things that only work when you are at your desk"],
      note: "Set up per business — happy to walk you through a live one."
    },
    followups: {
      lead: "Missed calls, unanswered quotes and review requests chased automatically, so a lead going cold is a decision rather than an accident.",
      list: ["Missed calls followed up without you doing it",
             "Quotes chased on a schedule",
             "Review requests after the job is done",
             "Stops when the customer replies"],
      note: "Runs in the background — ask to see it working on a real account."
    },
    chatbots: {
      lead: "A chatbot or live chat on the site that answers the common questions and captures the lead at two in the morning.",
      list: ["Answers the questions you get asked constantly",
             "Captures name and number before they leave",
             "Hands over to you when it is a real conversation",
             "Available when you are asleep"],
      note: "Configured around your own questions and services."
    },
    custom: {
      lead: "If it is digital and it helps the business, it is worth asking about. Plenty of what is on this page started as someone describing a problem.",
      list: ["Tell us the problem rather than the solution",
             "We will say if it is not something we do well",
             "No obligation and no hard sell"],
      note: "This one is a conversation, not a product."
    }
  };

  var modal = document.getElementById('svcModal');
  if (!modal || !modal.showModal) { return; }   // no dialog support: cards stay plain
  var elTitle = document.getElementById('svcModalTitle'),
      elLead  = document.getElementById('svcModalLead'),
      elList  = document.getElementById('svcModalList'),
      elShots = document.getElementById('svcModalShots'),
      elNote  = document.getElementById('svcModalNote'),
      elTag   = document.getElementById('svcModalTag');
  var lastOpener = null;

  function open(slug, title, opener) {
    var s = SERVICES[slug];
    if (!s) { return; }
    lastOpener = opener;
    elTag.textContent = 'Service';
    elTitle.innerHTML = title;
    elLead.textContent = s.lead;

    elList.innerHTML = '';
    s.list.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      elList.appendChild(li);
    });

    elShots.innerHTML = '';
    if (s.shots) {
      s.shots.forEach(function (pair) {
        var fig = document.createElement('figure');
        var img = document.createElement('img');
        img.src = pair[0]; img.alt = pair[1]; img.loading = 'lazy';
        var cap = document.createElement('figcaption');
        cap.textContent = pair[1];
        fig.appendChild(img); fig.appendChild(cap);
        elShots.appendChild(fig);
      });
    }
    elNote.textContent = s.note || '';
    elNote.hidden = !s.note;

    modal.showModal();
  }

  document.querySelectorAll('.service-card__hit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.service-card');
      var h3 = card && card.querySelector('h3');
      open(btn.getAttribute('data-service'), h3 ? h3.innerHTML : '', btn);
    });
  });

  var closeBtn = document.getElementById('svcModalClose');
  if (closeBtn) { closeBtn.addEventListener('click', function () { modal.close(); }); }

  /* clicking the backdrop closes; clicking the panel itself must not */
  modal.addEventListener('click', function (e) {
    if (e.target === modal) { modal.close(); }
  });
  modal.querySelectorAll('[data-close-modal]').forEach(function (a) {
    a.addEventListener('click', function () { modal.close(); });
  });
  /* send focus back where it came from, so keyboard users do not lose their place */
  modal.addEventListener('close', function () {
    if (lastOpener) { lastOpener.focus(); lastOpener = null; }
  });
})();
