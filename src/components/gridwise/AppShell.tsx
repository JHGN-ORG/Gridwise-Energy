import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Zap } from "lucide-react";

export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="min-h-screen pb-24">
      <header className="mx-auto w-full max-w-6xl px-5 sm:px-8 pt-8 pb-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          <span>GridDaddy</span>
        </div>
        {title && <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>}
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8 animate-fade-in-up">{children}</main>
      <BottomNav />
    </div>
  );
}
