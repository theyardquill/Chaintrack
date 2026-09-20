"use client";

import { useState } from "react";
import { loadSession, saveSession, type Session } from "./auth";
import type { User } from "./types";

export function useAuth() {
  const [session, setSession] = useState<Session>(() => loadSession());

  const signInAs = (user: User) => {
    const next: Session = {
      type: "user",
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    };
    saveSession(next);
    setSession(next);
  };

  const signInAdmin = () => {
    const next: Session = { type: "admin", id: "admin" };
    saveSession(next);
    setSession(next);
  };

  const signOut = () => {
    saveSession(null);
    setSession(null);
  };

  return {
    session,
    isAdmin: session?.type === "admin",
    isUser: session?.type === "user",
    isAgent: session?.type === "user" && session.user.role === "AGENT",
    signInAs,
    signInAdmin,
    signOut,
  };
}