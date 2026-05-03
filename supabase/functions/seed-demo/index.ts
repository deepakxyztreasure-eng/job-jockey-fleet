import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO = [
  { email: "demo.admin@dispatchos.app", password: "DemoAdmin#2026", full_name: "Demo Admin", role: "super_admin" },
  { email: "demo.member@dispatchos.app", password: "DemoMember#2026", full_name: "Demo Member", role: "member" },
  { email: "demo.driver@dispatchos.app", password: "DemoDriver#2026", full_name: "Demo Driver", role: "driver", driver: true },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: any[] = [];
    for (const u of DEMO) {
      // try create
      let userId: string | null = null;
      const { data: created, error: cerr } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (created?.user) {
        userId = created.user.id;
      } else {
        // already exists - find by listing
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users.find((x) => x.email === u.email);
        if (found) userId = found.id;
      }
      if (!userId) { results.push({ email: u.email, error: cerr?.message ?? "no user" }); continue; }

      await admin.from("profiles").upsert({ id: userId, email: u.email, full_name: u.full_name });
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      if (u.driver) {
        const { data: existing } = await admin.from("drivers").select("id").eq("user_id", userId).maybeSingle();
        if (!existing) {
          await admin.from("drivers").insert({
            user_id: userId, full_name: u.full_name, email: u.email,
            phone: "+1-555-0199", license_number: "DL-DEMO-001", vehicle: "Ford Transit (Demo)",
          });
        }
      }
      results.push({ email: u.email, password: u.password, role: u.role });
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
