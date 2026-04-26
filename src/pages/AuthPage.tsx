import { Link, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
<<<<<<< HEAD
import { Trophy, Zap } from "lucide-react";
=======
import { Trophy } from "lucide-react";
>>>>>>> 9bb5c2fe44b87d645348614f7df38ccb3617c860
import { startDemoSession } from "@/lib/demo-session";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const { loginWithRedirect } = useAuth0();

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const login = () => loginWithRedirect();
  const signup = () => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });
  const demo = () => startDemoSession();

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
<<<<<<< HEAD
        <div className="mb-6 flex items-center gap-3 text-lg font-semibold">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
            <Zap className="h-7 w-7" />
          </div>
          GridDaddy
=======
        <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
          <img src="/logo.png" alt="GridDaddy Logo" className="h-16 w-auto object-contain" />
>>>>>>> 9bb5c2fe44b87d645348614f7df38ccb3617c860
        </div>
        <Card className="bg-card-gradient border-border p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Track your home's carbon footprint against the live Arizona grid.
          </p>

          <div className="space-y-3">
            <Button className="w-full" onClick={login}>Log in</Button>
            <Button variant="outline" className="w-full" onClick={signup}>Sign up</Button>
            <Button variant="secondary" className="w-full" onClick={demo}>
              <Trophy className="mr-2 h-4 w-4" /> Try demo account
            </Button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Just curious?{" "}
          <Link to="/forecast" className="text-primary hover:underline">
            See today's optimal usage windows -&gt;
          </Link>
        </p>
      </div>
    </div>
  );
}
