import { Link, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function AuthPage() {
  const { session, loading } = useAuth();
  const { loginWithRedirect } = useAuth0();

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const login = () => loginWithRedirect();
  const signup = () => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-4 w-4" />
          </div>
          GridDaddy
        </div>
        <Card className="bg-card-gradient border-border p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Track your home’s carbon footprint against the live Arizona grid.
          </p>

          <div className="space-y-3">
            <Button className="w-full" onClick={login}>Log in</Button>
            <Button variant="outline" className="w-full" onClick={signup}>Sign up</Button>
          </div>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Just curious?{" "}
          <Link to="/forecast" className="text-primary hover:underline">
            See today’s optimal usage windows →
          </Link>
        </p>
      </div>
    </div>
  );
}
