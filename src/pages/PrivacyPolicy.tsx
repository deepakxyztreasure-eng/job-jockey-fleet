import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Mail, Phone, MapPin, Trash2, Lock, Eye, FileText } from "lucide-react";
import logo from "@/assets/jodha/logo.jpg";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
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
            <ShieldCheck className="h-4 w-4" /> Privacy & Compliance
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-slate-200 text-sm md:text-base max-w-2xl mx-auto">
            How Jodha Group collects, uses, and safeguards information across our web applications and the Jodha Driver mobile app.
          </p>
          <p className="text-xs text-emerald-300/80 mt-2">
            Last Updated: October 2026 • Compliant with the Australian Privacy Principles (Privacy Act 1988) & Google Play Policies
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-10 space-y-8 text-sm md:text-base leading-relaxed text-slate-700">
        
        {/* 1. Introduction */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" /> 1. Introduction
          </h2>
          <p>
            Jodha Group ("we", "our", or "us"), based in Melbourne, Victoria, Australia, operates quarry product supply, tipper transport, earthworks logistics, and fleet operations. This Privacy Policy outlines our practices regarding data collection, usage, and disclosure through our web application, dispatch console, and the <strong>Jodha Driver</strong> Android mobile application (collectively, the "Services").
          </p>
          <p>
            By accessing our Services or installing the Jodha Driver application, you acknowledge and agree to the collection and handling of your information as described in this policy.
          </p>
        </section>

        {/* 2. Information We Collect */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-600" /> 2. Information We Collect
          </h2>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900">A. Personal Identification Data</h3>
              <p className="text-slate-600 text-sm mt-0.5">
                When an account is created by dispatch or a driver registers, we collect: full name, email address, mobile phone number, driver license number, assigned vehicle identifier, and operational role.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900">B. Precise & Background Location Data</h3>
              <p className="text-slate-600 text-sm mt-0.5">
                The <strong>Jodha Driver</strong> application collects precise GPS coordinates (latitude, longitude, speed, heading, and altitude) when a driver is clocked in or on active duty:
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 mt-1">
                <li><strong>Foreground & Active Route:</strong> To calculate real-time estimated time of arrival (ETA) for customer deliveries and optimize transport routes.</li>
                <li><strong>Background Location:</strong> To ensure continuous tracking across mobile black spots and remote quarry delivery sites, to monitor heavy vehicle driver fatigue/rest compliance under Heavy Vehicle National Law (HVNL / NHVR), and to provide real-time dispatcher visibility.</li>
                <li><strong>SOS Emergency Dispatch:</strong> To transmit the driver's exact coordinates to management in the event of an emergency.</li>
              </ul>
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200 mt-2">
                <strong>Notice:</strong> Background location tracking is only active during the driver's working shift (while clocked in) and stops completely when the driver clocks out or ends their shift.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">C. Camera, Photos & Digital Signatures</h3>
              <p className="text-slate-600 text-sm mt-0.5">
                The app requests camera access to allow drivers to:
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1 mt-1">
                <li>Capture Proof of Delivery (POD) photos of tipped materials and job site conditions.</li>
                <li>Capture on-site customer touch signatures to confirm delivery receipt and resolve disputes.</li>
                <li>Attach photographic evidence of mid-shift vehicle defects or safety incidents.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">D. Push Notification Tokens & Device Diagnostics</h3>
              <p className="text-slate-600 text-sm mt-0.5">
                We collect device tokens (via Expo Notifications) to deliver instant audible and visual job allocation notices, urgent dispatch instructions, and safety alerts.
              </p>
            </div>
          </div>
        </section>

        {/* 3. How We Use Your Data */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" /> 3. How We Use Information
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong>Transport & Dispatch Logistics:</strong> Allocating delivery jobs, coordinating tipper runs, and notifying drivers of route updates.</li>
            <li><strong>Proof of Delivery (POD) Verification:</strong> Providing customers and dispatch with delivery photos, customer signatures, and timestamps.</li>
            <li><strong>Safety & Compliance:</strong> Enforcing NHVR fatigue management, pre-trip vehicle checklists, defect logging, and emergency SOS responses.</li>
            <li><strong>Two-Way Communication:</strong> Enabling in-app messaging between drivers and dispatchers.</li>
            <li><strong>Billing & Invoicing:</strong> Generating accurate delivery logs and timesheets based on confirmed completion records.</li>
          </ul>
        </section>

        {/* 4. Data Sharing & Third Parties */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900">4. Data Sharing & Disclosure</h2>
          <p>
            We do <strong>not</strong> sell, rent, or trade personal data to third parties or advertisers. We share information only under these operational conditions:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Cloud Service Providers:</strong> Encrypted backend databases and file storage (Supabase / AWS / Google Cloud) strictly for application hosting.</li>
            <li><strong>Clients & Receiving Sites:</strong> Delivery confirmation summaries (POD photo, signer name, delivery timestamp, and signature) are shared with the relevant customer who ordered the materials.</li>
            <li><strong>Regulatory & Legal Obligations:</strong> If required by Australian law, law enforcement, or heavy vehicle safety regulators (e.g., NHVR).</li>
          </ul>
        </section>

        {/* 5. Data Retention & Security */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-xl font-bold text-slate-900">5. Data Storage & Security</h2>
          <p>
            All network communication occurs over secure Transport Layer Security (HTTPS / TLS 1.3). Database records, proof photos, and digital signatures are stored in secure access-controlled cloud infrastructure with row-level security (RLS) enforcement.
          </p>
          <p>
            Operational delivery logs and compliance checklists are retained as required by Australian commercial transport and tax regulations (typically up to 7 years for tax and Chain of Responsibility compliance).
          </p>
        </section>

        {/* 6. Account & Data Deletion (Google Play Mandatory) */}
        <section id="account-deletion" className="bg-emerald-50/70 p-6 md:p-8 rounded-xl border border-emerald-200 space-y-4">
          <div className="flex items-center gap-2 text-emerald-800">
            <Trash2 className="h-6 w-6 text-emerald-700" />
            <h2 className="text-xl font-bold text-emerald-900">6. Account & Data Deletion Request (User Rights)</h2>
          </div>
          <p className="text-emerald-950">
            In accordance with Google Play policies and privacy standards, users and drivers have the right to request the deletion of their user profile and associated personal data.
          </p>
          <div className="bg-white p-5 rounded-lg border border-emerald-200 space-y-2">
            <h3 className="font-bold text-slate-900">How to Request Account & Data Deletion:</h3>
            <p className="text-slate-600 text-sm">
              To request full deletion of your user account and personal details:
            </p>
            <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
              <li>Send an email to: <a href="mailto:info@jodha.com.au?subject=Account%20Deletion%20Request" className="font-semibold text-emerald-700 hover:underline">info@jodha.com.au</a></li>
              <li>Use the subject line: <strong>"Account Deletion Request - [Your Full Name]"</strong></li>
              <li>Specify your registered email address and phone number.</li>
            </ol>
            <div className="mt-3 pt-3 border-t text-xs text-slate-500">
              <strong>Processing Timeline:</strong> Upon receiving your request, our administration team will verify your identity, disable your profile, and permanently purge your credentials and contact records within <strong>30 days</strong>, retaining only records mandated by Australian transport and tax law.
            </div>
          </div>
        </section>

        {/* 7. Contact Us */}
        <section className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-900">7. Contact Information</h2>
          <p className="text-slate-600">
            If you have questions, feedback, or concerns regarding this Privacy Policy or how your data is handled, please contact us:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 text-sm mt-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <Mail className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Email Us</span>
                <a href="mailto:info@jodha.com.au" className="text-slate-600 hover:text-emerald-700">info@jodha.com.au</a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border">
              <Phone className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Call Us</span>
                <a href="tel:0359024659" className="text-slate-600 hover:text-emerald-700">03 5902 4659 / 04 6958 8615</a>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border sm:col-span-2">
              <MapPin className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="block font-semibold text-slate-900">Operating Location</span>
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
          <Link to="/terms" className="hover:text-slate-800">Terms of Service</Link>
          <span>•</span>
          <Link to="/auth" className="hover:text-slate-800">Staff Portal</Link>
        </div>
      </footer>
    </div>
  );
}
