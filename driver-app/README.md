# Jodha Driver Mobile App (Native iOS & Android)

A native mobile application built with **React Native & Expo SDK 51** for heavy vehicle and tipper truck drivers operating across quarry routes and construction sites.

---

## Features Implemented

1. **Company Branding & App Icon:** Configured with official Jodha Group company logo.
2. **Driver Management & Linking:** Authenticates against existing Supabase backend and automatically links driver profile via `link_driver_account()`.
3. **Morning Safety Checklist:**
   - 5 mandatory questions with explicit **YES / NO** toggles.
   - If any answer is **NO**: prompts for defect notes & enters real-time **Awaiting Super Admin Sign-Off** locked state.
   - Screen unlocks automatically via Supabase Realtime when Super Admin approves.
4. **Evening Logout Maintenance Checklist:**
   - Enforces 9 maintenance checks (fuel, AdBlue, leaks, nuts & bolts, tyres, oil, coolant, clean bin, morning load) before closing shift and logging out.
5. **Audible & Visual Dispatch Alerts:**
   - Custom loud audio chimes for new job allocations and urgent dispatch instructions.
   - Persistent in-app update modals for unacknowledged changes.
6. **4-Segmented Job Views:**
   - **Current Job** (active run with one-tap navigation to Apple Maps / Google Maps)
   - **New Job Allocated** (with Accept / Reject actions)
   - **Jobs Accepted** (queued upcoming runs)
   - **Completed Jobs**
   - **Pre-Acceptance Notes:** Gate codes, site hazards, and contact phone numbers visible *before* accepting.
7. **Delivery Confirmation (POD):**
   - Mandatory delivery photo capture with automatic compression (< 500 KB).
   - Customer signature pad & recipient full name capture.
   - 4-digit customer PIN verification fallback.
   - Weighbridge docket scan with Gross, Tare, and Net tonnage auto-calculation.
8. **Adaptive Background GPS Tracking:**
   - Moving (> 15 km/h): updates every **15 seconds**.
   - Stationary (< 5 km/h): throttles to **90 seconds** to save battery and cellular data.
   - Pauses completely when clocked out for driver privacy.
9. **NHVR Fatigue Management (Chain of Responsibility):**
   - Continuous driving timer (alerts at 5.0 hours, mandatory 15-minute rest break at 5.25 hours).
10. **Mid-Shift Defect & Incident Reporting:**
    - Instant roadside photo + category + severity reporting without waiting for evening checklist.
11. **SOS Emergency Button:**
    - 2-second hold emergency trigger with live GPS dispatch to Super Admin.
12. **Two-Way Dispatch Chat:**
    - Real-time in-app messaging between driver and dispatch.
13. **Offline Mode for Quarry Black Spots:**
    - Actions queue locally in AsyncStorage and auto-sync when cellular signal returns.
    - Physical completion timestamp is preserved as official event time.

---

## Running the App in Development

### 1. Install Dependencies
```bash
cd driver-app
npm install
```

### 2. Start Expo Development Server
```bash
npm start
```

### 3. Open on Physical Device
1. Install **Expo Go** from the App Store (iOS) or Google Play Store (Android).
2. Scan the QR code displayed in the terminal.
3. The app will launch with live reload on your phone!

---

## Building Standalone Native Binaries (EAS Build)

To build standalone `.ipa` (iOS) and `.apk` / `.aab` (Android) for App Store and Google Play:

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login to your Expo account
eas login

# 3. Configure project
eas build:configure

# 4. Build for Android (APK for testing)
eas build -p android --profile preview

# 5. Build for iOS (TestFlight / App Store)
eas build -p ios --profile production
```
