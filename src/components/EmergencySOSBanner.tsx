import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  Phone,
  MapPin,
  Volume2,
  VolumeX,
  CheckCircle,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

interface EmergencyAlertRecord {
  id: string;
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  latitude: number;
  longitude: number;
  location_address?: string;
  status: "active" | "acknowledged" | "resolved";
  timestamp: string;
}

export default function EmergencySOSBanner() {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState<EmergencyAlertRecord | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  // True once the browser AudioContext has been unlocked by a user gesture
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscRef = useRef<OscillatorNode | null>(null);
  const sirenIntervalRef = useRef<any>(null);
  // Keep latest isMuted + audioUnlocked accessible inside realtime callbacks (avoids stale closure)
  const isMutedRef = useRef(isMuted);
  const audioUnlockedRef = useRef(audioUnlocked);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { audioUnlockedRef.current = audioUnlocked; }, [audioUnlocked]);

  // ── Oscillator helpers ──────────────────────────────────────────────────────

  const startSirenOscillator = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || sirenOscRef.current) return; // already playing

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    sirenOscRef.current = osc;

    let high = false;
    sirenIntervalRef.current = setInterval(() => {
      if (!sirenOscRef.current || !audioCtxRef.current) return;
      high = !high;
      sirenOscRef.current.frequency.setTargetAtTime(
        high ? 950 : 700,
        audioCtxRef.current.currentTime,
        0.15
      );
    }, 500);
  }, []);

  const stopSirenAudio = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }
    if (sirenOscRef.current) {
      try { sirenOscRef.current.stop(); sirenOscRef.current.disconnect(); } catch {}
      sirenOscRef.current = null;
    }
  }, []);

  /**
   * Attempt to start the siren.
   * If AudioContext is still suspended (browser autoplay policy), do nothing —
   * the user will see the "Enable Siren" button and can click it to unlock.
   */
  const startSirenAudio = useCallback(() => {
    if (isMutedRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        // Can't play yet — waiting for user gesture (the "Enable Siren" button)
        return;
      }
      setAudioUnlocked(true);
      startSirenOscillator();
    } catch (e) {
      console.warn("Audio siren notice:", e);
    }
  }, [startSirenOscillator]);

  // Ref so realtime callbacks always call the latest version
  const startSirenAudioRef = useRef(startSirenAudio);
  useEffect(() => { startSirenAudioRef.current = startSirenAudio; }, [startSirenAudio]);

  /**
   * Called when admin clicks "Enable Siren" button.
   * This IS a user gesture, so AudioContext can be resumed.
   */
  const unlockAndStartSiren = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      audioCtxRef.current.resume().then(() => {
        setAudioUnlocked(true);
        startSirenOscillator();
      }).catch(() => {});
    } catch (e) {
      console.warn("Audio unlock notice:", e);
    }
  };

  // ── Alert fetcher ───────────────────────────────────────────────────────────

  const checkActiveAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("emergency_alerts")
        .select("*")
        .eq("status", "active")
        .order("timestamp", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setActiveAlert(data[0] as EmergencyAlertRecord);
        startSirenAudioRef.current();
      } else {
        setActiveAlert(null);
        stopSirenAudio();
      }
    } catch {
      setActiveAlert(null);
      stopSirenAudio();
    }
  }, [stopSirenAudio]);

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    checkActiveAlerts();

    // 1. Realtime WebSocket broadcast (sub-second)
    const broadcastChannel = supabase
      .channel("dispatch-emergency-broadcast")
      .on("broadcast", { event: "emergency_sos" }, (payload: any) => {
        if (payload?.payload) {
          const alert = payload.payload as EmergencyAlertRecord;
          setActiveAlert(alert);
          startSirenAudioRef.current();
          toast.error(`🚨 EMERGENCY SOS: ${alert.driver_name || "Driver"} pressed SOS!`, {
            duration: 15000,
          });
        }
      })
      .subscribe();

    // 2. Postgres DB change listener (catches any client)
    const dbChannel = supabase
      .channel("emergency-alerts-db-events")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_alerts" },
        (payload: any) => {
          if (payload.eventType === "INSERT" && payload.new.status === "active") {
            setActiveAlert(payload.new as EmergencyAlertRecord);
            startSirenAudioRef.current();
            toast.error(
              `🚨 EMERGENCY SOS: ${payload.new.driver_name || "Driver"} pressed SOS!`,
              { duration: 15000 }
            );
          } else if (payload.eventType === "UPDATE") {
            checkActiveAlerts();
          }
        }
      )
      .subscribe();

    // 3. Periodic fallback poll every 20 s — catches missed realtime events
    const pollInterval = setInterval(() => checkActiveAlerts(), 20000);

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
      clearInterval(pollInterval);
      stopSirenAudio();
    };
  }, [checkActiveAlerts, stopSirenAudio]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleMuteToggle = () => {
    if (isMuted) {
      setIsMuted(false);
      startSirenAudioRef.current();
    } else {
      setIsMuted(true);
      stopSirenAudio();
    }
  };

  const handleResolveAlert = async () => {
    if (!activeAlert) return;
    stopSirenAudio();
    try {
      await supabase
        .from("emergency_alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", activeAlert.id);

      toast.success("Emergency alert resolved & cleared.");
      setActiveAlert(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve alert");
    }
  };

  if (!activeAlert) return null;

  const sirenIsPlaying = !isMuted && audioUnlocked;
  const needsAudioUnlock = !isMuted && !audioUnlocked;

  return (
    <div className="bg-red-600 text-white px-4 py-2.5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 animate-pulse border-b-2 border-red-900 z-50 sticky top-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-red-950/80 flex items-center justify-center shrink-0 border border-white/40">
          <ShieldAlert className="h-5 w-5 text-red-200 animate-bounce" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold tracking-wide text-xs sm:text-sm uppercase bg-red-900 px-2 py-0.5 rounded text-red-100">
              🚨 CRITICAL EMERGENCY SOS ACTIVE
            </span>
            <span className="font-bold text-sm truncate">
              {activeAlert.driver_name || "Driver in Distress"}
            </span>
          </div>
          <p className="text-xs text-red-100 flex items-center gap-2 mt-0.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            Lat: {activeAlert.latitude.toFixed(4)}, Lng: {activeAlert.longitude.toFixed(4)}
            {activeAlert.driver_phone && (
              <span className="hidden sm:inline">| Phone: {activeAlert.driver_phone}</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          className="bg-white text-red-700 hover:bg-red-50 text-xs font-bold gap-1 shadow-sm h-8"
          onClick={() => navigate("/dispatch")}
        >
          <MapPin className="h-3.5 w-3.5" /> Locate on Live Map
        </Button>

        {activeAlert.driver_phone && (
          <Button
            size="sm"
            variant="outline"
            className="border-white/50 text-white bg-red-800/80 hover:bg-red-800 text-xs gap-1 h-8"
            onClick={() => (window.location.href = `tel:${activeAlert.driver_phone}`)}
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </Button>
        )}

        {/* Audio unlock button — shown when browser has blocked autoplay */}
        {needsAudioUnlock && (
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-300 text-yellow-200 bg-red-900/80 hover:bg-red-800 text-xs gap-1 h-8 animate-none font-bold"
            onClick={unlockAndStartSiren}
          >
            <Bell className="h-3.5 w-3.5" /> Enable Siren
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="border-white/50 text-white bg-red-800/80 hover:bg-red-800 text-xs gap-1 h-8"
          onClick={handleMuteToggle}
        >
          {isMuted ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {isMuted ? "Unmute" : "Mute Siren"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="border-white/50 text-white bg-red-900/90 hover:bg-red-950 text-xs gap-1 h-8"
          onClick={handleResolveAlert}
        >
          <CheckCircle className="h-3.5 w-3.5" /> Resolve Alert
        </Button>
      </div>
    </div>
  );
}
