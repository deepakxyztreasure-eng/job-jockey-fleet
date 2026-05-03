import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Briefcase, Activity, CheckCircle2, Flame, Users } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, priority: 0, drivers: 0, available: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: jobs } = await supabase.from("jobs").select("id,title,status,priority,scheduled_date,start_time,invoice_number").order("created_at", { ascending: false });
      const { data: drivers } = await supabase.from("drivers").select("id,active");
      if (jobs) {
        setStats((s) => ({
          ...s,
          total: jobs.length,
          active: jobs.filter((j) => ["assigned","accepted","in_progress"].includes(j.status)).length,
          completed: jobs.filter((j) => ["completed","closed"].includes(j.status)).length,
          priority: jobs.filter((j) => j.priority === "priority").length,
        }));
        setRecent(jobs.slice(0, 6));
      }
      if (drivers) setStats((s) => ({ ...s, drivers: drivers.length, available: drivers.filter((d) => d.active).length }));
    })();
  }, []);

  const cards = [
    { label: "Total Jobs", value: stats.total, icon: Briefcase, color: "text-foreground" },
    { label: "Active", value: stats.active, icon: Activity, color: "text-accent" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
    { label: "Priority", value: stats.priority, icon: Flame, color: "text-priority" },
    { label: "Drivers", value: `${stats.available}/${stats.drivers}`, icon: Users, color: "text-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{role === "driver" ? "Your assigned jobs and updates." : "Overview of jobs, drivers and operations."}</p>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className={`text-2xl font-semibold mt-2 ${c.color}`}>{c.value}</p>
              </div>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card">
        <div className="p-5 border-b"><h2 className="font-semibold">Recent jobs</h2></div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Title</th><th>Invoice</th><th>Date</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No jobs yet</td></tr>}
              {recent.map((j) => (
                <tr key={j.id}>
                  <td className="font-medium">{j.title}</td>
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
