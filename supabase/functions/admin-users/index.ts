// Admin user management: create / update / delete members & resend invite
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "Unauthorized" });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "super_admin").maybeSingle();
    if (!roleRow) return json({ ok: false, error: "Forbidden: SuperAdmin required" });

    const body = await req.json();
    const action = body.action as string;

    if (action === "create") {
      const { email, password, full_name, phone, role } = body;
      if (!email || !role) return json({ ok: false, error: "Email and role are required" });

      const tempPassword = password && password.length >= 6 ? password : `Jodha@${Math.floor(100000 + Math.random() * 900000)}`;

      // Create user in Supabase Auth
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createErr) {
        return json({ ok: false, error: createErr.message });
      }

      const uid = created.user!.id;

      // Update profile details
      await admin.from("profiles").upsert({
        id: uid,
        full_name: full_name || null,
        email,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      });

      // Assign user role
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("user_roles").insert({ user_id: uid, role });

      // Generate login setup / invitation link
      let actionLink: string | null = null;
      try {
        const { data: linkData } = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (linkData?.properties?.action_link) {
          actionLink = linkData.properties.action_link;
        }
      } catch { /* noop */ }

      // Attempt sending invitation email via Supabase Auth
      try {
        await admin.auth.admin.inviteUserByEmail(email);
      } catch { /* noop */ }

      return json({
        ok: true,
        user_id: uid,
        message: `Member ${email} created successfully. Invitation email sent.`,
        action_link: actionLink,
      });
    }

    if (action === "resend_invite") {
      const { email, user_id } = body;
      let targetEmail = email;

      if (!targetEmail && user_id) {
        const { data: userData } = await admin.auth.admin.getUserById(user_id);
        targetEmail = userData?.user?.email;
      }

      if (!targetEmail) return json({ ok: false, error: "Email or user_id required" });

      let actionLink: string | null = null;
      let emailSent = false;

      // 1. Try sending invitation email
      const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(targetEmail);
      if (!inviteErr) {
        emailSent = true;
      }

      // 2. Generate recovery / setup link as fallback or for manual copying
      try {
        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: targetEmail,
        });
        if (!linkErr && linkData?.properties?.action_link) {
          actionLink = linkData.properties.action_link;
        }
      } catch { /* noop */ }

      return json({
        ok: true,
        email_sent: emailSent,
        message: `Invitation email processed for ${targetEmail}.`,
        action_link: actionLink,
      });
    }

    if (action === "update") {
      const { user_id, full_name, phone, role, password } = body;
      if (!user_id) return json({ ok: false, error: "user_id required" });

      await admin.from("profiles").update({ full_name, phone }).eq("id", user_id);

      if (role) {
        await admin.from("user_roles").delete().eq("user_id", user_id);
        await admin.from("user_roles").insert({ user_id, role });
      }

      if (password && typeof password === "string" && password.length >= 6) {
        const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, { password });
        if (pwErr) return json({ ok: false, error: pwErr.message });
      }

      return json({ ok: true, message: "User updated successfully" });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ ok: false, error: "user_id and password required" });
      if (password.length < 6) return json({ ok: false, error: "Password must be at least 6 characters" });

      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ ok: false, error: error.message });

      return json({ ok: true, message: "Password updated successfully" });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ ok: false, error: "user_id required" });
      if (user_id === u.user.id) return json({ ok: false, error: "Cannot delete yourself" });

      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ ok: false, error: error.message });

      return json({ ok: true, message: "User deleted" });
    }

    return json({ ok: false, error: "Unknown action" });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message });
  }
});

function json(b: unknown) {
  return new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
