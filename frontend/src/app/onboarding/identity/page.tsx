"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./identity.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function IdentityPage() {
  const router = useRouter();
  const [data, setData] = useState({
    displayName: "",
    primaryColor: "#c2410c",
    logoMediaId: "",
    coverMediaId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data?.identity) {
          setData(prev => ({ ...prev, ...data.data.identity }));
        }
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "ENTRY_MODE",
          data: {
            identity: {
              displayName: data.displayName.trim(),
              primaryColor: data.primaryColor,
              logoMediaId: data.logoMediaId || null,
              coverMediaId: data.coverMediaId || null,
            },
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro ao salvar" }));
        throw new Error(err.message);
      }
      router.push("/onboarding/entry-mode");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function handleColorChange(e: React.ChangeEvent<HTMLInputElement>) {
    setData({ ...data, primaryColor: e.target.value });
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Identidade Visual</h1>
        <p>Como seu estabelecimento aparecerá para os clientes</p>
      </header>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="displayName">Nome de Exibição *</label>
          <input
            id="displayName"
            type="text"
            required
            maxLength={160}
            value={data.displayName}
            onChange={e => setData({ ...data, displayName: e.target.value })}
            placeholder="Ex: Restaurante Sabor da Casa"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="primaryColor">Cor Principal *</label>
          <div className={styles.colorInput}>
            <input
              id="primaryColor"
              type="color"
              value={data.primaryColor}
              onChange={handleColorChange}
            />
            <span className={styles.colorValue}>{data.primaryColor}</span>
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="logoMediaId">Logo (ID da mídia)</label>
          <input
            id="logoMediaId"
            type="text"
            value={data.logoMediaId}
            onChange={e => setData({ ...data, logoMediaId: e.target.value })}
            placeholder="ID da mídia enviada"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="coverMediaId">Imagem de Capa (ID da mídia)</label>
          <input
            id="coverMediaId"
            type="text"
            value={data.coverMediaId}
            onChange={e => setData({ ...data, coverMediaId: e.target.value })}
            placeholder="ID da mídia enviada"
          />
        </div>

        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? "Salvando…" : "Continuar"}
        </button>
      </form>
    </main>
  );
}