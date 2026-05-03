import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Loc { id: string; name: string; address: string; city: string|null; notes: string|null; active: boolean }

export default function StoreLocations() {
  const { role } = useAuth();
  const isAdmin = role === "super_admin";
  const [items, setItems] = useState<Loc[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Loc | null>(null);
  const [form, setForm] = useState({ name: "", address: "", city: "", notes: "" });

  const load = async () => {
    const { data, error } = await supabase.from("store_locations").select("*").order("name");
    if (error) toast.error(error.message);
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => { setEditing(null); setForm({ name:"", address:"", city:"", notes:"" }); setOpen(true); };
  const startEdit = (l: Loc) => { setEditing(l); setForm({ name: l.name, address: l.address, city: l.city ?? "", notes: l.notes ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.address.trim()) return toast.error("Name and address are required");
    if (editing) {
      const { error } = await supabase.from("store_locations").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Location updated");
    } else {
      const { error } = await supabase.from("store_locations").insert(form);
      if (error) return toast.error(error.message);
      toast.success("Location added");
    }
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    const { error } = await supabase.from("store_locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Store Locations</h1>
          <p className="text-sm text-muted-foreground mt-1">Pickup locations available when creating jobs.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Add location</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} location</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} maxLength={120} /></div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})} maxLength={250} /></div>
                <div><Label>City</Label><Input value={form.city} onChange={(e)=>setForm({...form, city:e.target.value})} maxLength={80} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} maxLength={500} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12 border rounded-xl bg-card">No locations yet</div>}
        {items.map((l) => (
          <div key={l.id} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><MapPin className="h-4 w-4" /></div>
                <div>
                  <h3 className="font-medium">{l.name}</h3>
                  <p className="text-sm text-muted-foreground">{l.address}</p>
                  {l.city && <p className="text-xs text-muted-foreground mt-1">{l.city}</p>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={()=>startEdit(l)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={()=>remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </div>
            {l.notes && <p className="text-xs text-muted-foreground mt-3 border-t pt-3">{l.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
