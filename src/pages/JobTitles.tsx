import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface JT { id: string; name: string; active: boolean; sort_order: number }

export default function JobTitles() {
  const [items, setItems] = useState<JT[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JT | null>(null);
  const [form, setForm] = useState({ name: "", sort_order: 0, active: true });

  const load = async () => {
    const { data, error } = await supabase.from("job_titles").select("*").order("sort_order").order("name");
    if (error) toast.error(error.message);
    setItems((data ?? []) as JT[]);
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing(null); setForm({ name: "", sort_order: (items.at(-1)?.sort_order ?? 0) + 10, active: true }); setOpen(true); };
  const startEdit = (t: JT) => { setEditing(t); setForm({ name: t.name, sort_order: t.sort_order, active: t.active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const payload = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0, active: form.active };
    const { error } = editing
      ? await supabase.from("job_titles").update(payload).eq("id", editing.id)
      : await supabase.from("job_titles").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Updated" : "Added");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job title?")) return;
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Job Titles</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage the dropdown shown when creating jobs.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add title</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} job title</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} maxLength={120} /></div>
              <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e)=>setForm({...form, sort_order: Number(e.target.value)})} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v)=>setForm({...form, active:v})} /><Label>Active</Label></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="data-table w-full">
          <thead><tr><th>Name</th><th className="w-24">Order</th><th className="w-24">Active</th><th className="w-32"></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-8">No titles yet</td></tr>}
            {items.map((t)=>(
              <tr key={t.id}>
                <td className="font-medium flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" />{t.name}</td>
                <td className="text-muted-foreground">{t.sort_order}</td>
                <td>{t.active ? <span className="text-success text-xs">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" onClick={()=>startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={()=>remove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
