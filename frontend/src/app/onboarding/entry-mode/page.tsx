"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./entry-mode.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type EntryModeKind = "FIXED_TABLE" | "MOBILE_TAB";

export default function EntryModePage() {
  const router = useRouter();
  const [data, setData] = useState({
    enabledKinds: [] as EntryModeKind[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data?.entryMode?.enabledKinds) {
          setData({ enabledKinds: data.data.entryMode.enabledKinds });
        }
      });
  }, []);

  function toggleKind(kind: EntryModeKind) {
    setData(prev => ({
      enabledKinds: prev.enabledKinds.includes(kind)
        ? prev.enabledKinds.filter(k => k !== kind)
        : [...prev.enabledKinds, kind],
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (data.enabledKinds.length === 0) {
      alert("Selecione pelo menos um modo de atendimento");
      return;
    }
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "SERVICE_POINTS",
          data: { entryMode: { enabledKinds: data.enabledKinds } },
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      router.push("/onboarding/service-points");
    } catch {
      alert("Erro ao salvar");
    }
  }

  const KINDS = [
    { key: "FIXED_TABLE" as EntryModeKind, label: "Mesas Fixas", description: "Mesas com QR Code fixo na mesa", icon: "🪑" },
    { key: "MOBILE_TAB" as EntryModeKind, label: "Comandas Móveis", description: "Placas/Comandas reutilizáveis com QR", icon: "📋" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Modo de Atendimento</h1>
        <p>Como os clientes acessam o cardápio no seu estabelecimento</p>
      </header>

      <form onSubmit={submit} className={styles.form}>
        <fieldset className={styles.kindField}>
          <legend>Selecione os modos de atendimento *</legend>
          {KINDS.map(kind => (
            <label key={kind.key} className={`${styles.kindOption} ${data.enabledKinds.includes(kind.key) ? styles.selected : ""}`}>
              <input
                type="checkbox"
                checked={data.enabledKinds.includes(kind.key)}
                onChange={() => toggleKind(kind.key)}
              />
              <div className={styles.kindInfo}>
                <span className={styles.kindIcon}>{kind.icon}</span>
                <div className={styles.kindText}>
                  <strong>{kind.label}</strong>
                  <span>{kind.description}</span>
                </div>
              </div>
            </label>
          ))}
        </fieldset>

        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? "Salvando…" : "Continuar"}
        </button>
      </form>
    </main>
  );
}