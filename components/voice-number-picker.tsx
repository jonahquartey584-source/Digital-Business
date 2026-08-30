"use client";

import { useState, useTransition } from "react";
import { provisionVoiceNumber, searchVoiceNumbers } from "@/lib/voice/actions";
import type { AvailableNumber } from "@/lib/voice/provisioning";

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
];

export function VoiceNumberPicker() {
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [provisioning, startProvision] = useTransition();
  const [provisioningNumber, setProvisioningNumber] = useState<string | null>(null);

  const search = () => {
    setError(null);
    startSearch(async () => {
      const result = await searchVoiceNumbers(country, areaCode);
      setNumbers(result.numbers);
      setError(result.error);
    });
  };

  const provision = (phoneNumber: string) => {
    setProvisioningNumber(phoneNumber);
    startProvision(async () => {
      const formData = new FormData();
      formData.set("phone_number", phoneNumber);
      await provisionVoiceNumber(formData);
    });
  };

  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-bold text-cream">
        Get your AI Reception number
      </h2>
      <p className="mt-1 text-sm text-cream-dim">
        We'll set this up automatically — search for a number, pick one, and
        it's ready to take calls. No Twilio account needed on your end.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="country">Country</label>
          <select
            id="country"
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="areaCode">Area code (optional)</label>
          <input
            id="areaCode"
            className="input"
            value={areaCode}
            onChange={(e) => setAreaCode(e.target.value)}
            placeholder="415"
            maxLength={5}
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="btn-primary"
        >
          {searching ? "Searching…" : "Search numbers"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {numbers.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-border border-t border-ink-border">
          {numbers.map((n) => (
            <li key={n.phoneNumber} className="flex items-center justify-between py-3">
              <div>
                <p className="font-mono text-sm text-cream">{n.phoneNumber}</p>
                <p className="text-xs text-cream-dim">
                  {[n.locality, n.region].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => provision(n.phoneNumber)}
                disabled={provisioning}
                className="btn-secondary text-xs"
              >
                {provisioning && provisioningNumber === n.phoneNumber
                  ? "Setting up…"
                  : "Get this number"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
