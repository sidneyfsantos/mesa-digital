"use client";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import styles from "./delivery.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface DeliveryItem {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  status: string;
  stationId: string;
  createdAt: string;
  readyAt: string | null;
  orderReference: string;
  serviceSessionId: string;
}

function DeliveryPageContent() {
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(() => Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${api}/production/delivery/ready`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        setLastUpdate(new Date());
      }
    } catch {
      setError("Falha ao carregar itens prontos");
    } finally {
      setLoading(false);
    }
  }, []);

  async function markDelivered(itemId: string) {
    try {
      const res = await fetch(`${api}/production/items/${itemId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      });
      if (!res.ok) throw new Error("Falha ao marcar entregue");
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setTimeout(() => setError(""), 3000);
      fetchItems();
    }
  }

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function getRelativeTime(dateStr: string, now: number) {
    const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
  }

  useEffect(() => {
    async function load() {
      await fetchItems();
    }
    load();

    const es = new EventSource(`${api}/realtime/events`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "item.status" && msg.payload?.status === "READY") {
          fetchItems();
        } else if (msg.type === "order.created") {
          fetchItems();
        } else if (msg.type === "heartbeat") {
        }
      } catch {}
    };

    es.onerror = () => {
      setError("Conexão perdida, reconectando...");
      setTimeout(() => fetchItems(), 2000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetchItems]);

  if (loading) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>Entrega / Salão</h1>
        </header>
        <div className={styles.loading}>Carregando itens prontos...</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Entrega / Salão</h1>
        <span className={styles.subtitle}>Itens prontos para servir</span>
        {lastUpdate && <span className={styles.lastUpdate}>Atualizado: {formatTime(lastUpdate.toISOString())}</span>}
      </header>
      {error && <div className={styles.errorBar}>{error}</div>}
      <div className={styles.list} role="list" aria-label="Itens prontos para entrega">
        {items.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M20 7l-8 8-4-4M3 7h18M3 13h18" />
            </svg>
            <p>Nenhum item pronto</p>
            <small>Itens aparecem aqui quando a cozinha/bar finaliza</small>
          </div>
        ) : (
          items.map(item => (
            <article key={item.id} className={styles.card} role="listitem">
              <div className={styles.cardHeader}>
                <div className={styles.orderInfo}>
                  <strong>Pedido {item.orderReference}</strong>
                  <span className={styles.time}>Pronto há {getRelativeTime(item.readyAt || item.createdAt, now)}</span>
                </div>
                <span className={styles.badgeReady}>PRONTO</span>
              </div>
              <div className={styles.itemMain}>
                <div className={styles.itemName}>
                  <span className={styles.quantity}>{item.quantity}x</span>
                  {item.productName}
                </div>
                <span className={styles.readyTime}>Pronto: {formatTime(item.readyAt)}</span>
              </div>
              <div className={styles.actions}>
                <button className={styles.deliverBtn} onClick={() => markDelivered(item.id)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                  Marcar Entregue
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}

export default function DeliveryPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <DeliveryPageContent />
    </Suspense>
  );
}