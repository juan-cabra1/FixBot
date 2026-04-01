"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DAY_NAMES } from "@/lib/utils";
import type { AvailabilityBlock, BusinessConfig } from "@/types";

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
      {message}
    </div>
  );
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([api.settings.get(), api.settings.getAvailability()])
      .then(([cfg, avail]) => {
        setConfig(cfg);
        // Build full 7-day structure
        const full: AvailabilityBlock[] = Array.from({ length: 7 }, (_, i) => {
          const existing = avail.find((b) => b.day_of_week === i);
          return existing ?? { day_of_week: i, start_time: "09:00:00", end_time: "18:00:00", is_active: false };
        });
        setAvailability(full);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateConfig(key: keyof BusinessConfig, value: string) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  }

  function updateAvailBlock(index: number, key: keyof AvailabilityBlock, value: string | boolean) {
    setAvailability((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [key]: value } : b))
    );
  }

  async function saveBusiness() {
    if (!config) return;
    setSavingBusiness(true);
    try {
      await api.settings.update({
        name: config.name,
        description: config.description ?? undefined,
        owner_name: config.owner_name,
        phone: config.phone,
        timezone: config.timezone,
      });
      setToast("Datos del negocio guardados");
    } finally {
      setSavingBusiness(false);
    }
  }

  async function saveAgent() {
    if (!config) return;
    setSavingAgent(true);
    try {
      await api.settings.update({
        agent_name: config.agent_name,
        agent_tone: config.agent_tone,
        system_prompt: config.system_prompt,
        welcome_message: config.welcome_message,
        fallback_message: config.fallback_message,
      });
      setToast("Configuración del asistente guardada");
    } finally {
      setSavingAgent(false);
    }
  }

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const activeBlocks = availability.filter((b) => b.is_active);
      await api.settings.updateAvailability(activeBlocks);
      setToast("Horarios guardados");
    } finally {
      setSavingAvail(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400 py-16">
        Cargando configuración...
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      {/* Section 1: Business data */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Datos del negocio
        </h2>

        <Field label="Nombre del negocio">
          <input
            type="text"
            value={config.name}
            onChange={(e) => updateConfig("name", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={config.description ?? ""}
            onChange={(e) => updateConfig("description", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        <Field label="Dueño / Responsable">
          <input
            type="text"
            value={config.owner_name}
            onChange={(e) => updateConfig("owner_name", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Teléfono de contacto">
          <input
            type="tel"
            value={config.phone}
            onChange={(e) => updateConfig("phone", e.target.value)}
            className={inputClass}
          />
        </Field>

        <button
          onClick={saveBusiness}
          disabled={savingBusiness}
          className={saveButtonClass}
        >
          {savingBusiness ? "Guardando..." : "Guardar datos del negocio"}
        </button>
      </section>

      {/* Section 2: Agent config */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Asistente virtual
        </h2>

        <Field label="Nombre del asistente">
          <input
            type="text"
            value={config.agent_name}
            onChange={(e) => updateConfig("agent_name", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Tono de comunicación">
          <select
            value={config.agent_tone}
            onChange={(e) => updateConfig("agent_tone", e.target.value)}
            className={inputClass}
          >
            <option value="profesional">Profesional y formal</option>
            <option value="amigable">Amigable y cercano</option>
            <option value="neutro">Neutro</option>
          </select>
        </Field>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-gray-700">Instrucciones personalizadas</label>
          <p className="text-xs text-gray-400">
            Estas instrucciones se suman al prompt base que se genera automáticamente con los datos del negocio, servicios y horarios.
          </p>
          <textarea
            value={config.system_prompt}
            onChange={(e) => updateConfig("system_prompt", e.target.value)}
            rows={8}
            className={inputClass}
            placeholder="Ej: Si el cliente menciona urgencias, priorizá los turnos del mismo día. No agendar turnos en el barrio X."
          />
        </div>

        <Field label="Mensaje de bienvenida">
          <textarea
            value={config.welcome_message}
            onChange={(e) => updateConfig("welcome_message", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        <button
          onClick={saveAgent}
          disabled={savingAgent}
          className={saveButtonClass}
        >
          {savingAgent ? "Guardando..." : "Guardar configuración del asistente"}
        </button>
      </section>

      {/* Section 3: Availability */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Horarios de atención
        </h2>
        <p className="text-sm text-gray-500">
          Activá los días y horarios en los que atendés.
        </p>

        <div className="space-y-3">
          {availability.map((block, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 py-3 px-4 rounded-xl border transition-colors ${
                block.is_active
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => updateAvailBlock(i, "is_active", !block.is_active)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  block.is_active ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    block.is_active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>

              <span
                className={`w-24 font-semibold text-sm ${
                  block.is_active ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {DAY_NAMES[i]}
              </span>

              {block.is_active && (
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={block.start_time.substring(0, 5)}
                    onChange={(e) =>
                      updateAvailBlock(i, "start_time", e.target.value + ":00")
                    }
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400">a</span>
                  <input
                    type="time"
                    value={block.end_time.substring(0, 5)}
                    onChange={(e) =>
                      updateAvailBlock(i, "end_time", e.target.value + ":00")
                    }
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={saveAvailability}
          disabled={savingAvail}
          className={saveButtonClass}
        >
          {savingAvail ? "Guardando..." : "Guardar horarios"}
        </button>
      </section>

      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors";

const saveButtonClass =
  "w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}
