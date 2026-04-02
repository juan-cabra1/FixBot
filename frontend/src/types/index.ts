// TypeScript interfaces mirroring backend Pydantic schemas

export interface ClientEmbed {
  id: number;
  phone: string;
  name: string | null;
}

export interface ServiceEmbed {
  id: number;
  name: string;
}

export interface Appointment {
  id: number;
  client_id: number;
  service_id: number | null;
  title: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  address: string | null;
  notes: string | null;
  created_by: "agent" | "dashboard";
  created_at: string;
  client: ClientEmbed | null;
  service: ServiceEmbed | null;
}

export interface AppointmentListResponse {
  items: Appointment[];
  total: number;
}

export interface AppointmentCreate {
  client_id: number;
  service_id?: number | null;
  title: string;
  date: string;
  start_time: string;
  end_time?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface AppointmentUpdate {
  title?: string;
  date?: string;
  start_time?: string;
  end_time?: string | null;
  status?: string;
  address?: string | null;
  notes?: string | null;
}

export interface BusinessConfig {
  id: number;
  name: string;
  description: string | null;
  owner_name: string;
  phone: string;
  timezone: string;
  agent_name: string;
  agent_tone: string;
  system_prompt: string;
  welcome_message: string;
  fallback_message: string;
  outside_hours_msg: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsUpdate {
  name?: string;
  description?: string;
  owner_name?: string;
  phone?: string;
  timezone?: string;
  agent_name?: string;
  agent_tone?: string;
  system_prompt?: string;
  welcome_message?: string;
  fallback_message?: string;
  outside_hours_msg?: string;
}

export interface AvailabilityBlock {
  id?: number | null;
  day_of_week: number;
  start_time: string; // HH:MM:SS
  end_time: string;
  is_active: boolean;
}

export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: string | null; // Decimal serialized as string
  currency: string;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export interface ServiceCreate {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  duration_minutes?: number | null;
}

export interface ServiceUpdate {
  name?: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  duration_minutes?: number | null;
  is_active?: boolean;
}

export interface BusinessRules {
  coverage_zone: string;
  materials_policy: "included" | "client_provides" | "to_agree";
  handles_emergencies: boolean;
  emergency_details: string;
  custom_rules: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
