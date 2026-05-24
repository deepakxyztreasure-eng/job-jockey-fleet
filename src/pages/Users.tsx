import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Role = "super_admin" | "dispatch_admin" | "member" | "driver";
interface Row { id: string; full_name: string|null; email: string|null; phone: string|null; role: Role | null }

const blank = { id: "", full_name: "", email: "", phone: "", password: "", role: "member" as Role };

export default function Users() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<typeof blank>(blank);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r: any) => {
      const cur = roleMap.get(r.user_id);
      const rank: Record<Role, number> = { super_admin: 1, dispatch_admin: 2, member: 3, driver: 4 };
      if (!cur || rank[r.role as Role] < rank[cur]) roleMap.set(r.user_id, r.role);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? null })));
  };
  useEffect(() => { load(); }, []);

  const setRoleQuick = async (userId: string, newRole: Role) => {
    const { error: del } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del) return toast.error(del.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  const startCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const startEdit = (r: Row) => {
    setEditing(r);
    setForm({ id: r.id, full_name: r.full_name ?? "", email: r.email ?? "", phone: r.phone ?? "", password: "", role: (r.role ?? "member") as Role });
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (!editing) {
        if (!form.email || !form.password) { toast.error("Email and password required"); return; }
        const { data, error } = await supabase.functions.invoke("admin-users", {
          body: { action: "create", email: form.email, password: form.password, full_name: form.full_name, phone: form.phone, role: form.role },
        });
        if (error || (data as any)?.error) { toast.error(((data as any)?.error) || error!.message); return; }
        toast.success("Member added");
      } else {
        const { data, error } = await supabase.functions.invoke("admin-users", {
          body: { action: "update", user_id: editing.id, full_name: form.full_name, phone: form.phone, role: form.role },
        });
        if (error || (data as any)?.error) { toast.error(((data as any)?.error) || error!.message); return; }
        toast.success("Updated");
      }
      setOpen(false); load();
    } finally { setBusy(false); }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete ${r.email}? This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", user_id: r.id } });
    if (error || (data as any)?.error) return toast.error(((data as any)?.error) || error!.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Add staff members, manage roles, and remove access.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add member</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit user" : "Add member"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} maxLength={120} /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} disabled={!!editing} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
              {!editing && <div><Label>Temporary password *</Label><Input type="text" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} /></div>}
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v)=>setForm({...form,role:v as Role})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="member">Member (Staff)</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {rows.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No users</div>}
          {rows.map((r) => (
            <div key={r.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{r.full_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.email}</div>
                  {r.phone && <div className="text-[11px] text-muted-foreground">{r.phone}</div>}
                </div>
                <Badge variant="secondary" className="capitalize">{r.role?.replace("_"," ") ?? "none"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={r.role ?? ""} onValueChange={(v)=>setRoleQuick(r.id, v as Role)}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Set role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={()=>startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={()=>remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <table className="data-table w-full hidden md:table">
          <thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Quick change</th><th></th></tr></thead>
          <tbody>
            {rows.map((r)=>(
              <tr key={r.id}>
                <td className="font-medium">{r.full_name || "—"}</td>
                <td className="text-muted-foreground">{r.email}</td>
                <td className="text-muted-foreground">{r.phone || "—"}</td>
                <td><Badge variant="secondary" className="capitalize">{r.role?.replace("_"," ") ?? "none"}</Badge></td>
                <td>
                  <Select value={r.role ?? ""} onValueChange={(v)=>setRoleQuick(r.id, v as Role)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Set role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={()=>startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={()=>remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No users</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
