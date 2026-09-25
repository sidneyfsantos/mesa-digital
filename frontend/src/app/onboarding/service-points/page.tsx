"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./service-points.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type ServicePointKind = "FIXED_TABLE" | "MOBILE_TAB";
type ServicePoint = { id: string; label: string; kind: ServicePointKind };

export default function ServicePointsPage() {
  const router = useRouter();
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchData, setBatchData] = useState({
    prefix: "Mesa",
    start: 1,
    count: 10,
  });

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data?.servicePoints) {
          setPoints(data.data.servicePoints);
        }
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (points.length === 0) {
      alert("Crie pelo menos uma mesa ou comanda");
      return;
    }
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "STATIONS",
          data: { servicePoints: points },
        }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      router.push("/onboarding/stations");
    } catch {
      alert("Erro ao salvar");
    }
  }

  function addPoint(kind: "FIXED_TABLE" | "MOBILE_TAB") {
    const label = prompt(`Nome da ${kind === "FIXED_TABLE" ? "mesa" : "comanda"}:`);
    if (!label?.trim()) return;
    setPoints(prev => [...prev, { id: crypto.randomUUID(), label: label.trim(), kind }]);
  }

  function removePoint(id: string) {
    setPoints(prev => prev.filter(p => p.id !== id));
  }

  async function createBatch() {
    const { prefix, start, count } = batchData;
    if (count < 1 || count > 100) {
      alert("Quantidade inválida (1-100)");
      return;
    }
    const newPoints = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      label: `${prefix} ${start + i}`,
      kind: "FIXED_TABLE" as const,
    }));
    setPoints(prev => [...prev, ...newPoints]);
    setShowBatch(false);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Mesas / Comandas</h1>
        <p>Cadastre os pontos de atendimento do seu estabelecimento</p>
      </header>

      <form onSubmit={submit} className={styles.form}>
        <section className={styles.section}>
          <h2>Pontos Cadastrados</h2>
          {points.length === 0 ? (
            <p className={styles.empty}>Nenhum ponto cadastrado ainda</p>
          ) : (
            <ul className={styles.list}>
              {points.map(p => (
                <li key={p.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <strong>{p.label}</strong>
                    <span className={styles.kindBadge}>{p.kind === "FIXED_TABLE" ? "Mesa" : "Comanda"}</span>
                  </div>
                  <button type="button" className={styles.removeBtn} onClick={() => removePoint(p.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h2>Adicionar Ponto</h2>
          <div className={styles.buttons}>
            <button type="button" className={styles.addBtn} onClick={() => addPoint("FIXED_TABLE")}>
              + Mesa Fixa
            </button>
            <button type="button" className={styles.addBtn} onClick={() => addPoint("MOBILE_TAB")}>
              + Comanda Móvel
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Criação em Lote</h2>
          <button type="button" className={styles.secondaryBtn} onClick={() => setShowBatch(!showBatch)}>
            {showBatch ? "Esconder" : "Criar várias mesas de uma vez"}
          </button>
          {showBatch && (
            <div className={styles.batchForm}>
              <div className={styles.field}>
                <label>Prefixo</label>
                <input
                  type="text"
                  value={batchData.prefix}
                  onChange={e => setBatchData({ ...batchData, prefix: e.target.value })}
                  placeholder="Ex: Mesa"
                />
              </div>
              <div className={styles.columns}>
                <div className={styles.field}>
                  <label>Iniciar em</label>
                  <input type="number" min="1" value={batchData.start} onChange={e => setBatchData({ ...batchData, start: parseInt(e.target.value) || 1 })} />
                </div>
                <div className={styles.field}>
                  <label>Quantidade</label>
                  <input type="number" min="1" max="100" value={batchData.count} onChange={e => setBatchData({ ...batchData, count: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <button type="button" className={styles.primaryBtn} onClick={createBatch}>
                Criar {batchData.count} itens
              </button>
            </div>
          )}
        </section>

        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          Continuar
        </button>
      </form>
    </main>
  );
}