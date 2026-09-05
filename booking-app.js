// Real Booking System app logic for booking-system.html — talks to
// /api/booking-data (netlify/functions/booking-data.mts). Calendar,
// bookable Services and weekly Availability all live here, switched by
// the sidebar nav — same shape as crm-app.js.

function bookingMemberEmail() {
  const raw = localStorage.getItem("qpMemberSession") || sessionStorage.getItem("qpMemberSession");
  if (!raw) return null;
  try {
    return JSON.parse(raw).email || null;
  } catch {
    return null;
  }
}

const email = bookingMemberEmail();
const statusEl = document.getElementById("bookingStatus");
let workspace = { bookings: [], services: [], availability: [] };
let report = null;

function setStatus(message, isError) {
  if (!statusEl) return;
  statusEl.textContent = message || "";
  statusEl.style.color = isError ? "#e07a6b" : "var(--muted)";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function call(action, payload) {
  const response = await fetch("/api/booking-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, action, payload }),
  });
  const data = await response.json();
  if (!response.ok || data.status !== "ok") throw new Error(data.message || "Something went wrong.");
  workspace = data.workspace;
  report = data.report;
  renderAll();
}

async function loadWorkspace() {
  if (!email) {
    setStatus("Couldn't find your signed-in email — please return to the Members Portal and sign in again.", true);
    return;
  }
  setStatus("Loading your bookings…");
  try {
    const response = await fetch(`/api/booking-data?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "Could not load your bookings.");
    workspace = data.workspace;
    report = data.report;
    setStatus("");
    renderAll();
  } catch (error) {
    setStatus(error.message || "Could not load your bookings.", true);
  }
}

// ---------- Calendar ----------

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

let calendarView = "month"; // "month" | "week" | "day"
let anchorDate = new Date(); // navigation cursor for whichever view is showing
let selectedDate = todayStr();

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday-start
  return d;
}

function bookingsOn(date) {
  return workspace.bookings
    .filter((b) => b.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function renderCalendarHead() {
  const label = document.getElementById("bookingMonthLabel");
  if (!label) return;
  if (calendarView === "month") {
    label.textContent = `${MONTH_LABEL[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  } else if (calendarView === "week") {
    const start = startOfWeek(anchorDate);
    const end = addDays(start, 6);
    label.textContent = start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${MONTH_LABEL[start.getMonth()]} ${start.getFullYear()}`
      : `${start.getDate()} ${MONTH_LABEL[start.getMonth()]} – ${end.getDate()} ${MONTH_LABEL[end.getMonth()]} ${end.getFullYear()}`;
  } else {
    label.textContent = `${WEEKDAY_LABEL[anchorDate.getDay()]} ${anchorDate.getDate()} ${MONTH_LABEL[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
  }
}

function applyCalendarViewVisibility() {
  const weekdaysHead = document.getElementById("bookingCalendarWeekdays");
  const grid = document.getElementById("bookingCalendarGrid");
  const timegrid = document.getElementById("bookingTimegrid");
  const isMonth = calendarView === "month";
  if (weekdaysHead) weekdaysHead.hidden = !isMonth;
  if (grid) grid.hidden = !isMonth;
  if (timegrid) timegrid.hidden = isMonth;
}

function renderCalendar() {
  renderCalendarHead();
  applyCalendarViewVisibility();
  if (calendarView === "month") renderMonthGrid();
  else renderTimegrid();
}

function renderMonthGrid() {
  const grid = document.getElementById("bookingCalendarGrid");
  if (!grid) return;

  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  // Monday-start grid: JS getDay() is 0=Sun..6=Sat, shift so Monday=0.
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = todayStr();

  const cells = [];
  for (let i = 0; i < leadingBlank; i++) {
    const day = daysInPrevMonth - leadingBlank + 1 + i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    cells.push({ date: dateKey(prevYear, prevMonth, day), day, muted: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: dateKey(year, month, day), day, muted: false });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const [y, m, d] = last.date.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    cells.push({ date: dateKey(next.getFullYear(), next.getMonth(), next.getDate()), day: next.getDate(), muted: true });
    if (cells.length >= 42) break;
  }

  grid.innerHTML = cells
    .map((cell) => {
      const bookings = bookingsOn(cell.date);
      const shown = bookings.slice(0, 3);
      const extra = bookings.length - shown.length;
      const chips = shown
        .map((b) => `<span class="booking-calendar__chip${b.status === "cancelled" ? " booking-calendar__chip--cancelled" : b.status === "pending" ? " booking-calendar__chip--pending" : ""}">${esc(b.time)} ${esc(b.customerName)}</span>`)
        .join("");
      const classes = [
        "booking-calendar__day",
        cell.muted ? "booking-calendar__day--muted" : "",
        cell.date === today ? "booking-calendar__day--today" : "",
        cell.date === selectedDate ? "booking-calendar__day--selected" : "",
      ].filter(Boolean).join(" ");
      return `
        <button type="button" class="${classes}" data-calendar-day="${esc(cell.date)}" role="gridcell" aria-label="${esc(cell.date)}">
          <span class="booking-calendar__daynum">${cell.day}</span>
          <span class="booking-calendar__chips">${chips}${extra > 0 ? `<span class="booking-calendar__more">+${extra} more</span>` : ""}</span>
        </button>`;
    })
    .join("");

  grid.querySelectorAll("[data-calendar-day]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDate = btn.dataset.calendarDay;
      anchorDate = dateFromKey(selectedDate);
      renderCalendar();
      renderAgenda();
    });
  });
}

// ---------- Week / Day timegrid ----------

const TIMEGRID_START_HOUR = 7;
const TIMEGRID_END_HOUR = 21; // last hour row shown is 20:00–21:00
const TIMEGRID_HOUR_HEIGHT = 48;

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function hourLabel(hour) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

// Greedy column assignment so overlapping bookings on the same day sit
// side by side instead of on top of each other.
function layoutDayEvents(bookings) {
  const sorted = [...bookings].sort((a, b) => a.time.localeCompare(b.time));
  const columnEnds = [];
  const placed = sorted.map((booking) => {
    const start = timeToMinutes(booking.time);
    const end = start + booking.durationMinutes;
    let col = columnEnds.findIndex((endMinutes) => endMinutes <= start);
    if (col === -1) { col = columnEnds.length; columnEnds.push(end); } else columnEnds[col] = end;
    return { booking, start, col };
  });
  const cols = Math.max(1, columnEnds.length);
  return placed.map((p) => ({ ...p, cols }));
}

function renderTimegrid() {
  const head = document.getElementById("bookingTimegridHead");
  const hours = document.getElementById("bookingTimegridHours");
  const days = document.getElementById("bookingTimegridDays");
  if (!head || !hours || !days) return;

  const dayList = calendarView === "day" ? [new Date(anchorDate)] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchorDate), i));
  const today = todayStr();

  head.innerHTML =
    `<div class="booking-timegrid__head-gutter"></div>` +
    dayList
      .map((d) => {
        const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
        return `<div class="booking-timegrid__head-day${key === today ? " booking-timegrid__head-day--today" : ""}">${WEEKDAY_LABEL[d.getDay()]}<strong>${d.getDate()}</strong></div>`;
      })
      .join("");

  hours.innerHTML = Array.from({ length: TIMEGRID_END_HOUR - TIMEGRID_START_HOUR }, (_, i) => `<div class="booking-timegrid__hour">${hourLabel(TIMEGRID_START_HOUR + i)}</div>`).join("");

  const totalHeight = (TIMEGRID_END_HOUR - TIMEGRID_START_HOUR) * TIMEGRID_HOUR_HEIGHT;
  const rangeStart = TIMEGRID_START_HOUR * 60;

  days.innerHTML = dayList
    .map((d) => {
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const laid = layoutDayEvents(bookingsOn(key));
      const events = laid
        .map(({ booking, start, col, cols }) => {
          const clampedStart = Math.min(Math.max(start, rangeStart), rangeStart + totalHeight / TIMEGRID_HOUR_HEIGHT * 60);
          const top = ((clampedStart - rangeStart) / 60) * TIMEGRID_HOUR_HEIGHT;
          const height = Math.max(18, ((booking.durationMinutes - (clampedStart - start)) / 60) * TIMEGRID_HOUR_HEIGHT);
          const width = 100 / cols;
          const left = width * col;
          const cls = booking.status === "cancelled" ? " booking-timegrid__event--cancelled" : booking.status === "pending" ? " booking-timegrid__event--pending" : "";
          return `<button type="button" class="booking-timegrid__event${cls}" style="top:${top}px;height:${height}px;left:${left}%;width:calc(${width}% - 4px)" data-timegrid-booking="${esc(booking.id)}">
            <strong>${esc(booking.time)}</strong>${esc(booking.customerName)}
          </button>`;
        })
        .join("");
      return `<div class="booking-timegrid__day" style="height:${totalHeight}px" data-timegrid-day="${esc(key)}">${events}</div>`;
    })
    .join("");

  days.querySelectorAll("[data-timegrid-day]").forEach((col) => {
    col.addEventListener("click", (event) => {
      if (event.target.closest("[data-timegrid-booking]")) return;
      selectedDate = col.dataset.timegridDay;
      anchorDate = dateFromKey(selectedDate);
      renderCalendar();
      renderAgenda();
    });
  });
  days.querySelectorAll("[data-timegrid-booking]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedDate = btn.closest("[data-timegrid-day]").dataset.timegridDay;
      anchorDate = dateFromKey(selectedDate);
      renderCalendar();
      renderAgenda();
    });
  });
}

document.querySelectorAll("[data-calendar-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    calendarView = btn.dataset.calendarView;
    document.querySelectorAll("[data-calendar-view]").forEach((b) => b.classList.toggle("is-active", b.dataset.calendarView === calendarView));
    anchorDate = dateFromKey(selectedDate);
    renderCalendar();
  });
});

function formatAgendaDate(date) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const prefix = date === todayStr() ? "Today — " : "";
  return `${prefix}${WEEKDAY_LABEL[dt.getDay()]} ${d} ${MONTH_LABEL[m - 1]} ${y}`;
}

const BOOKING_STATUS_LABEL = { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled" };

function renderAgenda() {
  const title = document.getElementById("bookingAgendaTitle");
  const list = document.getElementById("bookingAgendaList");
  if (!title || !list) return;

  title.textContent = formatAgendaDate(selectedDate);
  const bookings = bookingsOn(selectedDate);
  if (bookings.length === 0) {
    list.innerHTML = `<p class="crm-column__empty">Nothing booked for this day.</p>`;
    return;
  }

  list.innerHTML = bookings
    .map((b) => {
      const contact = [b.customerPhone, b.customerEmail].filter(Boolean).join(" · ");
      const actions =
        b.status === "cancelled"
          ? `<span class="crm-badge">Cancelled</span>`
          : `
        ${b.status === "pending" ? `<button type="button" class="crm-link-btn" data-booking-status="${esc(b.id)}" data-status="confirmed">Confirm</button>` : `<button type="button" class="crm-link-btn" data-booking-status="${esc(b.id)}" data-status="pending">Mark pending</button>`}
        <button type="button" class="crm-link-btn" data-booking-status="${esc(b.id)}" data-status="cancelled">Cancel</button>`;
      return `
      <div class="booking-agenda__item">
        <div class="booking-agenda__item-main">
          <strong>${esc(b.time)} · ${esc(b.customerName)}</strong>
          <span>${esc(b.serviceName)} · ${b.durationMinutes} min${contact ? ` · ${esc(contact)}` : ""} · ${BOOKING_STATUS_LABEL[b.status]}</span>
          ${b.notes ? `<p>${esc(b.notes)}</p>` : ""}
        </div>
        <div class="crm-row-actions">
          ${actions}
          <button type="button" class="crm-link-btn crm-link-btn--danger" data-booking-delete="${esc(b.id)}">Delete</button>
        </div>
      </div>`;
    })
    .join("");

  list.querySelectorAll("[data-booking-status]").forEach((btn) => {
    btn.addEventListener("click", () => call("setBookingStatus", { id: btn.dataset.bookingStatus, status: btn.dataset.status }).catch((e) => setStatus(e.message, true)));
  });
  list.querySelectorAll("[data-booking-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this booking?")) call("deleteBooking", { id: btn.dataset.bookingDelete }).catch((e) => setStatus(e.message, true));
    });
  });
}

document.getElementById("bookingPrevMonth")?.addEventListener("click", () => {
  if (calendarView === "month") anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1);
  else if (calendarView === "week") anchorDate = addDays(anchorDate, -7);
  else anchorDate = addDays(anchorDate, -1);
  renderCalendar();
});
document.getElementById("bookingNextMonth")?.addEventListener("click", () => {
  if (calendarView === "month") anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
  else if (calendarView === "week") anchorDate = addDays(anchorDate, 7);
  else anchorDate = addDays(anchorDate, 1);
  renderCalendar();
});
document.getElementById("bookingTodayBtn")?.addEventListener("click", () => {
  anchorDate = new Date();
  selectedDate = todayStr();
  renderCalendar();
  renderAgenda();
});

// ---------- New Booking modal ----------

const bookingModal = document.getElementById("bookingModal");
const bookingForm = document.getElementById("bookingForm");
const bookingFormNote = document.getElementById("bookingFormNote");

function populateServiceOptions() {
  const select = document.getElementById("bookingFormService");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">No specific service</option>` + workspace.services.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${s.durationMinutes} min)</option>`).join("");
  if (current) select.value = current;
}

function openBookingModal(prefillDate) {
  if (!bookingModal) return;
  bookingForm?.reset();
  if (bookingFormNote) bookingFormNote.hidden = true;
  populateServiceOptions();
  const dateInput = bookingForm?.querySelector('[name="date"]');
  if (dateInput) dateInput.value = prefillDate || selectedDate;
  bookingModal.hidden = false;
}

function closeBookingModal() {
  if (bookingModal) bookingModal.hidden = true;
}

document.getElementById("bookingNewBtn")?.addEventListener("click", (event) => {
  // Its text ("+ New Booking") exactly matches service-actions.js's
  // generic "+ new booking" demo handler — stop the click reaching that
  // document-level listener so only this real modal opens.
  event.stopPropagation();
  openBookingModal(selectedDate);
});
document.getElementById("bookingAgendaAddBtn")?.addEventListener("click", () => openBookingModal(selectedDate));
document.getElementById("bookingModalClose")?.addEventListener("click", closeBookingModal);
document.getElementById("bookingFormCancel")?.addEventListener("click", closeBookingModal);
bookingModal?.addEventListener("click", (event) => { if (event.target === bookingModal) closeBookingModal(); });

bookingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(bookingForm).entries());
  try {
    await call("addBooking", payload);
    selectedDate = payload.date || selectedDate;
    closeBookingModal();
    renderCalendar();
    renderAgenda();
  } catch (e) {
    if (bookingFormNote) { bookingFormNote.hidden = false; bookingFormNote.textContent = e.message; }
    else setStatus(e.message, true);
  }
});

// ---------- Request Landing Page ----------
//
// Not a self-serve builder — this sends a request straight to Qp Digital
// (netlify/functions/landing-page-request.mts), same pattern as the
// "New Change Request" action on web-development.html. Qp Digital designs
// and ships the page by hand.

function bookingAccountId() {
  return new URLSearchParams(location.search).get("account") || "";
}

const landingPageModal = document.getElementById("landingPageModal");
const landingPageForm = document.getElementById("landingPageForm");
const landingPageFormNote = document.getElementById("landingPageFormNote");

document.getElementById("bookingLandingPageBtn")?.addEventListener("click", () => {
  landingPageForm?.reset();
  if (landingPageFormNote) landingPageFormNote.hidden = true;
  if (landingPageModal) landingPageModal.hidden = false;
});
document.getElementById("landingPageModalClose")?.addEventListener("click", () => { if (landingPageModal) landingPageModal.hidden = true; });
document.getElementById("landingPageFormCancel")?.addEventListener("click", () => { if (landingPageModal) landingPageModal.hidden = true; });
landingPageModal?.addEventListener("click", (event) => { if (event.target === landingPageModal) landingPageModal.hidden = true; });

landingPageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(landingPageForm).entries());
  try {
    const response = await fetch("/api/landing-page-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: bookingAccountId(), service: "Booking System", ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== "ok") throw new Error(data.message || "Couldn't send that — try again.");
    if (landingPageModal) landingPageModal.hidden = true;
    setStatus("Landing page request sent — Qp Digital will be in touch.");
  } catch (e) {
    if (landingPageFormNote) { landingPageFormNote.hidden = false; landingPageFormNote.textContent = e.message; }
  }
});

// ---------- Services ----------

function renderServices() {
  const list = document.getElementById("bookingServicesList");
  if (!list) return;
  if (workspace.services.length === 0) {
    list.innerHTML = `<p class="crm-column__empty">No bookable services yet.</p>`;
    return;
  }
  list.innerHTML = workspace.services
    .map(
      (s) => `
    <div class="member-service-row">
      <div><strong>${esc(s.name)}</strong><br><span>${s.durationMinutes} minutes</span></div>
      <div class="crm-row-actions"><button type="button" class="crm-link-btn crm-link-btn--danger" data-service-delete="${esc(s.id)}">Delete</button></div>
    </div>`
    )
    .join("");
  list.querySelectorAll("[data-service-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("Delete this service? Existing bookings keep their own details.")) call("deleteService", { id: btn.dataset.serviceDelete }).catch((e) => setStatus(e.message, true));
    });
  });
}

document.getElementById("bookingServiceForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await call("addService", payload);
    form.reset();
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Availability ----------

const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AVAILABILITY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, matching the calendar week

function renderAvailability() {
  const rows = document.getElementById("bookingAvailabilityRows");
  if (!rows) return;
  rows.innerHTML = AVAILABILITY_ORDER.map((day) => {
    const entry = workspace.availability.find((a) => a.day === day) || { day, enabled: false, startTime: "09:00", endTime: "17:00" };
    return `
      <div class="availability-row" data-day="${day}" data-enabled="${entry.enabled}">
        <label><input type="checkbox" data-avail-enabled ${entry.enabled ? "checked" : ""}> ${DAY_NAME[day]}</label>
        <span></span>
        <input type="time" data-avail-start value="${esc(entry.startTime)}">
        <input type="time" data-avail-end value="${esc(entry.endTime)}">
      </div>`;
  }).join("");

  rows.querySelectorAll("[data-avail-enabled]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      checkbox.closest(".availability-row").dataset.enabled = String(checkbox.checked);
    });
  });
}

document.getElementById("bookingSaveAvailabilityBtn")?.addEventListener("click", async () => {
  const rows = document.querySelectorAll("#bookingAvailabilityRows .availability-row");
  const availability = Array.from(rows).map((row) => ({
    day: Number(row.dataset.day),
    enabled: row.querySelector("[data-avail-enabled]").checked,
    startTime: row.querySelector("[data-avail-start]").value,
    endTime: row.querySelector("[data-avail-end]").value,
  }));
  try {
    await call("setAvailability", { availability });
    setStatus("Availability saved.");
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ---------- Summary ----------

function renderSummary() {
  if (!report) return;
  const todayEl = document.getElementById("bookingTodayCount");
  const monthEl = document.getElementById("bookingMonthCount");
  if (todayEl) todayEl.textContent = `${report.todayCount} booking${report.todayCount === 1 ? "" : "s"}`;
  if (monthEl) monthEl.textContent = `${report.monthCount} booking${report.monthCount === 1 ? "" : "s"}`;
}

// ---------- Nav switching ----------

const VIEW_TITLE = { calendar: "Calendar", services: "Services", availability: "Availability" };
const VIEW_LEAD = {
  calendar: "Every booking, at a glance.",
  services: "Keep what customers can book up to date.",
  availability: "Only bookable when you're switched on.",
};

function showView(view) {
  document.querySelectorAll("[data-booking-view]").forEach((el) => el.classList.toggle("is-active", el.dataset.bookingView === view));
  document.querySelectorAll("[data-booking-panel]").forEach((el) => { el.hidden = el.dataset.bookingPanel !== view; });
  const title = document.querySelector("[data-booking-view-title]");
  const lead = document.querySelector("[data-booking-view-lead]");
  if (title) title.textContent = VIEW_TITLE[view] || view;
  if (lead) lead.textContent = VIEW_LEAD[view] || "";
  const tools = document.querySelector(".service-app-tools[data-booking-view]");
  if (tools) tools.hidden = tools.dataset.bookingView !== view;
}

document.querySelectorAll("button[data-booking-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.bookingView));
});

function renderAll() {
  renderCalendar();
  renderAgenda();
  renderServices();
  renderAvailability();
  renderSummary();
}

loadWorkspace();
