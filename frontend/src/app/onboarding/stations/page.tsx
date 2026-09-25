"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./stations.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Station = { id: string; name: string; kind: "KITCHEN" | "BAR" | "OTHER" };

const KINDS = [
  { value: "KITCHEN" as const, label: "Cozinha", icon: "🍳" },
  { value: "BAR" as const, label: "Bar", icon: "🍻" },
  { value: "OTHER" as const, label: "Outra", icon: "📦" },
];

export default function StationsPage() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data?.stations) {
          setStations(data.data.stations);
        }
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (stations.length === 0) {
      alert("Crie pelo menos uma estação");
      return;
    }
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "CATALOG", data: { stations } }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      router.push("/onboarding/catalog");
    } catch {
      alert("Erro ao salvar");
    }
  }

  function addStation(kind: Station["kind"]) {
    const name = prompt(`Nome da ${kind === "KITCHEN" ? "cozinha" : kind === "BAR" ? "estação de bar" : "estação"}:`);
    if (!name?.trim()) return;
    setStations(prev => [...prev, { id: crypto.randomUUID(), name: name.trim(), kind }]);
  }

  function removeStation(id: string) {
    setStations(prev => prev.filter(s => s.id !== id));
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Estações (Cozinha / Bar)</h1>
        <p>Configure onde cada item será preparado</p>
      </header>

      <form onSubmit={submit} className={styles.form}>
        <section className={styles.section}>
          <h2>Estações Cadastradas</h2>
          {stations.length === 0 ? (
            <p className={styles.empty}>Nenhuma estação cadastrada ainda</p>
          ) : (
            <ul className={styles.list}>
              {stations.map(s => (
                <li key={s.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.stationIcon}>{s.kind === "KITCHEN" ? "🍳" : s.kind === "BAR" ? "🍻" : "📦"}</span>
                    <strong>{s.name}</strong>
                    <span className={styles.kindBadge}>{s.kind}</span>
                  </div>
                  <button type="button" className={styles.removeBtn} onClick={() => removeStation(s.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2>Adicionar Estação</h2>
          <div className={styles.buttons}>
            {KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                className={styles.addBtn}
                onClick={() => addStation(k.value)}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </section>

        <button type="submit" className={styles.primaryBtn}>
          Continuar
        </button>
      </form>
    </main>
  );
}