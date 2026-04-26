import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/gridwise/AuthProvider";
import { Onboarding } from "@/components/gridwise/Onboarding";
import { Profile } from "@/lib/gridwise";
import { fetchProfile } from "@/lib/repo";
import DashboardPage from "./DashboardPage";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const [profileState, setProfileState] = useState<{ profile: Profile | null; onboarded: boolean } | null>(null);

  useEffect(() => {
    if (!user) { setProfileState(null); return; }
    fetchProfile(user.id).then(setProfileState);
  }, [user]);

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profileState) return <FullPageSpinner />;
  if (!profileState.onboarded || !profileState.profile) {
    return <Onboarding initial={profileState.profile} onComplete={() => fetchProfile(user.id).then(setProfileState)} />;
  }
  return <DashboardPage profile={profileState.profile} />;
};

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default Index;
