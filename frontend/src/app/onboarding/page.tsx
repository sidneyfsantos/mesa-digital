"use client";
import { useEffect, useState, Suspense, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./onboarding.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const STEPS = [
  { key: "BASIC_DATA", label: "Dados do Estabelecimento", href: "/onboarding/basic" },
  { key: "IDENTITY", label: "Identidade Visual", href: "/onboarding/identity" },
  { key: "ENTRY_MODE", label: "Modo de Atendimento", href: "/onboarding/entry-mode" },
  { key: "SERVICE_POINTS", label: "Mesas / Comandas", href: "/onboarding/service-points" },
  { key: "STATIONS", label: "Estações (Cozinha/Bar)", href: "/onboarding/stations" },
  { key: "CATALOG", label: "Cardápio", href: "/onboarding/catalog" },
  { key: "COMPLETED", label: "Pronto para Operar", href: "/onboarding/completed" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface OnboardingState {
  step: string;
  data: Record<string, unknown>;
  label: string;
  progress: number;
  totalSteps: number;
  error?: string;
}

type StepStatus = "locked" | "current" | "completed";

function OnboardingPageContent() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${api}/onboarding/state`, { credentials: "include" });
      if (!mountedRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setState(data);
      } else if (res.status === 401) {
        router.push("/admin/login");
      } else {
        setError("Falha ao carregar estado do onboarding");
      }
    } catch {
      if (mountedRef.current) setError("Erro de conexão");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${api}/onboarding/state`, { credentials: "include" });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setState(data);
        } else if (res.status === 401) {
          router.push("/admin/login");
        } else {
          setError("Falha ao carregar estado do onboarding");
        }
      } catch {
        if (mounted) setError("Erro de conexão");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [router]);

  async function goToStep(stepKey: StepKey) {
    try {
      const res = await fetch(`${api}/onboarding/step`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: stepKey }),
      });
      if (res.ok) {
        router.push(STEPS.find(s => s.key === stepKey)?.href || "/onboarding");
      } else {
        const err = await res.json();
        alert(err.message || "Não foi possível avançar para esta etapa");
      }
    } catch {
      alert("Erro de conexão");
    }
  }

  function getStepStatus(stepKey: StepKey): StepStatus {
    if (!state) return "locked";
    const currentIndex = STEPS.findIndex(s => s.key === state.step);
    const targetIndex = STEPS.findIndex(s => s.key === stepKey);
    if (targetIndex < currentIndex) return "completed";
    if (targetIndex === currentIndex) return "current";
    return "locked";
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>Carregando onboarding...</div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className={styles.page}>
        <div className={styles.empty}>Onboarding não encontrado</div>
      </main>
    );
  }

  const isCompleted = state.step === "COMPLETED";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Configuração Inicial</h1>
        <p>Configure seu estabelecimento para começar a receber pedidos</p>
      </header>

      <nav className={styles.progress} aria-label="Progresso do onboarding">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.key);
          return (
            <div key={step.key} className={`${styles.step} ${status}`}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <div className={styles.stepLabel}>{step.label}</div>
            </div>
          );
        })}
      </nav>

      {state.error && <div className={styles.error} role="alert">{state.error}</div>}

      <section className={styles.content}>
        {state.step === "COMPLETED" ? (
          <div className={styles.completed}>
            <div className={styles.successIcon}>✓</div>
            <h2>Estabelecimento pronto para operar!</h2>
            <p>Toda a configuração foi concluída. Seu estabelecimento já pode receber pedidos.</p>
            <button className={styles.primaryBtn} onClick={() => router.push("/admin/catalog")}>
              Ir para o Painel
            </button>
          </div>
        ) : (
          <>
            <div className={styles.currentStep}>
              <h2>{state.label}</h2>
              <p>Progresso: {state.progress} de {state.totalSteps} etapas</p>
            </div>

            <div className={styles.stepContent}>
              <p>Complete esta etapa para prosseguir.</p>
              <div className={styles.actionRow}>
                <button
                  className={styles.secondaryBtn}
                  onClick={() => router.push("/admin/catalog")}
                >
                  Pular por agora
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={() => goToStep(
                    STEPS[STEPS.findIndex(s => s.key === state.step) + 1]?.key || "COMPLETED"
                  )}
                  disabled={state.step === "COMPLETED"}
                >
                  Continuar
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <OnboardingPageContent />
    </Suspense>
  );
}