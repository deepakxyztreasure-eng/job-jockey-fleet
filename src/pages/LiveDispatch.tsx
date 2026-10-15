import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import {
  Truck,
  MapPin,
  Clock,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Radio,
  Search,
  ExternalLink,
  Phone,
  Send,
  FileCheck,
  RefreshCw,
  Navigation,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

interface Driver {
  id: string;
  user_id?: string | null;
  full_name: string;
  phone?: string | null;
  vehicle?: string | null;
  active: boolean;
}

interface LocationFix {
  id?: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
  speed?: number | null;
  heading?: number | null;
}

interface ActiveJob {
  id: string;
  job_number?: number | null;
  title: string;
  assigned_driver_id?: string | null;
  status: string;
  pickup_address?: string | null;
  delivery_address?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  instructions?: string | null;
  proof_image_url?: string | null;
  completion_notes?: string | null;
  customer_signature_url?: string | null;
  customer_signature_name?: string | null;
  customer_pin?: string | null;
  weighbridge_docket_url?: string | null;
  gross_weight?: number | null;
  tare_weight?: number | null;
  net_weight?: number | null;
}

interface EmergencyAlert {
  id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: string;
}

interface ChecklistSignoff {
  id: string;
  driver_id: string;
  date: string;
  responses: Array<{ item_key: string; title: string; answer: string; notes?: string }>;
  signoff_status: string;
  submitted_at: string;
}

interface JobMessage {
  id: string;
  driver_id: string;
  sender_name: string;
  sender_role: string;
  message_text: string;
  created_at: string;
}

export default function LiveDispatch() {
  const { role, user } = useAuth();
  const { isLoaded: isMapsLoaded, loadError: mapsError } = useGoogleMaps();

  // State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Record<string, LocationFix>>({});
  const [activeJobs, setActiveJobs] = useState<Record<string, ActiveJob>>({});
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [pendingSignoffs, setPendingSignoffs] = useState<ChecklistSignoff[]>([]);
  const [etas, setEtas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Drawers
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDriver, setChatDriver] = useState<Driver | null>(null);
  const [chatMessages, setChatMessages] = useState<JobMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  // POD Verification / Complete Modal
  const [verifyJob, setVerifyJob] = useState<ActiveJob | null>(null);
  const [completing, setCompleting] = useState(false);

  // Morning Sign-off Modal
  const [signoffModal, setSignoffModal] = useState<ChecklistSignoff | null>(null);
  const [signoffActionLoading, setSignoffActionLoading] = useState(false);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const destMarkersRef = useRef<Map<string, any>>(new Map());
  const polylineRef = useRef<Map<string, any>>(new Map());

  // 1. Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      // Drivers
      const { data: drvData } = await supabase
        .from("drivers")
        .select("id, user_id, full_name, phone, vehicle, active")
        .eq("active", true)
        .order("full_name");
      if (drvData) setDrivers(drvData);

      // Jobs (active & in-progress)
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["in_progress", "accepted", "assigned", "completion_requested"]);
      if (jobData) {
        const jobMap: Record<string, ActiveJob> = {};
        jobData.forEach((j: ActiveJob) => {
          if (j.assigned_driver_id) {
            jobMap[j.assigned_driver_id] = j;
          }
        });
        setActiveJobs(jobMap);
      }

      // Latest Location for each driver
      const { data: locData } = await supabase
        .from("driver_locations")
        .select("*")
        .order("recorded_at", { ascending: false });

      if (locData) {
        const latestLocMap: Record<string, LocationFix> = {};
        locData.forEach((loc: LocationFix) => {
          if (!latestLocMap[loc.driver_id]) {
            latestLocMap[loc.driver_id] = loc;
          }
        });
        setLocations(latestLocMap);
      }

      // Active SOS Alerts
      try {
        const { data: sosData } = await supabase
          .from("emergency_alerts")
          .select("*")
          .eq("status", "active")
          .order("timestamp", { ascending: false });
        if (sosData) setEmergencies(sosData);
      } catch {}

      // Pending Morning Sign-offs
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: signoffData } = await supabase
          .from("driver_checklists")
          .select("*")
          .eq("checklist_type", "morning")
          .eq("date", today)
          .eq("signoff_status", "pending");
        if (signoffData) setPendingSignoffs(signoffData);
      } catch {}
    } catch (err) {
      console.error("Error loading live dispatch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Supabase Realtime Channels
    const channel = supabase
      .channel("dispatch-live-center")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_locations" },
        (payload: any) => {
          const newLoc = payload.new as LocationFix;
          setLocations((prev) => ({ ...prev, [newLoc.driver_id]: newLoc }));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          loadInitialData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_alerts" },
        (payload: any) => {
          if (payload.eventType === "INSERT" && payload.new.status === "active") {
            toast.error("🚨 EMERGENCY SOS ALERT: Driver pressed SOS!", { duration: 10000 });
          }
          loadInitialData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_checklists" },
        () => {
          loadInitialData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInitialData]);

  // 2. Google Map Initialization
  useEffect(() => {
    if (!isMapsLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Melbourne Victoria
    const defaultCenter = { lat: -37.8136, lng: 144.9631 };

    const map = new (window as any).google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    mapInstanceRef.current = map;
  }, [isMapsLoaded]);

  // 3. Update Markers & Polylines when Locations or Active Jobs Change
  useEffect(() => {
    if (!isMapsLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const gmaps = (window as any).google.maps;

    const bounds = new gmaps.LatLngBounds();
    let hasCoords = false;

    drivers.forEach((driver) => {
      const loc = locations[driver.id];
      const job = activeJobs[driver.id];
      const hasEmergency = emergencies.some((e) => e.driver_id === driver.id && e.status === "active");

      if (loc && loc.latitude && loc.longitude) {
        const pos = { lat: loc.latitude, lng: loc.longitude };
        bounds.extend(pos);
        hasCoords = true;

        // Truck Marker color based on status
        let fillColor = "#2563eb"; // blue: default/available
        if (hasEmergency) fillColor = "#dc2626"; // red: emergency
        else if (job && job.status === "in_progress") fillColor = "#16a34a"; // green: in transit
        else if (job) fillColor = "#f59e0b"; // amber: assigned/accepted

        const markerTitle = `${driver.full_name} (${driver.vehicle || "Truck"})`;

        // Update or create truck marker
        let marker = markersRef.current.get(driver.id);
        if (!marker) {
          marker = new gmaps.Marker({
            position: pos,
            map: map,
            title: markerTitle,
            icon: {
              path: "M 0,-15 L 12,10 L 0,5 L -12,10 Z", // Arrow / Heading needle
              fillColor: fillColor,
              fillOpacity: 1,
              scale: 1.4,
              strokeColor: "#ffffff",
              strokeWeight: 2,
              rotation: loc.heading || 0,
            },
            label: {
              text: driver.full_name.split(" ")[0],
              color: "#0f172a",
              fontWeight: "700",
              fontSize: "11px",
              className: "font-semibold bg-white/90 px-1 rounded shadow-sm",
            },
          });

          marker.addListener("click", () => {
            setSelectedDriver(driver);
          });

          markersRef.current.set(driver.id, marker);
        } else {
          marker.setPosition(pos);
          marker.setIcon({
            path: "M 0,-15 L 12,10 L 0,5 L -12,10 Z",
            fillColor: fillColor,
            fillOpacity: 1,
            scale: 1.4,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            rotation: loc.heading || 0,
          });
        }

        // Calculate Google Driving ETA to Customer Delivery Address if job is in progress
        if (job && job.delivery_address && !etas[driver.id]) {
          try {
            const service = new gmaps.DistanceMatrixService();
            service.getDistanceMatrix(
              {
                origins: [pos],
                destinations: [job.delivery_address],
                travelMode: gmaps.TravelMode.DRIVING,
              },
              (response: any, status: any) => {
                if (status === "OK" && response?.rows?.[0]?.elements?.[0]?.status === "OK") {
                  const element = response.rows[0].elements[0];
                  setEtas((prev) => ({
                    ...prev,
                    [driver.id]: `${element.duration.text} (${element.distance.text})`,
                  }));
                }
              }
            );
          } catch {}
        }
      }
    });

    if (hasCoords && mapInstanceRef.current && !selectedDriver) {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
      if (map.getZoom() > 14) map.setZoom(14);
    }
  }, [drivers, locations, activeJobs, emergencies, isMapsLoaded, etas, selectedDriver]);

  // Center Map on Driver
  const focusDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    const loc = locations[driver.id];
    if (loc && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
      mapInstanceRef.current.setZoom(15);
    } else {
      toast.info(`No active GPS fix yet for ${driver.full_name}`);
    }
  };

  // Open Chat with Driver
  const openChatWithDriver = async (driver: Driver) => {
    setChatDriver(driver);
    setChatOpen(true);
    try {
      const { data } = await supabase
        .from("job_messages")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: true });
      setChatMessages(data || []);
    } catch {}
  };

  // Send Dispatch Instruction Chat Message
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !chatDriver) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);

    try {
      const payload = {
        driver_id: chatDriver.id,
        sender_id: user?.id || "dispatch",
        sender_name: "Dispatch Office",
        sender_role: "dispatcher",
        message_text: text,
      };

      const { data, error } = await supabase.from("job_messages").insert(payload).select().single();
      if (!error && data) {
        setChatMessages((prev) => [...prev, data]);
        toast.success(`Instruction sent to ${chatDriver.full_name}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setChatSending(false);
    }
  };

  // Complete / Verify Job
  const handleCompleteJob = async () => {
    if (!verifyJob) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          status: "completed",
          verified_at: new Date().toISOString(),
          verified_by: user?.email || "dispatcher",
        })
        .eq("id", verifyJob.id);

      if (error) throw error;
      toast.success(`Job #${verifyJob.job_number || ""} marked as Completed & Verified!`);
      setVerifyJob(null);
      loadInitialData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete job");
    } finally {
      setCompleting(false);
    }
  };

  // Morning Checklist Sign-Off Action (Approve / Reject)
  const handleSignoffDecision = async (status: "approved" | "rejected") => {
    if (!signoffModal) return;
    setSignoffActionLoading(true);

    try {
      const { error } = await supabase
        .from("driver_checklists")
        .update({
          signoff_status: status,
          signoff_by: user?.email || "Super Admin",
          signoff_at: new Date().toISOString(),
        })
        .eq("id", signoffModal.id);

      if (error) throw error;

      toast.success(
        status === "approved"
          ? "Safety sign-off Approved. Driver has been notified to proceed."
          : "Vehicle Grounded. Driver prohibited from operating vehicle."
      );

      setSignoffModal(null);
      loadInitialData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit sign-off");
    } finally {
      setSignoffActionLoading(false);
    }
  };

  // Filtered Driver List
  const filteredDrivers = drivers.filter(
    (d) =>
      d.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.vehicle && d.vehicle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (activeJobs[d.id] && activeJobs[d.id].title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-3 sm:-m-6 bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Status Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-white shadow-md">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Live Fleet Dispatch Command Center</h2>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> REALTIME LIVE
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Live GPS tracking, auto ETAs, driver chat & POD verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs"
            onClick={loadInitialData}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Full Map */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Operations Sidebar */}
        <div className="w-full md:w-96 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Emergency SOS Banner (If any) */}
          {emergencies.length > 0 && (
            <div className="bg-red-950/80 border-b border-red-700/60 p-3 flex items-start gap-2.5 text-red-200 animate-pulse">
              <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-bold text-red-300">EMERGENCY SOS ACTIVE</p>
                <p>
                  Driver pressed SOS! Lat: {emergencies[0].latitude.toFixed(4)}, Lng: {emergencies[0].longitude.toFixed(4)}
                </p>
              </div>
            </div>
          )}

          {/* Morning Checklist Defect Sign-off Banner */}
          {pendingSignoffs.length > 0 && (
            <div className="bg-amber-950/80 border-b border-amber-700/60 p-3 flex items-start justify-between gap-2 text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-300">Safety Sign-off Required</p>
                  <p>{pendingSignoffs.length} driver reported defect this morning.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-600 bg-amber-900/60 text-amber-200 hover:bg-amber-800"
                onClick={() => setSignoffModal(pendingSignoffs[0])}
              >
                Review
              </Button>
            </div>
          )}

          {/* Search Box */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-slate-400" />
              <Input
                placeholder="Search driver, vehicle, or job..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-slate-900 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 h-9"
              />
            </div>
          </div>

          {/* Driver Fleet Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No drivers match your search.
              </div>
            ) : (
              filteredDrivers.map((driver) => {
                const loc = locations[driver.id];
                const job = activeJobs[driver.id];
                const eta = etas[driver.id];
                const hasEmergency = emergencies.some((e) => e.driver_id === driver.id && e.status === "active");

                return (
                  <Card
                    key={driver.id}
                    className={`bg-slate-900/90 border-slate-800 hover:border-slate-600 transition-all cursor-pointer ${
                      selectedDriver?.id === driver.id ? "ring-2 ring-orange-500 border-transparent" : ""
                    }`}
                    onClick={() => focusDriver(driver)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-white text-xs ${
                              hasEmergency
                                ? "bg-red-600 animate-bounce"
                                : job?.status === "in_progress"
                                ? "bg-emerald-600"
                                : job
                                ? "bg-amber-600"
                                : "bg-slate-700"
                            }`}
                          >
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-slate-100">{driver.full_name}</p>
                              {driver.vehicle && (
                                <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0">
                                  {driver.vehicle}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {driver.phone || "No phone listed"}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {hasEmergency ? (
                          <Badge className="bg-red-600 text-white text-[10px]">SOS ACTIVE</Badge>
                        ) : job?.status === "in_progress" ? (
                          <Badge className="bg-emerald-600 text-white text-[10px]">EN ROUTE</Badge>
                        ) : job?.status === "completion_requested" ? (
                          <Badge className="bg-purple-600 text-white text-[10px]">POD PENDING</Badge>
                        ) : job ? (
                          <Badge className="bg-amber-600 text-white text-[10px]">ASSIGNED</Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">
                            AVAILABLE
                          </Badge>
                        )}
                      </div>

                      {/* Active Run Info */}
                      {job && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-200">
                            <span className="font-semibold text-orange-400 truncate max-w-[200px]">
                              Job #{job.job_number || ""}: {job.title}
                            </span>
                          </div>
                          {job.delivery_address && (
                            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                              {job.delivery_address}
                            </p>
                          )}
                          {eta && (
                            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-emerald-400 shrink-0" />
                              ETA: {eta}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Speed & Last Ping */}
                      {loc && (
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                          <span className="flex items-center gap-1">
                            <Navigation className="h-2.5 w-2.5 text-blue-400" />
                            Speed: {loc.speed != null ? `${Math.round(loc.speed)} km/h` : "Stationary"}
                          </span>
                          <span>
                            {new Date(loc.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}

                      {/* Driver Action Buttons */}
                      <div className="mt-2.5 flex items-center gap-1.5 pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] bg-slate-800/60 hover:bg-slate-800 text-slate-200 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            focusDriver(driver);
                          }}
                        >
                          <Navigation className="h-3 w-3 mr-1 text-blue-400" /> Focus
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] bg-slate-800/60 hover:bg-slate-800 text-slate-200 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            openChatWithDriver(driver);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1 text-amber-400" /> Chat
                        </Button>

                        {job && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-300 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVerifyJob(job);
                            }}
                          >
                            <FileCheck className="h-3 w-3 mr-1 text-emerald-400" /> Verify
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Map Container */}
        <div className="flex-1 relative bg-slate-900 min-h-[400px]">
          {mapsError ? (
            <div className="h-full flex items-center justify-center p-6 text-center text-slate-400">
              <div>
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold">{mapsError}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Check your Google Maps API key configuration in .env
                </p>
              </div>
            </div>
          ) : !isMapsLoaded ? (
            <div className="h-full flex items-center justify-center p-6 text-center text-slate-400">
              <div>
                <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Loading Google Maps Satellite Engine...</p>
              </div>
            </div>
          ) : (
            <div ref={mapContainerRef} className="w-full h-full" />
          )}

          {/* Floating Map Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs space-y-1.5 backdrop-blur z-10 hidden sm:block">
            <p className="font-bold text-[11px] text-slate-300 uppercase tracking-wider">Fleet Status</p>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300">En Route to Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-300">Assigned / Pre-trip</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300">Available / Waiting</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-slate-300">Emergency Alert (SOS)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Way Chat Drawer */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="bg-slate-950 border-slate-800 text-slate-100 w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-slate-800">
            <SheetTitle className="text-base text-slate-100 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-400" />
              Dispatch Chat: {chatDriver?.full_name}
            </SheetTitle>
            <p className="text-xs text-slate-400">
              Real-time instructions sent directly to driver's native app
            </p>
          </SheetHeader>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-8">
                No message history with {chatDriver?.full_name}. Send an instruction below.
              </p>
            ) : (
              chatMessages.map((msg) => {
                const isDispatch = msg.sender_role === "dispatcher";
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col max-w-[85%] ${
                      isDispatch ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5">
                      {isDispatch ? "Dispatch (You)" : `${msg.sender_name} (Driver)`}
                    </span>
                    <div
                      className={`p-2.5 rounded-xl text-xs ${
                        isDispatch
                          ? "bg-orange-600 text-white rounded-br-none"
                          : "bg-slate-800 text-slate-100 rounded-bl-none"
                      }`}
                    >
                      {msg.message_text}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center gap-2">
            <Input
              placeholder="Type urgent note or route instruction..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
              className="bg-slate-950 border-slate-700 text-xs text-slate-100 placeholder:text-slate-500"
            />
            <Button
              size="sm"
              disabled={chatSending || !chatInput.trim()}
              onClick={handleSendChatMessage}
              className="bg-orange-600 hover:bg-orange-500 text-white px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Verify & Complete Run Modal */}
      <Dialog open={!!verifyJob} onOpenChange={() => setVerifyJob(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-emerald-400" />
              Verify & Complete Delivery
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Review proof of delivery, customer signature & weighbridge tonnage docket.
            </DialogDescription>
          </DialogHeader>

          {verifyJob && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <p className="font-bold text-sm text-slate-200">
                  Job #{verifyJob.job_number || ""}: {verifyJob.title}
                </p>
                <p className="text-slate-400 mt-1">Customer: {verifyJob.customer_name || "N/A"}</p>
                <p className="text-slate-400">Delivery Address: {verifyJob.delivery_address || "N/A"}</p>
                {verifyJob.completion_notes && (
                  <p className="text-amber-300 mt-1.5 font-medium">Notes: {verifyJob.completion_notes}</p>
                )}
              </div>

              {/* Delivery Proof Photo */}
              <div>
                <p className="font-semibold text-slate-300 mb-1">1. Delivery Photo (POD)</p>
                {verifyJob.proof_image_url ? (
                  <img
                    src={verifyJob.proof_image_url}
                    alt="Delivery proof"
                    className="w-full h-44 object-cover rounded-lg border border-slate-800"
                  />
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-500">
                    No photo uploaded by driver yet
                  </div>
                )}
              </div>

              {/* Customer Signature / PIN */}
              <div>
                <p className="font-semibold text-slate-300 mb-1">2. Customer Sign-off / PIN</p>
                {verifyJob.customer_signature_url ? (
                  <div className="bg-white p-2 rounded-lg border border-slate-800">
                    <img
                      src={verifyJob.customer_signature_url}
                      alt="Signature"
                      className="h-20 w-full object-contain"
                    />
                    {verifyJob.customer_signature_name && (
                      <p className="text-center text-[10px] text-slate-700 mt-1 font-semibold">
                        Signer: {verifyJob.customer_signature_name}
                      </p>
                    )}
                  </div>
                ) : verifyJob.customer_pin ? (
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-center font-mono font-bold text-emerald-400">
                    VERIFIED PIN: {verifyJob.customer_pin}
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center text-slate-500 text-[11px]">
                    Signature or PIN pending from driver
                  </div>
                )}
              </div>

              {/* Weighbridge Docket & Tonnage */}
              <div>
                <p className="font-semibold text-slate-300 mb-1">3. Weighbridge Docket & Weight</p>
                <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Gross Weight</span>
                    <span className="font-bold text-slate-200">{verifyJob.gross_weight ?? "—"} t</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Tare Weight</span>
                    <span className="font-bold text-slate-200">{verifyJob.tare_weight ?? "—"} t</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Net Weight</span>
                    <span className="font-bold text-emerald-400">{verifyJob.net_weight ?? "—"} t</span>
                  </div>
                </div>

                {verifyJob.weighbridge_docket_url && (
                  <img
                    src={verifyJob.weighbridge_docket_url}
                    alt="Docket scan"
                    className="w-full h-36 object-cover rounded-lg border border-slate-800"
                  />
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVerifyJob(null)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={completing}
              onClick={handleCompleteJob}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {completing ? "Completing..." : "Approve & Mark Completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Morning Checklist Defect Review & Sign-Off Modal */}
      <Dialog open={!!signoffModal} onOpenChange={() => setSignoffModal(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Morning Checklist Defect Sign-Off
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Driver reported a safety issue during morning clock-in. Review before clearing to drive.
            </DialogDescription>
          </DialogHeader>

          {signoffModal && (
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <p className="text-slate-300">
                  <span className="font-semibold text-white">Date:</span> {signoffModal.date}
                </p>
                <p className="text-slate-300">
                  <span className="font-semibold text-white">Submitted:</span>{" "}
                  {new Date(signoffModal.submitted_at).toLocaleTimeString()}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-300">Checklist Responses:</p>
                {(signoffModal.responses || []).map((resp, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded border text-[11px] ${
                      resp.answer === "no"
                        ? "bg-red-950/50 border-red-700 text-red-200"
                        : "bg-slate-900 border-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{resp.title}</span>
                      <Badge className={resp.answer === "no" ? "bg-red-600" : "bg-emerald-600"}>
                        {resp.answer.toUpperCase()}
                      </Badge>
                    </div>
                    {resp.notes && (
                      <p className="mt-1 font-mono text-[10px] text-amber-300">
                        Driver Note: {resp.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={signoffActionLoading}
              onClick={() => handleSignoffDecision("rejected")}
            >
              <XCircle className="h-4 w-4 mr-1" /> Ground Vehicle
            </Button>
            <Button
              size="sm"
              disabled={signoffActionLoading}
              onClick={() => handleSignoffDecision("approved")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Drive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
