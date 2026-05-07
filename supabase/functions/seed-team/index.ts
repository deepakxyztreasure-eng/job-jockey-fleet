// One-off seeder for the client demo team + sample jobs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "super_admin" | "member" | "driver";
interface SeedUser {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: Role;
  vehicle?: string;
  license_number?: string;
}

const USERS: SeedUser[] = [
  // Super Admin
  { email: "gurinder@dispatchos.app", password: "Gurinder@2026", full_name: "Gurinder Singh Bains", phone: "0469588615", role: "super_admin" },

  // Members (admin staff)
  { email: "avtar@dispatchos.app", password: "Avtar@2026", full_name: "Avtar Singh", phone: "0430227857", role: "member" },
  { email: "balwinder@dispatchos.app", password: "Bobby@2026", full_name: "Balwinder Singh (Bobby)", phone: "0499896003", role: "member" },

  // Drivers — passwords match the codes provided
  { email: "khalid@dispatchos.app",    password: "Xn19au@2026", full_name: "Khalid",    phone: "+61418989787", role: "driver", vehicle: "Truck", license_number: "DL-KHALID" },
  { email: "adam@dispatchos.app",      password: "Xv73rz@2026", full_name: "Adam",      phone: "0423222155",   role: "driver", vehicle: "Truck", license_number: "DL-ADAM" },
  { email: "harpal@dispatchos.app",    password: "1Jk5zb@2026", full_name: "Harpal",    phone: "+61469871182", role: "driver", vehicle: "Truck", license_number: "DL-HARPAL" },
  { email: "kawaldeep@dispatchos.app", password: "Xw69dt@2026", full_name: "Kawaldeep", phone: "+61450650786", role: "driver", vehicle: "Truck", license_number: "DL-KAWAL" },
  { email: "ommi@dispatchos.app",      password: "Xv65rz@2026", full_name: "Ommi",      phone: "0470416915",   role: "driver", vehicle: "Truck", license_number: "DL-OMMI" },
  { email: "satvir@dispatchos.app",    password: "Xw34eq@2026", full_name: "Satvir",    phone: "0401298628",   role: "driver", vehicle: "Truck", license_number: "DL-SATVIR" },
  { email: "jaspal@dispatchos.app",    password: "Jaspal@2026", full_name: "Jaspal",    phone: "+61469701074", role: "driver", vehicle: "Small Tipper", license_number: "DL-JASPAL" },
  { email: "james@dispatchos.app",     password: "James@2026",  full_name: "James",     phone: "0411194594",   role: "driver", vehicle: "Small Tipper", license_number: "DL-JAMES" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const out: any[] = [];

    for (const u of USERS) {
      let userId: string | null = null;
      const { data: created, error: cerr } = await admin.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (created?.user) {
        userId = created.user.id;
      } else {
        // already exists -> find + reset password
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = list?.users.find((x) => x.email === u.email);
        if (found) {
          userId = found.id;
          await admin.auth.admin.updateUserById(userId, { password: u.password, email_confirm: true });
        }
      }
      if (!userId) { out.push({ email: u.email, error: cerr?.message ?? "no user" }); continue; }

      await admin.from("profiles").upsert({ id: userId, email: u.email, full_name: u.full_name, phone: u.phone });
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      if (u.role === "driver") {
        const { data: existing } = await admin.from("drivers").select("id").eq("user_id", userId).maybeSingle();
        if (existing) {
          await admin.from("drivers").update({
            full_name: u.full_name, email: u.email, phone: u.phone,
            license_number: u.license_number, vehicle: u.vehicle, active: true,
          }).eq("id", existing.id);
        } else {
          await admin.from("drivers").insert({
            user_id: userId, full_name: u.full_name, email: u.email, phone: u.phone,
            license_number: u.license_number, vehicle: u.vehicle,
          });
        }
      }
      out.push({ email: u.email, password: u.password, role: u.role, user_id: userId });
    }

    // ----- Sample jobs -----
    const adminUser = out.find((x) => x.email === "gurinder@dispatchos.app");
    const createdBy = adminUser?.user_id;

    // Ensure a couple of store locations exist
    let { data: stores } = await admin.from("store_locations").select("id, name").eq("active", true).limit(5);
    if (!stores || stores.length < 2) {
      await admin.from("store_locations").insert([
        { name: "Sydney Depot", address: "12 Parramatta Rd, Sydney NSW", city: "Sydney" },
        { name: "Melbourne Hub", address: "44 Spencer St, Melbourne VIC", city: "Melbourne" },
        { name: "Brisbane Yard", address: "8 Wynnum Rd, Brisbane QLD", city: "Brisbane" },
      ]);
      const r = await admin.from("store_locations").select("id, name").eq("active", true).limit(5);
      stores = r.data ?? [];
    }

    const driverIds: Record<string, string> = {};
    const { data: drv } = await admin.from("drivers").select("id, full_name");
    (drv ?? []).forEach((d: any) => { driverIds[d.full_name] = d.id; });

    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);
    const at = (h: number, m = 0) => {
      const d = new Date(today); d.setHours(h, m, 0, 0); return d.toISOString();
    };
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const tAt = (h: number, m = 0) => {
      const d = new Date(tomorrow); d.setHours(h, m, 0, 0); return d.toISOString();
    };

    const pickupA = stores?.[0]?.id ?? null;
    const pickupB = stores?.[1]?.id ?? null;

    const jobs = [
      {
        title: "Building materials to North Sydney",
        invoice_number: `INV-${Date.now()}-1`,
        pickup_location_id: pickupA,
        delivery_address: "120 Pacific Hwy, North Sydney NSW",
        scheduled_date: fmtDate(today),
        priority: "standard",
        status: "in_progress",
        payment_status: "pending",
        cod: false,
        price: 350,
        show_price: true,
        customer_name: "BuildCo Pty Ltd",
        customer_mobile: "0411111111",
        quantity: 1,
        instructions: "Call 10 min before arrival",
        created_by: createdBy,
        assigned_driver_id: driverIds["Khalid"],
        start_time: at(7, 0), end_time: at(11, 0),
        actual_start_time: at(7, 5),
      },
      {
        title: "Pallet delivery — CBD",
        invoice_number: `INV-${Date.now()}-2`,
        pickup_location_id: pickupA,
        delivery_address: "350 George St, Sydney NSW",
        scheduled_date: fmtDate(today),
        priority: "high",
        status: "completed",
        payment_status: "paid",
        cod: true,
        price: 220,
        show_price: true,
        customer_name: "Acme Retail",
        customer_mobile: "0422222222",
        quantity: 4,
        created_by: createdBy,
        assigned_driver_id: driverIds["Adam"],
        start_time: at(8, 0), end_time: at(12, 0),
        actual_start_time: at(8, 3), actual_end_time: at(11, 45),
      },
      {
        title: "Soil load to Parramatta site",
        invoice_number: `INV-${Date.now()}-3`,
        pickup_location_id: pickupB,
        delivery_address: "5 Macquarie St, Parramatta NSW",
        scheduled_date: fmtDate(tomorrow),
        priority: "standard",
        status: "assigned",
        payment_status: "pending",
        cod: false,
        price: 480,
        show_price: false,
        customer_name: "GreenScape Landscaping",
        customer_mobile: "0433333333",
        quantity: 2,
        created_by: createdBy,
        assigned_driver_id: driverIds["Jaspal"],
        start_time: tAt(6, 30), end_time: tAt(10, 30),
      },
      {
        title: "Furniture relocation",
        invoice_number: `INV-${Date.now()}-4`,
        pickup_location_id: pickupB,
        delivery_address: "22 Smith St, Chatswood NSW",
        scheduled_date: fmtDate(tomorrow),
        priority: "urgent",
        status: "pending",
        payment_status: "pending",
        cod: true,
        price: 600,
        show_price: true,
        customer_name: "HomeMove",
        customer_mobile: "0444444444",
        quantity: 1,
        instructions: "Lift access on level 3",
        created_by: createdBy,
      },
      {
        title: "Small tipper — gravel run",
        invoice_number: `INV-${Date.now()}-5`,
        pickup_location_id: pickupA,
        delivery_address: "9 Forest Rd, Hurstville NSW",
        scheduled_date: fmtDate(today),
        priority: "standard",
        status: "assigned",
        payment_status: "pending",
        cod: false,
        price: 180,
        show_price: false,
        customer_name: "Sandstone Co",
        customer_mobile: "0455555555",
        quantity: 3,
        created_by: createdBy,
        assigned_driver_id: driverIds["James"],
        start_time: at(13, 0), end_time: at(16, 0),
      },
      {
        title: "Express documents to airport",
        invoice_number: `INV-${Date.now()}-6`,
        pickup_location_id: pickupA,
        delivery_address: "Sydney Intl Airport, Mascot NSW",
        scheduled_date: fmtDate(today),
        priority: "urgent",
        status: "completed",
        payment_status: "paid",
        cod: false,
        price: 95,
        show_price: true,
        customer_name: "FastDocs",
        customer_mobile: "0466666666",
        quantity: 1,
        created_by: createdBy,
        assigned_driver_id: driverIds["Harpal"],
        start_time: at(9, 0), end_time: at(10, 30),
        actual_start_time: at(9, 2), actual_end_time: at(10, 10),
      },
    ];

    const { data: insertedJobs, error: jerr } = await admin.from("jobs").insert(jobs).select("id, title");

    return new Response(JSON.stringify({ ok: true, users: out, jobs: insertedJobs, jobs_error: jerr?.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
