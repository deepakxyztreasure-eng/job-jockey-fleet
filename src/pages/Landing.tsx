import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Truck, MapPin, ShieldCheck, Clock, Receipt, Activity, AlertTriangle,
  XCircle, LayoutDashboard, ArrowRight, CheckCircle2, Briefcase, Users,
} from "lucide-react";
import hero from "@/assets/landing-hero.jpg";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email().max(255),
  business_type: z.string().trim().max(100).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Landing() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", business_type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.from("lead_submissions").insert({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      business_type: parsed.data.business_type || null,
      message: parsed.data.message || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks! We'll be in touch within 24 hours.");
    setForm({ name: "", phone: "", email: "", business_type: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Dispatch OS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => scrollTo("problem")} className="hover:text-foreground">Problem</button>
            <button onClick={() => scrollTo("solution")} className="hover:text-foreground">Solution</button>
            <button onClick={() => scrollTo("features")} className="hover:text-foreground">Features</button>
            <button onClick={() => scrollTo("how")} className="hover:text-foreground">How it works</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-foreground">Contact</button>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Button size="sm" onClick={() => scrollTo("contact")}>Request Demo</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={hero}
          alt="Fleet logistics operations dashboard"
          width={1600}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="container relative py-24 md:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Custom-built for your operations
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Struggling to manage <span className="text-accent">jobs & drivers</span> efficiently?
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              We build custom systems that help you assign jobs, track drivers in real time, and control every part of your operation — from one clean dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => scrollTo("contact")}>Request Demo <ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo("contact")}>Get Your System Built</Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> No setup fees</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Built around your workflow</div>
            </div>
          </div>

          {/* Inline mini inquiry */}
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg">Talk to an expert</h3>
              <p className="text-sm text-muted-foreground">Quick form — we reply within 24 hours.</p>
              <form onSubmit={submit} className="mt-4 grid gap-3">
                <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={30} />
                  <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} />
                </div>
                <Input placeholder="Business type (e.g. Logistics)" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} maxLength={100} />
                <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Request a Demo"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="container py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent">The problem</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Operations get messy fast.</h2>
          <p className="mt-3 text-muted-foreground">If any of this sounds familiar, you're losing time and money every single day.</p>
        </div>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: AlertTriangle, t: "Manual job tracking", d: "Spreadsheets, WhatsApp, missed updates." },
            { icon: XCircle, t: "No driver visibility", d: "You don't know who's where or what's happening." },
            { icon: Clock, t: "Missed assignments", d: "Jobs get delayed, customers get angry." },
            { icon: Receipt, t: "Untracked invoices", d: "Payments slip through the cracks." },
          ].map((p) => (
            <Card key={p.t}><CardContent className="p-5">
              <p.icon className="h-6 w-6 text-destructive" />
              <h3 className="mt-3 font-semibold">{p.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </CardContent></Card>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section id="solution" className="bg-secondary/40 border-y">
        <div className="container py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-accent">The solution</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold">One dashboard. Total control.</h2>
            <p className="mt-3 text-muted-foreground">Our Job & Driver Management System helps you run a tight, predictable operation:</p>
            <ul className="mt-6 space-y-3">
              {[
                "Assign jobs to drivers in seconds",
                "Track drivers live on the map",
                "Manage pickups across multiple locations",
                "Handle invoices and priority jobs without chaos",
                "Run the whole business from one screen",
              ].map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-8" onClick={() => scrollTo("contact")}>Get Your System Built <ArrowRight className="h-4 w-4" /></Button>
          </div>
          <Card className="shadow-lg">
            <CardContent className="p-2">
              <div className="rounded-md bg-sidebar text-sidebar-foreground p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white"><LayoutDashboard className="h-4 w-4" /> Live Operations</div>
                  <span className="text-xs opacity-70">Today</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[{ k: "Active Jobs", v: 24 }, { k: "Drivers Online", v: 12 }, { k: "Completed", v: 87 }].map((s) => (
                    <div key={s.k} className="rounded-lg bg-sidebar-accent p-3">
                      <p className="text-xs opacity-70">{s.k}</p>
                      <p className="text-2xl font-semibold text-white">{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  {[
                    { t: "Invoice #INV-1042 — Urgent", s: "In Progress" },
                    { t: "Pickup • Westside Warehouse", s: "Assigned" },
                    { t: "Delivery to 14 Park Ave", s: "Completed" },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center justify-between rounded-md bg-sidebar-accent/60 px-3 py-2 text-sm">
                      <span className="text-white/90">{r.t}</span>
                      <span className="text-xs rounded-full bg-accent px-2 py-0.5 text-accent-foreground">{r.s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-accent">Features</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Everything you need to run dispatch.</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: ShieldCheck, t: "Role-based access", d: "Admin, Staff, and Driver views — each with the right permissions." },
            { icon: Briefcase, t: "Job creation & assignment", d: "Create, dispatch, and reassign jobs in seconds." },
            { icon: MapPin, t: "Store location management", d: "Pickup locations as a clean dropdown, not free text." },
            { icon: AlertTriangle, t: "Priority job handling", d: "Mark jobs Standard or Urgent — surface what matters." },
            { icon: Receipt, t: "Invoice tracking", d: "Tie every job to an invoice and never lose payments." },
            { icon: Clock, t: "Time-based allocation", d: "Prevent overlapping driver schedules automatically." },
            { icon: Activity, t: "Live driver tracking", d: "Real-time location and status, so you always know." },
            { icon: Users, t: "Driver management", d: "Profiles, vehicles, licenses — all in one place." },
            { icon: LayoutDashboard, t: "One dashboard", d: "Every metric, every job, one screen." },
          ].map((f) => (
            <Card key={f.t} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-4 font-semibold">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-secondary/40 border-y">
        <div className="container py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-accent">How it works</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Three steps to launch.</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "We understand your business", d: "Discovery call to map your real workflow and pain points." },
              { n: "02", t: "We build your custom system", d: "Tailored features, your branding, your rules." },
              { n: "03", t: "You run everything from one dashboard", d: "Onboarding, training, and ongoing support included." },
            ].map((s) => (
              <Card key={s.n}><CardContent className="p-6">
                <div className="text-3xl font-semibold text-accent">{s.n}</div>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </CardContent></Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-accent">Why teams choose us</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Run leaner. Move faster. Grow.</h2>
            <p className="mt-3 text-muted-foreground">Stop firefighting and start scaling.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Save hours on dispatch every day",
              "Reduce human errors to near zero",
              "Increase fleet efficiency",
              "Full visibility & control",
              "Scalable as you grow",
              "Custom-fit, not off-the-shelf",
            ].map((b) => (
              <div key={b} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <span className="text-sm">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA banner */}
      <section className="container pb-20">
        <div className="rounded-2xl bg-sidebar text-sidebar-foreground p-10 md:p-14 relative overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-semibold text-white">Get your custom system today.</h2>
            <p className="mt-3 opacity-80">We'll show you a live demo built around the way you actually run your business.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => scrollTo("contact")}>Request Demo</Button>
              <Button size="lg" variant="outline" className="bg-transparent text-white border-white/30 hover:bg-white/10 hover:text-white" onClick={() => scrollTo("contact")}>
                Talk to an Expert
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="container pb-24">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <p className="text-sm font-medium text-accent">Contact</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold">Tell us about your operation.</h2>
            <p className="mt-3 text-muted-foreground max-w-md">Share a few details and we'll get back within 24 hours with a tailored plan and live walkthrough.</p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-success" /> No obligation</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-success" /> NDA available</div>
              <div className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-success" /> Built and shipped in weeks</div>
            </div>
          </div>
          <Card>
            <CardContent className="p-6">
              <form onSubmit={submit} className="grid gap-4">
                <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={30} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
                </div>
                <div><Label>Business type</Label><Input placeholder="Logistics, delivery, services..." value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} maxLength={100} /></div>
                <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" disabled={loading} size="lg">{loading ? "Sending..." : "Send Inquiry"}</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t">
        <div className="container py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>© {new Date().getFullYear()} Dispatch OS — Job & Driver Management System</span>
          </div>
          <Link to="/auth" className="hover:text-foreground">Customer login →</Link>
        </div>
      </footer>
    </div>
  );
}
