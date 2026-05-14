import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Row { id: string; full_name: string|null; email: string|null; phone: string|null }

export default function Admin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "member");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
      setRows((profiles ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">List of members (admin staff).</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table w-full">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.full_name || "—"}</td>
                <td className="text-muted-foreground">{r.email || "—"}</td>
                <td className="text-muted-foreground">{r.phone || "—"}</td>
                <td><Badge variant="secondary">Member</Badge></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No members</td></tr>
            )}
            {loading && (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-8">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
