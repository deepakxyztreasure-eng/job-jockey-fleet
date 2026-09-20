import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/jodha/logo.jpg";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6).max(72);

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Detect recovery or invite token in URL or hash
  useEffect(() => {
    const hash = window.location.hash;
    const mode = searchParams.get("mode");
    if (hash.includes("type=recovery") || hash.includes("access_token") || mode === "set-password" || hash.includes("set-password")) {
      setActiveTab("set-password");
      toast.info("Please set your account password below.");
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return toast.error("Invalid email address");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back");
      navigate("/dashboard");
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return toast.error("Please enter your email");
    if (!passwordSchema.safeParse(password).success) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);

    try {
      // 1. Try updating user password directly if session exists from invite token
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (!updateErr) {
          toast.success("Password set successfully! Redirecting...");
          navigate("/dashboard");
          return;
        }
      }

      // 2. Otherwise try signing in first with password, or creating credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInErr) {
        toast.success("Signed in successfully!");
        navigate("/dashboard");
        return;
      }

      // 3. Fallback: Create/Activate user account credentials via signUp
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || email.split("@")[0] },
        },
      });

      if (signUpErr) {
        toast.error(signUpErr.message);
      } else {
        toast.success("Account password set! You may now sign in.");
        setActiveTab("signin");
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not set password");
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
          <CardHeader>
            <CardTitle>Welcome to Jodha Group</CardTitle>
            <CardDescription>Sign in to your account or set your login password</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="set-password">Set Password</TabsTrigger>
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
                    <Label>Password</Label>
                    <Input type="password" required placeholder="••••••••" value={password} onChange={(e)=>setPassword(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("set-password")}
                      className="text-xs text-primary hover:underline"
                    >
                      Invited or setting your password for the first time? Click here
                    </button>
                  </div>
                </form>
              </TabsContent>

              {/* Set / Reset Password Tab */}
              <TabsContent value="set-password">
                <form onSubmit={handleSetPassword} className="space-y-4 mt-4">
                  <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground">
                    Enter your account email and choose a password to complete your account setup.
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" required placeholder="user@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label>New Password *</Label>
                    <Input type="password" required placeholder="Min 6 characters" value={password} onChange={(e)=>setPassword(e.target.value)} minLength={6} />
                  </div>
                  <div>
                    <Label>Confirm Password *</Label>
                    <Input type="password" required placeholder="Re-enter new password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} minLength={6} />
                  </div>
                  <Button className="w-full" disabled={loading}>{loading ? "Saving password..." : "Set Password & Continue"}</Button>
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
        </Card>
      </div>
    </div>
  );
}
