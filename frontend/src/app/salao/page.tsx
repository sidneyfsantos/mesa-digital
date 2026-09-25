"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./salao.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type SessionItem = {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  status: string;
  stationId: string | null;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  orderReference: string;
  orderStatus: string;
};

type ServiceCall = {
  id: string;
  serviceSessionId: string;
  status: "PENDING" | "RESOLVED";
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

type BillRequest = {
  id: string;
  serviceSessionId: string;
  requestedAt: string;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
};

type CancellationRequest = {
  id: string;
  orderItemId: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

type Totals = {
  originalTotalMinor: number;
  cancelledTotalMinor: number;
  discountTotalMinor: number;
  additionalServiceTotalMinor: number;
  effectiveTotalMinor: number;
  calculated: boolean;
};

type SessionDetails = {
  session: {
    id: string;
    status: string;
    openedAt: string;
    closedAt: string | null;
  } | null;
  orders: unknown[];
  items: SessionItem[];
  serviceCalls: ServiceCall[];
  billRequests: BillRequest[];
  cancellations: CancellationRequest[];
  totals: Totals | null;
};

function SalaoPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatMoney(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
  }

  function getRelativeTime(dateStr: string, now: number) {
    const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
  }

  async function fetchSession() {
    if (!token) return;
    try {
      const res = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/session`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar sessão");
      const data = await res.json();
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function resolveCall(callId: string) {
    try {
      const res = await fetch(`${api}/service-sessions/calls/${callId}/resolve`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao resolver");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function withdrawBill() {
    if (!session?.session?.id) return;
    try {
      const res = await fetch(`${api}/service-sessions/${session.session.id}/bill-request/withdraw`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao retirar conta");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function requestCancellation(itemId: string) {
    const reason = prompt("Motivo do cancelamento (mín. 5 caracteres):");
    if (!reason || reason.trim().length < 5) return;
    try {
      const res = await fetch(`${api}/service-sessions/cancellation-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao solicitar cancelamento");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function decideCancellation(requestId: string, approve: boolean) {
    const note = approve ? undefined : prompt("Observação (opcional):");
    try {
      const res = await fetch(`${api}/service-sessions/cancellation-requests/${requestId}/decide`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approve, note }),
      });
      if (!res.ok) throw new Error("Falha ao decidir cancelamento");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function startClosing() {
    if (!session?.session?.id) return;
    try {
      const res = await fetch(`${api}/service-sessions/${session.session.id}/start-closing`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao iniciar fechamento");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  async function closeSession() {
    if (!session?.session?.id) return;
    if (!confirm("Confirmar fechamento da sessão? Pagamento externo deve estar concluído.")) return;
    try {
      const res = await fetch(`${api}/service-sessions/${session.session.id}/close`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao fechar sessão");
      fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  // SSE Connection
  useEffect(() => {
    if (!token) return;
    async function load() {
      await fetchSession();
    }
    load();

    const es = new EventSource(`${api}/realtime/events`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "heartbeat") return;
        fetchSession(); // Reconcile via API
      } catch {}
    };

    es.onerror = () => {
      setTimeout(fetchSession, 3000);
    };

    return () => { es.close(); eventSourceRef.current = null; };
  }, [fetchSession, token]);

  if (loading) {
    return <div className={styles.loading}>Carregando sessão...</div>;
  }

  if (!session) {
    return <div className={styles.empty}>Sessão não encontrada</div>;
  }

  const { session: sess, items, serviceCalls, billRequests, cancellations, totals } = session;
  const pendingCalls = serviceCalls.filter(c => c.status === "PENDING");
  const pendingBill = billRequests.find(b => !b.withdrawnAt);
  const pendingCancels = cancellations.filter(c => c.status === "PENDING");

  const canClose = sess && sess.status === "CLOSING";
  const isClosed = sess && sess.status === "CLOSED";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Salão / Operação</h1>
        <div className={styles.sessionInfo}>
          <span className={`status ${sess?.status?.toLowerCase()}`}>{sess?.status || "—"}</span>
          <span>Iniciada: {sess ? formatTime(sess.openedAt) : "—"}</span>
          {sess?.closedAt && <span>Fechada: {formatTime(sess.closedAt)}</span>}
        </div>
        {lastUpdate && <span className={styles.lastUpdate}>Atualizado: {formatTime(lastUpdate.toISOString())}</span>}
      </header>

      {error && <div className={styles.errorBar}>{error}</div>}

      <section className={styles.section}>
        <h2>Chamados de Garçom</h2>
        {pendingCalls.length === 0 ? (
          <p className={styles.empty}>Nenhum chamado pendente</p>
        ) : (
          <ul className={styles.list}>
            {pendingCalls.map(call => (
              <li key={call.id} className={styles.callItem}>
                <div>
                  <strong>Chamado #{call.id.slice(0, 8)}</strong>
                  <span>{getRelativeTime(call.requestedAt, now)} atrás</span>
                </div>
                <button className={styles.resolveBtn} onClick={() => resolveCall(call.id)}>
                  Resolver
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Pedido de Conta</h2>
        {pendingBill ? (
          <div className={styles.billCard}>
            <div>
              <strong>Conta solicitada</strong>
              <span>{getRelativeTime(pendingBill.requestedAt, now)} atrás</span>
            </div>
            <button className={styles.withdrawBtn} onClick={withdrawBill}>
              Retirar pedido
            </button>
          </div>
        ) : sess?.status === "CHECK_REQUESTED" ? (
          <p className={styles.empty}>Conta em processamento</p>
        ) : sess?.status === "OPEN" ? (
          <button className={styles.requestBillBtn} onClick={() => fetch(`${api}/public/entry/${encodeURIComponent(token)}/bill-request`, { method: "POST", credentials: "include" }).then(fetchSession)}>
            Pedir a conta
          </button>
        ) : (
          <p className={styles.empty}>Conta não solicitada</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Itens da Sessão</h2>
        {items.length === 0 ? (
          <p className={styles.empty}>Nenhum item</p>
        ) : (
          <ul className={styles.list}>
            {items.map(item => (
              <li key={item.id} className={`item ${item.status.toLowerCase()}`}>
                <div className={styles.itemInfo}>
                  <strong>{item.quantity}x {item.productName}</strong>
                  <span className={styles.itemMeta}>Pedido #{item.orderReference} • {item.status}</span>
                </div>
                {item.status !== "CANCELLED" && item.status !== "DELIVERED" && (
                  <button className={styles.cancelBtn} onClick={() => requestCancellation(item.id)}>
                    Cancelar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Cancelamentos Pendentes</h2>
        {pendingCancels.length === 0 ? (
          <p className={styles.empty}>Nenhum cancelamento pendente</p>
        ) : (
          <ul className={styles.list}>
            {pendingCancels.map(cancel => (
              <li key={cancel.id} className={styles.cancelItem}>
                <div>
                  <strong>Item #{cancel.orderItemId.slice(0, 8)}</strong>
                  <span>Motivo: {cancel.reason}</span>
                  <span>Solicitado há {getRelativeTime(cancel.requestedAt, now)}</span>
                </div>
                <div className={styles.actions}>
                  <button className={styles.approveBtn} onClick={() => decideCancellation(cancel.id, true)}>
                    Aprovar
                  </button>
                  <button className={styles.rejectBtn} onClick={() => decideCancellation(cancel.id, false)}>
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Totais da Conta</h2>
        {totals && (
          <div className={styles.totals}>
            <div><span>Total original</span><strong>{formatMoney(totals.originalTotalMinor)}</strong></div>
            <div><span>Cancelados</span><strong>- {formatMoney(totals.cancelledTotalMinor)}</strong></div>
            <div><span>Descontos</span><strong>- {formatMoney(totals.discountTotalMinor)}</strong></div>
            <div><span>Taxas/Serviços</span><strong>+ {formatMoney(totals.additionalServiceTotalMinor)}</strong></div>
            <div className={styles.effectiveTotal}><span>Total efetivo</span><strong>{formatMoney(totals.effectiveTotalMinor)}</strong></div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Fechamento</h2>
        {isClosed ? (
          <div className={styles.closed}>
            <h3>Sessão encerrada</h3>
            <p>Fechada em {sess?.closedAt ? formatTime(sess.closedAt) : "—"}</p>
          </div>
        ) : canClose ? (
          <button className={styles.closeBtn} onClick={closeSession}>
            Confirmar fechamento (pagamento externo concluído)
          </button>
        ) : sess?.status === "OPEN" ? (
          <button className={styles.startCloseBtn} onClick={startClosing}>
            Iniciar fechamento
          </button>
        ) : sess?.status === "CHECK_REQUESTED" ? (
          <p className={styles.info}>Retire o pedido de conta para iniciar fechamento</p>
        ) : (
          <p className={styles.info}>Itens pendentes impedem fechamento</p>
        )}
      </section>
    </main>
  );
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function getRelativeTime(dateStr: string, now: number) {
  const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
}

export default function SalaoPageWrapper() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <SalaoPage />
    </Suspense>
  );
}