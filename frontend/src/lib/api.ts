// lib/api.ts — Fetch wrapper with JWT auth and 401 redirect
import type {
  Appointment,
  AppointmentCreate,
  AppointmentListResponse,
  AppointmentUpdate,
  AvailabilityBlock,
  BusinessConfig,
  LoginRequest,
  SettingsUpdate,
  TokenResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("No autorizado");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (data: LoginRequest) =>
      fetchAPI<TokenResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  appointments: {
    list: (params?: string) =>
      fetchAPI<AppointmentListResponse>(
        `/api/v1/appointments${params ? `?${params}` : ""}`
      ),
    create: (data: AppointmentCreate) =>
      fetchAPI<Appointment>("/api/v1/appointments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: AppointmentUpdate) =>
      fetchAPI<Appointment>(`/api/v1/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchAPI<void>(`/api/v1/appointments/${id}`, { method: "DELETE" }),
  },

  settings: {
    get: () => fetchAPI<BusinessConfig>("/api/v1/settings"),
    update: (data: SettingsUpdate) =>
      fetchAPI<BusinessConfig>("/api/v1/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    getAvailability: () =>
      fetchAPI<AvailabilityBlock[]>("/api/v1/settings/availability"),
    updateAvailability: (blocks: AvailabilityBlock[]) =>
      fetchAPI<AvailabilityBlock[]>("/api/v1/settings/availability", {
        method: "PUT",
        body: JSON.stringify({ blocks }),
      }),
  },
};
