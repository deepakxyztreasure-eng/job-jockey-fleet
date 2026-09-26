import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Mail } from "lucide-react";

import { sendInvitationEmail } from "@/lib/email";

type Role = "super_admin" | "dispatch_admin" | "member" | "driver";
interface Row { id: string; full_name: string|null; email: string|null; phone: string|null; role: Role | null; can_direct_edit?: boolean | null; can_assign_jobs?: boolean | null }

const blank = {
  id: "",
  full_name: "",
  email: "",
  phone: "",
  password: "",
  role: "member" as Role,
  can_direct_edit: "inherit" as "inherit" | "true" | "false",
  can_assign_jobs: "inherit" as "inherit" | "true" | "false",
};

export default function Users() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<typeof blank>(blank);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: perms } = await supabase.from("user_permissions").select("user_id, can_direct_edit, can_assign_jobs");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r: any) => {
      const cur = roleMap.get(r.user_id);
      const rank: Record<Role, number> = { super_admin: 1, dispatch_admin: 2, member: 3, driver: 4 };
      if (!cur || rank[r.role as Role] < rank[cur]) roleMap.set(r.user_id, r.role);
    });
    const permMap = new Map<string, { can_direct_edit: boolean | null; can_assign_jobs: boolean | null }>();
    (perms ?? []).forEach((p: any) => permMap.set(p.user_id, { can_direct_edit: p.can_direct_edit, can_assign_jobs: p.can_assign_jobs }));

    setRows((profiles ?? []).map((p: any) => {
      const pData = permMap.get(p.id);
      return {
        ...p,
        role: roleMap.get(p.id) ?? null,
        can_direct_edit: pData?.can_direct_edit ?? null,
        can_assign_jobs: pData?.can_assign_jobs ?? null,
      };
    }));
  };
  useEffect(() => { load(); }, []);

  const setRoleQuick = async (userId: string, newRole: Role) => {
    const { error } = await (supabase as any).rpc("set_user_role", { p_user_id: userId, p_role: newRole });
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  const [inviteLink, setInviteLink] = useState<{ email: string; link: string } | null>(null);

  const resendInvite = async (r: Row) => {
    if (!r.email) return toast.error("No email associated with this user");
    const result = await sendInvitationEmail({ email: r.email, fullName: r.full_name, role: r.role });
    if (result.ok) {
      toast.success(result.message || `Invitation sent to ${r.email}`);
    } else {
      toast.error(result.message || `Could not send email to ${r.email}`);
    }
    if (result.actionLink) {
      setInviteLink({ email: r.email, link: result.actionLink });
    }
  };

  const startCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const startEdit = (r: Row) => {
    setEditing(r);
    const permStr = r.can_direct_edit === true ? "true" : r.can_direct_edit === false ? "false" : "inherit";
    const assignStr = r.can_assign_jobs === true ? "true" : r.can_assign_jobs === false ? "false" : "inherit";
    setForm({
      id: r.id,
      full_name: r.full_name ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      password: "",
      role: (r.role ?? "member") as Role,
      can_direct_edit: permStr,
      can_assign_jobs: assignStr,
    });
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      let targetUserId = editing?.id;
      if (!editing) {
        if (!form.email) { toast.error("Email is required"); return; }
        const newUid = crypto.randomUUID();
        const { error: profErr } = await supabase.from("profiles").insert({
          id: newUid,
          full_name: form.full_name || null,
          email: form.email,
          phone: form.phone || null,
        });
        if (profErr) { toast.error(profErr.message); return; }

        await (supabase as any).rpc("set_user_role", { p_user_id: newUid, p_role: form.role });
        targetUserId = newUid;

        const inviteResult = await sendInvitationEmail({ email: form.email, fullName: form.full_name, role: form.role });
        if (inviteResult.ok) {
          toast.success(inviteResult.message || "Member added successfully");
        } else {
          toast.warning(inviteResult.message || "User created, but email could not be sent.");
        }
        if (inviteResult.actionLink) {
          setInviteLink({ email: form.email, link: inviteResult.actionLink });
        }
      } else {
        const { error: profErr } = await supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone }).eq("id", editing.id);
        if (profErr) { toast.error(profErr.message); return; }

        await (supabase as any).rpc("set_user_role", { p_user_id: editing.id, p_role: form.role });
        toast.success(form.password ? "Updated & password reset email sent" : "Updated successfully");

        if (form.password) {
          sendInvitationEmail({ email: editing.email || form.email, fullName: form.full_name, role: form.role }).catch(() => {});
        }
      }

      // Save user-wise direct edit & job assign permission overrides
      if (targetUserId && (form.role === "member" || form.role === "dispatch_admin")) {
        const valEdit = form.can_direct_edit === "true" ? true : form.can_direct_edit === "false" ? false : null;
        const valAssign = form.can_assign_jobs === "true" ? true : form.can_assign_jobs === "false" ? false : null;
        await supabase.from("user_permissions").upsert({
          user_id: targetUserId,
          can_direct_edit: valEdit,
          can_assign_jobs: valAssign,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      setOpen(false); load();
    } finally { setBusy(false); }
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete ${r.email}? This cannot be undone.`)) return;
    try {
      await supabase.from("user_roles").delete().eq("user_id", r.id);
      await supabase.from("user_permissions").delete().eq("user_id", r.id);
      await supabase.from("drivers").delete().eq("user_id", r.id);
      const { error } = await supabase.from("profiles").delete().eq("id", r.id);
      if (error) return toast.error(error.message);
      toast.success("User removed successfully");
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not delete user");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Add staff members, manage roles, and set per-user edit permissions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add member</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit user" : "Add member"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} maxLength={120} /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} disabled={!!editing} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
              {!editing && <div><Label>Temporary password *</Label><Input type="text" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} /></div>}
              {editing && <div><Label>Reset password (optional)</Label><Input type="text" placeholder="Leave blank to keep current" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} /><p className="text-[11px] text-muted-foreground mt-1">Min 6 characters. Share with the user securely.</p></div>}
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})} /></div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v)=>setForm({...form,role:v as Role})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="dispatch_admin">Dispatch Admin</SelectItem>
                    <SelectItem value="member">Staff Admin (`member`)</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(form.role === "member" || form.role === "dispatch_admin") && (
                <>
                  <div>
                    <Label>Direct Job Editing Permission</Label>
                    <Select value={form.can_direct_edit} onValueChange={(v: any)=>setForm({...form, can_direct_edit: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Inherit Global Setting (Recommended)</SelectItem>
                        <SelectItem value="true">Force Enable (Direct Edit Without Approval)</SelectItem>
                        <SelectItem value="false">Force Disable (Require SuperAdmin Approval)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Controls whether this Staff Admin can save job changes directly without SuperAdmin approval.
                    </p>
                  </div>

                  <div>
                    <Label>Driver Assignment Permission</Label>
                    <Select value={form.can_assign_jobs} onValueChange={(v: any)=>setForm({...form, can_assign_jobs: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Inherit Global Setting (Recommended)</SelectItem>
                        <SelectItem value="true">Force Enable (Allow Driver Assignment)</SelectItem>
                        <SelectItem value="false">Force Disable (Hide Driver Assignment)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Controls whether this Staff Admin can assign drivers, reassign drivers, and manage driver holds.
                    </p>
                  </div>
                </>
              )}
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
                    <SelectItem value="dispatch_admin">Dispatch Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" title="Resend Invite" onClick={()=>resendInvite(r)}><Mail className="h-4 w-4 text-primary" /></Button>
                <Button size="icon" variant="ghost" title="Edit User" onClick={()=>startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Delete User" onClick={()=>remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <table className="data-table w-full hidden md:table">
          <thead><tr><th>User</th><th>Email</th><th>Phone</th><th>Role</th><th>Quick change</th><th>Actions</th></tr></thead>
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
                    <SelectItem value="dispatch_admin">Dispatch Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="text-right whitespace-nowrap space-x-1">
                  <Button size="icon" variant="ghost" title="Resend Invite" onClick={()=>resendInvite(r)}><Mail className="h-4 w-4 text-primary" /></Button>
                  <Button size="icon" variant="ghost" title="Edit User" onClick={()=>startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Delete User" onClick={()=>remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No users</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!inviteLink} onOpenChange={(v) => { if (!v) setInviteLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Login Setup Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>
              An invitation email has been sent to <span className="font-semibold">{inviteLink?.email}</span>. You can also manually copy and share this setup link with the user:
            </p>
            <Input readOnly value={inviteLink?.link || ""} className="font-mono text-xs select-all bg-muted" />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (inviteLink?.link) {
                  navigator.clipboard.writeText(inviteLink.link);
                  toast.success("Setup link copied to clipboard");
                }
                setInviteLink(null);
              }}
            >
              Copy Link & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
