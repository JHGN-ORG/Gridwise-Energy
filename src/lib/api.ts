type TokenGetter = () => Promise<string>;

let getToken: TokenGetter | null = null;
const DEMO_STORAGE_KEY = "griddaddy_demo_user_id";

export function setTokenGetter(fn: TokenGetter | null) {
  getToken = fn;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const demoUserId = getDemoUserId();
  if (demoUserId && !path.startsWith("/api/admin-demo")) {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await fetch(withDemoUser(path, demoUserId), { ...init, headers });
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${path}: ${text}`);
    }
    return res;
  }

  if (!getToken) throw new Error("auth not ready");
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${path}: ${text}`);
  }
  return res;
}

function getDemoUserId() {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("demoUserId");
  const fromStorage = window.localStorage.getItem(DEMO_STORAGE_KEY);
  const value = fromQuery || fromStorage || "";
  return value.startsWith("demo:") ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64) : null;
}

function withDemoUser(path: string, demoUserId: string) {
  if (path.includes("demoUserId=")) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}demoUserId=${encodeURIComponent(demoUserId)}`;
}
