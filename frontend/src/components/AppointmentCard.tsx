"use client";

import { MapPin, Phone, Clock } from "lucide-react";
import type { Appointment } from "@/types";
import {
  formatTime,
  formatPhone,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/utils";

interface Props {
  appointment: Appointment;
  onStatusChange: (id: number, status: string) => void;
  compact?: boolean;
}

export default function AppointmentCard({
  appointment: appt,
  onStatusChange,
  compact = false,
}: Props) {
  const statusLabel = STATUS_LABELS[appt.status] ?? appt.status;
  const statusColor = STATUS_COLORS[appt.status] ?? "";

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${
        compact ? "p-3" : "p-5"
      }`}
    >
      {/* Header: time + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-gray-700 font-semibold text-base">
          <Clock size={16} className="flex-shrink-0 text-gray-400" />
          <span>
            {formatTime(appt.start_time)}
            {appt.end_time ? ` – ${formatTime(appt.end_time)}` : ""}
          </span>
        </div>
        <span
          className={`px-2 py-1 rounded-lg text-xs font-semibold border ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Title */}
      <p className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-lg"} mb-2`}>
        {appt.title}
      </p>

      {!compact && (
        <>
          {/* Client */}
          {appt.client && (
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <Phone size={15} className="flex-shrink-0 text-gray-400" />
              <span className="text-sm">
                {appt.client.name ?? "Sin nombre"} ·{" "}
                {formatPhone(appt.client.phone)}
              </span>
            </div>
          )}

          {/* Address */}
          {appt.address && (
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <MapPin size={15} className="flex-shrink-0 text-gray-400" />
              <span className="text-sm">{appt.address}</span>
            </div>
          )}

          {/* Notes */}
          {appt.notes && (
            <p className="text-sm text-gray-500 mt-2 italic">{appt.notes}</p>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2 flex-wrap">
            {appt.status === "pending" && (
              <>
                <button
                  onClick={() => onStatusChange(appt.id, "confirmed")}
                  className="flex-1 min-w-[120px] py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Confirmar turno
                </button>
                <button
                  onClick={() => onStatusChange(appt.id, "cancelled")}
                  className="flex-1 min-w-[120px] py-2.5 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancelar turno
                </button>
              </>
            )}
            {appt.status === "confirmed" && (
              <>
                <button
                  onClick={() => onStatusChange(appt.id, "completed")}
                  className="flex-1 min-w-[120px] py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Marcar como hecho
                </button>
                <button
                  onClick={() => onStatusChange(appt.id, "cancelled")}
                  className="flex-1 min-w-[120px] py-2.5 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancelar turno
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
