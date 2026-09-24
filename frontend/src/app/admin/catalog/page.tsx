"use client";
import { FormEvent, useState } from "react";
import styles from "./admin.module.css";
type Tab = "categories" | "products" | "modifiers" | "identity";
export default function CatalogAdmin() {
  const [tab, setTab] = useState<Tab>("categories");
  const [message, setMessage] = useState("");
  const save = (label: string) => (e: FormEvent) => {
    e.preventDefault();
    setMessage(`${label} pronto para salvar pela API administrativa.`);
  };
  return (
    <main className={styles.page}>
      <header>
        <p>Administração</p>
        <h1>Seu cardápio</h1>
        <span>Atualize o que seus clientes veem, sem suporte técnico.</span>
      </header>
      <nav aria-label="Áreas do catálogo">
        {(
          [
            ["categories", "Categorias"],
            ["products", "Produtos"],
            ["modifiers", "Adicionais"],
            ["identity", "Identidade"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? styles.active : ""}
            onClick={() => {
              setTab(id);
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className={styles.panel}>
        {tab === "categories" && (
          <form onSubmit={save("Categoria")}>
            <Title
              title="Categorias"
              subtitle="Organize a ordem de leitura do cardápio."
            />
            <Field label="Nome">
              <input required maxLength={100} />
            </Field>
            <Field label="Descrição (opcional)">
              <textarea maxLength={1000} />
            </Field>
            <Field label="Ordem">
              <input type="number" min="0" defaultValue="0" />
            </Field>
            <Toggle label="Categoria ativa" />
            <Save />
          </form>
        )}
        {tab === "products" && (
          <form onSubmit={save("Produto")}>
            <Title
              title="Produtos"
              subtitle="Preço, disponibilidade, descrição e fotos."
            />
            <Field label="Nome">
              <input required maxLength={140} />
            </Field>
            <Field label="Descrição">
              <textarea maxLength={3000} />
            </Field>
            <div className={styles.columns}>
              <Field label="Preço (R$)">
                <input inputMode="decimal" placeholder="0,00" required />
              </Field>
              <Field label="Ordem">
                <input type="number" min="0" defaultValue="0" />
              </Field>
            </div>
            <Field label="Fotos">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
              />
            </Field>
            <Toggle label="Produto ativo" />
            <Toggle label="Disponível agora" />
            <Save />
          </form>
        )}
        {tab === "modifiers" && (
          <form onSubmit={save("Grupo de adicionais")}>
            <Title
              title="Adicionais"
              subtitle="Crie grupos reutilizáveis e associe aos produtos."
            />
            <Field label="Nome do grupo">
              <input required maxLength={100} />
            </Field>
            <div className={styles.columns}>
              <Field label="Mínimo">
                <input type="number" min="0" defaultValue="0" />
              </Field>
              <Field label="Máximo">
                <input type="number" min="1" defaultValue="1" />
              </Field>
            </div>
            <Toggle label="Obrigatório" />
            <Toggle label="Grupo ativo" />
            <h3>Nova opção</h3>
            <Field label="Nome">
              <input maxLength={100} />
            </Field>
            <Field label="Acréscimo (R$)">
              <input inputMode="decimal" placeholder="0,00" />
            </Field>
            <Save />
          </form>
        )}
        {tab === "identity" && (
          <form onSubmit={save("Identidade")}>
            <Title
              title="Identidade visual"
              subtitle="Sua marca, com legibilidade controlada pela plataforma."
            />
            <Field label="Nome de exibição">
              <input required maxLength={160} />
            </Field>
            <Field label="Cor principal">
              <input type="color" defaultValue="#c2410c" />
            </Field>
            <Field label="Logo">
              <input type="file" accept="image/jpeg,image/png,image/webp" />
            </Field>
            <Field label="Imagem de capa">
              <input type="file" accept="image/jpeg,image/png,image/webp" />
            </Field>
            <Save />
          </form>
        )}
        {message && (
          <p className={styles.message} role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.title}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Toggle({ label }: { label: string }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" defaultChecked />
      <span>{label}</span>
    </label>
  );
}
function Save() {
  return <button className={styles.save}>Salvar alterações</button>;
}
