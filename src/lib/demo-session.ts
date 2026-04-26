export const DEMO_STORAGE_KEY = "griddaddy_demo_user_id";
export const DEFAULT_DEMO_USER_ID = "demo:default";

export function sanitizeDemoUserId(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed.startsWith("demo:")) return null;
  return trimmed.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64);
}

export function getStoredDemoUserId() {
  if (typeof window === "undefined") return null;
  return sanitizeDemoUserId(window.localStorage.getItem(DEMO_STORAGE_KEY));
}

export function getRequestedDemoUserId() {
  if (typeof window === "undefined") return null;
  return sanitizeDemoUserId(new URLSearchParams(window.location.search).get("demoUserId"));
}

export function getActiveDemoUserId() {
  return getRequestedDemoUserId() ?? getStoredDemoUserId();
}

export function startDemoSession(demoUserId = DEFAULT_DEMO_USER_ID) {
  const clean = sanitizeDemoUserId(demoUserId) ?? DEFAULT_DEMO_USER_ID;
  window.localStorage.setItem(DEMO_STORAGE_KEY, clean);
  window.location.assign(`/?demoUserId=${encodeURIComponent(clean)}`);
}

export function clearDemoSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}
