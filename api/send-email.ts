export default async function handler(req: any, res: any) {
  // Enable CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { to, fullName, role, loginUrl } = body;
    if (!to) {
      return res.status(400).json({ error: "Missing recipient email" });
    }

    const apiKey = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const roleLabel = (role || "member").replace("_", " ").toUpperCase();
    const displayName = fullName || to;
    const ts = Date.now();
    const targetUrl = loginUrl || `https://staging.jodhagroup.app/auth?mode=set-password&email=${encodeURIComponent(to)}&ts=${ts}#set-password`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Welcome to Jodha Group Fleet Management</h2>
        <p>Hello <strong>${displayName}</strong>,</p>
        <p>An account has been configured for you on the <strong>Jodha Group Fleet App</strong> with role: <strong>${roleLabel}</strong>.</p>
        <p>Please click the button below to set up your account password. <strong>Note: This link is valid for 15 minutes only.</strong></p>
        <p style="margin: 25px 0;">
          <a href="${targetUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password & Login</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${targetUrl}" style="color: #2563eb;">${targetUrl}</a></p>
        <p style="color: #ef4444; font-size: 12px; font-weight: bold; margin-top: 15px;">⏱️ Link expires in 15 minutes for security reasons.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Jodha Group Transport & Fleet Services</p>
      </div>
    `;

    // Dispatch via Resend API
    let resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.VITE_RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "Jodha Group <onboarding@jodhagroup.app>",
        to: Array.isArray(to) ? to : [to],
        subject: "Welcome to Jodha Group - Set Up Your Account (Valid 15 Mins)",
        html: htmlContent,
      }),
    });

    const resendData = await resendRes.json();
    return res.status(resendRes.status).json(resendData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
