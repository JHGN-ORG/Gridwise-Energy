const DEMO_PREFIX = "demo:";

export function isAdminUser(userId: string) {
  const allowed = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes(userId);
}

export function resolveRequestedUserId(actualUserId: string, requested: unknown) {
  const demoUserId = typeof requested === "string" ? requested.trim() : "";
  if (!demoUserId) return actualUserId;
  if (!demoUserId.startsWith(DEMO_PREFIX)) return actualUserId;
  return isAdminUser(actualUserId) ? demoUserId.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64) : actualUserId;
}
