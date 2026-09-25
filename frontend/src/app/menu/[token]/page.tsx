"use client";
import Image from "next/image";
import { use, useEffect, useRef, useState } from "react";
import styles from "./menu.module.css";

type Option = { id: string; name: string; priceDeltaMinor: number };
type Group = {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: Option[];
};
type Product = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  available: boolean;
  photos: { url: string; alt: string }[];
  modifierGroups: Group[];
};
type Category = {
  id: string;
  name: string;
  description: string | null;
  products: Product[];
};
type Catalog = {
  establishment: {
    displayName: string;
    primaryColor: string;
    logoUrl: string | null;
    coverUrl: string | null;
  };
  entry: { servicePoint: { label: string } };
  categories: Category[];
};
type CartItem = { product: Product; quantity: number; optionIds: string[] };

type SessionStatus = "OPEN" | "CHECK_REQUESTED" | "CLOSING" | "CLOSED" | null;

type ServiceCall = { id: string; status: "PENDING" | "RESOLVED"; requestedAt: string };
type BillRequest = { id: string; requestedAt: string; withdrawnAt: string | null };

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

export default function MenuPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState<{
    reference: string;
    totalMinor: number;
  } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const idempotencyKey = useRef(crypto.randomUUID());

  // Session state
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(null);
  const [activeCall, setActiveCall] = useState<ServiceCall | null>(null);
  const [activeBillRequest, setActiveBillRequest] = useState<BillRequest | null>(null);
  const [callError, setCallError] = useState("");
  const [billError, setBillError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  async function fetchSession() {
    try {
      const res = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/session`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.session) setSessionStatus(data.session.status);
        if (data.serviceCalls) {
          const pending = data.serviceCalls.find((c: ServiceCall) => c.status === "PENDING");
          setActiveCall(pending || null);
        }
        if (data.billRequests) {
          const pending = data.billRequests.find((b: BillRequest) => !b.withdrawnAt);
          setActiveBillRequest(pending || null);
        }
      }
    } catch {}
  }

  async function callWaiter() {
    setCallError("");
    try {
      const res = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/calls`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Falha ao chamar garçom");
      fetchSession();
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Erro ao chamar garçom");
    }
  }

  async function requestBill() {
    setBillError("");
    try {
      const res = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/bill-request`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Falha ao pedir conta");
      fetchSession();
    } catch (e) {
      setBillError(e instanceof Error ? e.message : "Erro ao pedir conta");
    }
  }

  async function withdrawBill() {
    setBillError("");
    try {
      const res = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/bill-request/withdraw`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error("Falha ao retirar conta");
      fetchSession();
    } catch (e) {
      setBillError(e instanceof Error ? e.message : "Erro ao retirar conta");
    }
  }

  useEffect(() => {
    fetch(`${api}/public/entry/${encodeURIComponent(token)}/catalog`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);

  useEffect(() => {
    if (!data) return;
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
        fetchSession();
      } catch {}
    };
    es.onerror = () => { setTimeout(fetchSession, 3000); };
    return () => { es.close(); };
  }, [token, data, fetchSession]);

  if (error) return (
    <main className={styles.state}>
      <span>Não foi possível abrir este cardápio.</span>
      <p>Confira o QR Code ou tente novamente.</p>
    </main>
  );
  if (!data) return (
    <main className={styles.shell}>
      <div className={styles.coverSkeleton} />
      <div className={styles.titleSkeleton} />
      {[1,2,3].map(i => <div key={i} className={styles.cardSkeleton} />)}
    </main>
  );

  const showBillUI = sessionStatus === "CHECK_REQUESTED" || sessionStatus === "CLOSING" || sessionStatus === "CLOSED";
  const canOrder = sessionStatus === "OPEN" && !activeCall;
  const canCallWaiter = sessionStatus === "OPEN" && !activeCall;
  const canRequestBill = sessionStatus === "OPEN" && !activeBillRequest;
  const canWithdrawBill = activeBillRequest && !activeBillRequest.withdrawnAt && sessionStatus !== "CLOSED";

  return (
    <main className={styles.shell} style={{ "--brand": data.establishment.primaryColor } as React.CSSProperties}>
      <header className={styles.hero}>
        {data.establishment.coverUrl && (
          <Image unoptimized fill sizes="100vw" src={`${api}/public${data.establishment.coverUrl}`} alt="" className={styles.cover} />
        )}
        <div className={styles.identity}>
          {data.establishment.logoUrl && (
            <Image unoptimized width={62} height={62} src={`${api}/public${data.establishment.logoUrl}`} alt="" className={styles.logo} />
          )}
          <div>
            <p className={styles.context}>{data.entry.servicePoint.label}</p>
            <h1>{data.establishment.displayName}</h1>
          </div>
        </div>
      </header>

      {/* Session Status Bar */}
      <section className={styles.sessionBar}>
        <div className={styles.sessionStatus}>
          <span className={`status ${sessionStatus?.toLowerCase()}`}>{sessionStatus || "—"}</span>
          {sessionStatus === "CHECK_REQUESTED" && (
            <span className={styles.billBadge}>Conta solicitada</span>
          )}
          {sessionStatus === "CHECK_REQUESTED" && (
            <span className={styles.blockedNotice}>Novos pedidos bloqueados</span>
          )}
          {sessionStatus === "CLOSING" && <span className={styles.closingBadge}>Fechando…</span>}
          {sessionStatus === "CLOSED" && <span className={styles.closedBadge}>Encerrada</span>}
        </div>
      </section>

      {/* Action Buttons Bar */}
      <section className={styles.actionBar}>
        {canCallWaiter && (
          <button className={styles.waiterBtn} onClick={callWaiter} disabled={sending}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Chamar garçom</span>
          </button>
        )}
        {activeCall && (
          <div className={styles.activeCall}>
            <span>Chamado enviado · {new Date().toLocaleTimeString()}</span>
          </div>
        )}
        {canRequestBill && (
          <button className={styles.billBtn} onClick={requestBill} disabled={sending}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            <span>Pedir a conta</span>
          </button>
        )}
        {activeBillRequest && !activeBillRequest.withdrawnAt && sessionStatus !== "CLOSED" && (
          <div className={styles.activeBill}>
            <span>Conta solicitada</span>
            <button className={styles.withdrawBtn} onClick={withdrawBill}>Retirar pedido</button>
          </div>
        )}
        {showBillUI && !activeBillRequest && !canRequestBill && (
          <div className={styles.activeBill}>
            <span>Conta solicitada</span>
          </div>
        )}
      </section>

      {callError && <div className={styles.errorToast} role="alert">{callError}</div>}
      {billError && <div className={styles.errorToast} role="alert">{billError}</div>}

      {data.categories.length === 0 ? (
        <section className={styles.empty}><h2>Cardápio sendo preparado</h2><p>Em breve haverá opções por aqui.</p></section>
      ) : (
        <>
          <nav className={styles.categories} aria-label="Categorias">
            {data.categories.map((c) => <a key={c.id} href={`#category-${c.id}`}>{c.name}</a>)}
          </nav>
          <div className={styles.content}>
            {data.categories.map((c) => (
              <section id={`category-${c.id}`} className={styles.section} key={c.id}>
                <h2>{c.name}</h2>
                {c.description && <p className={styles.categoryDescription}>{c.description}</p>}
                <div className={styles.grid}>
                  {c.products.map((p) => (
                    <button className={styles.card} key={p.id} onClick={() => setSelected(p)} disabled={!p.available || !canOrder}>
                      <div className={styles.cardText}>
                        <strong>{p.name}</strong>
                        {p.description && <span>{p.description}</span>}
                        <b>{money(p.priceMinor)}</b>
                        {!p.available && <em>Indisponível</em>}
                        {!canOrder && <em>Pedidos bloqueados</em>}
                      </div>
                      {p.photos[0] ? (
                        <Image unoptimized width={94} height={94} src={`${api}/public${p.photos[0].url}`} alt={p.photos[0].alt} />
                      ) : <div className={styles.placeholder} aria-hidden="true">⌁</div>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {selected && (
        <ProductDetail product={selected} close={() => setSelected(null)} add={(optionIds) => {
          setCart(c => [...c, { product: selected, quantity: 1, optionIds }]);
          idempotencyKey.current = crypto.randomUUID();
          setSelected(null);
          setCartOpen(true);
        }} />
      )}

      {cart.length > 0 && !cartOpen && (
        <button className={styles.cartBar} onClick={() => setCartOpen(true)}>
          Ver carrinho · {cart.reduce((n, i) => n + i.quantity, 0)} itens
        </button>
      )}

      {cartOpen && (
        <Cart items={cart} sending={sending} error={submitError} order={order} close={() => setCartOpen(false)}
          change={(index, quantity) => setCart(c => quantity < 1 ? c.filter((_, i) => i !== index) : c.map((item, i) => i === index ? {...item, quantity} : item))}
          submit={async () => {
            setSending(true); setSubmitError("");
            try {
              const response = await fetch(`${api}/public/entry/${encodeURIComponent(token)}/orders`, {
                method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
                body: JSON.stringify({ items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity, modifierOptionIds: item.optionIds })) }),
              });
              if (!response.ok) throw new Error((await response.json()).message ?? "Não foi possível enviar.");
              const result = await response.json();
              setOrder(result.order); setCart([]); idempotencyKey.current = crypto.randomUUID();
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : "Não foi possível enviar. Tente novamente.");
            } finally { setSending(false); }
          }} />
      )}

      <script dangerouslySetInnerHTML={{ __html: `
        if (window.location.search.includes('token=')) {
          const url = new URL(window.location.href);
          const token = url.searchParams.get('token');
          if (token) {
            const es = new EventSource('/realtime/events', { withCredentials: true });
            es.onmessage = (e) => {
              try { const msg = JSON.parse(e.data); if (msg.type !== 'heartbeat') fetch('/public/entry/'+token+'/session', {credentials:'include'}).then(r=>r.ok&&r.json()).then(d=>{ if(d.session) { const ev = new CustomEvent('session-update', {detail: d}); window.dispatchEvent(ev); } }); } catch {}
            };
            window.addEventListener('session-update', () => { /* state will update via React */ });
          }
        }
      `}} />
    </main>
  );
}

function ProductDetail({ product, close, add }: { product: Product; close: () => void; add: (optionIds: string[]) => void }) {
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const toggle = (g: Group, id: string) => setChoices(c => { const list = c[g.id] ?? []; const next = list.includes(id) ? list.filter(x => x!==id) : g.maxSelections===1 ? [id] : list.length < g.maxSelections ? [...list, id] : list; return {...c, [g.id]: next}; });
  const valid = product.modifierGroups.every(g => (choices[g.id]?.length ?? 0) >= g.minSelections);
  const extra = product.modifierGroups.flatMap(g => g.options).filter(o => Object.values(choices).flat().includes(o.id)).reduce((sum, o) => sum + o.priceDeltaMinor, 0);
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <section className={styles.detail} role="dialog" aria-modal="true" aria-labelledby="product-title">
        <button className={styles.close} onClick={close} aria-label="Fechar">×</button>
        <h2 id="product-title">{product.name}</h2>
        {product.description && <p>{product.description}</p>}
        <strong className={styles.detailPrice}>{money(product.priceMinor)}</strong>
        {product.modifierGroups.map(g => (
          <fieldset key={g.id}>
            <legend>{g.name} <small>{g.required ? "Obrigatório" : "Opcional"} · escolha {g.minSelections===g.maxSelections ? g.maxSelections : `${g.minSelections} a ${g.maxSelections}`}</small></legend>
            {g.options.map(o => (
              <label key={o.id}>
                <input type={g.maxSelections===1?"radio":"checkbox"} name={g.id} checked={(choices[g.id]??[]).includes(o.id)} onChange={()=>toggle(g,o.id)} />
                <span>{o.name}</span>
                {o.priceDeltaMinor>0 && <b>+ {money(o.priceDeltaMinor)}</b>}
              </label>
            ))}
          </fieldset>
        ))}
        <button className={styles.select} disabled={!valid} onClick={()=>add(Object.values(choices).flat())}>Adicionar · {money(product.priceMinor+extra)}</button>
        <small className={styles.notice}>Você poderá revisar antes de enviar.</small>
      </section>
    </div>
  );
}

function Cart({ items, sending, error, order, close, change, submit }: { items: CartItem[]; sending: boolean; error: string; order: { reference: string; totalMinor: number } | null; close: () => void; change: (index: number, quantity: number) => void; submit: () => void }) {
  const total = items.reduce((sum, item) => { const extra = item.product.modifierGroups.flatMap(g=>g.options).filter(o=>item.optionIds.includes(o.id)).reduce((n,o)=>n+o.priceDeltaMinor,0); return sum + (item.product.priceMinor + extra) * item.quantity; }, 0);
  return (
    <div className={styles.backdrop}>
      <section className={styles.detail} role="dialog" aria-modal="true">
        <button className={styles.close} onClick={close} aria-label="Fechar">×</button>
        {order ? (
          <div className={styles.success}><h2>Pedido confirmado!</h2><p>Referência <strong>{order.reference}</strong></p><b>{money(order.totalMinor)}</b></div>
        ) : (
          <>
            <h2>Revise seu pedido</h2>
            {items.map((item, index) => (
              <article className={styles.cartItem} key={`${item.product.id}-${index}`}>
                <div><strong>{item.product.name}</strong><small>{item.product.modifierGroups.flatMap(g=>g.options).filter(o=>item.optionIds.includes(o.id)).map(o=>o.name).join(", ")}</small></div>
                <div><button onClick={()=>change(index, item.quantity-1)}>−</button><b>{item.quantity}</b><button onClick={()=>change(index, item.quantity+1)}>+</button></div>
              </article>
            ))}
            <strong className={styles.cartTotal}>Subtotal {money(total)}</strong>
            {error && <p className={styles.submitError}>{error}</p>}
            <button className={styles.select} disabled={sending || !items.length} onClick={submit}>{sending?"Enviando…":"Confirmar pedido"}</button>
            <small className={styles.notice}>O pedido só é aceito após a confirmação do servidor.</small>
          </>
        )}
      </section>
    </div>
  );
}