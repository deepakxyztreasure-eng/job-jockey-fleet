import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { disablePush, enablePush, isPushEnabled, pushSupported } from "@/lib/push";

export default function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) return;
    isPushEnabled().then(setEnabled).catch(() => {});
  }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast.success("Notifications turned off");
      } else {
        const res = await enablePush();
        if (!res.ok) return toast.error(res.error ?? "Could not enable notifications");
        setEnabled(true);
        toast.success("Notifications enabled");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={enabled ? "secondary" : "outline"}
      disabled={busy}
      onClick={toggle}
      title={enabled ? "Notifications on" : "Enable notifications"}
    >
      {enabled ? <Bell className="h-4 w-4 sm:mr-1" /> : <BellOff className="h-4 w-4 sm:mr-1" />}
      <span className="hidden sm:inline">{enabled ? "Alerts on" : "Enable alerts"}</span>
    </Button>
  );
}
