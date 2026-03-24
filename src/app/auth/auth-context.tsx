import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loggedFetch } from "./logged-fetch";

type PermissionLevel = "Admin" | "Intermediate" | "Basic";

type AuthUser = {
  id: number;
  username: string;
  full_name?: string | null;
  permissions: PermissionLevel;
};

type AuthSession = {
  token: string;
  user: AuthUser;
};

type LoginPayload = {
  username: string;
  password: string;
};

type SignupPayload = {
  full_name: string;
  username: string;
  password: string;
  permissions: PermissionLevel;
};

type AuthContextValue = {
  session: AuthSession | null;
  isHydrated: boolean;
  login: (payload: LoginPayload) => Promise<AuthSession>;
  signup: (payload: SignupPayload) => Promise<AuthSession>;
  setSession: (nextSession: AuthSession | null) => void;
  logout: () => void;
};

const STORAGE_KEY = "shpmarketing.auth";
const API_BASE =
  (import.meta.env.VITE_OPERATIONS_API_BASE as string | undefined) ||
  "http://localhost:5001";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function callPublicAuth<T>(path: string, body: object): Promise<T> {
  const response = await loggedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data &&
        typeof data === "object" &&
        (("message" in data && String(data.message)) ||
          ("error" in data && String(data.error)))) ||
      "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const setSession = (nextSession: AuthSession | null) => {
    setSessionState(nextSession);
    if (nextSession) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed?.token && parsed?.user?.username) {
        setSessionState(parsed);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  const logout = () => {
    setSession(null);
  };

  const login = async (payload: LoginPayload) => {
    const result = await callPublicAuth<AuthSession>("/login", payload);
    setSession(result);
    return result;
  };

  const signup = async (payload: SignupPayload) => {
    const result = await callPublicAuth<AuthSession>("/signup", payload);
    setSession(result);
    return result;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isHydrated,
      login,
      signup,
      setSession,
      logout,
    }),
    [session, isHydrated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export type { AuthSession, AuthUser, LoginPayload, PermissionLevel, SignupPayload };
