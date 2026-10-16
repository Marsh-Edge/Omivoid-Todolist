"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function AppHeader() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const t = localStorage.getItem("omivoid-theme");
    let next: "dark" | "light" = "light";
    if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      next = "dark";
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    setTimeout(() => setTheme(next), 0);
  }, [setTheme]);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("omivoid-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="text-sm font-medium">Omivoid</div>
      <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </header>
  );
}
