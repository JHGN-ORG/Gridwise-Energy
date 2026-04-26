import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="min-h-screen pb-24">
      <header className="mx-auto w-full max-w-6xl px-5 sm:px-8 pt-8 pb-4">
<<<<<<< HEAD
        <div className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            <Zap className="h-7 w-7" />
          </div>
          <span>GridDaddy</span>
=======
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <img src="/logo.png" alt="GridDaddy Logo" className="h-12 w-auto object-contain" />
>>>>>>> 9bb5c2fe44b87d645348614f7df38ccb3617c860
        </div>
        {title && <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8 animate-fade-in-up">{children}</main>
      <BottomNav />
    </div>
  );
}
