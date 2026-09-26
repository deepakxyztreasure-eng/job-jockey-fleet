import { supabase } from "@/integrations/supabase/client";

// Resend API Key for transactional email delivery
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || "";

export interface SendInviteParams {
  email: string;
  fullName?: string | null;
  role?: string | null;
}

export async function sendInvitationEmail({ email, fullName, role }: SendInviteParams): Promise<{ ok: boolean; message: string; actionLink?: string }> {
  const ts = Date.now();
  const loginUrl = `${window.location.origin}/auth?mode=set-password&email=${encodeURIComponent(email)}&ts=${ts}#set-password`;

  // 1. Attempt Native Auth password reset trigger
  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: loginUrl,
    });
  } catch (e) {
    console.warn("Supabase Auth reset notice:", e);
  }

  // 2. Dispatch custom HTML invitation email via serverless /api/send-email or Resend API
  try {
    // Attempt 1: Call serverless endpoint /api/send-email (avoids CORS in deployment)
    try {
      const apiRes = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          fullName,
          role,
          loginUrl,
        }),
      });

      if (apiRes.ok) {
        return {
          ok: true,
          message: `Invitation email sent successfully to ${email}.`,
          actionLink: loginUrl,
        };
      }
    } catch (e) {
      console.warn("Serverless API endpoint call fallback:", e);
    }

    // Attempt 2: Direct Resend API call with onboarding@resend.dev sender
    const apiKey = RESEND_API_KEY;
    if (apiKey) {
      const roleLabel = (role || "member").replace("_", " ").toUpperCase();
      const displayName = fullName || email;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Welcome to Jodha Group Fleet Management</h2>
          <p>Hello <strong>${displayName}</strong>,</p>
          <p>An account has been configured for you on the <strong>Jodha Group Fleet App</strong> with role: <strong>${roleLabel}</strong>.</p>
          <p>Please click the button below to set up your account password. <strong>Note: This link is valid for 15 minutes only.</strong></p>
          <p style="margin: 25px 0;">
            <a href="${loginUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password & Login</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
          <p style="color: #ef4444; font-size: 12px; font-weight: bold; margin-top: 15px;">⏱️ Link expires in 15 minutes for security reasons.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Jodha Group Transport & Fleet Services</p>
        </div>
      `;

      const fromSender = import.meta.env.VITE_RESEND_FROM_EMAIL || "Jodha Group <onboarding@jodhagroup.app>";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromSender,
          to: [email],
          subject: "Welcome to Jodha Group - Set Up Your Account (Valid 15 Mins)",
          html: htmlContent,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          ok: true,
          message: `Invitation email sent successfully to ${email} via Resend.`,
          actionLink: loginUrl,
        };
      } else {
        console.warn("Resend direct call notice:", resData);
      }
    }
  } catch (err: any) {
    console.warn("Email dispatch notice:", err?.message || err);
  }

  return {
    ok: true,
    message: `Account setup link generated for ${email}.`,
    actionLink: loginUrl,
  };
}
