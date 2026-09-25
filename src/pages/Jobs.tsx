import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Flame,
  Pencil,
  Trash2,
  Download,
  Filter,
  ImageIcon,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  ShieldCheck,
  UserPlus,
  Eye,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, PaymentBadge } from "@/components/StatusBadge";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { optimizeImage, formatBytes } from "@/lib/compressImage";
import { exportJobsCSV, exportJobsXLSX } from "@/lib/exportJobs";
import { sendPushToRoles, sendPushToUser } from "@/lib/push";

const ALL_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "in_progress",
  "completion_requested",
  "completed",
  "rejected",
  "issue",
  "payment_pending",
] as const;
const HISTORY_STATUSES = ["completed", "rejected"] as const;
const PAYMENT_STATUSES = ["pending", "partial", "paid"] as const;
type DateRange = "all" | "today" | "week" | "month" | "custom";

const QUANTITY_UNITS = ["Tonnes", "Cubic Metres", "Number of bags"] as const;

// Format an ISO/UTC timestamp into the value expected by <input type="datetime-local">
// (local time, no timezone shift).
const formatDateTimeLocal = (dateString?: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

function formatDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const blank = {
  title_select: "",
  title_other: "",
  description: "",
  pickup_location_id: "",
  pickup_other: "",
  delivery_address: "",
  scheduled_date: "",
  start_time: "",
  priority: "standard" as "standard" | "priority",
  payment_kind: "invoice" as "invoice" | "cod",
  invoice_number: "",
  price: "",
  show_price: false,
  cod_amount: "",
  customer_name: "",
  customer_mobile: "",
  quantity: "",
  quantity_unit: "",
  quantity_unit_other: "",
  number_of_loads: "",
  instructions: "",
};


export default function Jobs() {
  const { role, user } = useAuth();
  const { pathname } = useLocation();
  const historyMode = pathname.startsWith("/history");
  const isAdmin = role === "super_admin";
  const isDispatch = role === "dispatch_admin";
  const isMember = role === "member";
  const isDriver = role === "driver";

  const [jobs, setJobs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [jobTitles, setJobTitles] = useState<{ id: string; name: string }[]>([]);
  const titleNames = useMemo(() => jobTitles.map((t) => t.name), [jobTitles]);

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Creator filter states
  const [creators, setCreators] = useState<{ id: string; name: string; email: string }[]>([]);
  const [fCreator, setFCreator] = useState<string>("all");

  // Filter states
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fDriver, setFDriver] = useState<string>("all");
  const [fLocation, setFLocation] = useState<string>("all");
  const [fRange, setFRange] = useState<DateRange>("all");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fPendingEdit, setFPendingEdit] = useState(false);

  // Dialog / form states
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(blank);
  const [productSearch, setProductSearch] = useState("");

  const customerOptions = useMemo(() => {
    const map = new Map<string, { name: string; mobile: string; address: string }>();
    jobs.forEach((j) => {
      const name = (j.customer_name || "").trim();
      const mobile = (j.customer_mobile || "").trim();
      const address = (j.delivery_address || "").trim();
      if (!name && !mobile) return;
      const key = `${name.toLowerCase()}||${mobile.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { name: name || "Customer", mobile, address });
      }
    });
    return Array.from(map.values());
  }, [jobs]);

  // Feature Flags & Permissions State
  const [appSettings, setAppSettings] = useState({
    allow_direct_job_edit: true,
    allow_direct_invoice_completion: true,
    require_cash_job_approval: true,
    allow_member_job_assign: true,
  });
  const [userPerm, setUserPerm] = useState<{ can_direct_edit: boolean | null; can_direct_complete_invoice: boolean | null; can_assign_jobs: boolean | null }>({
    can_direct_edit: null,
    can_direct_complete_invoice: null,
    can_assign_jobs: null,
  });

  const canDirectEdit = useMemo(() => {
    if (isAdmin) return true;
    if (userPerm?.can_direct_edit !== null && userPerm?.can_direct_edit !== undefined) {
      return userPerm.can_direct_edit;
    }
    return appSettings.allow_direct_job_edit;
  }, [isAdmin, userPerm, appSettings]);

  const canAssign = useMemo(() => {
    if (isDriver) return false;
    if (isAdmin || isDispatch) return true;
    if (userPerm?.can_assign_jobs !== null && userPerm?.can_assign_jobs !== undefined) {
      return userPerm.can_assign_jobs;
    }
    return appSettings.allow_member_job_assign;
  }, [isAdmin, isDispatch, isDriver, userPerm, appSettings]);

  const isAssigner = (isAdmin || isDispatch || canAssign) && !isDriver; // can assign/unassign drivers

  // Driver completion modal
  const [completeFor, setCompleteFor] = useState<any | null>(null);
  const [compNotes, setCompNotes] = useState("");
  const [compFile, setCompFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Admin verify modal
  const [verifyFor, setVerifyFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Admin review pending edit modal
  const [reviewEditFor, setReviewEditFor] = useState<any | null>(null);
  // Job detail modal (driver / member view)
  const [detailFor, setDetailFor] = useState<any | null>(null);

  // Admin assign-driver modal
  const [assignFor, setAssignFor] = useState<any | null>(null);
  const [assignDriver, setAssignDriver] = useState("");
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");

  const fetchAllJobs = async () => {
    try {
      const { count } = await supabase.from("jobs").select("*", { count: "exact", head: true });
      const total = count ?? 0;
      const pageSize = 1000;
      const pages = Math.ceil(total / pageSize) || 1;
      const promises = [];
      for (let p = 0; p < pages; p++) {
        promises.push(
          supabase
            .from("jobs")
            .select("*")
            .order("created_at", { ascending: false })
            .range(p * pageSize, (p + 1) * pageSize - 1)
        );
      }
      const results = await Promise.all(promises);
      const err = results.find(r => r.error)?.error;
      if (err) return { data: [], error: err };
      const allJobs = results.flatMap(r => r.data ?? []);
      return { data: allJobs, error: null };
    } catch (e: any) {
      return { data: [], error: e };
    }
  };

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const buildJobsQuery = (pageNumber: number, pageSize: number) => {
    let q = supabase.from("jobs").select("*");

    if (!historyMode) {
      q = q.not("status", "in", "(completed,rejected)");
    } else {
      q = q.in("status", ["completed", "rejected"]);
    }

    if (isMember && user?.id) {
      q = q.eq("created_by", user.id);
    }

    const term = search.trim();
    if (term) {
      const words = term.split(/\s+/).filter(Boolean);
      words.forEach((w) => {
        const escaped = w.replace(/[%_\\]/g, "\\$&");
        q = q.or(
          `title.ilike.%${escaped}%,invoice_number.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_mobile.ilike.%${escaped}%,pickup_address.ilike.%${escaped}%,delivery_address.ilike.%${escaped}%`
        );
      });
    }

    if (fStatus !== "all") {
      q = q.eq("status", fStatus);
    }

    if (isAdmin && fDriver !== "all") {
      q = q.eq("assigned_driver_id", fDriver);
    }

    if ((isAdmin || isDispatch) && fCreator !== "all") {
      q = q.eq("created_by", fCreator);
    }

    if (fLocation !== "all") {
      q = q.eq("pickup_location_id", fLocation);
    }

    let now = new Date();
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (fRange === "today") {
      fromDate = startOfDay(now);
      toDate = endOfDay(now);
    } else if (fRange === "week") {
      fromDate = startOfWeek(now);
      toDate = endOfWeek(now);
    } else if (fRange === "month") {
      fromDate = startOfMonth(now);
      toDate = endOfMonth(now);
    } else if (fRange === "custom") {
      if (fFrom) fromDate = startOfDay(new Date(fFrom));
      if (fTo) toDate = endOfDay(new Date(fTo));
    }

    if (fromDate) {
      q = q.gte("scheduled_date", format(fromDate, "yyyy-MM-dd"));
    }
    if (toDate) {
      q = q.lte("scheduled_date", format(toDate, "yyyy-MM-dd"));
    }

    if (!historyMode) {
      q = q
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }

    return q.range(pageNumber * pageSize, (pageNumber + 1) * pageSize - 1);
  };

  const load = async () => {
    try {
      setPage(0);
      setHasMore(true);
      const driversQuery = isAssigner
        ? supabase.from("drivers").select("id,full_name,active,user_id").order("full_name")
        : supabase.rpc("list_drivers_directory");

      const creatorsQuery = (async () => {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["super_admin", "dispatch_admin", "member"]);
        const creatorUserIds = (roles ?? []).map((r: any) => r.user_id);
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
        return { data: profs ?? [], creatorUserIds, error: null };
      })();

      const [{ data: firstPage, error: firstErr }, locRes, drvRes, titlesRes, settingsRes, permRes, profsRes] = await Promise.all([
        buildJobsQuery(0, PAGE_SIZE),
        supabase.from("store_locations").select("id,name,address,active").order("name"),
        driversQuery,
        supabase.from("job_titles").select("id,name,active,sort_order").order("name", { ascending: true }),
        supabase.from("app_settings").select("key, value"),
        user ? supabase.from("user_permissions").select("can_direct_edit, can_direct_complete_invoice, can_assign_jobs").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        creatorsQuery,
      ]);

      if (settingsRes.data) {
        const stObj: any = {};
        const parseBool = (v: any) => {
          if (typeof v === "boolean") return v;
          if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
          if (typeof v === "number") return v === 1;
          return Boolean(v);
        };
        settingsRes.data.forEach((s: any) => { stObj[s.key] = parseBool(s.value); });
        setAppSettings((prev) => ({ ...prev, ...stObj }));
      }
      if (permRes?.data) {
        setUserPerm({
          can_direct_edit: permRes.data.can_direct_edit ?? null,
          can_direct_complete_invoice: permRes.data.can_direct_complete_invoice ?? null,
          can_assign_jobs: permRes.data.can_assign_jobs ?? null,
        });
      }

      if (firstErr) {
        console.error("jobs load error", firstErr);
        toast.error(`Could not load jobs: ${firstErr.message}`);
      }

      const ls = locRes.data, ds = (drvRes.data ?? []) as any[], ts = titlesRes.data, profs = (profsRes?.data ?? []) as any[];
      const locMap = new Map((ls ?? []).map((l: any) => [l.id, l]));
      const drvMap = new Map(ds.map((d: any) => [d.id, d]));
      const profMap = new Map(profs.map((p: any) => [p.id, p]));

      if (profs.length > 0) {
        const creatorSet = new Set(profsRes?.creatorUserIds ?? []);
        const creatorProfs = profs.filter((p: any) => creatorSet.has(p.id));
        setCreators(creatorProfs.map((p: any) => ({ id: p.id, name: p.full_name || p.email || "Member", email: p.email })));
      }

      const enrichedFirst = (firstPage ?? []).map((j: any) => ({
        ...j,
        store_locations: j.pickup_location_id ? (locMap.get(j.pickup_location_id) ?? null) : null,
        drivers: j.assigned_driver_id ? (drvMap.get(j.assigned_driver_id) ?? null) : null,
        creator: j.created_by ? (profMap.get(j.created_by) ?? null) : null,
      }));

      setJobs(enrichedFirst);
      setLocations((ls ?? []).filter((l: any) => l.active !== false));
      setDrivers(ds.filter((d: any) => d.active));
      setJobTitles(((ts ?? []) as any[]).filter((t) => t.active !== false));
      setLoadingJobs(false);

      if (!firstPage || firstPage.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (e: any) {
      console.error("load error", e);
      setLoadingJobs(false);
    }
  };

  const loadMoreJobs = async () => {
    if (loadingMore || !hasMore || loadingJobs) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const { data: nextPageData, error } = await buildJobsQuery(nextPage, PAGE_SIZE);

      if (error || !nextPageData || nextPageData.length === 0) {
        setHasMore(false);
      } else {
        const locMap = new Map(locations.map((l: any) => [l.id, l]));
        const drvMap = new Map(drivers.map((d: any) => [d.id, d]));
        const profMap = new Map(creators.map((c: any) => [c.id, { full_name: c.name, email: c.email }]));
        const enrichedNext = nextPageData.map((j: any) => ({
          ...j,
          store_locations: j.pickup_location_id ? (locMap.get(j.pickup_location_id) ?? null) : null,
          drivers: j.assigned_driver_id ? (drvMap.get(j.assigned_driver_id) ?? null) : null,
          creator: j.created_by ? (profMap.get(j.created_by) ?? null) : null,
        }));
        setJobs((prev) => [...prev, ...enrichedNext]);
        setPage(nextPage);
        if (nextPageData.length < PAGE_SIZE) setHasMore(false);
      }
    } catch (e) {
      console.error("loadMoreJobs error", e);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fStatus, fDriver, fCreator, fLocation, fRange, fFrom, fTo, historyMode]);

  useEffect(() => {
    const ch = supabase
      .channel("jobs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [historyMode]);

  const filtered = useMemo(() => {
    let now = new Date();
    let from: Date | null = null,
      to: Date | null = null;
    if (fRange === "today") {
      from = startOfDay(now);
      to = endOfDay(now);
    } else if (fRange === "week") {
      from = startOfWeek(now);
      to = endOfWeek(now);
    } else if (fRange === "month") {
      from = startOfMonth(now);
      to = endOfMonth(now);
    } else if (fRange === "custom") {
      if (fFrom) from = startOfDay(new Date(fFrom));
      if (fTo) to = endOfDay(new Date(fTo));
    }
    const term = search.trim().toLowerCase();
    const words = term ? term.split(/\s+/).filter(Boolean) : [];
    const parseLocalDate = (dateStr: string) => {
      if (typeof dateStr === "string" && dateStr.length === 10 && dateStr.includes("-")) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      return new Date(dateStr);
    };
    return jobs.filter((j) => {
      const inHistory = (HISTORY_STATUSES as readonly string[]).includes(j.status);
      if (!historyMode && inHistory) return false;
      if (historyMode && !inHistory) return false;
      if (isDriver) {
        const currentDriver = drivers.find((d) => d.user_id === user?.id);
        if (currentDriver && j.assigned_driver_id !== currentDriver.id) return false;
      }
      if (words.length > 0) {
        const hay =
          `${j.title ?? ""} ${j.invoice_number ?? ""} ${j.customer_name ?? ""} ${j.customer_mobile ?? ""} ${j.pickup_address ?? ""} ${j.delivery_address ?? ""} ${j.store_locations?.name ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      if (fStatus !== "all" && j.status !== fStatus) return false;
      if (isAdmin && fDriver !== "all" && j.assigned_driver_id !== fDriver) return false;
      if ((isAdmin || isDispatch) && fCreator !== "all" && j.created_by !== fCreator) return false;
      if (fLocation !== "all" && j.pickup_location_id !== fLocation) return false;
      if (from || to) {
        const d = j.scheduled_date
          ? parseLocalDate(j.scheduled_date)
          : j.start_time
            ? new Date(j.start_time)
            : new Date(j.created_at);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (isAdmin && fPendingEdit && !j.pending_edit) return false;
      return true;
    });
  }, [jobs, search, fStatus, fDriver, fCreator, fLocation, fRange, fFrom, fTo, isAdmin, isDispatch, isDriver, drivers, user, fPendingEdit, historyMode]);

  const groupedJobs = useMemo(() => {
    const todayObj = new Date();
    const todayStr = format(todayObj, "yyyy-MM-dd");
    const tomorrowObj = addDays(todayObj, 1);
    const tomorrowStr = format(tomorrowObj, "yyyy-MM-dd");
    const dayAfterObj = addDays(todayObj, 2);
    const dayAfterStr = format(dayAfterObj, "yyyy-MM-dd");

    const groups = [
      { id: "today", title: "Today", subtitle: format(todayObj, "EEEE, MMM d, yyyy"), badgeBg: "bg-primary text-primary-foreground", jobs: [] as any[] },
      { id: "tomorrow", title: "Tomorrow", subtitle: format(tomorrowObj, "EEEE, MMM d, yyyy"), badgeBg: "bg-blue-600 text-white", jobs: [] as any[] },
      { id: "dayAfterTomorrow", title: "Day After Tomorrow", subtitle: format(dayAfterObj, "EEEE, MMM d, yyyy"), badgeBg: "bg-indigo-600 text-white", jobs: [] as any[] },
      { id: "upcoming", title: "Upcoming Schedule", subtitle: "Scheduled for future dates", badgeBg: "bg-emerald-600 text-white", jobs: [] as any[] },
      { id: "other", title: "Past / Other", subtitle: "Completed or previous dates", badgeBg: "bg-muted text-muted-foreground", jobs: [] as any[] },
    ];

    filtered.forEach((j) => {
      const dateVal = j.scheduled_date || (j.start_time ? j.start_time.slice(0, 10) : null);
      if (!dateVal) {
        groups[4].jobs.push(j);
      } else if (dateVal === todayStr) {
        groups[0].jobs.push(j);
      } else if (dateVal === tomorrowStr) {
        groups[1].jobs.push(j);
      } else if (dateVal === dayAfterStr) {
        groups[2].jobs.push(j);
      } else if (dateVal > dayAfterStr) {
        groups[3].jobs.push(j);
      } else {
        groups[4].jobs.push(j);
      }
    });

    return groups.filter((g) => g.jobs.length > 0);
  }, [filtered]);

  const startCreate = () => {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  };
  const startEdit = (j: any) => {
    setEditing(j);
    const isOtherPickup = !j.pickup_location_id && !!j.pickup_address;
    const rawTitle = j.title ?? "";
    const sepIdx = rawTitle.indexOf(" - ");
    const titlePrefix = sepIdx > -1 ? rawTitle.slice(0, sepIdx) : rawTitle;
    const titleSuffix = sepIdx > -1 ? rawTitle.slice(sepIdx + 3) : "";
    const prefixInList = titleNames.includes(titlePrefix);
    const unitInList = j.quantity_unit && (QUANTITY_UNITS as readonly string[]).includes(j.quantity_unit);
    setForm({
      title_select: prefixInList ? titlePrefix : rawTitle ? "__other__" : "",
      title_other: prefixInList ? titleSuffix : rawTitle,
      description: j.description ?? "",
      pickup_location_id: isOtherPickup ? "__other__" : (j.pickup_location_id ?? ""),
      pickup_other: isOtherPickup ? (j.pickup_address ?? "") : "",
      delivery_address: j.delivery_address ?? "",
      scheduled_date: j.scheduled_date ?? "",
      start_time: formatDateTimeLocal(j.start_time),
      priority: j.priority,
      payment_kind: j.cod ? "cod" : "invoice",
      invoice_number: j.invoice_number ?? "",
      price: j.price ?? "",
      show_price: j.show_price,
      cod_amount: j.cod ? (j.price ?? "") : "",
      customer_name: j.customer_name ?? "",
      customer_mobile: j.customer_mobile ?? "",
      quantity: j.quantity ?? "",
      quantity_unit: unitInList ? j.quantity_unit : j.quantity_unit ? "__other__" : "",
      quantity_unit_other: unitInList ? "" : (j.quantity_unit ?? ""),
      number_of_loads: j.number_of_loads ?? "",
      instructions: j.instructions ?? "",
    });

    setOpen(true);
  };

  const save = async () => {
    if (!form.title_select) return toast.error("Select job title type");
    if (!form.title_other.trim()) return toast.error("Job title required");
    const typeLabel = form.title_select === "__other__" ? "Others" : form.title_select;
    const finalTitle = `${typeLabel} - ${form.title_other.trim()}`;
    if (!form.pickup_location_id) return toast.error("Pickup location required");
    if (form.pickup_location_id === "__other__" && !form.pickup_other.trim())
      return toast.error("Enter pickup location");
    if (!form.delivery_address.trim()) return toast.error("Delivery location required");
    if (!form.start_time) return toast.error("Start time required");
    if (form.payment_kind === "invoice" && !form.invoice_number.trim()) return toast.error("Invoice number required");
    if (form.payment_kind === "cod" && (!form.cod_amount || isNaN(Number(form.cod_amount))))
      return toast.error("Enter COD amount");
    if (form.customer_mobile && !/^[0-9+\-\s()]{7,20}$/.test(form.customer_mobile))
      return toast.error("Invalid mobile number");
    if (form.quantity && isNaN(Number(form.quantity))) return toast.error("Quantity must be numeric");
    if (form.quantity && !form.quantity_unit) return toast.error("Select a quantity unit");
    if (form.quantity_unit === "__other__" && !form.quantity_unit_other.trim())
      return toast.error("Enter quantity unit");

    const isOtherPickup = form.pickup_location_id === "__other__";
    const isCod = form.payment_kind === "cod";
    const finalUnit = form.quantity_unit === "__other__" ? form.quantity_unit_other.trim() : form.quantity_unit || null;

    const payload: any = {
      title: finalTitle,
      description: form.description || null,
      pickup_location_id: isOtherPickup ? null : form.pickup_location_id,
      pickup_address: isOtherPickup ? form.pickup_other.trim() : null,
      delivery_location_id: null,
      delivery_address: form.delivery_address.trim(),
      scheduled_date: form.start_time ? form.start_time.slice(0, 10) : form.scheduled_date || null,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      priority: form.priority,
      invoice_number: isCod ? "" : form.invoice_number.trim(),
      price: isCod ? Number(form.cod_amount) : form.price ? Number(form.price) : null,
      show_price: form.show_price,
      cod: isCod,
      customer_name: form.customer_name || null,
      customer_mobile: form.customer_mobile || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      quantity_unit: form.quantity ? finalUnit : null,
      number_of_loads: form.number_of_loads ? Number(form.number_of_loads) : null,
      instructions: form.instructions || null,
    };


    if (editing) {
      if (isMember && editing.created_by !== user?.id && !canDirectEdit) {
        return toast.error("You cannot edit this job");
      }
      // Members & Dispatch Admins: route content edits through approval queue ONLY if direct edit is disabled
      if (!canDirectEdit && (isMember || isDispatch)) {
        const { error } = await supabase
          .from("jobs")
          .update({
            pending_edit: payload,
            pending_edit_by: user!.id,
            pending_edit_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) return toast.error(error.message);
        try {
          await supabase.rpc("notify_admins", {
            p_title: "Job edit awaiting approval",
            p_body: `${editing.title} (Invoice ${editing.invoice_number})`,
            p_type: "edit_requested",
            p_job_id: editing.id,
          });
        } catch { /* noop */ }
        toast.success("Edit submitted for super admin approval");
        setOpen(false);
        load();
        return;
      }
      const directPayload = {
        ...payload,
        pending_edit: null,
        pending_edit_by: null,
        pending_edit_at: null,
      };
      const { error } = await supabase.from("jobs").update(directPayload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Job updated successfully");
    } else {
      payload.created_by = user!.id;
      payload.status = "pending";
      const { data: created, error } = await supabase.from("jobs").insert(payload).select("id,title,invoice_number").single();
      if (error) return toast.error(error.message);
      if (created) {
        try {
          await supabase.rpc("notify_admins", {
            p_title: "New job created",
            p_body: `${created.title} (Invoice ${created.invoice_number})`,
            p_type: "job_created",
            p_job_id: created.id,
          });
          const push = await sendPushToRoles(["super_admin"], {
            title: "New job created",
            body: `${created.title} (Invoice ${created.invoice_number})`,
            url: "/jobs",
            tag: `new-job-${created.id}`,
          });
          if (!push.ok) console.error("admin push failed", push.error);
        } catch (e) {
          console.error("post-create notify failed", e);
        }
      }
    }
    toast.success("Saved");
    setOpen(false);
    load();
  };

  const approvePendingEdit = async () => {
    if (!reviewEditFor?.pending_edit) return;
    const { error } = await supabase
      .from("jobs")
      .update({
        ...reviewEditFor.pending_edit,
        pending_edit: null,
        pending_edit_by: null,
        pending_edit_at: null,
      })
      .eq("id", reviewEditFor.id);
    if (error) return toast.error(error.message);
    if (reviewEditFor.pending_edit_by) {
      await supabase.from("notifications").insert({
        user_id: reviewEditFor.pending_edit_by,
        title: "Job edit approved",
        body: `${reviewEditFor.title} (Invoice ${reviewEditFor.invoice_number})`,
        type: "edit_approved",
        job_id: reviewEditFor.id,
      });
    }
    toast.success("Edit applied");
    setReviewEditFor(null);
  };
  const rejectPendingEdit = async () => {
    if (!reviewEditFor) return;
    const { error } = await supabase
      .from("jobs")
      .update({
        pending_edit: null,
        pending_edit_by: null,
        pending_edit_at: null,
      })
      .eq("id", reviewEditFor.id);
    if (error) return toast.error(error.message);
    if (reviewEditFor.pending_edit_by) {
      await supabase.from("notifications").insert({
        user_id: reviewEditFor.pending_edit_by,
        title: "Job edit rejected",
        body: `${reviewEditFor.title} (Invoice ${reviewEditFor.invoice_number})`,
        type: "edit_rejected",
        job_id: reviewEditFor.id,
      });
    }
    toast.success("Edit rejected");
    setReviewEditFor(null);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const duplicate = (j: any) => {
    setEditing(null);
    const isOtherPickup = !j.pickup_location_id && !!j.pickup_address;
    const rawTitle = j.title ?? "";
    const sepIdx = rawTitle.indexOf(" - ");
    const titlePrefix = sepIdx > -1 ? rawTitle.slice(0, sepIdx) : rawTitle;
    const titleSuffix = sepIdx > -1 ? rawTitle.slice(sepIdx + 3) : "";
    const prefixInList = titleNames.includes(titlePrefix);
    const unitInList = j.quantity_unit && (QUANTITY_UNITS as readonly string[]).includes(j.quantity_unit);
    setForm({
      title_select: prefixInList ? titlePrefix : rawTitle ? "__other__" : "",
      title_other: prefixInList ? titleSuffix : rawTitle,
      description: j.description ?? "",
      pickup_location_id: isOtherPickup ? "__other__" : (j.pickup_location_id ?? ""),
      pickup_other: isOtherPickup ? (j.pickup_address ?? "") : "",
      delivery_address: j.delivery_address ?? "",
      scheduled_date: "",
      start_time: "",
      priority: j.priority,
      payment_kind: j.cod ? "cod" : "invoice",
      invoice_number: j.cod ? "" : "",
      price: j.cod ? "" : (j.price ?? ""),
      show_price: j.show_price,
      cod_amount: j.cod ? (j.price ?? "") : "",
      customer_name: j.customer_name ?? "",
      customer_mobile: j.customer_mobile ?? "",
      quantity: j.quantity ?? "",
      quantity_unit: unitInList ? j.quantity_unit : j.quantity_unit ? "__other__" : "",
      quantity_unit_other: unitInList ? "" : (j.quantity_unit ?? ""),
      number_of_loads: j.number_of_loads ?? "",
      instructions: j.instructions ?? "",
    });
    setOpen(true);
    toast.info("Duplicated — set a new start time and save");
  };

  const openAssign = (j: any) => {
    setAssignFor(j);
    setAssignDriver(j.assigned_driver_id ?? "");
    setAssignStart(formatDateTimeLocal(j.start_time));
    setAssignEnd(formatDateTimeLocal(j.end_time));
  };
  const submitAssign = async () => {
    if (!assignFor || !assignDriver) return toast.error("Select a driver");
    if (!assignStart) return toast.error("Start time required");
    const { error } = await supabase
      .from("jobs")
      .update({
        assigned_driver_id: assignDriver,
        start_time: new Date(assignStart).toISOString(),
        end_time: assignEnd ? new Date(assignEnd).toISOString() : null,
        status: "assigned" as any,
      })
      .eq("id", assignFor.id);
    if (error) return toast.error(error.message);
    const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", assignDriver).maybeSingle();
    if (drv?.user_id) {
      const body = `${assignFor.title} (Invoice ${assignFor.invoice_number})`;
      await supabase.from("notifications").insert({
        user_id: drv.user_id,
        title: "New job assigned",
        body,
        type: "job_assigned",
        job_id: assignFor.id,
      });
      await sendPushToUser(drv.user_id, {
        title: "New job assigned",
        body,
        url: "/jobs",
        tag: `job-${assignFor.id}`,
      });
    }
    toast.success("Driver assigned");
    setJobs((prev) => prev.map((item) => (item.id === assignFor.id ? { ...item, assigned_driver_id: assignDriver, status: "assigned" } : item)));
    setAssignFor(null);
    load();
  };

  const unassignJob = async (j: any) => {
    if (!j.assigned_driver_id) return;
    if (!confirm(`Unassign ${j.drivers?.full_name ?? "driver"} from this job? It will be put on hold.`)) return;
    setJobs((prev) => prev.map((item) => (item.id === j.id ? { ...item, assigned_driver_id: null, status: "pending" } : item)));
    const { error } = await supabase
      .from("jobs")
      .update({ assigned_driver_id: null, status: "pending" as any, start_time: j.start_time, end_time: null })
      .eq("id", j.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", j.assigned_driver_id).maybeSingle();
    if (drv?.user_id) {
      await supabase.from("notifications").insert({
        user_id: drv.user_id,
        title: "Job unassigned",
        body: `${j.title} (Invoice ${j.invoice_number}) has been put on hold`,
        type: "job_unassigned",
        job_id: j.id,
      });
    }
    toast.success("Job unassigned (on hold)");
    load();
  };

  // Driver actions
  const driverAccept = async (j: any) => {
    setJobs((prev) => prev.map((item) => (item.id === j.id ? { ...item, status: "accepted" } : item)));
    const { error } = await supabase
      .from("jobs")
      .update({ status: "accepted" as any })
      .eq("id", j.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    toast.success("Job accepted");
  };
  const driverReject = async (j: any) => {
    if (!confirm("Reject this job?")) return;
    setJobs((prev) => prev.map((item) => (item.id === j.id ? { ...item, status: "rejected", assigned_driver_id: null } : item)));
    const { error } = await supabase
      .from("jobs")
      .update({ status: "rejected" as any, assigned_driver_id: null })
      .eq("id", j.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    toast.success("Job rejected");
  };
  const driverStart = async (j: any) => {
    const patch: any = { status: "in_progress" as any };
    if (!j.actual_start_time) patch.actual_start_time = new Date().toISOString();
    setJobs((prev) => prev.map((item) => (item.id === j.id ? { ...item, ...patch } : item)));
    const { error } = await supabase.from("jobs").update(patch).eq("id", j.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    toast.success("Job started");
  };

  const submitCompletion = async () => {
    if (!completeFor) return;
    setUploading(true);
    try {
      let proofUrl: string | null = null;
      if (compFile) {
        if (!user) throw new Error("Authentication required to upload proof photo");
        const result = await optimizeImage(compFile);
        if (result.error) console.warn("Image optimization skipped:", result.error);
        const optimized = result.file;
        const safeName = (optimized.name || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${completeFor.id}-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("job-proofs")
          .upload(path, optimized, { contentType: optimized.type || "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        proofUrl = path;
        // Delete any previously stored proof for this job so only the optimised file remains.
        if (completeFor.proof_image_url && completeFor.proof_image_url !== path) {
          const oldClean = completeFor.proof_image_url.replace(/^job-proofs\//, "").replace(/^.*\/storage\/v1\/object\/public\/job-proofs\//, "");
          await supabase.storage.from("job-proofs").remove([oldClean]).catch(() => {});
        }
        if (result.optimized) {
          toast.success(`Image optimized (${result.savings}% smaller)`);
        }
      }

      const updateData: any = {
        status: "completion_requested" as any,
        completion_requested_at: new Date().toISOString(),
        completion_notes: compNotes || null,
        rejection_reason: null,
      };
      if (proofUrl) updateData.proof_image_url = proofUrl;

      setJobs((prev) => prev.map((item) => (item.id === completeFor.id ? { ...item, ...updateData } : item)));

      const { error } = await supabase
        .from("jobs")
        .update(updateData)
        .eq("id", completeFor.id);
      if (error) throw error;

      try {
        await supabase.rpc("notify_admins", {
          p_title: "Completion requested",
          p_body: `${completeFor.title} (Invoice ${completeFor.invoice_number}) awaits verification`,
          p_type: "completion_requested",
          p_job_id: completeFor.id,
        });
      } catch (rpcErr) {
        console.warn("notify_admins RPC skipped:", rpcErr);
      }
      toast.success("Sent for admin verification");
      setCompleteFor(null);
      setCompNotes("");
      setCompFile(null);
    } catch (e: any) {
      load();
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const adminApprove = async () => {
    if (!verifyFor || !user) return;
    const isCashJob = verifyFor.cod || verifyFor.payment_kind === "cod" || !verifyFor.invoice_number;
    if (isCashJob && appSettings.require_cash_job_approval && !isAdmin) {
      return toast.error("SuperAdmin approval is required for Cash (COD) jobs");
    }

    const patchData = {
      status: "completed" as any,
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      rejection_reason: null,
    };
    setJobs((prev) => prev.map((item) => (item.id === verifyFor.id ? { ...item, ...patchData } : item)));
    const { error } = await supabase
      .from("jobs")
      .update(patchData)
      .eq("id", verifyFor.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    const { data: drv } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", verifyFor.assigned_driver_id)
      .maybeSingle();
    if (drv?.user_id) {
      await supabase.from("notifications").insert({
        user_id: drv.user_id,
        title: "Completion approved",
        body: verifyFor.title,
        type: "completion_approved",
        job_id: verifyFor.id,
      });
    }
    toast.success("Approved");
    setVerifyFor(null);
    setRejectReason("");
  };
  const adminReject = async () => {
    if (!verifyFor) return;
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "in_progress" as any,
        rejection_reason: rejectReason || "Not approved",
      })
      .eq("id", verifyFor.id);
    if (error) return toast.error(error.message);
    const { data: drv } = await supabase
      .from("drivers")
      .select("user_id")
      .eq("id", verifyFor.assigned_driver_id)
      .maybeSingle();
    if (drv?.user_id) {
      await supabase.from("notifications").insert({
        user_id: drv.user_id,
        title: "Completion rejected",
        body: rejectReason || verifyFor.title,
        type: "completion_rejected",
        job_id: verifyFor.id,
      });
    }
    toast.success("Sent back to driver");
    setVerifyFor(null);
    setRejectReason("");
  };

  const viewProof = async (path: string) => {
    if (!path) return;
    const cleanPath = path.replace(/^job-proofs\//, "").replace(/^.*\/storage\/v1\/object\/public\/job-proofs\//, "");
    const { data, error } = await supabase.storage.from("job-proofs").createSignedUrl(cleanPath, 60 * 5);
    if (error) return toast.error(`Could not open image: ${error.message}`);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const allChecked = filtered.length > 0 && filtered.every((j) => selected.has(j.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map((j) => j.id)));
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const bulkUpdate = async (patch: any, label: string) => {
    if (selected.size === 0) return;
    if (!confirm(`${label} ${selected.size} job(s)?`)) return;
    const { error } = await supabase.from("jobs").update(patch).in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`Updated ${selected.size} jobs`);
    setSelected(new Set());
  };
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} job(s)? This cannot be undone.`)) return;
    const selectedIds = new Set(selected);
    setJobs((prev) => prev.filter((j) => !selectedIds.has(j.id)));
    const { error } = await supabase.from("jobs").delete().in("id", Array.from(selected));
    if (error) {
      load();
      return toast.error(error.message);
    }
    toast.success("Deleted");
    setSelected(new Set());
    load();
  };
  const bulkAssign = async (driverId: string) => {
    if (!driverId || selected.size === 0) return;
    const count = selected.size;
    const selectedIds = new Set(selected);
    setJobs((prev) => prev.map((item) => (selectedIds.has(item.id) ? { ...item, assigned_driver_id: driverId, status: "assigned" } : item)));
    const { error } = await supabase
      .from("jobs")
      .update({ assigned_driver_id: driverId, status: "assigned" as any })
      .in("id", Array.from(selected));
    if (error) {
      load();
      return toast.error(error.message);
    }
    const { data: drv } = await supabase.from("drivers").select("user_id").eq("id", driverId).maybeSingle();
    if (drv?.user_id) {
      const body = `${count} job${count > 1 ? "s" : ""} assigned to you`;
      await supabase.from("notifications").insert({
        user_id: drv.user_id,
        title: "New jobs assigned",
        body,
        type: "job_assigned",
      });
      await sendPushToUser(drv.user_id, { title: "New jobs assigned", body, url: "/jobs" });
    }
    toast.success("Reassigned");
    setSelected(new Set());
    load();
  };

  const updatePayment = async (j: any, status: string) => {
    const isCashJob = Boolean(j.cod || j.payment_kind === "cod");
    if (isCashJob && !isAdmin) {
      return toast.error("Only Gurinder (Admin) can clear cash payments");
    }
    setJobs((prev) => prev.map((item) => (item.id === j.id ? { ...item, payment_status: status } : item)));
    const { error } = await supabase
      .from("jobs")
      .update({ payment_status: status as any })
      .eq("id", j.id);
    if (error) {
      load();
      return toast.error(error.message);
    }
    toast.success("Payment status updated");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold">
            {historyMode ? "Job History" : isDriver ? "My Jobs" : "Jobs"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {historyMode
              ? "Completed and rejected jobs."
              : isDriver
                ? "Accept, work, and submit jobs for admin verification."
                : isMember
                  ? "Create new jobs — admin will assign a driver."
                  : "Create, assign, verify, and track jobs."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Export filtered ({filtered.length})</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportJobsXLSX(filtered)}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportJobsCSV(filtered)}>CSV</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!isDriver && !historyMode && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={startCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Edit" : "New"} job
                    {editing?.job_number != null && (
                      <span className="ml-2 text-xs font-mono text-muted-foreground">#{String(editing.job_number).padStart(4, "0")}</span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Label>Job title *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={form.title_select} onValueChange={(v) => setForm({ ...form, title_select: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select job title type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-64 overflow-y-auto">
                            <div className="p-2 sticky top-0 bg-popover z-10 border-b">
                              <Input
                                placeholder="🔍 Search product A-Z…"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="h-8 text-xs bg-background"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            {titleNames
                              .filter((t) => !productSearch || t.toLowerCase().includes(productSearch.toLowerCase()))
                              .map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            <SelectItem value="__other__">Others</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Enter job title"
                          value={form.title_other}
                          onChange={(e) => setForm({ ...form, title_other: e.target.value })}
                          maxLength={150}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Pickup location *</Label>
                      <Select
                        value={form.pickup_location_id}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            pickup_location_id: v,
                            pickup_other: v === "__other__" ? form.pickup_other : "",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              <span className="font-medium">{l.name}</span>
                              {l.address ? <span className="text-muted-foreground"> — {l.address}</span> : null}
                            </SelectItem>
                          ))}
                          <SelectItem value="__other__">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <div
                        className={`grid transition-all duration-300 ease-out ${form.pickup_location_id === "__other__" ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden">
                          <Input
                            placeholder="Enter pickup location"
                            value={form.pickup_other}
                            onChange={(e) => setForm({ ...form, pickup_other: e.target.value })}
                            maxLength={200}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Scheduled start *</Label>
                      <Input
                        type="datetime-local"
                        value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Delivery location *</Label>
                      <Input
                        value={form.delivery_address}
                        onChange={(e) => setForm({ ...form, delivery_address: e.target.value })}
                        placeholder="Street, city"
                        maxLength={250}
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                      <Label>Payment type *</Label>
                      <RadioGroup
                        value={form.payment_kind}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            payment_kind: v,
                            invoice_number: v === "invoice" ? form.invoice_number : "",
                            cod_amount: v === "cod" ? form.cod_amount : "",
                          })
                        }
                        className="flex gap-6"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id="pk-inv" value="invoice" />
                          <Label htmlFor="pk-inv" className="cursor-pointer">
                            Invoice Number
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem id="pk-cod" value="cod" />
                          <Label htmlFor="pk-cod" className="cursor-pointer">
                            Cash on Delivery (COD)
                          </Label>
                        </div>
                      </RadioGroup>
                      <div
                        className={`grid transition-all duration-300 ease-out ${form.payment_kind === "invoice" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden pt-1">
                          <Input
                            placeholder="Enter Invoice Number"
                            value={form.invoice_number}
                            onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                            maxLength={60}
                          />
                        </div>
                      </div>
                      <div
                        className={`grid transition-all duration-300 ease-out ${form.payment_kind === "cod" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden pt-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter COD Amount"
                            value={form.cod_amount}
                            onChange={(e) => setForm({ ...form, cod_amount: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {customerOptions.length > 0 && (
                      <div className="sm:col-span-2 bg-muted/40 p-2.5 rounded-lg border">
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span>🔍</span> Search & Autofill Previous Customer
                          </Label>
                        </div>
                        <Select
                          onValueChange={(val) => {
                            const selectedCust = customerOptions.find((c) => `${c.name}||${c.mobile}` === val);
                            if (selectedCust) {
                              setForm((prev: any) => ({
                                ...prev,
                                customer_name: selectedCust.name,
                                customer_mobile: selectedCust.mobile,
                                delivery_address: selectedCust.address || prev.delivery_address,
                              }));
                              toast.success(`Autofilled details for ${selectedCust.name}`);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder="Search or select a previous customer…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {customerOptions.map((c, idx) => (
                              <SelectItem key={idx} value={`${c.name}||${c.mobile}`}>
                                <div className="flex flex-col text-left">
                                  <span className="font-medium text-sm">{c.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {c.mobile ? `📱 ${c.mobile}` : "No phone"} {c.address ? `• 📍 ${c.address}` : ""}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label>Customer name</Label>
                      <Input
                        value={form.customer_name}
                        onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                        maxLength={120}
                        placeholder="e.g. John Doe"
                        list="previous-customer-names"
                      />
                      <datalist id="previous-customer-names">
                        {customerOptions.map((c, i) => (
                          <option key={i} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <Label>Mobile number</Label>
                      <Input
                        value={form.customer_mobile}
                        onChange={(e) => setForm({ ...form, customer_mobile: e.target.value })}
                        placeholder="+1 555 0100"
                        list="previous-customer-mobiles"
                      />
                      <datalist id="previous-customer-mobiles">
                        {customerOptions.map((c, i) => (
                          <option key={i} value={c.mobile} />
                        ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label>Unit</Label>
                        <Select
                          value={form.quantity_unit}
                          onValueChange={(v) =>
                            setForm({
                              ...form,
                              quantity_unit: v,
                              quantity_unit_other: v === "__other__" ? form.quantity_unit_other : "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {QUANTITY_UNITS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                            <SelectItem value="__other__">Others</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          value={form.quantity}
                          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        />
                      </div>
                      <div
                        className={`col-span-2 grid transition-all duration-300 ease-out ${form.quantity_unit === "__other__" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden">
                          <Input
                            placeholder="Enter unit"
                            value={form.quantity_unit_other}
                            onChange={(e) => setForm({ ...form, quantity_unit_other: e.target.value })}
                            maxLength={60}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Number of loads</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.number_of_loads}
                        onChange={(e) => setForm({ ...form, number_of_loads: e.target.value })}
                        placeholder="e.g. 3"
                      />
                    </div>
                    {form.payment_kind === "invoice" && (
                      <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
                        <div>
                          <Label>Price (ex GST)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>GST (10%)</Label>
                          <Input
                            readOnly
                            value={form.price ? (Number(form.price) * 0.1).toFixed(2) : ""}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Total (inc GST)</Label>
                          <Input
                            readOnly
                            className="font-semibold"
                            value={form.price ? (Number(form.price) * 1.1).toFixed(2) : ""}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}


                    <div className="sm:col-span-2">
                      <Label>Instructions / notes</Label>
                      <Textarea
                        value={form.instructions}
                        onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                        maxLength={1000}
                        placeholder="Handling notes, delivery window, etc."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Product description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        maxLength={1000}
                      />
                    </div>

                    <div className="flex items-end gap-4 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.priority === "priority"}
                          onCheckedChange={(v) => setForm({ ...form, priority: v ? "priority" : "standard" })}
                        />
                        <Label className="text-priority">
                          <Flame className="inline h-3 w-3 mr-1" />
                          Priority
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={form.show_price}
                          onCheckedChange={(v) => setForm({ ...form, show_price: v })}
                        />
                        <Label>Show price</Label>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Driver will be assigned by Super Admin after job is created.
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={save}>Save job</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium">
          <Filter className="h-4 w-4" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Input
            placeholder="Search invoice, customer, mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={fDriver} onValueChange={setFDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Select value={fCreator} onValueChange={setFCreator}>
              <SelectTrigger>
                <SelectValue placeholder="Created By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All creators</SelectItem>
                {creators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={fLocation} onValueChange={setFLocation}>
            <SelectTrigger>
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fRange} onValueChange={(v) => setFRange(v as DateRange)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anytime</SelectItem>
              <SelectItem value="today">Daily (Today)</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {fRange === "custom" && (
            <>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
              </div>
            </>
          )}
        </div>
        {isAdmin &&
          (() => {
            const pendingCount = jobs.filter((j) => j.pending_edit).length;
            return (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={fPendingEdit ? "default" : "outline"}
                  onClick={() => setFPendingEdit((v) => !v)}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Edit requests
                  {pendingCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-priority text-priority-foreground text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]">
                      {pendingCount}
                    </span>
                  )}
                </Button>
                {fPendingEdit && (
                  <span className="text-xs text-muted-foreground">Showing jobs awaiting your approval</span>
                )}
              </div>
            );
          })()}
      </div>

      {/* Bulk bar */}
      {isAdmin && selected.size > 0 && (
        <div className="rounded-xl border bg-accent/5 p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium px-2">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdate({ status: "completed" }, "Mark completed")}>
            Mark Completed
          </Button>
          <Select onValueChange={(v) => bulkUpdate({ status: v }, `Set status to ${v}`)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Change status…" />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkAssign(v)}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue placeholder="Assign to driver…" />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="destructive" onClick={bulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {loadingJobs ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
            No jobs match filters
          </div>
        ) : null}
        {!loadingJobs && groupedJobs.map((group) => (
          <div key={group.id} className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1.5 py-1.5 bg-muted/40 rounded-lg border">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${group.badgeBg}`}>
                  {group.title}
                </span>
                <span className="text-xs text-muted-foreground font-normal">{group.subtitle}</span>
              </div>
              <span className="text-xs font-mono bg-background border px-2 py-0.5 rounded text-muted-foreground">
                {group.jobs.length} {group.jobs.length === 1 ? "Job" : "Jobs"}
              </span>
            </div>
            {group.jobs.map((j: any) => {
              const flagUnpaid = !isDriver && (j.payment_status === "pending" || j.payment_status === "partial");
              return (
              <div key={j.id} className={`rounded-xl border p-3 space-y-2 ${flagUnpaid ? "border-warning bg-warning/10" : "bg-card"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {j.job_number != null && (
                        <span className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5">
                          #{String(j.job_number).padStart(4, "0")}
                        </span>
                      )}
                      {j.priority === "priority" && <Flame className="h-3.5 w-3.5 text-priority shrink-0" />}
                      <span className="font-medium text-sm">{j.title}</span>
                      {j.cod && (
                        <span
                          className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${j.payment_status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                        >
                          COD{j.price != null ? ` $${Number(j.price).toFixed(2)}` : ""}
                        </span>
                      )}
                      {!j.cod && !isDriver && j.show_price && j.price != null && (
                        <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">
                          ${Number(j.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {j.start_time && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(j.start_time), "MMM d, h:mm a")}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={j.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-muted-foreground">Customer</div>
                    <div className="font-medium truncate">{j.customer_name || "—"}</div>
                    {j.customer_mobile && <div className="text-muted-foreground">{j.customer_mobile}</div>}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Invoice</div>
                    <div className="font-mono truncate">{j.invoice_number || "—"}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Pickup → Delivery</div>
                    <div className="truncate">{j.store_locations?.name ?? j.pickup_address ?? "—"} → {j.delivery_address ?? "—"}</div>
                  </div>
                  {!isDriver && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Driver</div>
                      <div>{j.drivers?.full_name ?? <span className="italic text-muted-foreground">Unassigned</span>}</div>
                    </div>
                  )}
                  {j.creator?.full_name && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Created By</div>
                      <div className="font-medium text-foreground">{j.creator.full_name}</div>
                    </div>
                  )}
                  {j.number_of_loads != null && (
                    <div>
                      <div className="text-muted-foreground">Loads</div>
                      <div>{j.number_of_loads}</div>
                    </div>
                  )}
                  {!(isDriver && !j.cod) && (
                    <div>
                      <div className="text-muted-foreground">Payment</div>
                      {!isDriver ? (
                        <Select value={j.payment_status} onValueChange={(v) => updatePayment(j, v)}>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_STATUSES.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <PaymentBadge status={j.payment_status} />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => setDetailFor(j)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Details
                  </Button>
                  {isDriver && (j.status === "assigned" || j.status === "pending") && (
                    <>
                      <Button size="sm" onClick={() => driverAccept(j)}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => driverReject(j)}>Reject</Button>
                    </>
                  )}
                  {isDriver && j.status === "accepted" && (
                    <Button size="sm" onClick={() => driverStart(j)}>Start job</Button>
                  )}
                  {isDriver && j.status === "in_progress" && (
                    <Button size="sm" onClick={() => { setCompleteFor(j); setCompNotes(""); setCompFile(null); }}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete
                    </Button>
                  )}
                  {(isMember && j.created_by === user?.id) || isDispatch ? (
                    <Button size="sm" variant="ghost" onClick={() => startEdit(j)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />{j.pending_edit ? "Pending…" : "Edit"}
                    </Button>
                  ) : null}
                  {(isMember || isDispatch) && (
                    <Button size="sm" variant="ghost" onClick={() => duplicate(j)} title="Duplicate">
                      <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
                    </Button>
                  )}
                  {isAssigner && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openAssign(j)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> {j.assigned_driver_id ? "Reassign" : "Assign"}
                      </Button>
                      {j.assigned_driver_id && (
                        <Button size="sm" variant="ghost" onClick={() => unassignJob(j)} title="Unassign (hold)">
                          Hold
                        </Button>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <>
                      {j.status === "completion_requested" && (
                        <Button size="sm" variant="outline" onClick={() => { setVerifyFor(j); setRejectReason(""); }}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verify
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => startEdit(j)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicate(j)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {j.pending_edit && (
                        <Button size="sm" variant="outline" onClick={() => setReviewEditFor(j)}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Review edit
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(j.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        ))}
      </div>


      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                {isAdmin && (
                  <th className="w-8">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </th>
                )}
                <th>Job</th>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Delivery</th>
                <th>Driver</th>
                <th>Created By</th>
                <th>Invoice</th>
                <th>Time</th>
                <th>Payment</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loadingJobs ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    {isAdmin && <td><div className="h-4 w-4 bg-muted rounded" /></td>}
                    <td colSpan={11}>
                      <div className="h-6 bg-muted rounded w-full my-1" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-muted-foreground py-8">
                    No jobs match filters
                  </td>
                </tr>
              ) : null}
              {!loadingJobs && groupedJobs.map((group) => (
                <Fragment key={group.id}>
                  <tr className="bg-muted/50 font-semibold border-y">
                    <td colSpan={isAdmin ? 12 : 11} className="py-2.5 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${group.badgeBg}`}>
                            {group.title}
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">{group.subtitle}</span>
                        </div>
                        <span className="text-xs font-mono bg-background border px-2.5 py-0.5 rounded-full text-muted-foreground">
                          {group.jobs.length} {group.jobs.length === 1 ? "Job" : "Jobs"}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.jobs.map((j: any) => {
                    const flagUnpaid = !isDriver && (j.payment_status === "pending" || j.payment_status === "partial");
                    return (
                    <tr key={j.id} className={flagUnpaid ? "bg-warning/10" : ""}>
                      {isAdmin && (
                        <td>
                          <Checkbox checked={selected.has(j.id)} onCheckedChange={() => toggleOne(j.id)} />
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-2">
                          {j.job_number != null && (
                            <span className="text-[10px] font-mono rounded bg-muted px-1.5 py-0.5">
                              #{String(j.job_number).padStart(4, "0")}
                            </span>
                          )}
                          {j.priority === "priority" && <Flame className="h-4 w-4 text-priority" />}
                          <span className="font-medium">{j.title}</span>
                          {j.cod && (
                            <span
                              className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${j.payment_status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}
                            >
                              COD{j.price != null ? ` $${Number(j.price).toFixed(2)}` : ""}
                            </span>
                          )}

                          {!j.cod && !isDriver && j.show_price && j.price != null && (
                            <span className="text-[10px] rounded bg-muted px-1.5 py-0.5">
                              ${Number(j.price).toFixed(2)}
                            </span>
                          )}
                          {j.proof_image_url && (
                            <button onClick={() => viewProof(j.proof_image_url)} title="View proof">
                              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          {flagUnpaid && (
                            <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-warning/20 text-warning font-medium">
                              {j.payment_status}
                            </span>
                          )}
                        </div>

                        {j.start_time && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(j.start_time), "MMM d, yyyy h:mm a")}
                          </div>
                        )}
                        {j.rejection_reason && (
                          <div className="text-xs text-destructive">Rejected: {j.rejection_reason}</div>
                        )}
                      </td>
                      <td className="text-xs">
                        <div className="font-medium">{j.customer_name || "—"}</div>
                        <div className="text-muted-foreground">{j.customer_mobile || ""}</div>
                      </td>
                      <td className="text-muted-foreground">{j.store_locations?.name ?? j.pickup_address ?? "—"}</td>
                      <td className="text-muted-foreground text-xs max-w-[220px] truncate" title={j.delivery_address ?? ""}>
                        {j.delivery_address ?? "—"}
                      </td>
                      <td className="text-muted-foreground">
                        {j.drivers?.full_name ?? <span className="italic">Unassigned</span>}
                      </td>
                      <td className="text-xs">
                        <div className="font-medium text-foreground">{j.creator?.full_name ?? "—"}</div>
                        {j.created_at && (
                          <div className="text-[10px] text-muted-foreground">
                            {format(new Date(j.created_at), "MMM d, h:mm a")}
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-xs">{j.invoice_number}</td>
                      <td className="text-xs">
                        {j.actual_start_time ? (
                          <div className="space-y-0.5">
                            <div className="text-muted-foreground">
                              {format(new Date(j.actual_start_time), "h:mm a")}
                              {j.actual_end_time && <> → {format(new Date(j.actual_end_time), "h:mm a")}</>}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {formatDuration(j.actual_start_time, j.actual_end_time)}
                            </div>
                          </div>
                        ) : j.start_time ? (
                          <span className="text-muted-foreground">{format(new Date(j.start_time), "h:mm a")}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {!isDriver ? (
                          <Select value={j.payment_status} onValueChange={(v) => updatePayment(j, v)}>
                            <SelectTrigger className="h-8 w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_STATUSES.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <PaymentBadge status={j.payment_status} />
                        )}
                      </td>
                      <td>
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setDetailFor(j)} className="mr-1">
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>

                        {isDriver && (j.status === "assigned" || j.status === "pending") && (
                          <div className="inline-flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => driverAccept(j)}>
                              Accept
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => driverReject(j)}>
                              Reject
                            </Button>
                          </div>
                        )}
                        {isDriver && j.status === "accepted" && (
                          <Button size="sm" onClick={() => driverStart(j)}>
                            Start job
                          </Button>
                        )}
                        {isDriver && j.status === "in_progress" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setCompleteFor(j);
                              setCompNotes("");
                              setCompFile(null);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Mark Completed
                          </Button>
                        )}
                        {isDriver && j.status === "completion_requested" && (
                          <span className="text-xs text-priority px-2">Awaiting verification</span>
                        )}
                        {isDriver && j.status === "rejected" && (
                          <span className="text-xs text-muted-foreground px-2">Rejected</span>
                        )}
                        {isDriver && j.status === "completed" && (
                          <span className="text-xs text-success px-2">Completed ✓</span>
                        )}
                        {(isAdmin || isDispatch || isMember) && j.status === "completion_requested" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setVerifyFor(j);
                              setRejectReason("");
                            }}
                          >
                            <ShieldCheck className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                        )}
                        {((isMember && j.created_by === user?.id) || isDispatch) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(j)}
                            title={j.pending_edit ? "Edit pending approval" : "Request edit"}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            {j.pending_edit ? "Pending…" : "Edit"}
                          </Button>
                        )}
                        {(isMember || isDispatch) && (
                          <Button size="sm" variant="ghost" onClick={() => duplicate(j)} title="Duplicate">
                            <Copy className="h-4 w-4 mr-1" />
                            Duplicate
                          </Button>
                        )}
                        {isAssigner && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openAssign(j)} className="ml-1">
                              <UserPlus className="h-4 w-4 mr-1" />
                              {j.assigned_driver_id ? "Reassign" : "Assign"}
                            </Button>
                            {j.assigned_driver_id && (
                              <Button size="sm" variant="ghost" onClick={() => unassignJob(j)} title="Unassign (hold)">
                                Hold
                              </Button>
                            )}
                          </>
                        )}
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="relative">
                                <MoreHorizontal className="h-4 w-4" />
                                {j.pending_edit && (
                                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-priority" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {j.pending_edit && (
                                <DropdownMenuItem onClick={() => setReviewEditFor(j)}>
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  Review pending edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openAssign(j)}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                {j.assigned_driver_id ? "Reassign driver" : "Assign driver"}
                              </DropdownMenuItem>
                              {j.assigned_driver_id && (
                                <DropdownMenuItem onClick={() => unassignJob(j)}>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Unassign (hold)
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => startEdit(j)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicate(j)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              {j.proof_image_url && (
                                <DropdownMenuItem onClick={() => viewProof(j.proof_image_url)}>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  View proof
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => remove(j.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && !loadingJobs && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={loadMoreJobs}
            disabled={loadingMore}
            className="text-xs font-medium border-muted-foreground/30 hover:bg-muted"
          >
            {loadingMore ? "Streaming jobs..." : "Load More Jobs"}
          </Button>
        </div>
      )}

      {/* Driver completion dialog */}
      <Dialog open={!!completeFor} onOpenChange={(v) => !v && setCompleteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for verification</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Notes</Label>
              <Textarea
                value={compNotes}
                onChange={(e) => setCompNotes(e.target.value)}
                maxLength={1000}
                placeholder="What was delivered, any issues, etc."
              />
            </div>
            <div>
              <Label>Proof image (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setCompFile(e.target.files?.[0] ?? null)} />
              {compFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {compFile.name} — {formatBytes(compFile.size)}
                  {compFile.size > 500 * 1024
                    ? " · will be resized & compressed to 200–500 KB before upload"
                    : " · stored as-is (under 500 KB)"}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">Admin will review and approve completion.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteFor(null)}>
              Cancel
            </Button>
            <Button disabled={uploading} onClick={submitCompletion}>
              {uploading ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin verify dialog */}
      <Dialog open={!!verifyFor} onOpenChange={(v) => !v && setVerifyFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify completion</DialogTitle>
          </DialogHeader>
          {verifyFor && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Job:</span>{" "}
                <span className="font-medium">{verifyFor.title}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Invoice:</span> {verifyFor.invoice_number}
              </div>
              <div>
                <span className="text-muted-foreground">Driver:</span> {verifyFor.drivers?.full_name}
              </div>
              <div>
                <span className="text-muted-foreground">Payment:</span>{" "}
                <PaymentBadge status={verifyFor.payment_status} />
              </div>
              {verifyFor.completion_notes && (
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Driver notes</div>
                  {verifyFor.completion_notes}
                </div>
              )}
              {verifyFor.proof_image_url && (
                <Button size="sm" variant="outline" onClick={() => viewProof(verifyFor.proof_image_url)}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  View proof image
                </Button>
              )}
              <div className="border-t pt-3">
                <Label>Rejection reason (optional)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why is this not approved?"
                />
              </div>
            </div>
          )}
          {verifyFor && (verifyFor.payment_status === "pending" || verifyFor.payment_status === "partial") && (
            <div className="text-xs text-warning -mt-2">
              Note: payment is {verifyFor.payment_status}. This job will be flagged in history.
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={adminReject}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={adminApprove}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin assign driver dialog */}
      <Dialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign driver</DialogTitle>
          </DialogHeader>
          {assignFor && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {assignFor.title} · Invoice {assignFor.invoice_number}
              </div>
              <div>
                <Label>Driver</Label>
                <Select value={assignDriver} onValueChange={setAssignDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start time</Label>
                  <Input type="datetime-local" value={assignStart} onChange={(e) => setAssignStart(e.target.value)} />
                </div>
                <div>
                  <Label>End time</Label>
                  <Input type="datetime-local" value={assignEnd} onChange={(e) => setAssignEnd(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Overlapping assignments are blocked automatically.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitAssign}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin review pending edit dialog */}
      <Dialog open={!!reviewEditFor} onOpenChange={(v) => !v && setReviewEditFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review requested edit</DialogTitle>
          </DialogHeader>
          {reviewEditFor && (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                {reviewEditFor.title} · Invoice {reviewEditFor.invoice_number}
              </div>
              <div className="rounded-md border divide-y">
                {Object.entries(reviewEditFor.pending_edit ?? {}).map(([k, v]) => {
                  const current = (reviewEditFor as any)[k];
                  const changed = JSON.stringify(current ?? null) !== JSON.stringify(v ?? null);
                  if (!changed) return null;
                  return (
                    <div key={k} className="grid grid-cols-3 gap-2 p-2 text-xs">
                      <div className="font-medium">{k}</div>
                      <div className="text-muted-foreground line-through truncate">{String(current ?? "—")}</div>
                      <div className="text-success truncate">{String(v ?? "—")}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={rejectPendingEdit}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button onClick={approvePendingEdit}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job detail dialog (driver view) */}
      <Dialog open={!!detailFor} onOpenChange={(v) => !v && setDetailFor(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job details</DialogTitle>
          </DialogHeader>
          {detailFor &&
            (() => {
              const j = detailFor;
              const row = (label: string, val: any) => (
                <div className="grid grid-cols-3 gap-2 py-2 border-b text-sm">
                  <div className="text-muted-foreground">{label}</div>
                  <div className="col-span-2 font-medium break-words">{val ?? "—"}</div>
                </div>
              );
              return (
                <div className="text-sm">
                  {row("Job #", j.job_number != null ? `#${String(j.job_number).padStart(4, "0")}` : "—")}
                  {row("Job title", j.title)}
                  {row(
                    "Pickup location",
                    j.store_locations
                      ? `${j.store_locations.name}${j.store_locations.address ? " — " + j.store_locations.address : ""}`
                      : j.pickup_address || "—",
                  )}
                  {row(
                    "Scheduled date (time)",
                    j.start_time
                      ? format(new Date(j.start_time), "MMM d, yyyy h:mm a")
                      : j.scheduled_date
                        ? format(new Date(j.scheduled_date), "MMM d, yyyy")
                        : "—",
                  )}
                  {row("Delivery location", j.delivery_address)}
                  {(!isDriver || j.cod) && row(
                    "Payment type",
                    j.cod
                      ? `Cash on Delivery (COD)${j.price != null ? ` — $${Number(j.price).toFixed(2)}` : ""}`
                      : "Invoice",
                  )}
                  {!isDriver && row("Invoice number", j.invoice_number || "—")}
                  {!isDriver && !j.cod && j.price != null && row("Price (ex GST)", `$${Number(j.price).toFixed(2)}`)}
                  {!isDriver && !j.cod && j.price != null && row("GST (10%)", `$${(Number(j.price) * 0.1).toFixed(2)}`)}
                  {!isDriver && !j.cod && j.price != null && row("Total (inc GST)", `$${(Number(j.price) * 1.1).toFixed(2)}`)}
                  {!isDriver && row("COD", j.cod ? "Yes" : "No")}
                  {row("Customer name", j.customer_name)}
                  {row("Mobile number", j.customer_mobile)}
                  {row("Unit", j.quantity_unit)}
                  {row("Quantity", j.quantity)}
                  {row("Number of loads", j.number_of_loads)}
                  {row("Instructions / notes", j.instructions)}
                  {row("Product description", j.description)}
                  {row("Created By", j.creator?.full_name ?? "—")}
                  {row("Created At", j.created_at ? format(new Date(j.created_at), "MMM d, yyyy h:mm a") : "—")}
                </div>
              );
            })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailFor(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
