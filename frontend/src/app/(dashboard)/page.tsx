"use client";

import { useEffect, useState } from "react";
import { Plus, CalendarX } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateForApi } from "@/lib/utils";
import type { Appointment } from "@/types";
import AppointmentCard from "@/components/AppointmentCard";
import NewAppointmentModal from "@/components/NewAppointmentModal";

export default function HomePage() {
  const today = new Date();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  async function loadToday() {
    setLoading(true);
    try {
      const res = await api.appointments.list(
        `date=${formatDateForApi(today)}`
      );
      setAppointments(res.items);
    } catch {
      setError("No se pudieron cargar los turnos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStatusChange(id: number, status: string) {
    try {
      const updated = await api.appointments.update(id, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    } catch {
      setError("No se pudo actualizar el estado");
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Turnos de hoy</h1>
        <p className="text-gray-500 mt-1 capitalize">{formatDate(today.toISOString())}</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-16">Cargando turnos...</div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-16">
          <CalendarX size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-lg font-medium">No tenés turnos para hoy</p>
          <p className="text-gray-400 text-sm mt-1">
            Podés agregar uno con el botón de abajo
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg transition-colors"
      >
        <Plus size={22} />
        Nuevo turno
      </button>

      {showModal && (
        <NewAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadToday();
          }}
        />
      )}
    </div>
  );
}
