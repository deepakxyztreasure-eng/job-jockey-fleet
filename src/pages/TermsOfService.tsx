import { Link } from "react-router-dom";
import { ArrowLeft, Scale, Mail, Phone, MapPin, Truck, AlertCircle, ShieldAlert } from "lucide-react";
import logo from "@/assets/jodha/logo.jpg";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="border-b bg-white sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Jodha Group" className="h-10 w-auto object-contain" />
            <span className="font-bold text-lg text-slate-800 hidden sm:inline">Jodha Group</span>
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-[hsl(140,70%,15%)] text-white py-12 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold mb-4 text-emerald-200">
            <Scale className="h-4 w-4" /> Legal & Terms
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-slate-200 text-sm md:text-base max-w-2xl mx-auto">
            Terms governing the use of the Jodha Group logistics platform and the Jodha Driver application.
          </p>
          <p className="text-xs text-emerald-300/80 mt-2">
            Last Updated: October 2026 • Governing Law: Victoria, Australia
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-10 space-y-8 text-sm md:text-base leading-relaxed text-slate-700">
        
        {/* 1. Acceptance of Terms */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-600" /> 1. Acceptance of Terms
          </h2>
          <p>
            By accessing the Jodha Group web platform, requesting quarry deliveries, or downloading and logging into the <strong>Jodha Driver</strong> application, you agree to be bound by these Terms of Service. If you are using the Services on behalf of a company, organization, or contractor, you represent that you have authority to bind that entity to these terms.
          </p>
        </section>

        {/* 2. Driver Responsibilities & Safety Compliance */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" /> 2. Driver Responsibilities & Safety
          </h2>
          <p>
            All authorized drivers operating vehicles and logging into the Jodha Driver application agree to strictly observe:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-sm">
            <li><strong>Heavy Vehicle Road Rules:</strong> Obeying all applicable road safety, mass, loading, and speed regulations across Victoria and Australia.</li>
            <li><strong>Pre-Trip & Post-Trip Checklists:</strong> Completing mandatory morning clock-in inspection checklists honestly before operating a vehicle, and submitting evening shutdown checklists prior to logging out.</li>
            <li><strong>Fatigue & Work Hours:</strong> Abiding by the Heavy Vehicle National Law (HVNL) work-rest limits and recording rest breaks accurately.</li>
            <li><strong>Defect Reporting:</strong> Immediately reporting any mechanical faults, brake defects, tire damage, or safety hazards using the in-app defect reporting tool.</li>
            <li><strong>Safe Driving Conduct:</strong> Interacting with the mobile device only when safely parked or when using legally compliant hands-free mounting fixtures.</li>
          </ul>
        </section>

        {/* 3. Proof of Delivery & Sign-Off */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-emerald-600" /> 3. Proof of Delivery (POD) & Discrepancies
          </h2>
          <p>
            The Jodha Driver app requires mandatory photographic evidence of tipping/unloading and on-site customer signature confirmation.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-sm">
            <li>Customer signatures obtained via the touch screen constitute valid, legally binding acknowledgment of material receipt, quantity, and site acceptance.</li>
            <li>Any visible site damage, access obstructions, or quantity discrepancies must be noted by the driver in the delivery notes before completing the job.</li>
          </ul>
        </section>

        {/* 4. Limitation of Liability */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-emerald-600" /> 4. Limitation of Liability
          </h2>
          <p className="text-sm text-slate-600">
            Jodha Group makes every reasonable effort to maintain accurate GPS route timings, ETAs, and reliable service availability. However, we are not liable for delays caused by severe weather, traffic gridlock, mechanical breakdowns, quarry stock shortages, or telecommunication network failures in remote mobile black spots.
          </p>
        </section>

        {/* 5. Account Termination */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900">5. Termination & Suspension</h2>
          <p className="text-sm text-slate-600">
            We reserve the right to suspend or terminate driver access or customer accounts in the event of unauthorized use, fraudulent completion of delivery proofs, non-compliance with safety regulations, or breach of these terms.
          </p>
        </section>

        {/* 6. Contact Information */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">6. Legal & Support Inquiries</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm mt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <Mail className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Email</span>
                <a href="mailto:info@jodha.com.au" className="text-slate-600 hover:text-emerald-700">info@jodha.com.au</a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <Phone className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Phone</span>
                <a href="tel:0359024659" className="text-slate-600 hover:text-emerald-700">03 5902 4659 / 04 6958 8615</a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border sm:col-span-2">
              <MapPin className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Head Office</span>
                <span className="text-slate-600">Melbourne, Victoria, Australia</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Jodha Group. All Rights Reserved. Quarry Products & Earthworks Transport.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link to="/" className="hover:text-slate-800">Home</Link>
          <span>•</span>
          <Link to="/privacy" className="hover:text-slate-800">Privacy Policy</Link>
          <span>•</span>
          <Link to="/auth" className="hover:text-slate-800">Staff Portal</Link>
        </div>
      </footer>
    </div>
  );
}
