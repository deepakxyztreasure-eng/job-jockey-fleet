// Batch-optimize existing images in the `job-proofs` storage bucket.
// Super-admin only. Processes up to `limit` objects per invocation.
// Files <= 500 KB are skipped. Larger files are resized (max 1920px) and
// re-encoded as JPEG (~200–500 KB), then overwritten in place.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_ORIGINAL = 500 * 1024;
const TARGET_MAX = 500 * 1024;
const MAX_DIM = 1920;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // AuthN + super_admin check
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 25), 50);
    const cursor: string | undefined = body.cursor;

    // List all objects recursively under root using search
    const { data: files, error: listErr } = await admin.storage
      .from("job-proofs")
      .list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
    if (listErr) throw listErr;

    // list() at root returns only top-level; job-proofs uses `${userId}/...`
    // So iterate folders (user IDs) then their objects.
    const allKeys: { path: string; size: number }[] = [];
    for (const top of files ?? []) {
      // Folders have no id/metadata
      if (top.id) {
        allKeys.push({ path: top.name, size: top.metadata?.size ?? 0 });
      } else {
        const { data: sub } = await admin.storage
          .from("job-proofs")
          .list(top.name, { limit: 1000 });
        for (const f of sub ?? []) {
          if (f.id) allKeys.push({ path: `${top.name}/${f.name}`, size: f.metadata?.size ?? 0 });
        }
      }
    }

    // Only files > 500 KB, deterministic order
    const candidates = allKeys
      .filter((k) => k.size > MAX_ORIGINAL)
      .sort((a, b) => a.path.localeCompare(b.path));

    const startIdx = cursor ? candidates.findIndex((c) => c.path > cursor) : 0;
    const batch = candidates.slice(Math.max(0, startIdx), Math.max(0, startIdx) + limit);

    const results: Record<string, unknown>[] = [];
    for (const item of batch) {
      try {
        const { data: dl, error: dlErr } = await admin.storage.from("job-proofs").download(item.path);
        if (dlErr || !dl) throw dlErr ?? new Error("download failed");
        const buf = new Uint8Array(await dl.arrayBuffer());
        const decoded = await decode(buf);
        if (!(decoded instanceof Image)) throw new Error("not a raster image");

        let img: Image = decoded;
        const maxSide = Math.max(img.width, img.height);
        if (maxSide > MAX_DIM) {
          const scale = MAX_DIM / maxSide;
          img = img.resize(Math.round(img.width * scale), Math.round(img.height * scale));
        }

        let quality = 82;
        let out = await img.encodeJPEG(quality);
        while (out.byteLength > TARGET_MAX && quality > 40) {
          quality -= 10;
          out = await img.encodeJPEG(quality);
        }

        if (out.byteLength >= item.size) {
          results.push({ path: item.path, skipped: "no gain", before: item.size, after: out.byteLength });
          continue;
        }

        const { error: upErr } = await admin.storage
          .from("job-proofs")
          .upload(item.path, out, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;

        results.push({ path: item.path, before: item.size, after: out.byteLength, quality });
      } catch (e) {
        results.push({ path: item.path, error: (e as Error).message });
      }
    }

    const nextCursor = batch.length ? batch[batch.length - 1].path : null;
    const remaining = candidates.length - (startIdx + batch.length);

    return json({
      processed: batch.length,
      totalCandidates: candidates.length,
      remaining: Math.max(0, remaining),
      nextCursor,
      results,
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
