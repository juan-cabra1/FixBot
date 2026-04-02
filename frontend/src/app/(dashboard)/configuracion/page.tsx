"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { DAY_NAMES } from "@/lib/utils";
import type {
  AvailabilityBlock,
  BusinessConfig,
  BusinessRules,
  Service,
} from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRules(raw: string): BusinessRules {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      ("coverage_zone" in parsed || "custom_rules" in parsed || "handles_emergencies" in parsed)
    ) {
      return {
        coverage_zone: parsed.coverage_zone ?? "",
        materials_policy: parsed.materials_policy ?? "to_agree",
        handles_emergencies: parsed.handles_emergencies ?? false,
        emergency_details: parsed.emergency_details ?? "",
        custom_rules: Array.isArray(parsed.custom_rules) ? parsed.custom_rules : [],
      };
    }
  } catch {}
  // Legacy or developer-written prompt: discard and start fresh
  return DEFAULT_RULES;
}

function formatPrice(price: string | null): string {
  if (!price) return "A convenir";
  const num = parseFloat(price);
  return `$ ${num.toLocaleString("es-AR")}`;
}

const DEFAULT_RULES: BusinessRules = {
  coverage_zone: "",
  materials_policy: "to_agree",
  handles_emergencies: false,
  emergency_details: "",
  custom_rules: [],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [rules, setRules] = useState<BusinessRules>(DEFAULT_RULES);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [savingAvail, setSavingAvail] = useState(false);
  const [toast, setToast] = useState("");

  // Services inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", price: "", duration: "" });
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState({ name: "", price: "", duration: "" });

  // Custom rules input
  const [newRule, setNewRule] = useState("");

  useEffect(() => {
    Promise.all([
      api.settings.get(),
      api.settings.getAvailability(),
      api.services.list(),
    ])
      .then(([cfg, avail, svcs]) => {
        setConfig(cfg);
        setRules(parseRules(cfg.system_prompt));
        setServices(svcs);
        const full: AvailabilityBlock[] = Array.from({ length: 7 }, (_, i) => {
          const existing = avail.find((b) => b.day_of_week === i);
          return existing ?? {
            day_of_week: i,
            start_time: "09:00:00",
            end_time: "18:00:00",
            is_active: false,
          };
        });
        setAvailability(full);
      })
      .finally(() => setLoading(false));
  }, []);

  function updateConfig(key: keyof BusinessConfig, value: string) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  }

  function updateRules(patch: Partial<BusinessRules>) {
    setRules((prev) => ({ ...prev, ...patch }));
  }

  function addRule() {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    updateRules({ custom_rules: [...rules.custom_rules, trimmed] });
    setNewRule("");
  }

  function removeRule(index: number) {
    updateRules({ custom_rules: rules.custom_rules.filter((_, i) => i !== index) });
  }

  function updateAvailBlock(index: number, key: keyof AvailabilityBlock, value: string | boolean) {
    setAvailability((prev) => prev.map((b, i) => (i === index ? { ...b, [key]: value } : b)));
  }

  // ── Save handlers ────────────────────────────────────────────────────────────

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
        system_prompt: JSON.stringify(rules),
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
      await api.settings.updateAvailability(availability.filter((b) => b.is_active));
      setToast("Horarios guardados");
    } finally {
      setSavingAvail(false);
    }
  }

  // ── Services CRUD ─────────────────────────────────────────────────────────────

  function startEdit(svc: Service) {
    setEditingId(svc.id);
    setEditDraft({
      name: svc.name,
      price: svc.price ? parseFloat(svc.price).toString() : "",
      duration: svc.duration_minutes ? svc.duration_minutes.toString() : "",
    });
  }

  async function saveEdit(id: number) {
    const price = editDraft.price ? parseFloat(editDraft.price) : null;
    const duration = editDraft.duration ? parseInt(editDraft.duration) : null;
    const updated = await api.services.update(id, {
      name: editDraft.name,
      price,
      duration_minutes: duration,
    });
    setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
    setEditingId(null);
    setToast("Servicio actualizado");
  }

  async function saveNew() {
    if (!newDraft.name.trim()) return;
    const price = newDraft.price ? parseFloat(newDraft.price) : null;
    const duration = newDraft.duration ? parseInt(newDraft.duration) : null;
    const created = await api.services.create({
      name: newDraft.name.trim(),
      price,
      duration_minutes: duration,
    });
    setServices((prev) => [...prev, created]);
    setNewDraft({ name: "", price: "", duration: "" });
    setAddingNew(false);
    setToast("Servicio agregado");
  }

  async function deleteService(id: number) {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    await api.services.delete(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    setToast("Servicio eliminado");
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-6 text-center text-gray-400 py-16">Cargando configuración...</div>;
  }
  if (!config) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      {/* ── Section 1: Datos del negocio ───────────────────────────────────── */}
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

        <button onClick={saveBusiness} disabled={savingBusiness} className={btnClass}>
          {savingBusiness ? "Guardando..." : "Guardar datos del negocio"}
        </button>
      </section>

      {/* ── Section 2: Asistente virtual ──────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
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

        <Field label="Estilo de comunicación">
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

        <Field label="Mensaje de bienvenida">
          <textarea
            value={config.welcome_message}
            onChange={(e) => updateConfig("welcome_message", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        {/* Reglas del negocio */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-sm font-bold text-gray-900">Reglas del negocio</p>

          <Field label="Zona de cobertura">
            <input
              type="text"
              value={rules.coverage_zone}
              onChange={(e) => updateRules({ coverage_zone: e.target.value })}
              placeholder="Ej: Ciudad de Córdoba y alrededores"
              className={inputClass}
            />
          </Field>

          <Field label="Política de materiales">
            <select
              value={rules.materials_policy}
              onChange={(e) =>
                updateRules({
                  materials_policy: e.target.value as BusinessRules["materials_policy"],
                })
              }
              className={inputClass}
            >
              <option value="included">Incluidos en el presupuesto</option>
              <option value="client_provides">Los provee el cliente</option>
              <option value="to_agree">A convenir</option>
            </select>
          </Field>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Toggle
                checked={rules.handles_emergencies}
                onChange={(v) => updateRules({ handles_emergencies: v })}
              />
              <span className="text-sm font-semibold text-gray-700">Atiendo urgencias</span>
            </div>
            {rules.handles_emergencies && (
              <input
                type="text"
                value={rules.emergency_details}
                onChange={(e) => updateRules({ emergency_details: e.target.value })}
                placeholder="Ej: Recargo del 50% en urgencias fuera de horario"
                className={inputClass}
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Reglas adicionales
            </label>
            {rules.custom_rules.length > 0 && (
              <ul className="space-y-1.5">
                {rules.custom_rules.map((rule, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-700"
                  >
                    <span>{rule}</span>
                    <button
                      onClick={() => removeRule(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-3 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                placeholder="Ej: No trabajamos los feriados"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={addRule}
                disabled={!newRule.trim()}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-semibold rounded-xl transition-colors text-sm whitespace-nowrap"
              >
                + Agregar
              </button>
            </div>
          </div>
        </div>

        <button onClick={saveAgent} disabled={savingAgent} className={btnClass}>
          {savingAgent ? "Guardando..." : "Guardar configuración del asistente"}
        </button>
      </section>

      {/* ── Section 3: Servicios y presupuestos ───────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Servicios y presupuestos
        </h2>
        <p className="text-sm text-gray-500">
          El asistente usa esta información para responder consultas de precio y duración.
        </p>

        <div className="space-y-2">
          {services.map((svc) =>
            editingId === svc.id ? (
              <div
                key={svc.id}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3"
              >
                <input
                  autoFocus
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Nombre"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={editDraft.price}
                  onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                  placeholder="Precio"
                  className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={editDraft.duration}
                  onChange={(e) => setEditDraft((d) => ({ ...d, duration: e.target.value }))}
                  placeholder="Min"
                  className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => saveEdit(svc.id)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div
                key={svc.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div>
                  <span className="text-sm font-semibold text-gray-800">{svc.name}</span>
                  {svc.duration_minutes && (
                    <span className="ml-2 text-xs text-gray-400">{svc.duration_minutes} min</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">{formatPrice(svc.price)}</span>
                  <button
                    onClick={() => startEdit(svc)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteService(svc.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          )}

          {/* New service inline form */}
          {addingNew ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <input
                autoFocus
                type="text"
                value={newDraft.name}
                onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Nombre del servicio"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={newDraft.price}
                onChange={(e) => setNewDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="Precio"
                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                value={newDraft.duration}
                onChange={(e) => setNewDraft((d) => ({ ...d, duration: e.target.value }))}
                placeholder="Min"
                className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={saveNew}
                disabled={!newDraft.name.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => { setAddingNew(false); setNewDraft({ name: "", price: "", duration: "" }); }}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-400 rounded-xl transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Agregar servicio
            </button>
          )}
        </div>
      </section>

      {/* ── Section 4: Horarios de atención ────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
          Horarios de atención
        </h2>
        <p className="text-sm text-gray-500">
          Activá los días y horarios en los que realizás trabajos a domicilio.
        </p>

        <div className="space-y-3">
          {availability.map((block, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 py-3 px-4 rounded-xl border transition-colors ${
                block.is_active ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
              }`}
            >
              <Toggle
                checked={block.is_active}
                onChange={(v) => updateAvailBlock(i, "is_active", v)}
              />
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
                    onChange={(e) => updateAvailBlock(i, "start_time", e.target.value + ":00")}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400">a</span>
                  <input
                    type="time"
                    value={block.end_time.substring(0, 5)}
                    onChange={(e) => updateAvailBlock(i, "end_time", e.target.value + ":00")}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={saveAvailability} disabled={savingAvail} className={btnClass}>
          {savingAvail ? "Guardando..." : "Guardar horarios"}
        </button>
      </section>

      {toast && <Toast message={toast} onDismiss={() => setToast("")} />}
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors";

const btnClass =
  "w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-colors text-sm";
