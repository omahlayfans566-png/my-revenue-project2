import { useState, useEffect, useCallback } from "react";
import "../style/pwaUpdate.css";

export default function PwaUpdateNotifier() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Check if there's a waiting service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setShowUpdate(true);
        }
      });

      // Listen for updates
      const handleUpdateFound = () => {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setShowUpdate(true);
          }
        });
      };

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  }, [waitingWorker]);

  const handleDismiss = useCallback(() => {
    setShowUpdate(false);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="pwa-update-bar" role="alert">
      <div className="pwa-update-content">
        <div className="pwa-update-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </div>
        <p className="pwa-update-text">
          A new version of DateClone is available.
        </p>
        <div className="pwa-update-actions">
          <button className="pwa-update-btn pwa-update-btn-primary" onClick={handleUpdate}>
            Update Now
          </button>
          <button className="pwa-update-btn pwa-update-btn-secondary" onClick={handleDismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}