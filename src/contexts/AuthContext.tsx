import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "super_admin" | "dispatch_admin" | "member" | "driver";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  driverExit: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  driverExit: async () => {},
});

const SESSION_KEY = "driver_session_id";

async function ensureDriverSession(userId: string) {
  // Reuse if one is cached and still open
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) {
    const { data } = await supabase
      .from("driver_sessions")
      .select("id,status")
      .eq("id", cached)
      .maybeSingle();
    if (data && data.status === "online") return;
  }
  // Lookup driver row (optional)
  const { data: drv } = await supabase
    .from("drivers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: inserted, error } = await supabase
    .from("driver_sessions")
    .insert({
      user_id: userId,
      driver_id: drv?.id ?? null,
      login_time: new Date().toISOString(),
      status: "online",
    })
    .select("id")
    .single();
  if (!error && inserted) localStorage.setItem(SESSION_KEY, inserted.id);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) fetchRole(data.session.user.id);
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchRole = async (uid: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("role", { ascending: true });
    const roles = (data ?? []).map((r) => r.role as AppRole);
    const r: AppRole | null = roles.includes("super_admin")
      ? "super_admin"
      : roles.includes("member")
        ? "member"
        : roles.includes("driver")
          ? "driver"
          : null;
    setRole(r);
    setLoading(false);
    if (r === "driver") {
      ensureDriverSession(uid).catch((e) => console.error("driver session", e));
    }
  };

  const closeDriverSessionAndNotify = async () => {
    if (!session?.user) return;
    const uid = session.user.id;
    // Find the open session (cached id first, else latest online row)
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      const { data } = await supabase
        .from("driver_sessions")
        .select("id")
        .eq("user_id", uid)
        .eq("status", "online")
        .order("login_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      sessionId = data?.id ?? null;
    }
    if (!sessionId) return;
    const { data: row } = await supabase
      .from("driver_sessions")
      .select("id,login_time")
      .eq("id", sessionId)
      .maybeSingle();
    if (!row) return;
    const logoutTime = new Date();
    const totalMinutes = Math.max(
      0,
      Math.round((logoutTime.getTime() - new Date(row.login_time).getTime()) / 60000),
    );
    await supabase
      .from("driver_sessions")
      .update({
        logout_time: logoutTime.toISOString(),
        total_minutes: totalMinutes,
        status: "logged_out",
      })
      .eq("id", sessionId);

    // Driver display info
    const { data: drv } = await supabase
      .from("drivers")
      .select("full_name,email")
      .eq("user_id", uid)
      .maybeSingle();
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name,email")
      .eq("id", uid)
      .maybeSingle();

    try {
      await supabase.functions.invoke("send-driver-checkout", {
        body: {
          driverName: drv?.full_name ?? prof?.full_name ?? session.user.email,
          driverEmail: drv?.email ?? prof?.email ?? session.user.email,
          loginTime: row.login_time,
          logoutTime: logoutTime.toISOString(),
          totalMinutes,
        },
      });
    } catch (e) {
      console.error("checkout email", e);
    }
    localStorage.removeItem(SESSION_KEY);
  };

  const signOut = async () => {
    // Plain logout — only ends the auth session, does NOT close the driver's working day
    await supabase.auth.signOut();
    setRole(null);
  };

  const driverExit = async () => {
    // Exit = end of working day. Close driver session + notify admin, then sign out.
    if (role === "driver") {
      try {
        await closeDriverSessionAndNotify();
      } catch (e) {
        console.error(e);
      }
    }
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, role, loading, signOut, driverExit }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
