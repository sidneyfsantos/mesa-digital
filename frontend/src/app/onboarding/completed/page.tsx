"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./completed.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Readiness {
  ready: boolean;
  missing: string[];
  step: string;
  progress: number;
}

export default function CompletedPage() {
  const router = useRouter();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${api}/onboarding/readiness`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setReadiness(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function goToAdmin() {
    router.push("/admin/catalog");
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Verificando prontidão…</div>
      </main>
    );
  }

  if (!readiness) {
    return (
      <main className={styles.page}>
        <div className={styles.error}>Não foi possível verificar o status</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Onboarding Concluído</h1>
        <p>Seu estabelecimento está configurado</p>
      </header>

      <section className={styles.section}>
        {readiness.ready ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h2>Pronto para Receber Pedidos!</h2>
            <p>Toda a configuração necessária foi concluída. Seu estabelecimento já pode operar.</p>
          </div>
        ) : (
          <div className={styles.incomplete}>
            <h2>Ainda faltam alguns itens</h2>
            <ul className={styles.missing}>
              {readiness.missing.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <p className={styles.hint}>
              Complete os itens acima no <a href="/admin/catalog" target="_blank" rel="noopener">painel administrativo</a>
            </p>
          </div>
        )}
      </section>

      <section className={styles.actions}>
        <button className={styles.primaryBtn} onClick={goToAdmin}>
          Ir para o Painel Administrativo
        </button>
        <button className={styles.secondaryBtn} onClick={() => router.push("/onboarding")}>
          Voltar ao Onboarding
        </button>
      </section>
    </main>
  );
}