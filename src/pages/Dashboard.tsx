import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Briefcase, Activity, CheckCircle2, Flame, Users, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format, subDays, startOfDay } from "date-fns";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["hsl(217 91% 60%)", "hsl(152 60% 38%)", "hsl(38 92% 50%)", "hsl(12 88% 55%)", "hsl(220 10% 46%)"];

export default function Dashboard() {
  const { role } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: js }, { data: ds }] = await Promise.all([
        supabase.from("jobs").select("id,title,status,priority,scheduled_date,start_time,invoice_number,assigned_driver_id,created_at").order("created_at", { ascending: false }),
        supabase.rpc("list_drivers_directory"),
      ]);
      const drvMap = new Map(((ds ?? []) as any[]).map((d: any) => [d.id, { full_name: d.full_name }]));
      const enriched = (js ?? []).map((j: any) => ({ ...j, drivers: j.assigned_driver_id ? drvMap.get(j.assigned_driver_id) ?? null : null }));
      setJobs(enriched); setDrivers(ds ?? []);
    };
    load();
    const ch = supabase.channel("dash-rt").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter(j => j.status === "pending").length,
    active: jobs.filter(j => ["assigned","accepted","in_progress"].includes(j.status)).length,
    completion_requested: jobs.filter(j => j.status === "completion_requested").length,
    completed: jobs.filter(j => ["completed","closed"].includes(j.status)).length,
    priority: jobs.filter(j => j.priority === "priority").length,
    drivers: drivers.length,
    activeDrivers: drivers.filter(d => d.active).length,
  }), [jobs, drivers]);

  const dailyData = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => startOfDay(subDays(new Date(), 13 - i)));
    return days.map((d) => {
      const label = format(d, "MMM d");
      const dayJobs = jobs.filter((j) => {
        const ref = j.scheduled_date ? new Date(j.scheduled_date) : new Date(j.created_at);
        return startOfDay(ref).getTime() === d.getTime();
      });
      return {
        date: label,
        created: dayJobs.length,
        completed: dayJobs.filter(j => ["completed","closed"].includes(j.status)).length,
      };
    });
  }, [jobs]);

  const driverPerf = useMemo(() => {
    const map = new Map<string, { name: string; completed: number; active: number }>();
    drivers.forEach((d) => map.set(d.id, { name: d.full_name, completed: 0, active: 0 }));
    jobs.forEach((j) => {
      if (!j.assigned_driver_id) return;
      const e = map.get(j.assigned_driver_id);
      if (!e) return;
      if (["completed","closed"].includes(j.status)) e.completed++;
      else if (["assigned","accepted","in_progress","completion_requested"].includes(j.status)) e.active++;
    });
    return Array.from(map.values()).sort((a,b) => b.completed - a.completed).slice(0, 6);
  }, [jobs, drivers]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const statusBreakdown = useMemo(() => ([
    { name: "Active", value: stats.active },
    { name: "Completed", value: stats.completed },
    { name: "Pending verify", value: stats.completion_requested },
    { name: "Pending", value: stats.pending },
  ].filter(x => x.value > 0)), [stats]);

  const cards = [
    { label: "Total Jobs", value: stats.total, icon: Briefcase, color: "text-foreground" },
    { label: "Pending", value: stats.pending, icon: Activity, color: "text-muted-foreground" },
    { label: "Active", value: stats.active, icon: Activity, color: "text-accent" },
    { label: "Awaiting Verify", value: stats.completion_requested, icon: ShieldAlert, color: "text-priority" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
    { label: "Priority", value: stats.priority, icon: Flame, color: "text-priority" },
    { label: "Drivers", value: `${stats.activeDrivers}/${stats.drivers}`, icon: Users, color: "text-foreground" },
  ];

  const recent = jobs.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{role === "driver" ? "Your assigned jobs and updates." : "Overview of jobs, drivers and operations."}</p>
        </div>
        {role === "super_admin" && stats.completion_requested > 0 && (
          <Link to="/jobs?status=completion_requested" className="inline-flex items-center gap-2 rounded-md bg-priority/10 text-priority px-3 py-2 text-xs sm:text-sm font-medium">
            <ShieldAlert className="h-4 w-4" /> {stats.completion_requested} awaiting verification
          </Link>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {cards.map((c) => (
          <div key={c.label} className="stat-card !p-3 sm:!p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide truncate">{c.label}</p>
                <p className={`text-lg sm:text-2xl font-semibold mt-1 sm:mt-2 ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${c.color} shrink-0`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Jobs over last 14 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="created" name="Created" fill="hsl(217 91% 60%)" radius={[4,4,0,0]} />
                <Bar dataKey="completed" name="Completed" fill="hsl(152 60% 38%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-4">Status mix</h2>
          <div className="h-64">
            {statusBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="text-center text-sm text-muted-foreground mt-2">Completion rate: <span className="font-semibold text-foreground">{completionRate}%</span></div>
        </div>
      </div>

      {driverPerf.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold mb-4">Driver performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverPerf} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="hsl(152 60% 38%)" />
                <Bar dataKey="active" name="In flight" stackId="a" fill="hsl(217 91% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="p-4 sm:p-5 border-b"><h2 className="font-semibold">Recent jobs</h2></div>
        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {recent.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No jobs yet</div>}
          {recent.map((j) => (
            <div key={j.id} className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm truncate">{j.title}</div>
                <StatusBadge status={j.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>Invoice: <span className="font-mono text-foreground">{j.invoice_number || "—"}</span></div>
                <div>Driver: <span className="text-foreground">{j.drivers?.full_name ?? "—"}</span></div>
                <div className="col-span-2">{j.scheduled_date ? format(new Date(j.scheduled_date), "MMM d, yyyy") : "—"} · {j.priority === "priority" ? <span className="text-priority font-medium">Priority</span> : "Standard"}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Title</th><th>Driver</th><th>Invoice</th><th>Date</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No jobs yet</td></tr>}
              {recent.map((j) => (
                <tr key={j.id}>
                  <td className="font-medium">{j.title}</td>
                  <td className="text-muted-foreground">{j.drivers?.full_name ?? "—"}</td>
                  <td className="text-muted-foreground">{j.invoice_number}</td>
                  <td className="text-muted-foreground">{j.scheduled_date ? format(new Date(j.scheduled_date), "MMM d, yyyy") : "—"}</td>
                  <td>{j.priority === "priority" ? <span className="text-priority font-medium">Priority</span> : <span className="text-muted-foreground">Standard</span>}</td>
                  <td><StatusBadge status={j.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
