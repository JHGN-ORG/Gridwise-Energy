import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Onboarding } from "@/components/gridwise/Onboarding";
import { Profile } from "@/lib/gridwise";
import { fetchProfile } from "@/lib/repo";
import DashboardPage from "./DashboardPage";
import { Loader2, LogOut, Trophy } from "lucide-react";

const Index = () => {
  const { user, loading, isDemo, signOut } = useAuth();
  const [profileState, setProfileState] = useState<{ profile: Profile | null; onboarded: boolean } | null>(null);

  useEffect(() => {
    if (!user) { setProfileState(null); return; }
    fetchProfile(user.id).then(setProfileState);
  }, [user]);

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profileState) return <FullPageSpinner />;
  if (!profileState.onboarded || !profileState.profile) {
    if (isDemo) return <DemoUnavailable onSignOut={signOut} />;
    return <Onboarding initial={profileState.profile} onComplete={() => fetchProfile(user.id).then(setProfileState)} />;
  }
  return <DashboardPage profile={profileState.profile} />;
};

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const DemoUnavailable = ({ onSignOut }: { onSignOut: () => Promise<void> }) => (
  <div className="min-h-screen flex items-center justify-center px-5 py-10">
    <Card className="w-full max-w-md bg-card-gradient border-border p-6 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Trophy className="h-5 w-5" />
      </div>
      <h1 className="text-xl font-semibold">Demo account is not ready yet</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create or generate data for demo:default from the admin panel, then try the demo login again.
      </p>
      <Button variant="outline" className="mt-5 w-full" onClick={onSignOut}>
        <LogOut className="mr-2 h-4 w-4" /> Back to login
      </Button>
    </Card>
  </div>
);

export default Index;
