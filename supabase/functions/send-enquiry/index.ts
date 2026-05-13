const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { name, phone, email, business_type, message } = await req.json();

    if (!name || !email || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");

    const esc = (s: string) =>
      String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
      );

    const html = `
      <h2>New Enquiry from Jodha Group Website</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Phone:</strong> ${esc(phone)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Business Type:</strong> ${esc(business_type || "-")}</p>
      <p><strong>Message:</strong></p>
      <p>${esc(message || "-").replace(/\n/g, "<br/>")}</p>
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
        reply_to: email,
        subject: `New Enquiry - ${name}`,
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

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-enquiry error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
