import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type Role = "super_admin" | "member" | "driver";

interface Row { id: string; full_name: string|null; email: string|null; role: Role | null }

export default function Users() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, Role>();
    (roles ?? []).forEach((r: any) => {
      const cur = roleMap.get(r.user_id);
      const rank: Record<Role, number> = { super_admin: 1, member: 2, driver: 3 };
      if (!cur || rank[r.role as Role] < rank[cur]) roleMap.set(r.user_id, r.role);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? null })));
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, newRole: Role) => {
    const { error: del } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del) return toast.error(del.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) return toast.error(error.message);
    toast.success("Role updated"); load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users & Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">Promote members to Super Admin or assign Driver role.</p>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table w-full">
          <thead><tr><th>User</th><th>Email</th><th>Current Role</th><th>Change</th></tr></thead>
          <tbody>
            {rows.map((r)=>(
              <tr key={r.id}>
                <td className="font-medium">{r.full_name || "—"}</td>
                <td className="text-muted-foreground">{r.email}</td>
                <td><Badge variant="secondary" className="capitalize">{r.role?.replace("_"," ") ?? "none"}</Badge></td>
                <td>
                  <Select value={r.role ?? ""} onValueChange={(v)=>setRole(r.id, v as Role)}>
                    <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Set role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No users</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
