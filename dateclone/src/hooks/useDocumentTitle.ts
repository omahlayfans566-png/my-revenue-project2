import { useEffect } from "react";

const BASE_TITLE = "DateClone";

/**
 * Hook to update the document title with unread badge count
 * Shows unread count in the browser tab title
 */
export function useDocumentTitle(unreadCount: number = 0) {
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>("link[rel=icon]");

    if (unreadCount > 0) {
      document.title = `(${unreadCount > 99 ? "99+" : unreadCount}) ${BASE_TITLE}`;

      // Try to set badge on supported browsers (Chrome Android)
      if ("setAppBadge" in navigator && (navigator as any).setAppBadge) {
        try {
          (navigator as any).setAppBadge(unreadCount);
        } catch {
          // Silently fail
        }
      }
    } else {
      document.title = `${BASE_TITLE} - Find Your Perfect Match`;

      // Clear badge
      if ("clearAppBadge" in navigator && (navigator as any).clearAppBadge) {
        try {
          (navigator as any).clearAppBadge();
        } catch {
          // Silently fail
        }
      }
    }

    return () => {
      document.title = BASE_TITLE;
    };
  }, [unreadCount]);
}