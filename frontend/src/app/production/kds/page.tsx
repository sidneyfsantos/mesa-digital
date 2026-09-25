"use client";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./kds.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type ItemStatus = "ACCEPTED" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";

interface StationItem {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  status: ItemStatus;
  stationId: string;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  orderReference: string;
  orderStatus: string;
  serviceSessionId: string;
}

interface Station {
  id: string;
  name: string;
  kind: "KITCHEN" | "BAR" | "OTHER";
  active: boolean;
  sortOrder: number;
}

function KDSPageContent() {
  const searchParams = useSearchParams();
  const stationId = searchParams.get("station") || "";
  const [station, setStation] = useState<Station | null>(null);
  const [items, setItems] = useState<StationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const statusOrder: Record<ItemStatus, number> = {
    ACCEPTED: 1,
    IN_PREPARATION: 2,
    READY: 3,
    DELIVERED: 4,
    CANCELLED: 5,
  };

  const sortedItems = [...items].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 99;
    const sb = statusOrder[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  useEffect(() => {
    const id = setInterval(() => setNow(() => Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  const fetchStation = useCallback(async () => {
    try {
      const res = await fetch(`${api}/admin/production/stations`, { credentials: "include" });
      if (res.ok) {
        const stations = await res.json();
        setStation(stations.find((s: Station) => s.id === stationId) || null);
      }
    } catch {}
  }, [stationId]);

  const fetchItems = useCallback(async () => {
    if (!stationId) return;
    try {
      const res = await fetch(`${api}/production/stations/${stationId}/items?status=ACCEPTED,IN_PREPARATION,READY`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        setLastUpdate(new Date());
      }
    } catch {
      setError("Falha ao carregar itens");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  async function transitionItem(itemId: string, newStatus: ItemStatus) {
    try {
      const res = await fetch(`${api}/production/items/${itemId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Falha na transição");
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
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

  function getStatusLabel(status: ItemStatus) {
    const labels: Record<ItemStatus, string> = {
      ACCEPTED: "Pendente",
      IN_PREPARATION: "Preparando",
      READY: "Pronto",
      DELIVERED: "Entregue",
      CANCELLED: "Cancelado",
    };
    return labels[status];
  }

  function getStatusClass(status: ItemStatus) {
    return `status-${status.toLowerCase().replace("_", "-")}`;
  }

  function getNextStatus(current: ItemStatus): ItemStatus {
    const transitions: Record<ItemStatus, ItemStatus> = {
      ACCEPTED: "IN_PREPARATION",
      IN_PREPARATION: "READY",
      READY: "DELIVERED",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED",
    };
    return transitions[current];
  }

  useEffect(() => {
    if (!stationId) return;
    async function load() {
      await fetchStation();
      await fetchItems();
    }
    load();

    const es = new EventSource(`${api}/realtime/stations/${stationId}/events`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "item.status" && msg.payload) {
          const { itemId, status } = msg.payload;
          setItems(prev => prev.map(i => i.id === itemId ? { ...i, status } : i));
          setLastUpdate(new Date());
        } else if (msg.type === "order.created" && msg.payload) {
          fetchItems();
        } else if (msg.type === "heartbeat") {
        }
      } catch {}
    };

    es.onerror = () => {
      setError("Conexão perdida, reconectando...");
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          fetchItems();
        }
      }, 2000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [stationId, fetchStation, fetchItems]);

  if (!stationId) {
    return (
      <main className={styles.page}>
        <div className={styles.empty}>
          <h2>Selecione uma estação</h2>
          <p>Acesse pela URL com parâmetro ?station=ID</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <h1>{station?.name || "Carregando..."}</h1>
          <span className={styles.kind}>{station?.kind || ""}</span>
        </header>
        <div className={styles.loading}>Carregando itens...</div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{station?.name}</h1>
        <span className={styles.kind}>{station?.kind}</span>
        {lastUpdate && <span className={styles.lastUpdate}>Atualizado: {formatTime(lastUpdate.toISOString())}</span>}
      </header>
      {error && <div className={styles.errorBar}>{error}</div>}
      <div className={styles.list} role="list" aria-label="Itens da estação">
        {sortedItems.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <p>Nenhum item pendente</p>
            <small>Novos pedidos aparecerão aqui automaticamente</small>
          </div>
        ) : (
          sortedItems.map(item => (
            <article key={item.id} className={`${styles.card} ${getStatusClass(item.status)}`} role="listitem">
              <div className={styles.cardHeader}>
                <div className={styles.orderInfo}>
                  <strong>Pedido {item.orderReference}</strong>
                  <span className={styles.time}>{getRelativeTime(item.createdAt, now)} atrás</span>
                </div>
                <span className={`${styles.badge} ${getStatusClass(item.status)}`}>{getStatusLabel(item.status)}</span>
              </div>
              <div className={styles.itemMain}>
                <div className={styles.itemName}>
                  <span className={styles.quantity}>{item.quantity}x</span>
                  {item.productName}
                </div>
                <div className={styles.timestamps}>
                  {item.status === "IN_PREPARATION" && item.startedAt && (
                    <span className={styles.timestamp}><span className={styles.label}>Iniciado:</span> {formatTime(item.startedAt)}</span>
                  )}
                  {item.status === "READY" && item.readyAt && (
                    <span className={styles.timestamp}><span className={styles.label}>Pronto:</span> {formatTime(item.readyAt)}</span>
                  )}
                </div>
              </div>
              <div className={styles.actions}>
                {item.status !== "DELIVERED" && item.status !== "CANCELLED" ? (
                  <button
                    className={styles.actionBtn}
                    onClick={() => transitionItem(item.id, getNextStatus(item.status))}
                    disabled={false}
                  >
                    {item.status === "ACCEPTED" && "Iniciar"}
                    {item.status === "IN_PREPARATION" && "Finalizar"}
                    {item.status === "READY" && "Entregar"}
                  </button>
                ) : (
                  <>
                    {item.status === "CANCELLED" && <span className={styles.cancelled}>Cancelado</span>}
                    {item.status === "DELIVERED" && <span className={styles.delivered}>Entregue</span>}
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}

export default function KDSPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Carregando...</div>}>
      <KDSPageContent />
    </Suspense>
  );
}