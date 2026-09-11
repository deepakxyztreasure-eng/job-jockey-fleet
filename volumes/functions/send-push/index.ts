import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { sendWebPush } from "./webpush.ts";

const BodySchema = z.object({
  user_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).max(100).optional(),
  target_roles: z.array(z.enum(["super_admin", "dispatch_admin"])).max(2).optional(),
  title: z.string().min(1).max(120).default("Jodha Ops"),
  body: z.string().max(300).optional(),
  url: z.string().max(200).optional(),
  tag: z.string().max(80).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:garytippertruck@gmail.com";
    if (!publicKey || !privateKey) return json({ error: "VAPID keys are not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Supabase env vars are missing" }, 500);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    const admin = createClient(url, service);
    const directIds = body.user_ids ?? (body.user_id ? [body.user_id] : []);
    const isSelfOnly = directIds.length > 0 && directIds.every((id) => id === userData.user.id);

    const { data: callerRoleRows, error: callerRoleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (callerRoleErr) return json({ error: `caller role: ${callerRoleErr.message}` }, 500);
    const callerRoles = (callerRoleRows ?? []).map((row) => row.role);

    let roleIds: string[] = [];
    if (body.target_roles?.length) {
      const canNotifyRoles = callerRoles.some((role) =>
        ["super_admin", "dispatch_admin", "member"].includes(role)
      );
      if (!canNotifyRoles) return json({ error: "Forbidden" }, 403);
      const { data: roleRows, error: roleErr } = await admin
        .from("user_roles")
        .select("user_id")
        .in("role", body.target_roles);
      if (roleErr) return json({ error: `roles: ${roleErr.message}` }, 500);
      roleIds = (roleRows ?? []).map((row) => row.user_id);
    }

    if (!isSelfOnly && directIds.length) {
      const canTargetUsers = callerRoles.some((role) =>
        ["super_admin", "dispatch_admin"].includes(role)
      );
      if (!canTargetUsers) return json({ error: "Forbidden" }, 403);
    }

    const targetUserIds = [...new Set([...directIds, ...roleIds])];
    if (targetUserIds.length === 0) {
      return json({ error: "user_id, user_ids, or target_roles is required" }, 400);
    }

    const payload = JSON.stringify({
      title: String(body.title ?? "Jodha Ops").slice(0, 120),
      body: String(body.body ?? "").slice(0, 300),
      url: String(body.url ?? "/jobs").slice(0, 200),
      tag: body.tag ? String(body.tag).slice(0, 80) : undefined,
    });

    const { data: subs, error: subErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", targetUserIds);
    if (subErr) return json({ error: `subscriptions: ${subErr.message}` }, 500);

    let sent = 0;
    const stale: string[] = [];
    const errors: string[] = [];

    for (const s of subs ?? []) {
      try {
        const res = await sendWebPush({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
          payload,
          subject,
          publicKey,
          privateKey,
        });
        if (res.ok || res.status === 201 || res.status === 202) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          stale.push(s.id);
        } else {
          errors.push(`${res.status} ${(await res.text()).slice(0, 200)}`);
        }
      } catch (e) {
        errors.push(String(e).slice(0, 200));
      }
    }

    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
    if (errors.length) console.error("push errors", errors);

    return json({ ok: true, sent, removed: stale.length, total: subs?.length ?? 0, errors });
  } catch (e) {
    console.error("send-push error", e);
    return json({ error: String(e) }, 500);
  }
});
