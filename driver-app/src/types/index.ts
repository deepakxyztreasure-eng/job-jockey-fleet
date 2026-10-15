export type AppRole = 'super_admin' | 'dispatch_admin' | 'member' | 'driver';

export interface DriverProfile {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  vehicle: string | null;
  active: boolean;
}

export type JobStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'payment_pending'
  | 'closed'
  | 'completion_requested'
  | 'rejected'
  | 'issue';

export type JobPriority = 'standard' | 'priority';

export interface JobStop {
  id: string;
  job_id: string;
  stop_order: number;
  stop_type: 'pickup' | 'delivery' | 'weighbridge' | 'waypoint';
  location_id?: string | null;
  address: string;
  customer_name?: string | null;
  customer_mobile?: string | null;
  gate_code?: string | null;
  site_hazards?: string | null;
  contact_person?: string | null;
  instructions?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  status: 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped';
  arrived_at?: string | null;
  completed_at?: string | null;
  proof_image_url?: string | null;
  signature_url?: string | null;
  signer_name?: string | null;
  pin_code?: string | null;
  docket_image_url?: string | null;
  notes?: string | null;
}

export interface Job {
  id: string;
  job_number?: number | null;
  title: string;
  description?: string | null;
  pickup_address?: string | null;
  delivery_address?: string | null;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  priority: JobPriority;
  status: JobStatus;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  instructions?: string | null;
  quantity?: number | null;
  quantity_unit?: string | null;
  number_of_loads?: number | null;
  cod?: boolean;
  price?: number | null;
  show_price?: boolean;
  completion_notes?: string | null;
  proof_image_url?: string | null;
  customer_signature_url?: string | null;
  customer_signature_name?: string | null;
  customer_pin?: string | null;
  weighbridge_docket_url?: string | null;
  gross_weight?: number | null;
  tare_weight?: number | null;
  net_weight?: number | null;
  created_at: string;
  stops?: JobStop[];
}

export interface ChecklistItemResponse {
  item_key: string;
  title: string;
  answer: 'yes' | 'no';
  notes?: string;
  photo_url?: string;
}

export interface DriverChecklist {
  id?: string;
  driver_id: string;
  checklist_type: 'morning' | 'evening';
  date: string;
  responses: ChecklistItemResponse[];
  requires_signoff: boolean;
  signoff_status: 'none' | 'pending' | 'approved' | 'rejected';
  signoff_by?: string | null;
  signoff_notes?: string | null;
  signoff_at?: string | null;
  submitted_at: string;
}

export interface VehicleDefectReport {
  id?: string;
  driver_id: string;
  vehicle?: string | null;
  job_id?: string | null;
  defect_type: 'tyre' | 'brakes' | 'hydraulic_leak' | 'engine_oil' | 'coolant' | 'lights' | 'body' | 'incident' | 'other';
  severity: 'minor' | 'urgent_action_required' | 'critical_ground_vehicle';
  description: string;
  photo_urls?: string[];
  status: 'open' | 'acknowledged' | 'repaired' | 'dismissed';
  reported_at: string;
}

export interface FatigueLog {
  id?: string;
  driver_id: string;
  event_type: 'shift_start' | 'work_driving' | 'rest_break' | 'shift_end';
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

export interface EmergencyAlert {
  id?: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  location_address?: string | null;
  battery_level?: number | null;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
}

export interface JobMessage {
  id: string;
  job_id?: string | null;
  driver_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message_text: string;
  attachment_url?: string | null;
  created_at: string;
}
