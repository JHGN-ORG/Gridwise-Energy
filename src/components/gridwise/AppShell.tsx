import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="min-h-screen pb-24">
      <header className="mx-auto w-full max-w-6xl px-5 sm:px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/logo.png" alt="GridDaddy Logo" className="h-25 w-auto object-contain" />
        </div>
        {title && <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8 animate-fade-in-up">{children}</main>
      <BottomNav />
    </div>
  );
}
