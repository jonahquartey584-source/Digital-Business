// The real Booking System backend for booking-system.html — one JSON
// "workspace" per client email, stored in Netlify Blobs. Same shape as
// crm-data.mts: a calendar of bookings, a list of bookable services, and
// weekly availability, all read/written through one action-based endpoint.
//
// Auth note: same trust model as crm-data.mts/member-access.mts throughout
// this site — trusts the email the client sends rather than a verified
// server session. booking-system.html only ever sends the email from a
// member's own qpMemberSession after they've already passed the Booking
// System purchase gate.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json } from "./_shared.mts";

type BookingStatus = "confirmed" | "pending" | "cancelled";

interface BookableService {
  id: string;
  name: string;
  durationMinutes: number;
}

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  serviceId: string | null;
  serviceName: string;
  durationMinutes: number;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM", 24h
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
}

interface AvailabilityDay {
  day: number; // 0 = Sunday ... 6 = Saturday
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface BookingWorkspace {
  email: string;
  bookings: Booking[];
  services: BookableService[];
  availability: AvailabilityDay[];
}

const DEFAULT_AVAILABILITY: AvailabilityDay[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  enabled: day >= 1 && day <= 5,
  startTime: "09:00",
  endTime: "17:00",
}));

const DEFAULT_SERVICES = (): BookableService[] => [
  { id: randomUUID(), name: "Consultation", durationMinutes: 45 },
  { id: randomUUID(), name: "Standard appointment", durationMinutes: 60 },
];

function emptyWorkspace(email: string): BookingWorkspace {
  return { email, bookings: [], services: DEFAULT_SERVICES(), availability: DEFAULT_AVAILABILITY };
}

function store() {
  return getStore({ name: "booking-workspaces", consistency: "strong" });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

async function loadWorkspace(email: string): Promise<BookingWorkspace> {
  const existing = (await store().get(email, { type: "json" })) as BookingWorkspace | null;
  return existing ?? emptyWorkspace(email);
}

async function saveWorkspace(ws: BookingWorkspace): Promise<void> {
  await store().setJSON(ws.email, ws);
}

function str(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function reportFor(ws: BookingWorkspace) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const monthPrefix = todayStr.slice(0, 7); // "YYYY-MM"
  const active = ws.bookings.filter((b) => b.status !== "cancelled");
  return {
    todayCount: active.filter((b) => b.date === todayStr).length,
    monthCount: active.filter((b) => b.date.startsWith(monthPrefix)).length,
  };
}

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
    if (!email) return json(400, { status: "error", message: "email is required" });
    const ws = await loadWorkspace(email);
    return json(200, { status: "ok", workspace: ws, report: reportFor(ws) });
  }

  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = normalizeEmail(input.email);
  const action = String(input.action ?? "");
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  if (!email) return json(400, { status: "error", message: "email is required" });

  const ws = await loadWorkspace(email);
  const now = new Date().toISOString();

  switch (action) {
    case "addBooking": {
      const customerName = str(payload.customerName);
      const date = str(payload.date);
      const time = str(payload.time);
      if (!customerName) return json(400, { status: "error", message: "Customer name is required." });
      if (!date || !DATE_RE.test(date)) return json(400, { status: "error", message: "A valid date is required." });
      if (!time || !TIME_RE.test(time)) return json(400, { status: "error", message: "A valid time is required." });

      const serviceId = str(payload.serviceId);
      const service = serviceId ? ws.services.find((s) => s.id === serviceId) : undefined;
      const durationMinutes = service?.durationMinutes ?? Number(payload.durationMinutes) || 30;

      ws.bookings.push({
        id: randomUUID(),
        customerName,
        customerPhone: str(payload.customerPhone),
        customerEmail: str(payload.customerEmail),
        serviceId: service?.id ?? null,
        serviceName: service?.name ?? str(payload.serviceName) ?? "Appointment",
        durationMinutes,
        date,
        time,
        status: "confirmed",
        notes: str(payload.notes),
        createdAt: now,
      });
      break;
    }
    case "setBookingStatus": {
      const booking = ws.bookings.find((b) => b.id === str(payload.id));
      const status = payload.status as BookingStatus;
      if (!booking) return json(404, { status: "error", message: "Booking not found." });
      if (!["confirmed", "pending", "cancelled"].includes(status)) return json(400, { status: "error", message: "Invalid status." });
      booking.status = status;
      break;
    }
    case "deleteBooking": {
      ws.bookings = ws.bookings.filter((b) => b.id !== str(payload.id));
      break;
    }

    case "addService": {
      const name = str(payload.name);
      if (!name) return json(400, { status: "error", message: "Service name is required." });
      const durationMinutes = Number(payload.durationMinutes);
      ws.services.push({
        id: randomUUID(),
        name,
        durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.round(durationMinutes) : 30,
      });
      break;
    }
    case "deleteService": {
      const id = str(payload.id);
      ws.services = ws.services.filter((s) => s.id !== id);
      // Existing bookings keep their own snapshot of serviceName/duration —
      // deleting a service only stops it being offered for new bookings.
      for (const booking of ws.bookings) {
        if (booking.serviceId === id) booking.serviceId = null;
      }
      break;
    }

    case "setAvailability": {
      const days = Array.isArray(payload.availability) ? payload.availability : [];
      const next: AvailabilityDay[] = DEFAULT_AVAILABILITY.map((fallback) => {
        const match = days.find((d: any) => Number(d?.day) === fallback.day);
        if (!match) return fallback;
        const startTime = str(match.startTime);
        const endTime = str(match.endTime);
        return {
          day: fallback.day,
          enabled: Boolean(match.enabled),
          startTime: startTime && TIME_RE.test(startTime) ? startTime : fallback.startTime,
          endTime: endTime && TIME_RE.test(endTime) ? endTime : fallback.endTime,
        };
      });
      ws.availability = next;
      break;
    }

    default:
      return json(400, { status: "error", message: `Unknown action: ${action}` });
  }

  await saveWorkspace(ws);
  return json(200, { status: "ok", workspace: ws, report: reportFor(ws) });
};

export const config: Config = { path: "/api/booking-data" };
