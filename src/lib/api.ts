type TokenGetter = () => Promise<string>;

let getToken: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter | null) {
  getToken = fn;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
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
