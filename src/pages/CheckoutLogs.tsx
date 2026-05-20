import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Row = {
  id: string;
  user_id: string;
  driver_id: string | null;
  login_time: string;
  logout_time: string | null;
  total_minutes: number | null;
  status: string;
  driver_name?: string;
  driver_email?: string;
};

function fmtDur(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const PAGE_SIZE = 20;

export default function CheckoutLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("driver_sessions")
      .select("*")
      .order("login_time", { ascending: false })
      .limit(500);
    const sessions = (data ?? []) as Row[];
    const uids = Array.from(new Set(sessions.map((r) => r.user_id)));
    const did = Array.from(
      new Set(sessions.map((r) => r.driver_id).filter(Boolean) as string[]),
    );
    const [{ data: profs }, { data: drvs }] = await Promise.all([
      uids.length
        ? supabase.from("profiles").select("id,full_name,email").in("id", uids)
        : Promise.resolve({ data: [] as any[] } as any),
      did.length
        ? supabase.from("drivers").select("id,full_name,email").in("id", did)
        : Promise.resolve({ data: [] as any[] } as any),
    ]);
    const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const dMap = new Map((drvs ?? []).map((d: any) => [d.id, d]));
    setRows(
      sessions.map((r) => {
        const d = r.driver_id ? dMap.get(r.driver_id) : null;
        const p = pMap.get(r.user_id);
        return {
          ...r,
          driver_name: d?.full_name ?? p?.full_name ?? "—",
          driver_email: d?.email ?? p?.email ?? "—",
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("driver-sessions-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_sessions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = from ? new Date(from).getTime() : null;
    const t = to ? new Date(to).getTime() + 24 * 3600_000 - 1 : null;
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.driver_name ?? ""} ${r.driver_email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = new Date(r.login_time).getTime();
      if (f && ts < f) return false;
      if (t && ts > t) return false;
      return true;
    });
  }, [rows, search, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Driver Checkout Logs</h1>
        <p className="text-sm text-muted-foreground">
          Login/logout sessions and total working duration.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label className="text-xs">Search driver</Label>
          <Input
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-3">Driver</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Login</th>
                <th className="text-left p-3">Logout</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8">
                    No sessions found
                  </td>
                </tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.driver_name}</td>
                  <td className="p-3 text-muted-foreground">{r.driver_email}</td>
                  <td className="p-3">{format(new Date(r.login_time), "MMM d, yyyy h:mm a")}</td>
                  <td className="p-3">
                    {r.logout_time
                      ? format(new Date(r.logout_time), "MMM d, yyyy h:mm a")
                      : "—"}
                  </td>
                  <td className="p-3">{fmtDur(r.total_minutes)}</td>
                  <td className="p-3">
                    {r.status === "online" ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/15">Online</Badge>
                    ) : (
                      <Badge variant="secondary">Logged Out</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-xs text-muted-foreground">
            {filtered.length} session{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-xs">
              Page {page} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
