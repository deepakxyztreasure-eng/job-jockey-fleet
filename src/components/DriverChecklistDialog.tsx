import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ITEMS = [
  {
    title: "Stay fit, physically and mentally",
    description:
      "Don't drink alcohol before driving or take any kind of drugs which may impair your driving skills. Avoid heavy meals before driving, as these can make you feel drowsy.",
  },
  {
    title: "Make sure the vehicle is in good working order",
    description:
      "Check the brakes and brake lines, tires pressure and tread depth, coolant and oil, mirrors, windows, windscreen wipers, lights, indicators, and also emergency equipment.",
  },
  {
    title: "Check the load",
    description:
      "Make sure the load is evenly distributed and properly secured. If necessary, redistribute and secure it again if you unload part of it before your final destination.",
  },
  {
    title: "Check the documents and recording devices",
    description:
      "Bring the right documents. Remember to insert the tachograph disk/card. Have the legally required disks on board.",
  },
  {
    title: "Check your route",
    description:
      "Anticipate any bridges, tunnels, etc. where your vehicle might have a problem (dimensions, weight, dangerous goods). Plan your breaks and check weather conditions.",
  },
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
    toast.success("Checklist submitted successfully. Drive safely.");
    setOpen(false);
    setSubmitting(false);
  };

  if (role !== "driver") return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-lg p-0 gap-0 max-h-[90vh] flex flex-col [&>button]:hidden backdrop-blur-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Daily Driver Safety Checklist</DialogTitle>
          </div>
          <DialogDescription>
            Please review and confirm all items below before starting your day. This is required once per day.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {ITEMS.map((item, i) => (
            <label
              key={i}
              htmlFor={`chk-${i}`}
              className="flex items-start gap-3 cursor-pointer rounded-md p-3 -mx-1 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={`chk-${i}`}
                checked={checks[i]}
                onCheckedChange={(v) => {
                  const next = [...checks];
                  next[i] = !!v;
                  setChecks(next);
                }}
                className="mt-1"
              />
              <div className="space-y-1">
                <div className="font-semibold text-sm leading-snug">{item.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="p-4 border-t bg-background">
          <Button
            disabled={!allChecked || submitting}
            onClick={submit}
            className="w-full h-11 text-base font-semibold"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting Checklist...
              </>
            ) : (
              "Submit Checklist"
            )}
          </Button>
          {!allChecked && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Please confirm all {ITEMS.length} items to continue
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
