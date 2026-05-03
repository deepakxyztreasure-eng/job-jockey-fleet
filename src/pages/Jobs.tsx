import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Flame, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";

const STATUSES = ["pending","assigned","accepted","in_progress","completed","payment_pending","closed"] as const;

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
      // notify driver
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

  const updateStatus = async (j: any, status: string) => {
    const { error } = await supabase.from("jobs").update({ status: status as any }).eq("id", j.id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isDriver ? "My Jobs" : "Jobs"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isDriver ? "Jobs assigned to you. Update status as you progress." : "Create, assign, and track jobs."}</p>
        </div>
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
                  <p className="text-xs text-muted-foreground mt-2">The system blocks overlapping assignments for the same driver.</p>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save job</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr>
              <th>Job</th><th>Pickup</th><th>Driver</th><th>Window</th><th>Invoice</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {jobs.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No jobs yet</td></tr>}
              {jobs.map((j)=>(
                <tr key={j.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {j.priority === "priority" && <Flame className="h-4 w-4 text-priority" />}
                      <span className="font-medium">{j.title}</span>
                    </div>
                    {j.scheduled_date && <div className="text-xs text-muted-foreground">{format(new Date(j.scheduled_date), "MMM d, yyyy")}</div>}
                  </td>
                  <td className="text-muted-foreground">{j.store_locations?.name ?? "—"}</td>
                  <td className="text-muted-foreground">{j.drivers?.full_name ?? <span className="italic">Unassigned</span>}</td>
                  <td className="text-muted-foreground text-xs">
                    {j.start_time && j.end_time ? <>{format(new Date(j.start_time),"MMM d HH:mm")} → {format(new Date(j.end_time),"HH:mm")}</> : "—"}
                  </td>
                  <td className="font-mono text-xs">{j.invoice_number}</td>
                  <td>
                    {(isDriver || isAdmin) ? (
                      <Select value={j.status} onValueChange={(v)=>updateStatus(j, v)}>
                        <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.filter(s => isAdmin || ["accepted","in_progress","completed"].includes(s)).map((s)=> <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <StatusBadge status={j.status} />}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {!isDriver && <Button size="icon" variant="ghost" onClick={()=>startEdit(j)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="icon" variant="ghost" onClick={()=>remove(j.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
