import { useEffect, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { Trophy, Loader2, Target, TrendingUp } from "lucide-react";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Profile } from "@/lib/gridwise";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  city: string;
  totalSaved: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  communityTotal: number;
}

export default function LeaderboardPage({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard", e);
    } finally {
      setLoading(false);
    }
  };

  // Poll every 10 seconds
  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const myEntry = data?.leaderboard.find((e) => e.userId === user?.id);

  return (
    <AppShell title="Community Impact" subtitle="See how you stack up">
      <div className="space-y-6">
        
        {/* Community Stat Banner */}
        <Card className="bg-card-gradient border-border p-6 flex flex-col items-center text-center">
          <Target className="h-8 w-8 text-intensity-low mb-3" />
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Community Savings</h2>
          <div className="text-4xl font-bold mt-2 text-intensity-low">
            {data ? data.communityTotal.toFixed(1) : "---"} <span className="text-lg text-muted-foreground">lbs CO₂</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground max-w-sm">
            That's how much carbon emissions our community has prevented by shifting usage away from gas peaker plants!
          </p>
        </Card>

        {/* Leaderboard List */}
        <Card className="bg-card-gradient border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> Top Optimizers
            </h2>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className="divide-y divide-border relative">
            {!data && loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : data?.leaderboard.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No data yet. Be the first!</div>
            ) : (
              data?.leaderboard.map((entry) => {
                const isMe = entry.userId === user?.id;
                return (
                  <div 
                    key={entry.userId} 
                    className={`flex items-center px-4 py-3 transition-colors ${isMe ? "bg-primary/10" : "hover:bg-secondary/10"}`}
                  >
                    <div className="flex-none w-8 text-sm font-bold text-muted-foreground">
                      #{entry.rank}
                    </div>
                    <div className="flex-1 min-w-0 px-3">
                      <div className={`text-sm font-semibold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                        {entry.name || "Anonymous"} {isMe && "(You)"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{entry.city}</div>
                    </div>
                    <div className="flex-none text-right">
                      <div className="text-sm font-semibold text-intensity-low">{entry.totalSaved.toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">lbs saved</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Sticky personal rank if logged in */}
        {myEntry && (
          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+60px)] left-0 right-0 z-30 px-5 sm:px-8 pointer-events-none">
            <div className="mx-auto max-w-6xl w-full">
              <div className="max-w-md mx-auto pointer-events-auto">
                <Card className="bg-background/95 backdrop-blur-md border border-primary/50 shadow-lg shadow-primary/10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 h-8 w-8 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Your Rank</div>
                      <div className="text-sm font-bold text-foreground">#{myEntry.rank}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-intensity-low">{myEntry.totalSaved.toFixed(1)} lbs</div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
