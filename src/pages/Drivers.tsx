import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface Driver { id: string; full_name: string; phone: string|null; email: string|null; license_number: string|null; vehicle: string|null; active: boolean; user_id: string|null }

export default function Drivers() {
  const { role } = useAuth();
  const isAdmin = role === "super_admin";
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string|null; email: string|null }[]>([]);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState({ full_name:"", phone:"", email:"", license_number:"", vehicle:"", user_id:"", active:true });

  const load = async () => {
    const [{ data: ds }, { data: ps }, { data: jobs }] = await Promise.all([
      supabase.from("drivers").select("*").order("full_name"),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("jobs").select("assigned_driver_id, status, start_time, end_time"),
    ]);
    setDrivers(ds ?? []);
    setUsers(ps ?? []);
    const now = new Date();
    const busy: Record<string, boolean> = {};
    (jobs ?? []).forEach((j: any) => {
      if (!j.assigned_driver_id || !j.start_time || !j.end_time) return;
      if (["completed","closed"].includes(j.status)) return;
      const s = new Date(j.start_time), e = new Date(j.end_time);
      if (now >= s && now < e) busy[j.assigned_driver_id] = true;
    });
    setBusyMap(busy);
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing(null); setForm({ full_name:"", phone:"", email:"", license_number:"", vehicle:"", user_id:"", active:true }); setOpen(true); };
  const startEdit = (d: Driver) => { setEditing(d); setForm({
    full_name: d.full_name, phone: d.phone??"", email: d.email??"", license_number: d.license_number??"", vehicle: d.vehicle??"", user_id: d.user_id??"", active: d.active,
  }); setOpen(true); };

  const save = async () => {
    if (!form.full_name.trim()) return toast.error("Name required");
    let targetUserId = form.user_id || null;
    if (!targetUserId && form.email) {
      const { data: prof } = await supabase.from("profiles").select("id").ilike("email", form.email.trim()).maybeSingle();
      if (prof?.id) targetUserId = prof.id;
    }
    const payload: any = { ...form, user_id: targetUserId };
    if (editing) {
      const { error } = await supabase.from("drivers").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("drivers").insert(payload);
      if (error) return toast.error(error.message);
    }
    // If linked to a user, ensure they have driver role
    if (targetUserId) {
      await supabase.from("user_roles").upsert({ user_id: targetUserId, role: "driver" }, { onConflict: "user_id,role" });
    }
    toast.success("Saved"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete driver?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Drivers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage drivers and their availability.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add driver</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} driver</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>License #</Label><Input value={form.license_number} onChange={(e)=>setForm({...form,license_number:e.target.value})} /></div>
                  <div><Label>Vehicle</Label><Input value={form.vehicle} onChange={(e)=>setForm({...form,vehicle:e.target.value})} /></div>
                </div>
                <div>
                  <Label>Link to user account (optional)</Label>
                  <Select value={form.user_id || "none"} onValueChange={(v)=>setForm({...form,user_id: v==="none"?"":v})}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {users.map((u)=> <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form,active:v})} /><Label>Active</Label></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table w-full">
          <thead><tr><th>Driver</th><th>Phone</th><th>Vehicle</th><th>Status</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {drivers.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No drivers yet</td></tr>}
            {drivers.map((d)=>(
              <tr key={d.id}>
                <td>
                  <div className="font-medium">{d.full_name}</div>
                  <div className="text-xs text-muted-foreground">{d.email}</div>
                </td>
                <td className="text-muted-foreground">{d.phone || "—"}</td>
                <td className="text-muted-foreground">{d.vehicle || "—"}</td>
                <td>
                  {!d.active ? <Badge variant="secondary">Inactive</Badge>
                    : busyMap[d.id] ? <Badge className="bg-warning/15 text-warning border-0">Busy</Badge>
                    : <Badge className="bg-success/15 text-success border-0">Available</Badge>}
                </td>
                {isAdmin && <td className="text-right">
                  <Button size="icon" variant="ghost" onClick={()=>startEdit(d)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={()=>remove(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
