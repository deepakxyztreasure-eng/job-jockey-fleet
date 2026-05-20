const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtDuration(mins: number) {
  if (!mins || mins < 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Australia/Sydney",
    });
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { driverName, driverEmail, loginTime, logoutTime, totalMinutes } = await req.json();
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");

    const duration = fmtDuration(Number(totalMinutes ?? 0));
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px">
        <h2 style="color:#111">Driver Checkout Notification</h2>
        <p>Driver <strong>${driverName ?? "—"}</strong> has checked out.</p>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 8px;color:#555">Driver Email</td><td style="padding:4px 8px"><strong>${driverEmail ?? "—"}</strong></td></tr>
          <tr><td style="padding:4px 8px;color:#555">Login Time</td><td style="padding:4px 8px">${loginTime ? fmtDateTime(loginTime) : "—"}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Logout Time</td><td style="padding:4px 8px">${logoutTime ? fmtDateTime(logoutTime) : "—"}</td></tr>
          <tr><td style="padding:4px 8px;color:#555">Total Duration</td><td style="padding:4px 8px"><strong>${duration}</strong></td></tr>
          <tr><td style="padding:4px 8px;color:#555">Date</td><td style="padding:4px 8px">${logoutTime ? new Date(logoutTime).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" }) : ""}</td></tr>
        </table>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Jodha Group <noreply@jodhagroup.app>",
        to: ["garytippertruck@gmail.com"],
        subject: `Driver Checkout Notification - ${driverName ?? ""}`,
        html,
      }),
    });

    const data = await res.json();
    console.log("Resend response", res.status, JSON.stringify(data));
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-driver-checkout error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
