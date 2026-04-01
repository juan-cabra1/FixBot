// lib/utils.ts — Formatting utilities
import {
  addDays,
  format,
  startOfWeek,
  parseISO,
  isToday,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(iso: string): string {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
}

export function formatDateShort(date: Date): string {
  return format(date, "EEE d", { locale: es });
}

export function formatDateForApi(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatTime(time: string): string {
  // time is HH:MM:SS or HH:MM
  return time.substring(0, 5);
}

export function formatPhone(phone: string): string {
  // Remove whatsapp suffix like @s.whatsapp.net
  return phone.replace(/@.*$/, "");
}

export function getWeekDays(baseDate: Date): Date[] {
  const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function isTodayDate(date: Date): boolean {
  return isToday(date);
}

export function isSameDayDate(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function parseDateString(dateStr: string): Date {
  return parseISO(dateStr);
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
