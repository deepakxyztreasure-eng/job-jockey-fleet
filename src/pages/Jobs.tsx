import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Flame, Pencil, Trash2, Download, Filter, ImageIcon, CheckCircle2, XCircle, MoreHorizontal, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, PaymentBadge } from "@/components/StatusBadge";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { exportJobsCSV, exportJobsXLSX } from "@/lib/exportJobs";

const ALL_STATUSES = ["pending","assigned","accepted","in_progress","completion_requested","completed","rejected","issue","payment_pending","closed"] as const;
const PAYMENT_STATUSES = ["pending","partial","paid"] as const;
type DateRange = "all"|"today"|"week"|"month"|"custom";

const blank = {
  title:"", description:"", pickup_location_id:"", delivery_address:"",
  scheduled_date:"", priority:"standard" as "standard"|"priority",
  invoice_number:"", price:"", show_price:false,
  assigned_driver_id:"", start_time:"", end_time:"",
};

export default function Jobs() {
  const { role, user } = useAuth();
  const isAdmin = role === "super_admin";
  const isDriver = role === "driver";

  const [jobs, setJobs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(blank);

  // Filters
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fDriver, setFDriver] = useState("all");
  const [fLocation, setFLocation] = useState("all");
  const [fPriority, setFPriority] = useState("all");
  const [fRange, setFRange] = useState<DateRange>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Driver completion modal
  const [completeFor, setCompleteFor] = useState<any | null>(null);
  const [compNotes, setCompNotes] = useState("");
  const [compFile, setCompFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Admin verify modal
  const [verifyFor, setVerifyFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    const [{ data: js }, { data: ls }, { data: ds }] = await Promise.all([
      supabase.from("jobs").select("*, store_locations(name), drivers(full_name)").order("created_at", { ascending: false }),
      supabase.from("store_locations").select("id,name").eq("active", true).order("name"),
      supabase.from("drivers").select("id,full_name,active").eq("active", true).order("full_name"),
    ]);
    setJobs(js ?? []); setLocations(ls ?? []); setDrivers(ds ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("jobs-rt").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    let now = new Date();
    let from: Date | null = null, to: Date | null = null;
    if (fRange === "today") { from = startOfDay(now); to = endOfDay(now); }
    else if (fRange === "week") { from = startOfWeek(now); to = endOfWeek(now); }
    else if (fRange === "month") { from = startOfMonth(now); to = endOfMonth(now); }
    else if (fRange === "custom") {
      if (fFrom) from = startOfDay(new Date(fFrom));
      if (fTo) to = endOfDay(new Date(fTo));
    }
    return jobs.filter((j) => {
      if (search && !`${j.title} ${j.invoice_number}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (fStatus !== "all" && j.status !== fStatus) return false;
      if (fDriver !== "all" && j.assigned_driver_id !== fDriver) return false;
      if (fLocation !== "all" && j.pickup_location_id !== fLocation) return false;
      if (fPriority !== "all" && j.priority !== fPriority) return false;
      if (from || to) {
        const d = j.scheduled_date ? new Date(j.scheduled_date) : (j.start_time ? new Date(j.start_time) : null);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [jobs, search, fStatus, fDriver, fLocation, fPriority, fRange, fFrom, fTo]);

  const startCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const startEdit = (j: any) => {
    setEditing(j);
    setForm({
      title: j.title, description: j.description ?? "", pickup_location_id: j.pickup_location_id,
      delivery_address: j.delivery_address ?? "", scheduled_date: j.scheduled_date ?? "",
      priority: j.priority, invoice_number: j.invoice_number, price: j.price ?? "",
      show_price: j.show_price, assigned_driver_id: j.assigned_driver_id ?? "",
      start_time: j.start_time ? j.start_time.slice(0,16) : "",
      end_time: j.end_time ? j.end_time.slice(0,16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title required");
    if (!form.invoice_number.trim()) return toast.error("Invoice number required");
    if (!form.pickup_location_id) return toast.error("Pickup location required");
    if (form.assigned_driver_id && (!form.start_time || !form.end_time)) return toast.error("Start and end time required when assigning a driver");

    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      pickup_location_id: form.pickup_location_id,
      delivery_address: form.delivery_address || null,
      scheduled_date: form.scheduled_date || null,
      priority: form.priority,
      invoice_number: form.invoice_number.trim(),
      price: form.price ? Number(form.price) : null,
      show_price: form.show_price,
      assigned_driver_id: form.assigned_driver_id || null,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
    };
    if (form.assigned_driver_id && (!editing || editing.status === "pending")) payload.status = "assigned";

    if (editing) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      payload.created_by = user!.id;
      const { data: created, error } = await supabase.from("jobs").insert(payload).select().single();
      if (error) return toast.error(error.message);
      if (created?.assigned_driver_id) {
        const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", created.assigned_driver_id).single();
        if (drv?.user_id) {
          await supabase.from("notifications").insert({
            user_id: drv.user_id, title: "New job assigned", body: `${payload.title} (Invoice ${payload.invoice_number})`, type: "job_assigned", job_id: created.id,
          });
        }
      }
    }
    toast.success("Saved"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  // Driver actions
  const driverAccept = async (j: any) => {
    const { error } = await supabase.from("jobs").update({ status: "accepted" as any }).eq("id", j.id);
    if (error) return toast.error(error.message);
    toast.success("Job accepted");
  };
  const driverReject = async (j: any) => {
    if (!confirm("Reject this job?")) return;
    const { error } = await supabase.from("jobs").update({ status: "rejected" as any, assigned_driver_id: null }).eq("id", j.id);
    if (error) return toast.error(error.message);
    toast.success("Job rejected");
  };
  const driverStart = async (j: any) => {
    const { error } = await supabase.from("jobs").update({ status: "in_progress" as any }).eq("id", j.id);
    if (error) return toast.error(error.message);
  };

  const submitCompletion = async () => {
    if (!completeFor) return;
    setUploading(true);
    try {
      let proofUrl: string | null = null;
      if (compFile && user) {
        const path = `${user.id}/${completeFor.id}-${Date.now()}-${compFile.name}`;
        const { error: upErr } = await supabase.storage.from("job-proofs").upload(path, compFile);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("jobs").update({
        status: "completion_requested" as any,
        completion_notes: compNotes || null,
        proof_image_url: proofUrl,
        completion_requested_at: new Date().toISOString(),
      }).eq("id", completeFor.id);
      if (error) throw error;

      // notify admins
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
      if (admins?.length) {
        await supabase.from("notifications").insert(admins.map((a) => ({
          user_id: a.user_id,
          title: "Completion requested",
          body: `${completeFor.title} (Invoice ${completeFor.invoice_number}) awaits verification`,
          type: "completion_requested",
          job_id: completeFor.id,
        })));
      }
      toast.success("Sent for admin verification");
      setCompleteFor(null); setCompNotes(""); setCompFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  // Admin verify actions
  const adminApprove = async () => {
    if (!verifyFor || !user) return;
    const { error } = await supabase.from("jobs").update({
      status: "completed" as any, verified_at: new Date().toISOString(), verified_by: user.id, rejection_reason: null,
    }).eq("id", verifyFor.id);
    if (error) return toast.error(error.message);
    const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", verifyFor.assigned_driver_id).maybeSingle();
    if (drv?.user_id) {
      await supabase.from("notifications").insert({
        user_id: drv.user_id, title: "Completion approved", body: verifyFor.title, type: "completion_approved", job_id: verifyFor.id,
      });
    }
    toast.success("Approved"); setVerifyFor(null); setRejectReason("");
  };
  const adminReject = async () => {
    if (!verifyFor) return;
    const { error } = await supabase.from("jobs").update({
      status: "in_progress" as any, rejection_reason: rejectReason || "Not approved",
    }).eq("id", verifyFor.id);
    if (error) return toast.error(error.message);
    const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", verifyFor.assigned_driver_id).maybeSingle();
    if (drv?.user_id) {
      await supabase.from("notifications").insert({
        user_id: drv.user_id, title: "Completion rejected", body: rejectReason || verifyFor.title, type: "completion_rejected", job_id: verifyFor.id,
      });
    }
    toast.success("Sent back to driver"); setVerifyFor(null); setRejectReason("");
  };

  const viewProof = async (path: string) => {
    const { data } = await supabase.storage.from("job-proofs").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  // Bulk
  const allChecked = filtered.length > 0 && filtered.every((j) => selected.has(j.id));
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(filtered.map((j) => j.id)));
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  };
  const bulkUpdate = async (patch: any, label: string) => {
    if (selected.size === 0) return;
    if (!confirm(`${label} ${selected.size} job(s)?`)) return;
    const { error } = await supabase.from("jobs").update(patch).in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`Updated ${selected.size} jobs`);
    setSelected(new Set());
  };
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} job(s)? This cannot be undone.`)) return;
    const { error } = await supabase.from("jobs").delete().in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success("Deleted"); setSelected(new Set());
  };
  const bulkAssign = async (driverId: string) => {
    if (!driverId || selected.size === 0) return;
    const { error } = await supabase.from("jobs").update({ assigned_driver_id: driverId, status: "assigned" as any }).in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success("Reassigned"); setSelected(new Set());
  };

  const updatePayment = async (j: any, status: string) => {
    const { error } = await supabase.from("jobs").update({ payment_status: status as any }).eq("id", j.id);
    if (error) return toast.error(error.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isDriver ? "My Jobs" : "Jobs"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isDriver ? "Accept, work, and submit jobs for admin verification." : "Create, assign, verify, and track jobs."}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Export filtered ({filtered.length})</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportJobsXLSX(filtered)}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportJobsCSV(filtered)}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isDriver && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />New job</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} job</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Job title *</Label><Input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} maxLength={150} /></div>
                    <div className="col-span-2"><Label>Product description</Label><Textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} maxLength={1000} /></div>
                    <div>
                      <Label>Pickup location *</Label>
                      <Select value={form.pickup_location_id} onValueChange={(v)=>setForm({...form,pickup_location_id:v})}>
                        <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                        <SelectContent>{locations.map((l)=> <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Delivery address</Label><Input value={form.delivery_address} onChange={(e)=>setForm({...form,delivery_address:e.target.value})} /></div>
                    <div><Label>Scheduled date</Label><Input type="date" value={form.scheduled_date} onChange={(e)=>setForm({...form,scheduled_date:e.target.value})} /></div>
                    <div><Label>Invoice number *</Label><Input value={form.invoice_number} onChange={(e)=>setForm({...form,invoice_number:e.target.value})} maxLength={60} /></div>
                    <div><Label>Price</Label><Input type="number" step="0.01" value={form.price} onChange={(e)=>setForm({...form,price:e.target.value})} /></div>
                    <div className="flex items-end gap-4">
                      <div className="flex items-center gap-2"><Switch checked={form.priority === "priority"} onCheckedChange={(v)=>setForm({...form,priority: v?"priority":"standard"})} /><Label className="text-priority"><Flame className="inline h-3 w-3 mr-1" />Priority</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={form.show_price} onCheckedChange={(v)=>setForm({...form,show_price:v})} /><Label>Show price</Label></div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-3">Driver assignment</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Driver</Label>
                        <Select value={form.assigned_driver_id || "none"} onValueChange={(v)=>setForm({...form,assigned_driver_id: v==="none"?"":v})}>
                          <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {drivers.map((d)=> <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Start time</Label><Input type="datetime-local" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})} /></div>
                      <div><Label>End time</Label><Input type="datetime-local" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})} /></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Overlapping assignments for the same driver are blocked automatically.</p>
                  </div>
                </div>
                <DialogFooter><Button onClick={save}>Save job</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium"><Filter className="h-4 w-4" /> Filters</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Input placeholder="Search title/invoice" value={search} onChange={(e)=>setSearch(e.target.value)} />
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s)=> <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fDriver} onValueChange={setFDriver}>
            <SelectTrigger><SelectValue placeholder="Driver" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All drivers</SelectItem>
              {drivers.map((d)=> <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fLocation} onValueChange={setFLocation}>
            <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l)=> <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fPriority} onValueChange={setFPriority}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fRange} onValueChange={(v)=>setFRange(v as DateRange)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {fRange === "custom" && (
            <>
              <div><Label className="text-xs">From</Label><Input type="date" value={fFrom} onChange={(e)=>setFFrom(e.target.value)} /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={fTo} onChange={(e)=>setFTo(e.target.value)} /></div>
            </>
          )}
        </div>
      </div>

      {/* Bulk bar */}
      {isAdmin && selected.size > 0 && (
        <div className="rounded-xl border bg-accent/5 p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium px-2">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={()=>bulkUpdate({ status: "completed" }, "Mark completed")}>Mark Completed</Button>
          <Select onValueChange={(v)=>bulkUpdate({ status: v }, `Set status to ${v}`)}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Change status…" /></SelectTrigger>
            <SelectContent>{ALL_STATUSES.map((s)=> <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={(v)=>bulkAssign(v)}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Assign to driver…" /></SelectTrigger>
            <SelectContent>{drivers.map((d)=> <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
          <Button size="sm" variant="ghost" onClick={()=>setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr>
              {isAdmin && <th className="w-8"><Checkbox checked={allChecked} onCheckedChange={toggleAll} /></th>}
              <th>Job</th><th>Pickup</th><th>Driver</th><th>Window</th><th>Invoice</th><th>Payment</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-8">No jobs match filters</td></tr>}
              {filtered.map((j)=>(
                <tr key={j.id}>
                  {isAdmin && <td><Checkbox checked={selected.has(j.id)} onCheckedChange={()=>toggleOne(j.id)} /></td>}
                  <td>
                    <div className="flex items-center gap-2">
                      {j.priority === "priority" && <Flame className="h-4 w-4 text-priority" />}
                      <span className="font-medium">{j.title}</span>
                      {j.proof_image_url && <button onClick={()=>viewProof(j.proof_image_url)} title="View proof"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                    </div>
                    {j.scheduled_date && <div className="text-xs text-muted-foreground">{format(new Date(j.scheduled_date), "MMM d, yyyy")}</div>}
                    {j.rejection_reason && <div className="text-xs text-destructive">Rejected: {j.rejection_reason}</div>}
                  </td>
                  <td className="text-muted-foreground">{j.store_locations?.name ?? "—"}</td>
                  <td className="text-muted-foreground">{j.drivers?.full_name ?? <span className="italic">Unassigned</span>}</td>
                  <td className="text-muted-foreground text-xs">
                    {j.start_time && j.end_time ? <>{format(new Date(j.start_time),"MMM d HH:mm")} → {format(new Date(j.end_time),"HH:mm")}</> : "—"}
                  </td>
                  <td className="font-mono text-xs">{j.invoice_number}</td>
                  <td>
                    {isAdmin ? (
                      <Select value={j.payment_status} onValueChange={(v)=>updatePayment(j,v)}>
                        <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_STATUSES.map((p)=> <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <PaymentBadge status={j.payment_status} />}
                  </td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="text-right whitespace-nowrap">
                    {/* Driver actions */}
                    {isDriver && j.status === "assigned" && (
                      <>
                        <Button size="sm" variant="outline" onClick={()=>driverAccept(j)}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={()=>driverReject(j)}>Reject</Button>
                      </>
                    )}
                    {isDriver && j.status === "accepted" && (
                      <Button size="sm" onClick={()=>driverStart(j)}>Start</Button>
                    )}
                    {isDriver && j.status === "in_progress" && (
                      <Button size="sm" onClick={()=>{ setCompleteFor(j); setCompNotes(""); setCompFile(null); }}>Mark Completed</Button>
                    )}
                    {isDriver && j.status === "completion_requested" && (
                      <span className="text-xs text-priority px-2">Awaiting verification</span>
                    )}
                    {/* Admin actions */}
                    {isAdmin && j.status === "completion_requested" && (
                      <Button size="sm" variant="outline" onClick={()=>{ setVerifyFor(j); setRejectReason(""); }}>
                        <ShieldCheck className="h-4 w-4 mr-1" />Verify
                      </Button>
                    )}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={()=>startEdit(j)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          {j.proof_image_url && <DropdownMenuItem onClick={()=>viewProof(j.proof_image_url)}><ImageIcon className="h-4 w-4 mr-2" />View proof</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={()=>remove(j.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver completion dialog */}
      <Dialog open={!!completeFor} onOpenChange={(v)=>!v && setCompleteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit for verification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Notes</Label><Textarea value={compNotes} onChange={(e)=>setCompNotes(e.target.value)} maxLength={1000} placeholder="What was delivered, any issues, etc." /></div>
            <div><Label>Proof image (optional)</Label><Input type="file" accept="image/*" onChange={(e)=>setCompFile(e.target.files?.[0] ?? null)} /></div>
            <p className="text-xs text-muted-foreground">Admin will review and approve completion.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setCompleteFor(null)}>Cancel</Button>
            <Button disabled={uploading} onClick={submitCompletion}>{uploading ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin verify dialog */}
      <Dialog open={!!verifyFor} onOpenChange={(v)=>!v && setVerifyFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify completion</DialogTitle></DialogHeader>
          {verifyFor && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Job:</span> <span className="font-medium">{verifyFor.title}</span></div>
              <div><span className="text-muted-foreground">Invoice:</span> {verifyFor.invoice_number}</div>
              <div><span className="text-muted-foreground">Driver:</span> {verifyFor.drivers?.full_name}</div>
              <div><span className="text-muted-foreground">Payment:</span> <PaymentBadge status={verifyFor.payment_status} /></div>
              {verifyFor.completion_notes && <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground mb-1">Driver notes</div>{verifyFor.completion_notes}</div>}
              {verifyFor.proof_image_url && <Button size="sm" variant="outline" onClick={()=>viewProof(verifyFor.proof_image_url)}><ImageIcon className="h-4 w-4 mr-2" />View proof image</Button>}
              <div className="border-t pt-3">
                <Label>Rejection reason (optional)</Label>
                <Textarea value={rejectReason} onChange={(e)=>setRejectReason(e.target.value)} placeholder="Why is this not approved?" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={adminReject}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button onClick={adminApprove}><CheckCircle2 className="h-4 w-4 mr-2" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
