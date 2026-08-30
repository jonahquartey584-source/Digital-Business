"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo-mark";

const DISMISS_KEY = "qp-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own (non-standard) flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIphoneOrIpad = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ identifies as "MacIntel" but is touch-capable, unlike a real Mac.
  const isIpadOs13Plus =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIphoneOrIpad || isIpadOs13Plus;
}

/**
 * Registers the PWA service worker on every page, and shows a small,
 * dismissible "install this app" banner — a real install button on
 * Android/Chrome (via beforeinstallprompt), or manual instructions on
 * iOS Safari (which has no install-prompt API).
 */
export function PwaInstall() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until we check localStorage

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the site still works, it just won't be installable.
      });
    }

    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }

    if (isStandalone()) return; // already installed/running as an app

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (isIos()) setShowIosHint(true);

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage can throw in private-browsing contexts — fine to ignore.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    dismiss();
  };

  if (dismissed || (!installEvent && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-border bg-ink-soft px-4 py-3 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-96 sm:rounded-xl sm:border">
      <div className="flex items-start gap-3">
        <LogoMark className="h-9 w-9 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cream">Install Qp Digital</p>
          {installEvent ? (
            <p className="mt-0.5 text-xs text-cream-dim">
              Add it to your home screen for quick access to your CRM.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-cream-dim">
              Tap the Share icon, then &quot;Add to Home Screen.&quot;
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {installEvent && (
              <button onClick={install} className="btn-primary px-3 py-1.5 text-xs">
                Install
              </button>
            )}
            <button onClick={dismiss} className="btn-ghost px-3 py-1.5 text-xs">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
