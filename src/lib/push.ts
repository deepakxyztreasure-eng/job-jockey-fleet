import { supabase } from "@/integrations/supabase/client";

// Public VAPID key (safe to ship in the client). The matching private key lives
// in the VAPID_PRIVATE_KEY secret used by the send-push edge function.
export const VAPID_PUBLIC_KEY =
  "BN4GIXHdT6yOHOEmrMZOIzX1nC96YeENEYrH6-OPdPN_UrCP4STJdfp3FxCjPTywubLH-31WLa18pup6WwNnKvo";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS/iPadOS only allows web push when the app is installed to the home screen. */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export async function getPushRegistration() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function isPushEnabled() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub && Notification.permission === "granted";
}

/** Asks for permission, subscribes, and stores the subscription for the current user. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "Push notifications are not supported on this browser." };
  }
  if (isIos() && !isStandalone()) {
    return {
      ok: false,
      error: "On iPhone/iPad, add this app to your Home Screen first, then enable notifications from there.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Notification permission was denied." };

  const reg = await getPushRegistration();
  if (!reg) return { ok: false, error: "Could not register the notification service worker." };
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "You must be signed in." };

  const { error } = await supabase.from("push_subscriptions" as any).upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: bufToBase64Url(sub.getKey("p256dh")),
      auth: bufToBase64Url(sub.getKey("auth")),
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions" as any).delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return { ok: true };
}

type PushResult = {
  ok: boolean;
  sent?: number;
  total?: number;
  removed?: number;
  errors?: string[];
  error?: string;
};

/** Fire a push to a user and return delivery diagnostics. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; url?: string; tag?: string },
): Promise<PushResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { user_id: userId, ...payload },
    });
    if (error) return { ok: false, error: error.message };
    return data as PushResult;
  } catch (e) {
    console.error("send-push", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendPushToRoles(
  roles: Array<"super_admin" | "dispatch_admin">,
  payload: { title: string; body?: string; url?: string; tag?: string },
): Promise<PushResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { target_roles: roles, ...payload },
    });
    if (error) return { ok: false, error: error.message };
    return data as PushResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function testPushToSelf(): Promise<PushResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "You must be signed in." };
  return sendPushToUser(auth.user.id, {
    title: "Jodha Ops test notification",
    body: "Push notifications are working on this device.",
    url: "/notifications",
    tag: `push-test-${Date.now()}`,
  });
}
