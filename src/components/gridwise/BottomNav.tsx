import { NavLink } from "react-router-dom";
import { Home, BarChart3, Clock, User, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Today", Icon: Home },
  { to: "/insights", label: "Insights", Icon: BarChart3 },
  { to: "/forecast", label: "Forecast", Icon: Clock },
  { to: "/leaderboard", label: "Rank", Icon: Trophy },
  { to: "/profile", label: "Profile", Icon: User },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/85 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl items-stretch justify-around px-4">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.7)]")} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
