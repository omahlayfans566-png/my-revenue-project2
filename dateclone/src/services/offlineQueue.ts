/**
 * Offline Queue Manager
 * Queues actions when offline and syncs when back online
 */

interface QueuedAction {
  id: string;
  type: "message" | "like" | "profile_edit" | "settings_update";
  payload: any;
  timestamp: number;
  retries: number;
}

const QUEUE_KEY = "dateclone_offline_queue";
const MAX_RETRIES = 3;

// Get queue from localStorage
function getQueue(): QueuedAction[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save queue to localStorage
function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full - remove oldest items
    const trimmed = queue.slice(-20);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  }
}

// Add action to queue
export function queueAction(type: QueuedAction["type"], payload: any): string {
  const id = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const queue = getQueue();
  queue.push({ id, type, payload, timestamp: Date.now(), retries: 0 });
  saveQueue(queue);
  return id;
}

// Remove action from queue
export function dequeueAction(id: string): void {
  const queue = getQueue().filter((a) => a.id !== id);
  saveQueue(queue);
}

// Get all queued actions
export function getQueuedActions(): QueuedAction[] {
  return getQueue();
}

// Get count of queued actions
export function getQueueCount(): number {
  return getQueue().length;
}

// Clear all queued actions
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// Process queue - called when back online
export async function processQueue(): Promise<{ success: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const action of queue) {
    try {
      await executeAction(action);
      dequeueAction(action.id);
      success++;
    } catch (error) {
      action.retries++;
      if (action.retries >= MAX_RETRIES) {
        dequeueAction(action.id);
        failed++;
      } else {
        // Update retry count
        saveQueue(getQueue().map((a) => (a.id === action.id ? action : a)));
      }
    }
  }

  return { success, failed };
}

// Execute a single queued action
async function executeAction(action: QueuedAction): Promise<void> {
  const API_BASE = import.meta.env.VITE_API_URL || "https://my-revenue-project2.onrender.com/api";
  const token = sessionStorage.getItem("authToken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  switch (action.type) {
    case "message":
      await fetch(`${API_BASE}/messages/send`, {
        method: "POST",
        headers,
        body: JSON.stringify(action.payload),
      });
      break;

    case "like":
      await fetch(`${API_BASE}/matches/like`, {
        method: "POST",
        headers,
        body: JSON.stringify(action.payload),
      });
      break;

    case "profile_edit":
      await fetch(`${API_BASE}/profile/${action.payload.userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(action.payload.data),
      });
      break;

    case "settings_update":
      await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify(action.payload),
      });
      break;

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// Register online/offline listeners
export function registerOfflineSync(): () => void {
  const handleOnline = async () => {
    const count = getQueueCount();
    if (count > 0) {
      console.log(`[OfflineQueue] Back online - processing ${count} queued actions`);
      const result = await processQueue();
      console.log(`[OfflineQueue] Processed: ${result.success} succeeded, ${result.failed} failed`);
    }
  };

  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}