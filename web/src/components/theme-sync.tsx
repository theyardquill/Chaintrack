"use client";

import { useEffect } from "react";

const STORAGE_KEY = "chaintrack-theme";

export function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const dark =
          stored === "dark" ||
          (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", dark);
        document.documentElement.dataset.themeApplied = String(dark);
      } catch {
        // ignore
      }
    };
    // Run after mount AND after hydration commits that re-assert <html> className.
    const t1 = window.setTimeout(apply, 0);
    const t2 = window.setTimeout(apply, 100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}