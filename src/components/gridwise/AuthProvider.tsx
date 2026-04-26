import { ReactNode, createContext, useContext, useEffect, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setTokenGetter } from "@/lib/api";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: a0User, isAuthenticated, isLoading, logout, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setTokenGetter(() => getAccessTokenSilently());
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently]);

  const value = useMemo<AuthContextValue>(() => {
    const user: AuthUser | null =
      isAuthenticated && a0User?.sub
        ? { id: a0User.sub, email: a0User.email, name: a0User.name }
        : null;
    return {
      user,
      session: user ? { user } : null,
      loading: isLoading,
      signOut: async () => {
        await logout({ logoutParams: { returnTo: window.location.origin } });
      },
    };
  }, [a0User, isAuthenticated, isLoading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
