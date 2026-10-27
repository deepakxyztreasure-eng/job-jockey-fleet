import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  ClipboardList,
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

function createTruckSvg(fillColor: string, heading: number = 0, isEmergency: boolean = false) {
  const rot = heading || 0;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.45"/>
        </filter>
      </defs>
      <!-- Radar Pulse Ripple (Ola/Uber/Swiggy Live Telemetry Beacon) -->
      <circle cx="23" cy="23" r="21" fill="${isEmergency ? "#ef4444" : fillColor}" fill-opacity="0.22" stroke="${isEmergency ? "#ef4444" : fillColor}" stroke-width="1.5" stroke-dasharray="3,3"/>

      <!-- Rotated Heavy Tipper Truck Body -->
      <g transform="rotate(${rot} 23 23)" filter="url(#shadow)">
        <!-- Heavy Dual Wheels -->
        <rect x="9" y="13" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>
        <rect x="33.5" y="13" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>
        <rect x="9" y="23" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>
        <rect x="33.5" y="23" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>
        <rect x="9" y="30.5" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>
        <rect x="33.5" y="30.5" width="3.5" height="6.5" rx="1.5" fill="#0f172a"/>

        <!-- Tipper Bin Body (Rear) -->
        <rect x="12.5" y="19" width="21" height="18.5" rx="2" fill="${fillColor}" stroke="#ffffff" stroke-width="1.8"/>
        <!-- Steel Ribs -->
        <line x1="12.5" y1="25" x2="33.5" y2="25" stroke="#ffffff" stroke-width="1" stroke-opacity="0.6"/>
        <line x1="12.5" y1="31" x2="33.5" y2="31" stroke="#ffffff" stroke-width="1" stroke-opacity="0.6"/>

        <!-- Truck Cab (Front) -->
        <path d="M 13.5 19 L 13.5 12 C 13.5 9 15.5 7 18.5 7 L 27.5 7 C 30.5 7 32.5 9 32.5 12 L 32.5 19 Z" fill="#0f172a" stroke="#ffffff" stroke-width="1.8"/>
        <!-- Panoramic Windshield -->
        <path d="M 15.5 14 L 15.5 11 C 15.5 9.5 16.5 8.5 19 8.5 L 27 8.5 C 29.5 8.5 30.5 9.5 30.5 11 L 30.5 14 Z" fill="#38bdf8"/>
        <!-- Headlights -->
        <circle cx="16.5" cy="7.5" r="1.3" fill="#fef08a"/>
        <circle cx="29.5" cy="7.5" r="1.3" fill="#fef08a"/>
      </g>
    </svg>
  `)}`;
}

function createPinSvg(label: string, color: string = "#dc2626") {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <defs>
        <filter id="pShad" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.4"/>
        </filter>
      </defs>
      <path d="M 16 0 C 7.16 0 0 7.16 0 16 C 0 28 16 42 16 42 C 16 42 32 28 32 16 C 32 7.16 24.84 0 16 0 Z" fill="${color}" stroke="#ffffff" stroke-width="2" filter="url(#pShad)"/>
      <circle cx="16" cy="15" r="9" fill="#ffffff"/>
      <text x="16" y="19" font-family="Arial, sans-serif" font-size="11" font-weight="900" fill="${color}" text-anchor="middle">${label}</text>
    </svg>
  `)}`;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCAPYcCyZfs_3qpFv09bcU3VRRdoEwAIek";

interface LiveRouteResult {
  path: Array<{ lat: number; lng: number }>;
  destCoords: { lat: number; lng: number };
  durationText: string;
  distanceText: string;
}

// Multi-Tier Live Route Fetcher: Routes API v2 -> Geocoding Fallback
async function fetchLiveTravelingRoute(
  originLat: number,
  originLng: number,
  destinationAddress: string
): Promise<LiveRouteResult | null> {
  if (!originLat || !originLng || !destinationAddress) return null;

  // Tier 1: Modern Google Routes API v2
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { address: destinationAddress },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        const gmaps = (window as any).google?.maps;
        let path: Array<{ lat: number; lng: number }> = [];

        if (route.polyline?.encodedPolyline && gmaps?.geometry?.encoding) {
          const decoded = gmaps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
          path = decoded.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
        }

        const durationSec = parseInt((route.duration || "0s").replace("s", ""), 10) || 60;
        const distMeters = route.distanceMeters || 0;
        const durationText =
          durationSec >= 3600
            ? `${Math.floor(durationSec / 3600)}h ${Math.round((durationSec % 3600) / 60)}m`
            : `${Math.max(1, Math.round(durationSec / 60))} mins`;
        const distanceText =
          distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(1)} km`
            : `${distMeters} m`;

        const destCoords =
          path.length > 0
            ? path[path.length - 1]
            : { lat: originLat, lng: originLng };

        return { path, destCoords, durationText, distanceText };
      }
    }
  } catch (err) {
    console.warn("Routes API note:", err);
  }

  // Tier 2: Geocoding + Geodesic Navigation Fallback (Guarantees visible line for remote sites/quarries)
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destinationAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();
    if (geoData.status === "OK" && geoData.results?.[0]?.geometry?.location) {
      const loc = geoData.results[0].geometry.location;
      const destCoords = { lat: loc.lat, lng: loc.lng };
      const dLat = ((destCoords.lat - originLat) * Math.PI) / 180;
      const dLng = ((destCoords.lng - originLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((originLat * Math.PI) / 180) *
          Math.cos((destCoords.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = 6371 * c * 1.3;
      const durationMins = Math.max(2, Math.round((distKm / 45) * 60));

      return {
        path: [
          { lat: originLat, lng: originLng },
          { lat: destCoords.lat, lng: destCoords.lng },
        ],
        destCoords,
        durationText: `${durationMins} mins`,
        distanceText: `${distKm.toFixed(1)} km`,
      };
    }
  } catch (geoErr) {
    console.warn("Geocoding fallback note:", geoErr);
  }

  return null;
}

async function geocodeAddressCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address) return null;
  try {
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(geoUrl);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      return { lat: data.results[0].geometry.location.lat, lng: data.results[0].geometry.location.lng };
    }
  } catch {}
  return null;
}

export default function LiveDispatch() {
  const navigate = useNavigate();
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
  const [resolvedProofUrl, setResolvedProofUrl] = useState<string | null>(null);
  const [resolvedSigUrl, setResolvedSigUrl] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!verifyJob) {
      setResolvedProofUrl(null);
      setResolvedSigUrl(null);
      return;
    }

    const resolveUrl = async (urlOrPath?: string | null): Promise<string | null> => {
      if (!urlOrPath) return null;
      if (urlOrPath.startsWith("data:")) return urlOrPath;
      const isPublicStorage = urlOrPath.includes("/storage/v1/object/public/job-proofs/") || urlOrPath.includes("/storage/v1/object/authenticated/job-proofs/");
      if (!isPublicStorage && (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://"))) {
        return urlOrPath;
      }
      const cleanPath = urlOrPath.replace(/^job-proofs\//, "").replace(/^.*\/storage\/v1\/object\/(?:public|authenticated)\/job-proofs\//, "");
      const { data } = await supabase.storage.from("job-proofs").createSignedUrl(cleanPath, 60 * 10);
      return data?.signedUrl || null;
    };

    resolveUrl(verifyJob.proof_image_url).then(setResolvedProofUrl);

    const directSig = verifyJob.customer_signature_url;
    const embeddedMatch = verifyJob.completion_notes?.match(/\[Customer Signature:\s*([^\]]+)\]/);
    const sigRaw = directSig || (embeddedMatch ? embeddedMatch[1].trim() : null);
    resolveUrl(sigRaw).then(setResolvedSigUrl);
  }, [verifyJob]);

  // Morning Sign-off Modal
  const [signoffModal, setSignoffModal] = useState<ChecklistSignoff | null>(null);
  const [signoffActionLoading, setSignoffActionLoading] = useState(false);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const destMarkersRef = useRef<Map<string, any>>(new Map());
  const pickupMarkersRef = useRef<Map<string, any>>(new Map());
  const polylineRef = useRef<Map<string, any>>(new Map());
  const trailPolylineRef = useRef<Map<string, any>>(new Map());
  const destCoordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const pickupCoordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const routeCacheRef = useRef<Map<string, { result: LiveRouteResult; timestamp: number }>>(new Map());
  const directionsServiceRef = useRef<any>(null);
  const chatChannelRef = useRef<any>(null);

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

      // Jobs (active & in-progress, prioritized)
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .in("status", ["in_progress", "accepted", "assigned", "completion_requested"]);
      if (jobData) {
        const statusRank: Record<string, number> = {
          in_progress: 4,
          completion_requested: 3,
          accepted: 2,
          assigned: 1,
        };

        const jobMap: Record<string, ActiveJob> = {};
        jobData.forEach((j: ActiveJob) => {
          if (j.assigned_driver_id) {
            const existing = jobMap[j.assigned_driver_id];
            const currentRank = statusRank[j.status] || 0;
            const existingRank = existing ? statusRank[existing.status] || 0 : -1;
            if (currentRank > existingRank) {
              jobMap[j.assigned_driver_id] = j;
            }
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

  // 3. Update Markers & Polylines when Locations or Active Jobs Change (Ola/Uber/Zomato style)
  useEffect(() => {
    if (!isMapsLoaded || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const gmaps = (window as any).google.maps;

    const bounds = new gmaps.LatLngBounds();
    let hasCoords = false;

    // Initialize DirectionsService if not yet created
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new gmaps.DirectionsService();
    }
    const directionsService = directionsServiceRef.current;

    drivers.forEach((driver) => {
      const loc = locations[driver.id];
      const job = activeJobs[driver.id];
      const hasEmergency = emergencies.some((e) => e.driver_id === driver.id && e.status === "active");

      if (loc && loc.latitude && loc.longitude) {
        const pos = { lat: loc.latitude, lng: loc.longitude };
        bounds.extend(pos);
        hasCoords = true;

        // Color coding: Blue (Available), Green (In Transit), Amber (Assigned), Red (Emergency SOS)
        let fillColor = "#2563eb";
        if (hasEmergency) fillColor = "#dc2626";
        else if (job && job.status === "in_progress") fillColor = "#16a34a";
        else if (job) fillColor = "#f59e0b";

        const markerTitle = `${driver.full_name} (${driver.vehicle || "Truck"})`;
        const truckIconUrl = createTruckSvg(fillColor, loc.heading || 0, hasEmergency);

        const driverLabel = {
          text: `${driver.full_name.split(" ")[0]}${loc.speed != null ? ` • ${Math.round(loc.speed)}km/h` : ""}`,
          color: "#ffffff",
          fontWeight: "700",
          fontSize: "11px",
          className: "bg-slate-900/95 text-white font-bold px-2 py-0.5 rounded shadow border border-slate-700 text-[10px]",
        };

        // 1. Heavy Tipper Truck Marker with Dynamic Heading Rotation
        let marker = markersRef.current.get(driver.id);
        if (!marker) {
          marker = new gmaps.Marker({
            position: pos,
            map: map,
            title: markerTitle,
            icon: {
              url: truckIconUrl,
              scaledSize: new gmaps.Size(46, 46),
              anchor: new gmaps.Point(23, 23),
            },
            label: driverLabel,
          });

          marker.addListener("click", () => {
            setSelectedDriver(driver);
          });

          markersRef.current.set(driver.id, marker);
        } else {
          marker.setPosition(pos);
          marker.setIcon({
            url: truckIconUrl,
            scaledSize: new gmaps.Size(46, 46),
            anchor: new gmaps.Point(23, 23),
          });
          marker.setLabel(driverLabel);
        }

        // 2. Start-to-End Live Traveling Polyline (Ola / Uber / Swiggy Style)
        if (job && job.delivery_address) {
          const cacheKey = `${driver.id}_${job.id}_${pos.lat.toFixed(3)}_${pos.lng.toFixed(3)}`;
          const cached = routeCacheRef.current.get(cacheKey);

          const applyRoute = (routeData: LiveRouteResult) => {
            // Update Live ETA
            setEtas((prev) => ({
              ...prev,
              [driver.id]: `${routeData.durationText} (${routeData.distanceText})`,
            }));

            destCoordsRef.current.set(driver.id, routeData.destCoords);

            // Destination Pin "B" (Customer Delivery Site)
            let destMarker = destMarkersRef.current.get(driver.id);
            if (!destMarker) {
              destMarker = new gmaps.Marker({
                position: routeData.destCoords,
                map: map,
                title: `Destination: ${job.delivery_address}`,
                icon: {
                  url: createPinSvg("B", "#dc2626"),
                  scaledSize: new gmaps.Size(32, 42),
                  anchor: new gmaps.Point(16, 42),
                },
              });
              destMarkersRef.current.set(driver.id, destMarker);
            } else {
              destMarker.setPosition(routeData.destCoords);
              destMarker.setMap(map);
            }

            // Draw Active Traveling Road Polyline (Truck -> Customer Site)
            let poly = polylineRef.current.get(driver.id);
            if (poly) poly.setMap(null);

            poly = new gmaps.Polyline({
              path: routeData.path,
              geodesic: true,
              strokeColor: "#2563eb",
              strokeOpacity: 0.95,
              strokeWeight: 5,
              map: map,
            });
            polylineRef.current.set(driver.id, poly);
          };

          if (cached && Date.now() - cached.timestamp < 30000) {
            applyRoute(cached.result);
          } else {
            fetchLiveTravelingRoute(pos.lat, pos.lng, job.delivery_address).then((res) => {
              if (res) {
                routeCacheRef.current.set(cacheKey, { result: res, timestamp: Date.now() });
                applyRoute(res);
              }
            });
          }

          // Start Point "A" (Quarry / Depot) & Traveled Trail
          if (job.pickup_address) {
            const handlePickupPin = (pCoords: { lat: number; lng: number }) => {
              pickupCoordsRef.current.set(driver.id, pCoords);

              let pickMarker = pickupMarkersRef.current.get(driver.id);
              if (!pickMarker) {
                pickMarker = new gmaps.Marker({
                  position: pCoords,
                  map: map,
                  title: `Pickup Quarry: ${job.pickup_address}`,
                  icon: {
                    url: createPinSvg("A", "#f59e0b"),
                    scaledSize: new gmaps.Size(32, 42),
                    anchor: new gmaps.Point(16, 42),
                  },
                });
                pickupMarkersRef.current.set(driver.id, pickMarker);
              } else {
                pickMarker.setPosition(pCoords);
                pickMarker.setMap(map);
              }

              // Traveled Trail: subtle dashed line connecting Start Point "A" to moving Truck
              let trailPoly = trailPolylineRef.current.get(driver.id);
              if (trailPoly) trailPoly.setMap(null);

              trailPoly = new gmaps.Polyline({
                path: [pCoords, pos],
                geodesic: true,
                strokeColor: "#64748b",
                strokeOpacity: 0.65,
                strokeWeight: 3,
                map: map,
              });
              trailPolylineRef.current.set(driver.id, trailPoly);
            };

            const existingPCoords = pickupCoordsRef.current.get(driver.id);
            if (existingPCoords) {
              handlePickupPin(existingPCoords);
            } else {
              geocodeAddressCoordinates(job.pickup_address).then((pCoords) => {
                if (pCoords) handlePickupPin(pCoords);
              });
            }
          }
        } else {
          // Clean up old route if job is completed or none
          const oldPoly = polylineRef.current.get(driver.id);
          if (oldPoly) {
            oldPoly.setMap(null);
            polylineRef.current.delete(driver.id);
          }
          const oldTrail = trailPolylineRef.current.get(driver.id);
          if (oldTrail) {
            oldTrail.setMap(null);
            trailPolylineRef.current.delete(driver.id);
          }
          const oldDest = destMarkersRef.current.get(driver.id);
          if (oldDest) {
            oldDest.setMap(null);
            destMarkersRef.current.delete(driver.id);
          }
          const oldPick = pickupMarkersRef.current.get(driver.id);
          if (oldPick) {
            oldPick.setMap(null);
            pickupMarkersRef.current.delete(driver.id);
          }
        }
      }
    });

    if (hasCoords && mapInstanceRef.current && !selectedDriver) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      if (map.getZoom() > 14) map.setZoom(14);
    }
  }, [drivers, locations, activeJobs, emergencies, isMapsLoaded, selectedDriver]);

  // Center Map on Driver & Auto-Frame Entire Trip (Start Point -> Truck -> Destination)
  const focusDriver = (driver: Driver) => {
    setSelectedDriver(driver);
    const loc = locations[driver.id];
    if (loc && mapInstanceRef.current) {
      const gmaps = (window as any).google?.maps;
      if (gmaps) {
        const bounds = new gmaps.LatLngBounds();
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });

        const dCoords = destCoordsRef.current.get(driver.id);
        if (dCoords) bounds.extend(dCoords);

        const pCoords = pickupCoordsRef.current.get(driver.id);
        if (pCoords) bounds.extend(pCoords);

        mapInstanceRef.current.fitBounds(bounds, { top: 90, bottom: 90, left: 90, right: 90 });
        if (mapInstanceRef.current.getZoom() > 15) mapInstanceRef.current.setZoom(15);
      } else {
        mapInstanceRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
        mapInstanceRef.current.setZoom(15);
      }
    } else {
      toast.info(`No active GPS fix yet for ${driver.full_name}`);
    }
  };

  // Open Chat with Driver (with Supabase Realtime Broadcast & DB Fallback)
  const openChatWithDriver = async (driver: Driver) => {
    setChatDriver(driver);
    setChatOpen(true);

    // 1. Load history from DB if available
    try {
      const { data, error } = await supabase
        .from("job_messages")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        setChatMessages(data);
      } else {
        setChatMessages([]);
      }
    } catch {
      setChatMessages([]);
    }

    // 2. Setup Realtime Broadcast channel (enables instant peer-to-peer WebSocket chat without DB table)
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
    }

    const channelName = `dispatch-chat-${driver.id}`;
    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "dispatch_message" }, (payload: any) => {
        if (payload?.payload) {
          const newMsg = payload.payload as JobMessage;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_messages",
          filter: `driver_id=eq.${driver.id}`,
        },
        (payload: any) => {
          const newMsg = payload.new as JobMessage;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    chatChannelRef.current = channel;
  };

  // Send Dispatch Instruction Chat Message
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !chatDriver) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);

    const tempId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msg: JobMessage = {
      id: tempId,
      driver_id: chatDriver.id,
      sender_id: user?.id || "dispatch",
      sender_name: "Dispatch Office",
      sender_role: "dispatcher",
      message_text: text,
      created_at: new Date().toISOString(),
    };

    // Show immediately in dispatch UI
    setChatMessages((prev) => [...prev, msg]);

    // Broadcast over WebSocket directly to driver mobile app
    if (chatChannelRef.current) {
      chatChannelRef.current.send({
        type: "broadcast",
        event: "dispatch_message",
        payload: msg,
      });
    }

    // Fire DB insert in background — don't block UI on it
    supabase.from("job_messages").insert({
      driver_id: chatDriver.id,
      sender_id: user?.id || "dispatch",
      sender_name: "Dispatch Office",
      sender_role: "dispatcher",
      message_text: text,
    }).then(() => {}).catch(() => {});

    setChatSending(false);
    toast.success(`Instruction sent to ${chatDriver.full_name}`);
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
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 text-xs gap-1"
            onClick={() => navigate("/checkout-logs")}
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Checklist & Timesheets
          </Button>
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

          {/* Floating Live Trip Progress Card (Ola/Uber/Zomato Style) */}
          {selectedDriver && (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[460px] bg-slate-950/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md p-4 text-slate-100 z-20 transition-all animate-in fade-in slide-in-from-bottom-4">
              {/* Header: Driver info + Speed + Close */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-bold text-white shadow">
                      {selectedDriver.full_name.charAt(0)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">{selectedDriver.full_name}</h3>
                      {selectedDriver.vehicle && (
                        <Badge className="bg-slate-800 text-slate-300 text-[10px] py-0 border-slate-700">
                          {selectedDriver.vehicle}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span>📞 {selectedDriver.phone || "No phone"}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">
                        {locations[selectedDriver.id]?.speed != null
                          ? `${Math.round(locations[selectedDriver.id]!.speed!)} km/h`
                          : "Stationary"}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white rounded-full"
                  onClick={() => setSelectedDriver(null)}
                >
                  ✕
                </Button>
              </div>

              {/* Trip Stepper & ETA (Ola/Uber/Zomato style) */}
              {activeJobs[selectedDriver.id] ? (
                <div className="py-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-400">
                      Job #{activeJobs[selectedDriver.id].job_number || ""}: {activeJobs[selectedDriver.id].title}
                    </span>
                    {etas[selectedDriver.id] && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2 py-0.5 font-semibold">
                        ⏱️ {etas[selectedDriver.id]}
                      </Badge>
                    )}
                  </div>

                  {/* Visual Route Line: A -> Truck -> B */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 space-y-2">
                    {/* Pickup Point A */}
                    <div className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-amber-500/20 border border-amber-500 text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        A
                      </span>
                      <div className="text-xs flex-1 min-w-0">
                        <p className="text-slate-400 text-[10px] font-semibold uppercase">Pickup / Quarry</p>
                        <p className="text-slate-200 font-medium truncate">
                          {activeJobs[selectedDriver.id].pickup_address || "Quarry / Depot"}
                        </p>
                      </div>
                    </div>

                    {/* Dotted connector */}
                    <div className="ml-2.5 border-l-2 border-dashed border-blue-500/60 h-3" />

                    {/* Destination Point B */}
                    <div className="flex items-start gap-2.5">
                      <span className="h-5 w-5 rounded-full bg-red-500/20 border border-red-500 text-red-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        B
                      </span>
                      <div className="text-xs flex-1 min-w-0">
                        <p className="text-slate-400 text-[10px] font-semibold uppercase">Delivery Customer Site</p>
                        <p className="text-slate-200 font-medium truncate">
                          {activeJobs[selectedDriver.id].delivery_address || "Customer Address"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-xs text-slate-400">
                  Driver is currently available and waiting for job assignment.
                </div>
              )}

              {/* Quick Action Footer */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <Button
                  size="sm"
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-xs h-8"
                  onClick={() => openChatWithDriver(selectedDriver)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Dispatch Chat
                </Button>

                {selectedDriver.phone && (
                  <a href={`tel:${selectedDriver.phone}`} className="flex-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs h-8"
                    >
                      <Phone className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> Call Driver
                    </Button>
                  </a>
                )}

                {activeJobs[selectedDriver.id] && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-700/60 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 text-xs h-8"
                    onClick={() => setVerifyJob(activeJobs[selectedDriver.id])}
                  >
                    <FileCheck className="h-3.5 w-3.5 mr-1" /> POD
                  </Button>
                )}
              </div>
            </div>
          )}
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
              Verify & Complete Delivery (POD)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Review delivery photo and verified on-site customer signature.
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
                {resolvedProofUrl ? (
                  <img
                    src={resolvedProofUrl}
                    alt="Delivery proof"
                    className="w-full h-44 object-cover rounded-lg border border-slate-800"
                  />
                ) : verifyJob.proof_image_url ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-400">
                    Loading delivery photo...
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-500">
                    No photo uploaded by driver yet
                  </div>
                )}
              </div>

              {/* Customer Signature */}
              <div>
                <p className="font-semibold text-slate-300 mb-1">2. Customer Signature & Sign-Off</p>
                {(() => {
                  const embeddedNameMatch = verifyJob.completion_notes?.match(/\[Signed By:\s*([^\]]+)\]/);
                  const signerName = verifyJob.customer_signature_name || (embeddedNameMatch ? embeddedNameMatch[1].trim() : "");

                  if (!resolvedSigUrl) {
                    const hasSig = verifyJob.customer_signature_url || verifyJob.completion_notes?.includes("[Customer Signature:");
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center text-amber-500/80 text-[11px]">
                        {hasSig ? "Loading customer signature..." : "Customer signature pending from driver"}
                      </div>
                    );
                  }

                  return (
                    <div className="bg-white p-3 rounded-lg border border-slate-700 shadow-sm">
                      <img
                        src={resolvedSigUrl}
                        alt="Customer Signature"
                        className="h-24 w-full object-contain"
                      />
                      {signerName && (
                        <div className="mt-2 pt-2 border-t border-slate-200 text-center">
                          <span className="text-[11px] text-slate-800 font-bold">
                            Signed by: {signerName}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
