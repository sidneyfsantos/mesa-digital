"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./basic.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function BasicDataPage() {
  const router = useRouter();
  const [data, setData] = useState({
    establishmentName: "",
    establishmentSlug: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) {
          setData(prev => ({ ...prev, ...data.data }));
        }
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "IDENTITY",
          data: {
            establishmentName: data.establishmentName.trim(),
            establishmentSlug: data.establishmentSlug.trim().toLowerCase(),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro ao salvar" }));
        throw new Error(err.message);
      }
      router.push("/onboarding/identity");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Dados do Estabelecimento</h1>
        <p>Informações básicas para identificar seu estabelecimento</p>
      </header>

      <form onSubmit={submit} className={styles.form}>
        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.field}>
          <label htmlFor="name">Nome do Estabelecimento *</label>
          <input
            id="name"
            type="text"
            required
            maxLength={160}
            value={data.establishmentName}
            onChange={e => setData({ ...data, establishmentName: e.target.value })}
            placeholder="Ex: Restaurante Sabor da Casa"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="slug">Identificador (slug) *</label>
          <div className={styles.slugInput}>
            <span className={styles.slugPrefix}>mesa.digital/</span>
            <input
              id="slug"
              type="text"
              required
              maxLength={100}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              value={data.establishmentSlug}
              onChange={e => setData({ ...data, establishmentSlug: e.target.value.toLowerCase() })}
              placeholder="restaurante-sabor-da-casa"
            />
          </div>
          <p className={styles.hint}>
            Será usado na URL do cardápio: <code>mesa.digital/seu-identificador</code>
          </p>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? "Salvando…" : "Continuar"}
        </button>
      </form>
    </main>
  );
}