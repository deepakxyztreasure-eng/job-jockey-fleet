import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ITEMS = [
  "Stay fit physically and mentally",
  "Vehicle is in good condition",
  "Load is properly secured",
  "Documents are ready",
  "Route is checked",
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function DriverChecklistDialog() {
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [driver, setDriver] = useState<{ id: string; full_name: string } | null>(null);
  const [checks, setChecks] = useState<boolean[]>(ITEMS.map(() => false));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (role !== "driver" || !user) return;
    (async () => {
      const { data: d } = await supabase
        .from("drivers")
        .select("id, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!d) return;
      setDriver(d);
      const { data: log } = await supabase
        .from("driver_checklist_logs")
        .select("id")
        .eq("driver_id", d.id)
        .eq("date", todayStr())
        .maybeSingle();
      if (!log) setOpen(true);
    })();
  }, [role, user]);

  const allChecked = checks.every(Boolean);

  const submit = async () => {
    if (!driver || !allChecked) return;
    setSubmitting(true);
    const { error } = await supabase.from("driver_checklist_logs").insert({
      driver_id: driver.id,
      date: todayStr(),
      checklist_completed: true,
    });
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }
    const now = new Date();
    supabase.functions.invoke("send-checklist-email", {
      body: {
        driverName: driver.full_name,
        driverId: driver.id,
        date: todayStr(),
        time: now.toLocaleTimeString(),
      },
    }).catch(() => {});
    toast.success("Checklist submitted");
    setOpen(false);
    setSubmitting(false);
  };

  if (role !== "driver") return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle>Daily Driver Checklist</DialogTitle>
          <DialogDescription>
            Please confirm all items before starting your day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {ITEMS.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <Checkbox
                id={`chk-${i}`}
                checked={checks[i]}
                onCheckedChange={(v) => {
                  const next = [...checks];
                  next[i] = !!v;
                  setChecks(next);
                }}
              />
              <Label htmlFor={`chk-${i}`} className="text-sm leading-tight cursor-pointer">
                {item}
              </Label>
            </div>
          ))}
        </div>
        <Button disabled={!allChecked || submitting} onClick={submit} className="w-full">
          {submitting ? "Submitting..." : "Submit Checklist"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
