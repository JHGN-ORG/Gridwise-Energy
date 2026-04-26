import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/gridwise/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { fetchCheckIns, fetchProfile } from "@/lib/repo";
import { useGridwiseChat } from "@/hooks/use-gridwise-chat";
import {
  APPLIANCE_MAP,
  CheckIn,
  Profile,
  dateOffsetISO,
  formatHour,
  streakCount,
} from "@/lib/gridwise";
import { Award, Flame, Flag, Leaf, Loader2, RotateCcw, Send, Sparkles, Trophy } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function InsightsPage() {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCheckIns(user.id).then(setCheckIns);
    fetchProfile(user.id).then((r) => setProfile(r.profile));
  }, [user]);

  const last7 = useMemo(() => {
    if (!checkIns) return [];
    const days: { date: string; lbs: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = dateOffsetISO(i);
      const ci = checkIns.find((c) => c.date === d);
      const dt = new Date(`${d}T12:00:00`);
      days.push({
        date: d,
        lbs: ci ? +ci.totalLbs.toFixed(2) : 0,
        label: dt.toLocaleDateString(undefined, { weekday: "short" }),
      });
    }
    return days;
  }, [checkIns]);

  if (!checkIns || !profile) {
    return (
      <AppShell title="Insights">
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (checkIns.length < 3) {
    return (
      <AppShell title="Insights" subtitle="Your trends, side-by-side with the grid.">
        <div className="space-y-4">
          <Card className="bg-card-gradient border-border p-8 text-center">
            <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-semibold">Keep checking in!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Log at least 3 days to unlock your weekly trend, worst habits, and savings opportunities.
            </p>
          </Card>
          <InsightsChatCard />
        </div>
      </AppShell>
    );
  }

  const worst = computeWorstHabit(checkIns);
  const opportunity = computeBestOpportunity(checkIns);
  const streak = streakCount(checkIns);

  return (
    <AppShell title="Insights" subtitle={`${profile.city}, AZ | personalized to your home`}>
      <div className="space-y-4">
        <InsightsChatCard />

        <Card className="bg-card-gradient border-border p-5">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Last 7 days | CO2 (lbs)</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="lbs" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-card-gradient border-border p-5">
            <div className="flex items-center gap-2 text-intensity-high mb-2">
              <Flame className="h-4 w-4" />
              <h3 className="text-xs uppercase tracking-[0.18em]">Worst habit</h3>
            </div>
            {worst ? (
              <>
                <div className="text-lg font-semibold">{APPLIANCE_MAP[worst.applianceId].label}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Run mostly around <span className="text-foreground">{formatHour(worst.hour)}</span>
                </div>
                <div className="mt-3 text-sm">
                  <span className="text-intensity-high font-semibold">{worst.lbs.toFixed(2)} lbs</span> CO2 across your check-ins.
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Not enough data.</div>
            )}
          </Card>

          <Card className="bg-card-gradient border-border p-5">
            <div className="flex items-center gap-2 text-intensity-low mb-2">
              <Leaf className="h-4 w-4" />
              <h3 className="text-xs uppercase tracking-[0.18em]">Best opportunity</h3>
            </div>
            {opportunity ? (
              <>
                <div className="text-lg font-semibold">{APPLIANCE_MAP[opportunity.applianceId].label}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Shift to <span className="text-intensity-low font-medium">{formatHour(opportunity.optimalStart)}</span>
                </div>
                <div className="mt-3 text-sm">
                  Save <span className="text-intensity-low font-semibold">~{opportunity.savings.toFixed(2)} lbs</span> CO2/week.
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">You are running things at clean times.</div>
            )}
          </Card>
        </div>

        <Card className="bg-card-gradient border-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Streak</h3>
              <div className="text-3xl font-bold mt-1">
                {streak} <span className="text-base font-normal text-muted-foreground">days</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Keep it going. Daily check-ins compound.</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              {streak >= 7 ? <Award className="h-6 w-6" /> : <Flag className="h-6 w-6" />}
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

// Hand-curated to show off what the chat can actually answer well —
// hits applianceSummary, leaderboard context, time-shift recommendations,
// and the equivalency framing baked into the system prompt.
const SUGGESTED_PROMPTS = [
  "What's my single worst habit and how do I fix it?",
  "When should I run my dryer tomorrow?",
  "How do I close the gap with the person ranked above me?",
  "Translate this week's impact into something I can picture",
];

function InsightsChatCard() {
  const { messages, sendMessage, reset, loading, historyLoading, error } = useGridwiseChat();
  const [draft, setDraft] = useState("");

  const submit = async (text?: string) => {
    const question = (text ?? draft).trim();
    if (!question || loading) return;
    setDraft("");
    await sendMessage(question);
  };

  return (
    <Card className="bg-card-gradient border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Ask GridDaddy</h2>
            <p className="text-xs text-muted-foreground">Chat about your check-ins, appliance timing, and carbon impact.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={reset} disabled={loading} className="h-8 w-8 shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border bg-background/30 p-3">
        {historyLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-2 py-2">
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Try asking</div>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submit(prompt)}
                className="block w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                  : "mr-auto max-w-[92%] border border-border bg-background/60 text-foreground"
              }`}
            >
              {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}
            </div>
          ))
        )}
        {loading && (
          <div className="mr-auto inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {messages.length > 0 && !loading && !historyLoading && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about your carbon impact..."
          className="min-h-11 resize-none"
          disabled={loading || historyLoading}
        />
        <Button size="icon" onClick={() => submit()} disabled={loading || historyLoading || !draft.trim()} className="h-11 w-11 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === "ul") {
          return (
            <ul key={index} className="ml-4 list-disc space-y-1">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="ml-4 list-decimal space-y-1">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
            </ol>
          );
        }
        return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "p", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? "").trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks.length ? blocks : [{ type: "p", text: content }];
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={nodes.length} className="rounded bg-secondary/60 px-1 py-0.5 text-[0.85em]">{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (link) {
        nodes.push(
          <a key={nodes.length} href={link[2]} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
            {link[1]}
          </a>,
        );
      }
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function computeWorstHabit(checkIns: CheckIn[]) {
  const tally = new Map<string, { applianceId: keyof typeof APPLIANCE_MAP; hour: number; lbs: number }>();
  for (const ci of checkIns) {
    for (const u of ci.usages) {
      const lbs = ci.perAppliance.find((p) => p.applianceId === u.applianceId)?.lbs ?? 0;
      const key = `${u.applianceId}:${u.startHour}`;
      const prev = tally.get(key);
      tally.set(key, { applianceId: u.applianceId, hour: u.startHour, lbs: (prev?.lbs ?? 0) + lbs });
    }
  }
  let best: { applianceId: keyof typeof APPLIANCE_MAP; hour: number; lbs: number } | null = null;
  tally.forEach((v) => {
    if (!best || v.lbs > best.lbs) best = v;
  });
  return best;
}

function computeBestOpportunity(checkIns: CheckIn[]) {
  const tally = new Map<string, { applianceId: keyof typeof APPLIANCE_MAP; gap: number; optimalStart: number }>();
  for (const ci of checkIns) {
    for (const p of ci.perAppliance) {
      const gap = p.lbs - p.optimalLbs;
      const cur = tally.get(p.applianceId);
      tally.set(p.applianceId, { applianceId: p.applianceId, gap: (cur?.gap ?? 0) + gap, optimalStart: p.optimalStart });
    }
  }
  let best: { applianceId: keyof typeof APPLIANCE_MAP; gap: number; optimalStart: number } | null = null;
  tally.forEach((v) => {
    if (!best || v.gap > best.gap) best = v;
  });
  if (!best || best.gap < 0.05) return null;
  const days = checkIns.length;
  return { applianceId: best.applianceId, optimalStart: best.optimalStart, savings: (best.gap / days) * 7 };
}
