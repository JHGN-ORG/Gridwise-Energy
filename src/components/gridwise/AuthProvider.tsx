import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setTokenGetter } from "@/lib/api";
import { clearDemoSession, getActiveDemoUserId, sanitizeDemoUserId, DEMO_STORAGE_KEY } from "@/lib/demo-session";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  isDemo: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isDemo: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: a0User, isAuthenticated, isLoading, logout, getAccessTokenSilently } = useAuth0();
  const [demoUserId, setDemoUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return getActiveDemoUserId();
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedDemo = params.get("demoUserId");
    const storedDemo = window.localStorage.getItem(DEMO_STORAGE_KEY);
    const nextDemo = sanitizeDemoUserId(requestedDemo || storedDemo || "");
    if (nextDemo) {
      window.localStorage.setItem(DEMO_STORAGE_KEY, nextDemo);
      setDemoUserId(nextDemo);
    }
  }, []);

  useEffect(() => {
    setTokenGetter(() => getAccessTokenSilently());
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently]);

  const value = useMemo<AuthContextValue>(() => {
    const demoUser: AuthUser | null = demoUserId
      ? { id: demoUserId, email: `${demoUserId}@demo.local`, name: "Demo" }
      : null;
    const user: AuthUser | null =
      demoUser ??
      (isAuthenticated && a0User?.sub
        ? { id: a0User.sub, email: a0User.email, name: a0User.name }
        : null);
    return {
      user,
      session: user ? { user } : null,
      loading: demoUser ? false : isLoading,
      isDemo: !!demoUser,
      signOut: async () => {
        if (demoUser) {
          clearDemoSession();
          setDemoUserId(null);
          window.location.assign("/auth");
          return;
        }
        await logout({ logoutParams: { returnTo: window.location.origin } });
      },
    };
  }, [a0User, demoUserId, isAuthenticated, isLoading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
