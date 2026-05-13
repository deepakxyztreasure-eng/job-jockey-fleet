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
  Mail, Phone, Star, ArrowRight, CheckCircle2, Truck, Calculator, ShieldCheck, Clock, Award, MapPin,
} from "lucide-react";
import hero from "@/assets/jodha/hero.jpg";
import groupProduct from "@/assets/jodha/group-product.webp";
import gardenImg from "@/assets/jodha/garden.png";
import constructionImg from "@/assets/jodha/construction.png";
import buildingImg from "@/assets/jodha/building.png";
import crushedImg from "@/assets/jodha/crushed.webp";
import sandTopsoilImg from "@/assets/jodha/sand-topsoil.webp";
import asphaltImg from "@/assets/jodha/asphalt.webp";
import rocksImg from "@/assets/jodha/rocks.webp";
import tipperImg from "@/assets/jodha/tipper.png";
import mulchImg from "@/assets/jodha/mulch.webp";
import logo from "@/assets/jodha/logo.jpg";

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
    toast.success("Thanks! We'll be in touch shortly.");
    setForm({ name: "", phone: "", email: "", business_type: "", message: "" });
  };

  const categories = [
    { img: gardenImg, title: "Garden Materials", desc: "High-quality garden soils, compost, mulch, and decorative stones—ideal for healthy lawns, garden beds, water features, and landscape design. Our blends ensure strong growth, moisture retention, and weed control." },
    { img: constructionImg, title: "Construction Materials", desc: "Washed sands, aggregates, crushed rock, drainage gravel, recycled asphalt, and crushed concrete—engineered for strength, durability, and sustainability in residential and civil construction." },
    { img: buildingImg, title: "Building Materials", desc: "Crusher dust, base course, pavement gravel, landscape rocks, and rubble for large-scale builds, roadworks, retaining walls, and decorative stonework—balancing aesthetics with structural performance." },
  ];

  const products = [
    { img: crushedImg, title: "Crushed Rock & Aggregate", desc: "We provide a range of quality crushed rock and aggregate materials ideal for Civil Construction." },
    { img: sandTopsoilImg, title: "Sand & Topsoil", desc: "Sourcing only the best products of high quality sand and premium topsoil." },
    { img: asphaltImg, title: "Recycled Asphalt", desc: "Jodha Group provide quality recycled asphalt at the best price & ensuring the highest quality bitumen mix." },
    { img: rocksImg, title: "Rubble & Landscape Rocks", desc: "Quality products for the professional or DIY Landscaper, ranging from rubble, beach rocks, soft rock and decorative landscaping rubble." },
    { img: tipperImg, title: "Tipper Hire & Earthworks", desc: "We supply rubble, beach rocks, and decorative stones for landscaping. Tipper trucks available for short or long-term hire." },
    { img: mulchImg, title: "Mulch & Bark", desc: "A range of quality mulch and bark ideal for gardens and landscapes. Perfect for moisture retention, weed control, and a clean, natural finish." },
  ];

  const pillars = [
    { icon: Award, t: "Over 15 Years of Industry Experience", d: "With deep industry knowledge and refined processes, we bring proven expertise to every project—ensuring reliable solutions and successful outcomes." },
    { icon: Truck, t: "Reliable, Australia-Wide Delivery", d: "Our modern fleet and nationwide logistics network ensure timely delivery to metro and regional sites, keeping your project on track." },
    { icon: ShieldCheck, t: "Competitive Pricing & Bulk Supply", d: "We offer quality materials at competitive prices, with bulk supply options that deliver great value and cost efficiency." },
    { icon: Clock, t: "Tailored Advice for Every Project", d: "From DIY to large-scale construction, our team provides tailored guidance to help you choose the right materials and avoid costly mistakes." },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top contact bar */}
      <div className="bg-[hsl(140,70%,18%)] text-white text-sm">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <span className="font-medium">4.8 Google rating</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <a href="mailto:info@jodha.com.au" className="flex items-center gap-2 hover:underline"><Mail className="h-4 w-4" /> info@jodha.com.au</a>
            <a href="tel:0359024659" className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" /> 03 5902 4659</a>
            <a href="tel:0499896003" className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" /> 0499 896 003</a>
          </div>
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b bg-white">
        <div className="container flex h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Jodha Group logo" className="h-12 w-auto object-contain" />
            <div className="leading-tight hidden sm:block">
              <div className="text-[10px] text-muted-foreground tracking-widest">QUARRY PRODUCTS · EARTHWORKS</div>
            </div>
          </Link>
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium">
            <button onClick={() => scrollTo("home")} className="text-[hsl(28,90%,50%)]">Home</button>
            <button onClick={() => scrollTo("about")} className="hover:text-[hsl(140,70%,18%)]">About us</button>
            <button onClick={() => scrollTo("products")} className="hover:text-[hsl(140,70%,18%)]">Products</button>
            <button onClick={() => scrollTo("tipper")} className="hover:text-[hsl(140,70%,18%)]">Tipper Hire & Earthworks</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-[hsl(140,70%,18%)]">Contact us</button>
          </nav>
          <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative">
        <img src={hero} alt="Quarry products" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative container py-28 md:py-40 text-center text-white">
          <h1 className="mx-auto max-w-4xl text-4xl md:text-6xl font-bold leading-tight">
            Quality Quarry Products & Material for Melbourne, Victoria's Growing Needs
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base md:text-lg text-white/90">
            Supplying premium quarry products & material across Melbourne, industries — trusted by civil, commercial & residential sectors statewide.
          </p>
          <div className="mt-8">
            <Button size="lg" className="hover:bg-primary/90 inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-white rounded-full h-12 bg-[#f2780d] opacity-100 px-[50px]" onClick={() => scrollTo("contact")}>
              Sign in
            </Button>
          </div>
        </div>
        <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 text-black text-center font-medium py-3 px-4">
          Over 15 years of trusted industry experience, built on quality and reliability.
        </div>
      </section>

      {/* About */}
      <section id="about" className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">
              <span className="text-[hsl(28,90%,50%)]">Welcome to Jodha Group:</span>{" "}
              <span className="text-foreground">Your Trusted Partner for Quarry Materials Across Australia</span>
            </h2>
            <p className="mt-6 text-muted-foreground leading-relaxed">
              Welcome to <strong className="text-foreground">Jodha Group</strong>, Australia's premier supplier of <strong className="text-foreground">high-quality materials</strong> for an extensive range of projects, from intricate garden designs to large-scale civil infrastructure developments. With a proud legacy spanning over 15 years, we've built a reputation for delivering not just materials, but also dependable service and tailored solutions that underpin the success of countless ventures nationwide.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              At Jodha Group, we understand that the foundation of any successful project lies in the quality of its materials. That's why we meticulously source and supply a comprehensive selection of products, ensuring each meets stringent Australian standards for performance and durability.
            </p>
          </div>
          <div className="relative">
            <img src={groupProduct} alt="All quarry products" className="rounded-2xl w-full" />
            <div className="absolute -bottom-6 -left-6 bg-[hsl(140,70%,18%)] text-white rounded-2xl px-8 py-6 shadow-xl">
              <div className="text-4xl font-bold">15 years</div>
              <div className="text-sm opacity-90">of experience</div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator banner */}
      <section className="bg-[hsl(140,70%,18%)] text-white">
        <div className="container py-16 grid md:grid-cols-[auto,1fr,auto] items-center gap-8">
          <Calculator className="h-16 w-16 text-[hsl(28,90%,55%)] hidden md:block" />
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Calculate Your Quarry Material Easily</h2>
            <p className="mt-2 text-white/80 max-w-2xl">
              Get accurate material calculations for any garden or outdoor project. Quickly estimate the quantities of sand, gravel, or stone you need and plan your project with confidence.
            </p>
          </div>
          <Button size="lg" className="bg-[hsl(28,90%,50%)] hover:bg-[hsl(28,90%,45%)] text-white rounded-full px-7" onClick={() => scrollTo("contact")}>
            Get Your Material Estimate <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Categories */}
      <section id="products" className="container py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold">Our Extensive Range of Quarry Materials: Building Australia, Naturally</h2>
          <p className="mt-4 text-muted-foreground">
            We've categorised our vast product offering into three core areas to make it easy for you to find exactly what you need. Each category represents our dedication to quality and our understanding of diverse project requirements.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {categories.map((c) => (
            <Card key={c.title} className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-shadow">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img src={c.img} alt={c.title} className="h-full w-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-[hsl(140,70%,18%)]">{c.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                <button onClick={() => scrollTo("contact")} className="mt-4 inline-flex items-center gap-1 text-[hsl(28,90%,50%)] font-semibold text-sm hover:gap-2 transition-all">
                  See more <ArrowRight className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-secondary/40 border-y">
        <div className="container py-20">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold">Why Choose Jodha Group? Our Pillars of Excellence</h2>
            <p className="mt-4 text-muted-foreground">
              Our sustained growth and strong client relationships over the past 15 years are a testament to our unwavering commitment to a set of core values that define the Jodha Group experience.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((p) => (
              <Card key={p.t} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="h-14 w-14 rounded-full bg-[hsl(140,70%,18%)] flex items-center justify-center">
                    <p.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mt-5 font-bold">{p.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {["Top quality products at best prices", "Over 15 Years of Industry Experience", "Guarantee on time deliveries"].map((b) => (
              <div key={b} className="flex items-start gap-3 rounded-lg bg-card border p-4">
                <CheckCircle2 className="h-5 w-5 text-[hsl(140,70%,30%)] mt-0.5 shrink-0" />
                <span className="text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section id="tipper" className="container py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <Card key={p.title} className="overflow-hidden group border-0 shadow-md hover:shadow-xl transition-shadow">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img src={p.img} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-[hsl(140,70%,18%)]">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <button onClick={() => scrollTo("contact")} className="mt-4 inline-flex items-center gap-1 text-[hsl(28,90%,50%)] font-semibold text-sm hover:gap-2 transition-all">
                  See more <ArrowRight className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-[hsl(140,70%,18%)] text-white">
        <div className="container py-20 grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Get In Touch With Us..!</h2>
            <p className="mt-4 text-white/85 leading-relaxed">
              Ready to get started on your next project? Or perhaps you simply have a question about our materials or services? The Jodha Group team is always ready to assist. We offer free, no-obligation quotes and are happy to discuss your project's unique requirements in detail.
            </p>
            <p className="mt-3 text-white/85 leading-relaxed">
              Call us today for a free quote, or use our online enquiry form to get in touch. Let Jodha Group be the cornerstone of your next successful endeavour.
            </p>
            <div className="mt-8 space-y-4">
              <a href="tel:0359024659" className="flex items-center gap-3 hover:text-[hsl(28,90%,55%)]">
                <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center"><Phone className="h-5 w-5" /></div>
                <span className="text-lg font-semibold">03 5902 4659</span>
              </a>
              <a href="tel:0469588615" className="flex items-center gap-3 hover:text-[hsl(28,90%,55%)]">
                <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center"><Phone className="h-5 w-5" /></div>
                <span className="text-lg font-semibold">04 6958 8615</span>
              </a>
              <a href="mailto:info@jodha.com.au" className="flex items-center gap-3 hover:text-[hsl(28,90%,55%)]">
                <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center"><Mail className="h-5 w-5" /></div>
                <span className="text-lg font-semibold">info@jodha.com.au</span>
              </a>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center"><MapPin className="h-5 w-5" /></div>
                <span className="text-lg">Melbourne, Victoria, Australia</span>
              </div>
            </div>
          </div>
          <Card className="text-foreground">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold">Send us an enquiry</h3>
              <form onSubmit={submit} className="mt-4 grid gap-4">
                <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} /></div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required maxLength={30} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} /></div>
                </div>
                <div><Label>Project type</Label><Input placeholder="Civil, residential, landscaping..." value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} maxLength={100} /></div>
                <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" disabled={loading} size="lg" className="bg-[hsl(28,90%,50%)] hover:bg-[hsl(28,90%,45%)]">
                  {loading ? "Sending..." : "Send Enquiry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="bg-[hsl(140,70%,12%)] text-white/80">
        <div className="container py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Jodha Group" className="h-9 w-auto bg-white rounded px-1 py-0.5 object-contain" />
            <span>© {new Date().getFullYear()} Jodha Group — Quarry Products & Earthworks</span>
          </div>
          <Link to="/auth" className="hover:text-white">Customer login →</Link>
        </div>
      </footer>
    </div>
  );
}
