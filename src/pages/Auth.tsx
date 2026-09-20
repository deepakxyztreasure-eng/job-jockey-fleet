import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, Clock, KeyRound, ArrowLeft } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/jodha/logo.jpg";
import { sendInvitationEmail } from "@/lib/email";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6).max(72);

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  // View state: 'auth' (Sign In / Sign Up) | 'set-password' | 'forgot-password'
  const [viewMode, setViewMode] = useState<"auth" | "set-password" | "forgot-password">("auth");
  const [isLinkExpired, setIsLinkExpired] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const mode = searchParams.get("mode");
    const paramEmail = searchParams.get("email");
    const tsStr = searchParams.get("ts");

    if (paramEmail) {
      setEmail(paramEmail);
    }

    // Check if link is for setting password
    if (mode === "set-password" || hash.includes("type=recovery") || hash.includes("access_token") || hash.includes("set-password")) {
      setViewMode("set-password");

      // Verify 15-minute expiration window if timestamp parameter is present
      if (tsStr) {
        const linkTs = Number(tsStr);
        if (!isNaN(linkTs)) {
          const ageInMinutes = (Date.now() - linkTs) / (1000 * 60);
          if (ageInMinutes > 15) {
            setIsLinkExpired(true);
          } else {
            setIsLinkExpired(false);
          }
        }
      }
    } else if (mode === "forgot-password") {
      setViewMode("forgot-password");
    } else {
      setViewMode("auth");
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email address");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.warning("Email not confirmed yet. Sending a 15-minute setup link to your email...");
        sendInvitationEmail({ email }).catch(() => {});
        setViewMode("forgot-password");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Welcome back");
      navigate("/dashboard");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    if (!emailSchema.safeParse(targetEmail).success) return toast.error("Please enter a valid email address");
    if (!passwordSchema.safeParse(password).success) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      // 1. Check current session
      const { data: { session } } = await supabase.auth.getSession();

      // 2. If active session belongs to a DIFFERENT user (e.g. Super Admin), log out immediately!
      if (session?.user?.email && session.user.email.toLowerCase() !== targetEmail.toLowerCase()) {
        console.warn(`Signing out existing session for ${session.user.email} to set password for ${targetEmail}`);
        await supabase.auth.signOut();
      }

      // 3. Re-check session after signout
      const { data: { session: activeSession } } = await supabase.auth.getSession();

      // 4. If session belongs to targetEmail (e.g. from recovery token), update password
      if (activeSession?.user?.email && activeSession.user.email.toLowerCase() === targetEmail.toLowerCase()) {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (!updateErr) {
          toast.success(`Password set successfully for ${targetEmail}! Logging in...`);
          navigate("/dashboard");
          return;
        }
      }

      // 5. Try signing in with target email & new password
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
      if (!signInErr && signInData?.session) {
        toast.success(`Signed in as ${targetEmail}!`);
        navigate("/dashboard");
        return;
      }

      // 6. Register/activate credentials for target receiver email
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: targetEmail,
        password,
        options: {
          data: { full_name: fullName || targetEmail.split("@")[0] },
        },
      });

      if (signUpErr) {
        if (signUpErr.message.toLowerCase().includes("already registered") || signUpErr.message.toLowerCase().includes("user already exists")) {
          // Retry signing in
          const { data: retrySignIn, error: retryErr } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
          if (!retryErr && retrySignIn?.session) {
            toast.success(`Signed in as ${targetEmail}!`);
            navigate("/dashboard");
            return;
          }
          toast.info(`Account exists for ${targetEmail}. Dispatching a 15-minute setup link to your email...`);
          await sendInvitationEmail({ email: targetEmail });
          setViewMode("auth");
        } else {
          toast.error(signUpErr.message);
        }
      } else {
        // Immediately sign in after signUp
        const { data: postSignUpSignIn, error: postSignInErr } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
        if (!postSignInErr && postSignUpSignIn?.session) {
          toast.success(`Password set successfully! Logged in as ${targetEmail}`);
          navigate("/dashboard");
          return;
        }

        if (signUpData?.session) {
          toast.success(`Password configured! Logged in as ${targetEmail}`);
          navigate("/dashboard");
        } else {
          toast.success(`Password set for ${targetEmail}! A confirmation email has been sent.`);
          await sendInvitationEmail({ email: targetEmail }).catch(() => {});
          setViewMode("auth");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not set password");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return toast.error("Please enter a valid email address");
    setLoading(true);
    try {
      const res = await sendInvitationEmail({ email });
      toast.success(res.message || "A 15-minute password reset link has been dispatched to your email.");
    } catch (err: any) {
      toast.error(err?.message || "Could not process password reset request");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email address");
    if (!passwordSchema.safeParse(password).success) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created successfully!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Jodha Group" className="h-12 w-auto bg-white rounded-md p-1 object-contain" />
          <span className="font-semibold text-lg text-white">Jodha Group</span>
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-white leading-tight">
            Job & driver management,<br/>built for fast operations.
          </h2>
          <p className="mt-3 text-sm opacity-80">Assign jobs, prevent schedule conflicts, track drivers, and close the loop on payments — all in one console.</p>
        </div>
        <p className="text-xs opacity-60">© {new Date().getFullYear()} Jodha Group</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          {/* VIEW MODE: EXPIRED LINK WARNING */}
          {viewMode === "set-password" && isLinkExpired && (
            <>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 text-destructive font-semibold">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Security Warning: Link Expired</span>
                </div>
                <CardDescription>
                  This password setup link was generated over <strong>15 minutes ago</strong> and has expired for security reasons.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md space-y-1">
                  <p className="font-medium">Why did this happen?</p>
                  <p>Invitation and password setup links remain valid for 15 minutes only to protect your account against unauthorized access.</p>
                </div>
                <div className="space-y-2 pt-2">
                  <Button variant="default" className="w-full" onClick={() => setViewMode("forgot-password")}>
                    Request New 15-Minute Link
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => { setSearchParams({}); setViewMode("auth"); }}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* VIEW MODE: DYNAMIC VALID SET PASSWORD CARD */}
          {viewMode === "set-password" && !isLinkExpired && (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="h-5 w-5 text-primary" /> Set Account Password
                  </CardTitle>
                  <div className="flex items-center gap-1 text-[11px] bg-amber-500/10 text-amber-600 font-medium px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" /> Valid 15 mins
                  </div>
                </div>
                <CardDescription>
                  Create your login password to complete your account setup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <Label>Account Email</Label>
                    <Input type="email" required readOnly={!!email} className={email ? "bg-muted" : ""} placeholder="user@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>New Password *</Label>
                    <Input type="password" required placeholder="Min 6 characters" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={6} />
                  </div>
                  <div>
                    <Label>Confirm Password *</Label>
                    <Input type="password" required placeholder="Re-enter new password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} minLength={6} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Saving password..." : "Set Password & Sign In"}</Button>
                  <div className="text-center pt-2">
                    <button type="button" onClick={() => { setSearchParams({}); setViewMode("auth"); }} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back to Sign In
                    </button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {/* VIEW MODE: FORGOT PASSWORD REQUEST CARD */}
          {viewMode === "forgot-password" && (
            <>
              <CardHeader>
                <CardTitle className="text-lg">Reset Account Password</CardTitle>
                <CardDescription>
                  Enter your registered email address to receive a secure 15-minute password link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label>Email Address</Label>
                    <Input type="email" required placeholder="user@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Sending link..." : "Send 15-Min Reset Link"}</Button>
                  <div className="text-center pt-2">
                    <button type="button" onClick={() => { setSearchParams({}); setViewMode("auth"); }} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back to Sign In
                    </button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {/* VIEW MODE: STANDARD PUBLIC AUTH (SIGN IN / SIGN UP TABS ONLY) */}
          {viewMode === "auth" && (
            <>
              <CardHeader>
                <CardTitle>Welcome to Jodha Group</CardTitle>
                <CardDescription>Sign in or create an account to continue</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signin">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  {/* Sign In Tab */}
                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                      <div>
                        <Label>Email</Label>
                        <Input type="email" required placeholder="user@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label>Password</Label>
                          <button
                            type="button"
                            onClick={() => setViewMode("forgot-password")}
                            className="text-xs text-primary hover:underline font-normal"
                          >
                            Forgot or set password?
                          </button>
                        </div>
                        <Input type="password" required placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} />
                      </div>
                      <Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
                    </form>
                  </TabsContent>

                  {/* Sign Up Tab */}
                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                      <div>
                        <Label>Full name</Label>
                        <Input value={fullName} onChange={(e)=>setFullName(e.target.value)} required maxLength={100} placeholder="Your full name" />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" required placeholder="user@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                      </div>
                      <div>
                        <Label>Password</Label>
                        <Input type="password" required placeholder="Min 6 characters" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={6} />
                      </div>
                      <Button className="w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
                      <p className="text-xs text-muted-foreground">New accounts default to <strong>Member</strong>. A Super Admin can promote your role.</p>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
