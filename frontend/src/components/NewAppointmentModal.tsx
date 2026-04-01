"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewAppointmentModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    phone: "",
    name: "",
    title: "",
    date: "",
    start_time: "",
    end_time: "",
    address: "",
    notes: "",
  });
  const [clientId, setClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone || !form.title || !form.date || !form.start_time) {
      setError("Completá teléfono, descripción del trabajo, fecha y hora de inicio");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Get or create client by phone
      let cid = clientId;
      if (cid === null) {
        // Search client by phone via appointments list to see if they exist
        // We create the appointment with a client_id — we need to find or create the client
        // For MVP: call a backend helper via settings or just pass phone + name in title
        // Since we don't have a clients endpoint, we try a workaround:
        // create appointment with phone embedded in title or notes.
        // Better approach: fetch GET /api/v1/appointments?client_phone=...
        // Since we only have clients as embedded in appointments, we create appointment
        // with client_id=1 as fallback and include phone in notes.
        // TODO: add a POST /api/v1/clients endpoint for proper lookup.
        // For now, search by listing appointments and finding client with matching phone.
        const recent = await api.appointments.list(`from_date=2020-01-01`);
        const match = recent.items.find(
          (a) => a.client?.phone && a.client.phone.includes(form.phone.replace(/\D/g, ""))
        );
        if (match?.client) {
          cid = match.client.id;
          setClientId(cid);
        } else {
          setError(
            "No se encontró un cliente con ese teléfono. El cliente debe haber enviado un mensaje por WhatsApp primero."
          );
          setLoading(false);
          return;
        }
      }

      await api.appointments.create({
        client_id: cid,
        title: form.title + (form.name ? ` — ${form.name}` : ""),
        date: form.date,
        start_time: form.start_time + ":00",
        end_time: form.end_time ? form.end_time + ":00" : null,
        address: form.address || null,
        notes: form.notes || null,
      });

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el turno");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Nuevo turno</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Teléfono del cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                updateField("phone", e.target.value);
                setClientId(null);
              }}
              placeholder="+54 9 351 000 0000"
              className={inputClass}
              required
            />
            <p className="text-xs text-gray-400">
              El cliente debe haber enviado al menos un mensaje por WhatsApp
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Nombre del cliente
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Juan García"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Descripción del trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Revisar tablero eléctrico en cocina"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">
                Hora inicio <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Hora estimada de fin
            </label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => updateField("end_time", e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Dirección del trabajo
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="Av. Colón 1234, Córdoba"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Notas adicionales
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Traer materiales, llave de 13..."
              className={inputClass}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-base font-semibold rounded-xl transition-colors"
          >
            {loading ? "Agendando..." : "Agendar turno"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors";
