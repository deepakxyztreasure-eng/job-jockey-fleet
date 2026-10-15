import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Download,
  ClipboardList,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Truck,
  User,
} from "lucide-react";
import { format } from "date-fns";

type SessionRow = {
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

type ChecklistResponseItem = {
  item_key: string;
  title: string;
  answer: "yes" | "no";
  notes?: string;
  photo_url?: string;
};

type ChecklistRow = {
  id: string;
  driver_id: string;
  checklist_type: "morning" | "evening";
  date: string;
  responses: ChecklistResponseItem[];
  requires_signoff: boolean;
  signoff_status: "none" | "pending" | "approved" | "rejected";
  signoff_by: string | null;
  signoff_notes: string | null;
  signoff_at: string | null;
  submitted_at: string;
  driver_name?: string;
  driver_email?: string;
  driver_vehicle?: string;
};

type DriverPerformance = {
  id: string;
  name: string;
  email: string;
  vehicle: string;
  active: boolean;
  totalHours: number;
  completedJobs: number;
  inProgressJobs: number;
  morningChecklists: number;
  eveningChecklists: number;
  defectsReported: number;
  complianceRate: number;
};

function fmtDur(mins: number | null) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

export default function CheckoutLogs() {
  const [activeTab, setActiveTab] = useState<string>("timesheets");

  // Timesheets Data
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionFrom, setSessionFrom] = useState("");
  const [sessionTo, setSessionTo] = useState("");
  const [sessionPage, setSessionPage] = useState(1);

  // Checklists Data
  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>([]);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [checklistTypeFilter, setChecklistTypeFilter] = useState<string>("all");
  const [checklistStatusFilter, setChecklistStatusFilter] = useState<string>("all");
  const [checklistPage, setChecklistPage] = useState(1);
  const [inspectModal, setInspectModal] = useState<ChecklistRow | null>(null);

  // Performance Data
  const [performanceRows, setPerformanceRows] = useState<DriverPerformance[]>([]);

  const [loading, setLoading] = useState(true);

  // Load All Reporting & Audit Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Drivers & Profiles for lookup
      const [{ data: drvs }, { data: profs }] = await Promise.all([
        supabase.from("drivers").select("id,user_id,full_name,email,vehicle,active"),
        supabase.from("profiles").select("id,full_name,email"),
      ]);

      const driverMap = new Map((drvs || []).map((d: any) => [d.id, d]));
      const profileMap = new Map((profs || []).map((p: any) => [p.id, p]));

      // 2. Fetch Sessions
      const { data: rawSessions } = await supabase
        .from("driver_sessions")
        .select("*")
        .order("login_time", { ascending: false })
        .limit(1000);

      const parsedSessions = ((rawSessions || []) as SessionRow[]).map((r) => {
        const d: any = r.driver_id ? driverMap.get(r.driver_id) : null;
        const p: any = profileMap.get(r.user_id);
        return {
          ...r,
          driver_name: d?.full_name ?? p?.full_name ?? "Driver",
          driver_email: d?.email ?? p?.email ?? "—",
        };
      });
      setSessionRows(parsedSessions);

      // 3. Fetch Checklists
      let parsedChecklists: ChecklistRow[] = [];
      try {
        const { data: rawChecklists } = await supabase
          .from("driver_checklists")
          .select("*")
          .order("submitted_at", { ascending: false })
          .limit(1000);

        if (rawChecklists) {
          parsedChecklists = (rawChecklists as ChecklistRow[]).map((c) => {
            const d: any = driverMap.get(c.driver_id);
            return {
              ...c,
              driver_name: d?.full_name ?? "Driver",
              driver_email: d?.email ?? "—",
              driver_vehicle: d?.vehicle ?? "—",
            };
          });
          setChecklistRows(parsedChecklists);
        }
      } catch (e) {
        console.warn("Could not query driver_checklists:", e);
      }

      // 4. Fetch Jobs to compute performance
      const { data: rawJobs } = await supabase
        .from("jobs")
        .select("id,assigned_driver_id,status,scheduled_date,created_at");

      const jobs = rawJobs || [];

      // 5. Aggregate Performance per Driver
      const performanceList: DriverPerformance[] = (drvs || []).map((d: any) => {
        const driverSessions = parsedSessions.filter((s) => s.driver_id === d.id);
        const totalMinutes = driverSessions.reduce((acc, s) => acc + (s.total_minutes || 0), 0);
        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

        const driverJobs = jobs.filter((j: any) => j.assigned_driver_id === d.id);
        const completedJobs = driverJobs.filter((j: any) => j.status === "completed").length;
        const inProgressJobs = driverJobs.filter((j: any) => j.status === "in_progress" || j.status === "accepted").length;

        const driverChecklists = parsedChecklists.filter((c) => c.driver_id === d.id);
        const morningChecklists = driverChecklists.filter((c) => c.checklist_type === "morning").length;
        const eveningChecklists = driverChecklists.filter((c) => c.checklist_type === "evening").length;
        const defectsReported = driverChecklists.filter((c) => c.requires_signoff || c.signoff_status === "rejected" || c.signoff_status === "pending").length;

        // Compliance score: ratio of clean checklists vs defect/missed
        const totalChecklists = morningChecklists + eveningChecklists;
        const complianceRate = totalChecklists > 0
          ? Math.round(((totalChecklists - defectsReported) / totalChecklists) * 100)
          : 100;

        return {
          id: d.id,
          name: d.full_name,
          email: d.email || "—",
          vehicle: d.vehicle || "Standard Tipper",
          active: !!d.active,
          totalHours,
          completedJobs,
          inProgressJobs,
          morningChecklists,
          eveningChecklists,
          defectsReported,
          complianceRate,
        };
      });

      setPerformanceRows(performanceList);
    } catch (err) {
      console.error("Failed to load audit and reporting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const ch = supabase
      .channel("audit-logs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_sessions" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_checklists" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    const f = sessionFrom ? new Date(sessionFrom).getTime() : null;
    const t = sessionTo ? new Date(sessionTo).getTime() + 24 * 3600_000 - 1 : null;
    return sessionRows.filter((r) => {
      if (q) {
        const hay = `${r.driver_name ?? ""} ${r.driver_email ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const ts = new Date(r.login_time).getTime();
      if (f && ts < f) return false;
      if (t && ts > t) return false;
      return true;
    });
  }, [sessionRows, sessionSearch, sessionFrom, sessionTo]);

  const sessionPageCount = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const sessionPageRows = filteredSessions.slice(
    (sessionPage - 1) * PAGE_SIZE,
    sessionPage * PAGE_SIZE
  );

  // Filtered Checklists
  const filteredChecklists = useMemo(() => {
    const q = checklistSearch.trim().toLowerCase();
    return checklistRows.filter((c) => {
      if (checklistTypeFilter !== "all" && c.checklist_type !== checklistTypeFilter) return false;
      if (checklistStatusFilter !== "all") {
        if (checklistStatusFilter === "defects" && !c.requires_signoff) return false;
        if (checklistStatusFilter === "approved" && c.signoff_status !== "approved") return false;
        if (checklistStatusFilter === "pending" && c.signoff_status !== "pending") return false;
        if (checklistStatusFilter === "clean" && c.requires_signoff) return false;
      }
      if (q) {
        const hay = `${c.driver_name ?? ""} ${c.driver_email ?? ""} ${c.driver_vehicle ?? ""} ${c.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [checklistRows, checklistSearch, checklistTypeFilter, checklistStatusFilter]);

  const checklistPageCount = Math.max(1, Math.ceil(filteredChecklists.length / PAGE_SIZE));
  const checklistPageRows = filteredChecklists.slice(
    (checklistPage - 1) * PAGE_SIZE,
    checklistPage * PAGE_SIZE
  );

  // CSV Exporter: Timesheets
  const handleExportTimesheetsCSV = () => {
    const headers = ["Session ID", "Driver Name", "Driver Email", "Login Time", "Logout Time", "Duration (Minutes)", "Status"];
    const rows = filteredSessions.map((r) => [
      r.id,
      `"${(r.driver_name || "").replace(/"/g, '""')}"`,
      `"${(r.driver_email || "").replace(/"/g, '""')}"`,
      `"${format(new Date(r.login_time), "yyyy-MM-dd HH:mm:ss")}"`,
      r.logout_time ? `"${format(new Date(r.logout_time), "yyyy-MM-dd HH:mm:ss")}"` : '""',
      r.total_minutes ?? 0,
      r.status,
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    downloadCSV(csv, `driver-timesheets-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
  };

  // CSV Exporter: NHVR Vehicle Checklists Audit
  const handleExportChecklistsCSV = () => {
    const headers = [
      "Checklist ID",
      "Date",
      "Driver Name",
      "Driver Email",
      "Vehicle",
      "Type",
      "Requires Signoff",
      "Signoff Status",
      "Signoff By",
      "Signoff Notes",
      "Submitted At",
      "Item Details (Yes/No & Notes)",
    ];
    const rows = filteredChecklists.map((c) => {
      const responsesSummary = (c.responses || [])
        .map((resp) => `${resp.title}: ${resp.answer.toUpperCase()}${resp.notes ? ` (Note: ${resp.notes})` : ""}`)
        .join(" | ");

      return [
        c.id,
        c.date,
        `"${(c.driver_name || "").replace(/"/g, '""')}"`,
        `"${(c.driver_email || "").replace(/"/g, '""')}"`,
        `"${(c.driver_vehicle || "").replace(/"/g, '""')}"`,
        c.checklist_type.toUpperCase(),
        c.requires_signoff ? "YES" : "NO",
        c.signoff_status.toUpperCase(),
        `"${(c.signoff_by || "").replace(/"/g, '""')}"`,
        `"${(c.signoff_notes || "").replace(/"/g, '""')}"`,
        `"${format(new Date(c.submitted_at), "yyyy-MM-dd HH:mm:ss")}"`,
        `"${responsesSummary.replace(/"/g, '""')}"`,
      ];
    });

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    downloadCSV(csv, `nhvr-checklists-audit-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Driver Logs & Compliance Audits</h1>
          <p className="text-sm text-muted-foreground">
            NHVR Chain of Responsibility, automatic timesheets, and vehicle inspection records.
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-xl">
          <TabsTrigger value="timesheets" className="text-xs sm:text-sm gap-2">
            <Clock className="h-4 w-4" /> Driver Timesheets
          </TabsTrigger>
          <TabsTrigger value="checklists" className="text-xs sm:text-sm gap-2">
            <ClipboardList className="h-4 w-4" /> Checklist Audits
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs sm:text-sm gap-2">
            <TrendingUp className="h-4 w-4" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DRIVER TIMESHEETS */}
        <TabsContent value="timesheets" className="space-y-4">
          <div className="rounded-xl border bg-card p-4 grid gap-3 sm:grid-cols-4 items-end">
            <div className="sm:col-span-2">
              <Label className="text-xs">Search driver</Label>
              <Input
                placeholder="Name or email..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" value={sessionFrom} onChange={(e) => setSessionFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" value={sessionTo} onChange={(e) => setSessionTo(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-xs"
              onClick={handleExportTimesheetsCSV}
              disabled={filteredSessions.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export Timesheets CSV
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {loading && <div className="text-center text-muted-foreground py-8 text-sm">Loading sessions…</div>}
              {!loading && sessionPageRows.length === 0 && (
                <div className="text-center text-muted-foreground py-8 text-sm">No driver sessions found</div>
              )}
              {sessionPageRows.map((r) => (
                <div key={r.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{r.driver_name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{r.driver_email}</div>
                    </div>
                    {r.status === "online" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Online</Badge>
                    ) : (
                      <Badge variant="secondary">Logged Out</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>Clock In: <span className="text-foreground">{format(new Date(r.login_time), "MMM d, h:mm a")}</span></div>
                    <div>Clock Out: <span className="text-foreground">{r.logout_time ? format(new Date(r.logout_time), "MMM d, h:mm a") : "Active Shift"}</span></div>
                    <div>Shift Duration: <span className="text-foreground font-medium">{fmtDur(r.total_minutes)}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="text-left p-3.5">Driver</th>
                    <th className="text-left p-3.5">Email</th>
                    <th className="text-left p-3.5">Clock In</th>
                    <th className="text-left p-3.5">Clock Out</th>
                    <th className="text-left p-3.5">Shift Duration</th>
                    <th className="text-left p-3.5">Shift Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        Loading timesheets…
                      </td>
                    </tr>
                  )}
                  {!loading && sessionPageRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-8">
                        No sessions recorded.
                      </td>
                    </tr>
                  )}
                  {sessionPageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-medium">{r.driver_name}</td>
                      <td className="p-3.5 text-muted-foreground text-xs">{r.driver_email}</td>
                      <td className="p-3.5">{format(new Date(r.login_time), "MMM d, yyyy h:mm a")}</td>
                      <td className="p-3.5">
                        {r.logout_time ? format(new Date(r.logout_time), "MMM d, yyyy h:mm a") : <span className="text-emerald-600 font-medium">Active Now</span>}
                      </td>
                      <td className="p-3.5 font-medium">{fmtDur(r.total_minutes)}</td>
                      <td className="p-3.5">
                        {r.status === "online" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Online</Badge>
                        ) : (
                          <Badge variant="secondary">Logged Out</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-muted-foreground">
                {filteredSessions.length} total shift{filteredSessions.length === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sessionPage <= 1}
                  onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs">
                  Page {sessionPage} / {sessionPageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sessionPage >= sessionPageCount}
                  onClick={() => setSessionPage((p) => Math.min(sessionPageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: CHECKLIST AUDITS (NHVR / Pre-start & Evening) */}
        <TabsContent value="checklists" className="space-y-4">
          <div className="rounded-xl border bg-card p-4 grid gap-3 sm:grid-cols-4 items-end">
            <div className="sm:col-span-2">
              <Label className="text-xs">Search driver or vehicle</Label>
              <Input
                placeholder="Name, email, vehicle, date..."
                value={checklistSearch}
                onChange={(e) => setChecklistSearch(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Checklist Type</Label>
              <select
                aria-label="Filter by checklist type"
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                value={checklistTypeFilter}
                onChange={(e) => setChecklistTypeFilter(e.target.value)}
              >
                <option value="all">All Types (Morning & Evening)</option>
                <option value="morning">Morning Pre-start</option>
                <option value="evening">Evening Log-out</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Compliance Status</Label>
              <select
                aria-label="Filter by compliance status"
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                value={checklistStatusFilter}
                onChange={(e) => setChecklistStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="clean">100% Passed (Clean)</option>
                <option value="defects">Defect / Sign-off Required</option>
                <option value="pending">Pending Admin Decision</option>
                <option value="approved">Admin Approved</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-xs"
              onClick={handleExportChecklistsCSV}
              disabled={filteredChecklists.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export NHVR Audit CSV
            </Button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase font-medium">
                  <tr>
                    <th className="text-left p-3.5">Date</th>
                    <th className="text-left p-3.5">Driver</th>
                    <th className="text-left p-3.5">Vehicle</th>
                    <th className="text-left p-3.5">Type</th>
                    <th className="text-left p-3.5">Inspection Status</th>
                    <th className="text-left p-3.5">Sign-off Details</th>
                    <th className="text-right p-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-8">
                        Loading checklist audit logs…
                      </td>
                    </tr>
                  )}
                  {!loading && checklistPageRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground py-8">
                        No vehicle checklists match the selected filters.
                      </td>
                    </tr>
                  )}
                  {checklistPageRows.map((c) => {
                    const noCount = (c.responses || []).filter((r) => r.answer === "no").length;
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-medium whitespace-nowrap">{c.date}</td>
                        <td className="p-3.5">
                          <div className="font-medium text-foreground">{c.driver_name}</div>
                          <div className="text-[11px] text-muted-foreground">{c.driver_email}</div>
                        </td>
                        <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {c.driver_vehicle}
                        </td>
                        <td className="p-3.5">
                          {c.checklist_type === "morning" ? (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/10">
                              Morning Pre-start
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-purple-500/30 text-purple-600 bg-purple-500/10">
                              Evening Post-shift
                            </Badge>
                          )}
                        </td>
                        <td className="p-3.5">
                          {noCount > 0 ? (
                            <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                              <span>{noCount} Defect{noCount > 1 ? "s" : ""} Flagged</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              <span>All Clear (100% Yes)</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-xs">
                          {c.signoff_status === "approved" && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                              Approved by Admin
                            </Badge>
                          )}
                          {c.signoff_status === "rejected" && (
                            <Badge className="bg-red-500/15 text-red-600 border-red-500/30">
                              Vehicle Grounded
                            </Badge>
                          )}
                          {c.signoff_status === "pending" && (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">
                              Pending Review
                            </Badge>
                          )}
                          {c.signoff_status === "none" && (
                            <span className="text-muted-foreground">Self-cleared</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => setInspectModal(c)}
                          >
                            <Eye className="h-3.5 w-3.5" /> Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-muted-foreground">
                {filteredChecklists.length} total inspection{filteredChecklists.length === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={checklistPage <= 1}
                  onClick={() => setChecklistPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="text-xs">
                  Page {checklistPage} / {checklistPageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={checklistPage >= checklistPageCount}
                  onClick={() => setChecklistPage((p) => Math.min(checklistPageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: DRIVER PERFORMANCE & NHVR COMPLIANCE SCORECARD */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {performanceRows.map((perf) => (
              <div key={perf.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{perf.name}</h3>
                    <p className="text-xs text-muted-foreground">{perf.email}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Truck className="h-3.5 w-3.5" /> {perf.vehicle}
                    </div>
                  </div>
                  {perf.active ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Active Driver</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                  <div className="bg-muted/40 p-2.5 rounded-lg">
                    <span className="text-muted-foreground block text-[10px] uppercase">Completed Jobs</span>
                    <span className="text-base font-bold text-foreground">{perf.completedJobs}</span>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg">
                    <span className="text-muted-foreground block text-[10px] uppercase">Logged Hours</span>
                    <span className="text-base font-bold text-foreground">{perf.totalHours} hrs</span>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg">
                    <span className="text-muted-foreground block text-[10px] uppercase">Morning Audits</span>
                    <span className="text-base font-bold text-foreground">{perf.morningChecklists}</span>
                  </div>
                  <div className="bg-muted/40 p-2.5 rounded-lg">
                    <span className="text-muted-foreground block text-[10px] uppercase">Evening Audits</span>
                    <span className="text-base font-bold text-foreground">{perf.eveningChecklists}</span>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Compliance Score:</span>
                  <span className={`font-bold ${perf.complianceRate >= 90 ? "text-emerald-600" : perf.complianceRate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                    {perf.complianceRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* INSPECT CHECKLIST MODAL */}
      <Dialog open={!!inspectModal} onOpenChange={(open) => !open && setInspectModal(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {inspectModal && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  Vehicle Inspection Details
                </DialogTitle>
                <DialogDescription>
                  Submitted by {inspectModal.driver_name} on {inspectModal.date} ({format(new Date(inspectModal.submitted_at), "h:mm a")})
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Checklist Type:</span>
                  <span className="font-semibold uppercase">{inspectModal.checklist_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Vehicle:</span>
                  <span>{inspectModal.driver_vehicle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sign-off Status:</span>
                  <span className="font-semibold capitalize">{inspectModal.signoff_status}</span>
                </div>
                {inspectModal.signoff_by && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signed off by:</span>
                    <span>{inspectModal.signoff_by}</span>
                  </div>
                )}
                {inspectModal.signoff_notes && (
                  <div className="pt-1 text-amber-700 bg-amber-50 p-2 rounded mt-1">
                    <span className="font-semibold">Supervisor Decision Note: </span>
                    {inspectModal.signoff_notes}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Questionnaire Responses ({inspectModal.responses?.length || 0} items)
                </h4>
                <div className="divide-y rounded-lg border bg-card">
                  {(inspectModal.responses || []).map((resp, idx) => (
                    <div key={idx} className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{resp.title}</span>
                        {resp.answer === "yes" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> PASS
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> DEFECT / NO
                          </Badge>
                        )}
                      </div>
                      {resp.notes && (
                        <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                          <span className="font-medium text-foreground">Driver note:</span> {resp.notes}
                        </div>
                      )}
                      {resp.photo_url && (
                        <div className="mt-1">
                          <a
                            href={resp.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 underline"
                          >
                            View Attached Inspection Photo
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setInspectModal(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
