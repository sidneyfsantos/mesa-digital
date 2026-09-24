"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${api}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password"),
        tenantSlug: data.get("tenant"),
      }),
    });
    setSending(false);
    if (!response.ok) {
      setError("E-mail, senha ou estabelecimento inválido.");
      return;
    }
    router.replace("/admin/catalog");
  }
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "#f6f4f1",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          padding: 28,
          borderRadius: 18,
          display: "grid",
          gap: 16,
        }}
      >
        <h1>Entrar no Mesa Digital</h1>
        <label>
          Estabelecimento
          <input
            name="tenant"
            required
            autoComplete="organization"
            style={{
              display: "block",
              width: "100%",
              minHeight: 48,
              marginTop: 6,
            }}
          />
        </label>
        <label>
          E-mail
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            style={{
              display: "block",
              width: "100%",
              minHeight: 48,
              marginTop: 6,
            }}
          />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{
              display: "block",
              width: "100%",
              minHeight: 48,
              marginTop: 6,
            }}
          />
        </label>
        {error && (
          <p role="alert" style={{ color: "#9b2c22" }}>
            {error}
          </p>
        )}
        <button
          disabled={sending}
          style={{
            minHeight: 52,
            border: 0,
            borderRadius: 12,
            background: "#c2410c",
            color: "#fff",
            fontWeight: 800,
          }}
        >
          {sending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
