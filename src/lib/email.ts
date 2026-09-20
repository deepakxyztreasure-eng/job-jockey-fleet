import { supabase } from "@/integrations/supabase/client";

// Resend API Key for transactional email delivery
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || "";

export interface SendInviteParams {
  email: string;
  fullName?: string | null;
  role?: string | null;
}

export async function sendInvitationEmail({ email, fullName, role }: SendInviteParams): Promise<{ ok: boolean; message: string; actionLink?: string }> {
  const loginUrl = `${window.location.origin}/auth`;

  // 1. Attempt Native Auth password reset trigger
  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: loginUrl,
    });
  } catch (e) {
    console.warn("Supabase Auth reset notice:", e);
  }

  // 2. Dispatch custom HTML invitation email via Resend API
  try {
    const roleLabel = (role || "member").replace("_", " ").toUpperCase();
    const displayName = fullName || email;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Welcome to Jodha Group Fleet Management</h2>
        <p>Hello <strong>${displayName}</strong>,</p>
        <p>An account has been configured for you on the <strong>Jodha Group Fleet App</strong> with role: <strong>${roleLabel}</strong>.</p>
        <p>Please click the button below to access your account and set up your login password:</p>
        <p style="margin: 25px 0;">
          <a href="${loginUrl}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Password & Login</a>
        </p>
        <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:<br/><a href="${loginUrl}" style="color: #2563eb;">${loginUrl}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">Jodha Group Transport & Fleet Services</p>
      </div>
    `;

    const apiKey = RESEND_API_KEY;
    if (apiKey) {
      // First attempt: Custom domain sender
      let res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "Jodha Group <noreply@jodhagroup.app>",
          to: [email],
          subject: "Welcome to Jodha Group - Set Up Your Account",
          html: htmlContent,
        }),
      });

      let resData = await res.json().catch(() => ({}));

      // Second attempt: Fallback to Resend testing domain if domain is not yet verified
      if (!res.ok && (resData?.message?.includes("domain") || resData?.statusCode === 403 || resData?.name === "validation_error")) {
        console.warn("Custom domain unverified on Resend. Retrying with onboarding@resend.dev...", resData);
        res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: "Jodha Group <onboarding@resend.dev>",
            to: [email],
            subject: "Welcome to Jodha Group - Set Up Your Account",
            html: htmlContent,
          }),
        });
        resData = await res.json().catch(() => ({}));
      }

      if (res.ok) {
        return {
          ok: true,
          message: `Invitation email sent successfully to ${email} via Resend.`,
          actionLink: loginUrl,
        };
      } else {
        const errorMsg = resData?.message || `Resend API returned status ${res.status}`;
        console.error("Resend delivery failed:", resData);
        return {
          ok: false,
          message: `Resend email failed: ${errorMsg}`,
          actionLink: loginUrl,
        };
      }
    }
  } catch (err: any) {
    console.error("Resend API Exception:", err);
    return {
      ok: false,
      message: `Failed to dispatch email: ${err?.message || err}`,
      actionLink: loginUrl,
    };
  }

  return {
    ok: true,
    message: `Invitation processed for ${email}.`,
    actionLink: loginUrl,
  };
}
