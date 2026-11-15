import { getToken } from "./authStorage";
import { API_BASE_URL } from "../constants/api";

export type Appointment = {
  id: string;
  patientId: string;
  doctorName: string;
  hospital: string;
  department?: string | null;
  appointmentDate: string;
  reason: string;
  notes?: string | null;
  followUpDate?: string | null;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
};

async function authenticatedFetch(path: string, options: RequestInit = {}) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  return data;
}

export async function getAppointments(patientId?: string): Promise<Appointment[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/appointments${query}`);
  return data.appointments || [];
}

export async function getUpcomingAppointments(patientId?: string): Promise<Appointment[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/appointments/upcoming${query}`);
  return data.upcomingAppointments || [];
}

export async function getAppointmentHistory(patientId?: string): Promise<Appointment[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/appointments/history${query}`);
  return data.history || [];
}

export async function createAppointment(payload: {
  patientId?: string;
  doctorName: string;
  hospital: string;
  department?: string;
  appointmentDate: string | Date;
  reason: string;
  notes?: string;
  followUpDate?: string | Date;
}): Promise<Appointment> {
  const data = await authenticatedFetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.appointment;
}

export async function cancelAppointment(appointmentId: string, patientId?: string): Promise<Appointment> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const data = await authenticatedFetch(`/api/appointments/${appointmentId}/cancel${query}`, {
    method: "POST",
  });
  return data.appointment;
}

