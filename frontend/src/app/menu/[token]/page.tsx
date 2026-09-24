"use client";
import Image from "next/image";
import { use, useEffect, useState } from "react";
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
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value / 100,
  );
export default function MenuPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  useEffect(() => {
    fetch(`${api}/public/entry/${encodeURIComponent(token)}/catalog`, {
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [token]);
  if (error)
    return (
      <main className={styles.state}>
        <span>Não foi possível abrir este cardápio.</span>
        <p>Confira o QR Code ou tente novamente.</p>
      </main>
    );
  if (!data)
    return (
      <main className={styles.shell}>
        <div className={styles.coverSkeleton} />
        <div className={styles.titleSkeleton} />
        {[1, 2, 3].map((i) => (
          <div className={styles.cardSkeleton} key={i} />
        ))}
      </main>
    );
  return (
    <main
      className={styles.shell}
      style={
        { "--brand": data.establishment.primaryColor } as React.CSSProperties
      }
    >
      <header className={styles.hero}>
        {data.establishment.coverUrl && (
          <Image
            unoptimized
            fill
            sizes="100vw"
            src={`${api}/public${data.establishment.coverUrl}`}
            alt=""
            className={styles.cover}
          />
        )}
        <div className={styles.identity}>
          {data.establishment.logoUrl && (
            <Image
              unoptimized
              width={62}
              height={62}
              src={`${api}/public${data.establishment.logoUrl}`}
              alt=""
              className={styles.logo}
            />
          )}
          <div>
            <p className={styles.context}>{data.entry.servicePoint.label}</p>
            <h1>{data.establishment.displayName}</h1>
          </div>
        </div>
      </header>
      {data.categories.length === 0 ? (
        <section className={styles.empty}>
          <h2>Cardápio sendo preparado</h2>
          <p>Em breve haverá opções por aqui.</p>
        </section>
      ) : (
        <>
          <nav className={styles.categories} aria-label="Categorias">
            {data.categories.map((c) => (
              <a href={`#category-${c.id}`} key={c.id}>
                {c.name}
              </a>
            ))}
          </nav>
          <div className={styles.content}>
            {data.categories.map((c) => (
              <section
                id={`category-${c.id}`}
                className={styles.section}
                key={c.id}
              >
                <h2>{c.name}</h2>
                {c.description && (
                  <p className={styles.categoryDescription}>{c.description}</p>
                )}
                <div className={styles.grid}>
                  {c.products.map((p) => (
                    <button
                      className={styles.card}
                      key={p.id}
                      onClick={() => setSelected(p)}
                      disabled={!p.available}
                    >
                      <div className={styles.cardText}>
                        <strong>{p.name}</strong>
                        {p.description && <span>{p.description}</span>}
                        <b>{money(p.priceMinor)}</b>
                        {!p.available && <em>Indisponível no momento</em>}
                      </div>
                      {p.photos[0] ? (
                        <Image
                          unoptimized
                          width={94}
                          height={94}
                          src={`${api}/public${p.photos[0].url}`}
                          alt={p.photos[0].alt}
                        />
                      ) : (
                        <div className={styles.placeholder} aria-hidden="true">
                          ⌁
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {selected && (
        <ProductDetail product={selected} close={() => setSelected(null)} />
      )}
    </main>
  );
}
function ProductDetail({
  product,
  close,
}: {
  product: Product;
  close: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const toggle = (g: Group, id: string) =>
    setChoices((current) => {
      const list = current[g.id] ?? [];
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : g.maxSelections === 1
          ? [id]
          : list.length < g.maxSelections
            ? [...list, id]
            : list;
      return { ...current, [g.id]: next };
    });
  const valid = product.modifierGroups.every(
    (g) => (choices[g.id]?.length ?? 0) >= g.minSelections,
  );
  const extra = product.modifierGroups
    .flatMap((g) => g.options)
    .filter((o) => Object.values(choices).flat().includes(o.id))
    .reduce((sum, o) => sum + o.priceDeltaMinor, 0);
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={styles.detail}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
      >
        <button className={styles.close} onClick={close} aria-label="Fechar">
          ×
        </button>
        <h2 id="product-title">{product.name}</h2>
        {product.description && <p>{product.description}</p>}
        <strong className={styles.detailPrice}>
          {money(product.priceMinor)}
        </strong>
        {product.modifierGroups.map((g) => (
          <fieldset key={g.id}>
            <legend>
              {g.name}
              <small>
                {g.required ? "Obrigatório" : "Opcional"} · escolha{" "}
                {g.minSelections === g.maxSelections
                  ? g.maxSelections
                  : `${g.minSelections} a ${g.maxSelections}`}
              </small>
            </legend>
            {g.options.map((o) => (
              <label key={o.id}>
                <input
                  type={g.maxSelections === 1 ? "radio" : "checkbox"}
                  name={g.id}
                  checked={(choices[g.id] ?? []).includes(o.id)}
                  onChange={() => toggle(g, o.id)}
                />
                <span>{o.name}</span>
                {o.priceDeltaMinor > 0 && <b>+ {money(o.priceDeltaMinor)}</b>}
              </label>
            ))}
          </fieldset>
        ))}
        <button className={styles.select} disabled={!valid}>
          Selecionado · {money(product.priceMinor + extra)}
        </button>
        <small className={styles.notice}>
          Esta seleção ainda não envia um pedido.
        </small>
      </section>
    </div>
  );
}
