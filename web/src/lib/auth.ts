import type { Role } from "./types";

export type Session =
  | { type: "user"; user: { id: number; name: string; phone: string; role: Role } }
  | { type: "admin"; id: string }
  | null;

const KEY = "chaintrack-session";

export const ADMIN_PASSCODE = "admin123";

export function loadSession(): Session {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}