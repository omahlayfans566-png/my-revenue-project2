import { useState, useEffect, useCallback } from "react";
import "../style/pwaInstall.css";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

const PWA_INSTALL_DISMISSED_KEY = "pwa_install_dismissed";
const PWA_INSTALL_REMIND_LATER_KEY = "pwa_install_remind_later";
const PWA_INSTALLED_KEY = "pwa_installed";
const MIN_INTERACTION_COUNT = 3;
const REMINDER_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if already installed
  useEffect(() => {
    const isPwaInstalled =
      localStorage.getItem(PWA_INSTALLED_KEY) === "true" ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    setIsInstalled(isPwaInstalled);
  }, []);

  // Detect iOS Safari
  useEffect(() => {
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
  }, []);

  // Track user interaction for popup timing
  useEffect(() => {
    const handleInteraction = () => {
      setInteractionCount((prev) => {
        const next = prev + 1;
        if (next >= MIN_INTERACTION_COUNT) {
          document.removeEventListener("click", handleInteraction);
          document.removeEventListener("touchstart", handleInteraction);
        }
        return next;
      });
    };
    document.addEventListener("click", handleInteraction);
    document.addEventListener("touchstart", handleInteraction);
    return () => {
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Listen for app installed
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setShowPopup(false);
      setDeferredPrompt(null);
      localStorage.setItem(PWA_INSTALLED_KEY, "true");
      localStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
      localStorage.removeItem(PWA_INSTALL_REMIND_LATER_KEY);
    };
    window.addEventListener("appinstalled", handler);
    return () => window.removeEventListener("appinstalled", handler);
  }, []);

  // Show popup when conditions are met
  useEffect(() => {
    if (isInstalled) return;
    if (interactionCount < MIN_INTERACTION_COUNT) return;

    const dismissed = localStorage.getItem(PWA_INSTALL_DISMISSED_KEY);
    if (dismissed === "true") return;

    const remindLater = localStorage.getItem(PWA_INSTALL_REMIND_LATER_KEY);
    if (remindLater) {
      const remindTime = parseInt(remindLater, 10);
      if (Date.now() < remindTime) return;
      localStorage.removeItem(PWA_INSTALL_REMIND_LATER_KEY);
    }

    // Show popup after a short delay
    const timer = setTimeout(() => {
      if (isIOS) {
        setShowIOSInstructions(true);
      } else if (deferredPrompt) {
        setShowPopup(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isInstalled, interactionCount, deferredPrompt, isIOS]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setIsInstalled(true);
        localStorage.setItem(PWA_INSTALLED_KEY, "true");
      }
      setDeferredPrompt(null);
      setShowPopup(false);
      localStorage.removeItem(PWA_INSTALL_DISMISSED_KEY);
      localStorage.removeItem(PWA_INSTALL_REMIND_LATER_KEY);
    } catch (err) {
      console.error("Install prompt failed:", err);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPopup(false);
    setShowIOSInstructions(false);
    localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
  }, []);

  const handleRemindLater = useCallback(() => {
    setShowPopup(false);
    setShowIOSInstructions(false);
    localStorage.setItem(PWA_INSTALL_REMIND_LATER_KEY, String(Date.now() + REMINDER_DELAY_MS));
  }, []);

  // If installed, don't render anything
  if (isInstalled) return null;

  return (
    <>
      {/* Floating install button */}
      {!isInstalled && deferredPrompt && !showPopup && !isIOS && (
        <button
          className="pwa-floating-install"
          onClick={handleInstall}
          aria-label="Install DateClone app"
          title="Install DateClone"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Install App</span>
        </button>
      )}

      {/* Install popup modal */}
      {showPopup && (
        <div className="pwa-popup-overlay" onClick={handleDismiss} role="dialog" aria-modal="true" aria-label="Install DateClone">
          <div className="pwa-popup" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-popup-close" onClick={handleDismiss} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="pwa-popup-icon">
              <span>D</span>
            </div>
            <h2 className="pwa-popup-title">Install DateClone</h2>
            <p className="pwa-popup-message">
              Install DateClone for faster access, instant notifications, and a full-screen app experience.
            </p>
            <div className="pwa-popup-actions">
              <button className="pwa-popup-btn pwa-popup-btn-primary" onClick={handleInstall}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Install
              </button>
              <button className="pwa-popup-btn pwa-popup-btn-secondary" onClick={handleRemindLater}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS instructions popup */}
      {showIOSInstructions && (
        <div className="pwa-popup-overlay" onClick={() => setShowIOSInstructions(false)} role="dialog" aria-modal="true" aria-label="Install DateClone on iOS">
          <div className="pwa-popup" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-popup-close" onClick={() => setShowIOSInstructions(false)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="pwa-popup-icon">
              <span>D</span>
            </div>
            <h2 className="pwa-popup-title">Install DateClone</h2>
            <div className="pwa-ios-instructions">
              <p className="pwa-popup-message">
                Install DateClone on your iPhone for a full-screen app experience.
              </p>
              <ol className="pwa-ios-steps">
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  </span>
                  Tap the <strong>Share</strong> button <span className="pwa-ios-share-icon">⎙</span> in Safari
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  </span>
                  Scroll down and tap <strong>Add to Home Screen</strong>
                </li>
                <li>
                  <span className="pwa-ios-step-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                  </span>
                  Tap <strong>Add</strong> in the top-right corner
                </li>
              </ol>
            </div>
            <div className="pwa-popup-actions">
              <button className="pwa-popup-btn pwa-popup-btn-secondary" onClick={handleRemindLater}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hook to check if app is installed
export function useIsPwaInstalled(): boolean {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const check = () => {
      const isInstalled =
        localStorage.getItem(PWA_INSTALLED_KEY) === "true" ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
      setInstalled(isInstalled);
    };
    check();
    window.addEventListener("appinstalled", check);
    return () => window.removeEventListener("appinstalled", check);
  }, []);

  return installed;
}

// Hook to get install prompt
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        localStorage.setItem(PWA_INSTALLED_KEY, "true");
        return true;
      }
    } catch (err) {
      console.error("Install failed:", err);
    }
    return false;
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt, install };
}