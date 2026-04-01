"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import {
  formatDateShort,
  formatDateForApi,
  getWeekDays,
  isTodayDate,
  isSameDayDate,
  parseDateString,
} from "@/lib/utils";
import type { Appointment } from "@/types";
import AppointmentCard from "@/components/AppointmentCard";
import NewAppointmentModal from "@/components/NewAppointmentModal";

export default function AgendaPage() {
  const [baseDate, setBaseDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const weekDays = getWeekDays(baseDate);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  async function loadWeek() {
    setLoading(true);
    try {
      const res = await api.appointments.list(
        `from_date=${formatDateForApi(weekStart)}&to_date=${formatDateForApi(weekEnd)}`
      );
      setAppointments(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDate]);

  async function handleStatusChange(id: number, status: string) {
    const updated = await api.appointments.update(id, { status });
    setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    if (selected?.id === id) setSelected(updated);
  }

  function prevWeek() {
    setBaseDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 7);
      return nd;
    });
  }

  function nextWeek() {
    setBaseDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 7);
      return nd;
    });
  }

  function goToday() {
    setBaseDate(new Date());
  }

  function appointmentsForDay(day: Date) {
    return appointments.filter((a) =>
      isSameDayDate(parseDateString(a.date), day)
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Agenda semanal</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goToday}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={nextWeek}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Semana siguiente"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Week range label */}
      <p className="text-gray-500 text-sm mb-4 capitalize">
        {formatDateShort(weekStart)} — {formatDateShort(weekEnd)}
      </p>

      {loading ? (
        <div className="text-center text-gray-400 py-16">Cargando agenda...</div>
      ) : (
        /* Week grid */
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const dayAppts = appointmentsForDay(day);
            const isToday = isTodayDate(day);
            return (
              <div key={day.toISOString()} className="min-h-[200px]">
                {/* Day header */}
                <div
                  className={`text-center py-2 px-1 rounded-xl mb-2 ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  <p className={`text-xs font-semibold capitalize ${isToday ? "text-blue-100" : "text-gray-500"}`}>
                    {formatDateShort(day).split(" ")[0]}
                  </p>
                  <p className={`text-lg font-bold leading-none ${isToday ? "text-white" : "text-gray-900"}`}>
                    {formatDateShort(day).split(" ")[1]}
                  </p>
                </div>

                {/* Appointments for day */}
                <div className="space-y-2">
                  {dayAppts.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center pt-2">—</p>
                  ) : (
                    dayAppts.map((appt) => (
                      <button
                        key={appt.id}
                        onClick={() => setSelected(appt)}
                        className="w-full text-left"
                      >
                        <AppointmentCard
                          appointment={appt}
                          onStatusChange={handleStatusChange}
                          compact
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <AppointmentCard
              appointment={selected}
              onStatusChange={handleStatusChange}
            />
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-1 py-3 text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <NewAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            loadWeek();
          }}
        />
      )}
    </div>
  );
}
