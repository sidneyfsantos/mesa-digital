"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./catalog.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function CatalogOnboardingPage() {
  const router = useRouter();
  const [hasCatalog, setHasCatalog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${api}/onboarding/state`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const cats = data?.data?.catalog?.categories?.length ?? 0;
        setHasCatalog(cats > 0);
      })
      .finally(() => setLoading(false));
  }, []);

  async function complete() {
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "COMPLETED", data: { catalog: { categories: true } } }),
      });
      if (!res.ok) throw new Error("Erro ao concluir");
      router.push("/onboarding/completed");
    } catch {
      alert("Erro ao concluir onboarding");
    }
  }

  if (loading) return <div className={styles.loading}>Carregando…</div>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Cardápio</h1>
        <p>Gerencie categorias, produtos, preços e modificadores</p>
      </header>

      <section className={styles.section}>
        <h2>Catálogo Atual</h2>
        {hasCatalog ? (
          <div className={styles.hasCatalog}>
            <p>Seu cardápio já possui categorias e produtos cadastrados.</p>
            <a href="/admin/catalog" className={styles.manageBtn} target="_blank" rel="noopener">
              Gerenciar Cardápio Completo
            </a>
          </div>
        ) : (
          <div className={styles.noCatalog}>
            <p>Nenhuma categoria cadastrada ainda.</p>
            <a href="/admin/catalog" className={styles.createBtn} target="_blank" rel="noopener">
              Criar Primeira Categoria
            </a>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <button className={styles.primaryBtn} onClick={complete} disabled={loading}>
          {hasCatalog ? "Concluir Onboarding" : "Pular e Concluir"}
        </button>
        <p className={styles.hint}>
          {hasCatalog
            ? "Seu estabelecimento está pronto para receber pedidos!"
            : "Você pode configurar o cardápio depois no painel administrativo."}
        </p>
      </section>
    </main>
  );
}