import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Realtime updates on jobs and assignments.</p>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-center text-muted-foreground py-12 border rounded-xl bg-card">You're all caught up</div>}
        {items.map((n)=>(
          <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border bg-card ${!n.read ? "border-accent/40" : ""}`}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${!n.read ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}><Bell className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{n.title}</span>
                {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </div>
              {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(n.created_at), "MMM d, HH:mm")}</p>
            </div>
            {!n.read && <Button size="sm" variant="ghost" onClick={()=>markRead(n.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Mark read</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
