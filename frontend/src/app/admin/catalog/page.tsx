"use client";
import { FormEvent, useEffect, useState } from "react";
import styles from "./admin.module.css";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type Tab = "categories" | "products" | "modifiers" | "identity" | "stations" | "routing";

interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
}
interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  active: boolean;
  available: boolean;
  sortOrder: number;
}
interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  active: boolean;
  sortOrder: number;
}
interface ModifierOption {
  id: string;
  groupId: string;
  name: string;
  priceDeltaMinor: number;
  active: boolean;
  sortOrder: number;
}
interface Branding {
  displayName: string;
  primaryColor: string;
  logoMediaId: string | null;
  coverMediaId: string | null;
}
interface Station {
  id: string;
  name: string;
  kind: "KITCHEN" | "BAR" | "OTHER";
  active: boolean;
  sortOrder: number;
}
interface RoutingEntry {
  productId: string;
  productName: string;
  stationId: string;
  stationName: string;
  stationKind: string;
}

export default function CatalogAdmin() {
  const [tab, setTab] = useState<Tab>("categories");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catForm, setCatForm] = useState({ name: "", description: "", sortOrder: 0, active: true });
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [prodForm, setProdForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    priceMinor: 0,
    active: true,
    available: true,
    sortOrder: 0,
  });
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodPhotos, setProdPhotos] = useState<File[]>([]);
  const [prodPhotoPreviews, setProdPhotoPreviews] = useState<string[]>([]);

  // Modifiers
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [options, setOptions] = useState<ModifierOption[]>([]);
  const [groupForm, setGroupForm] = useState({
    name: "",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    active: true,
    sortOrder: 0,
  });
  const [optionForm, setOptionForm] = useState({
    groupId: "",
    name: "",
    priceDeltaMinor: 0,
    active: true,
    sortOrder: 0,
  });
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);

  // Identity
  const [, setBranding] = useState<Branding | null>(null);
  const [brandForm, setBrandForm] = useState({
    displayName: "",
    primaryColor: "#c2410c",
    logoMediaId: "",
    coverMediaId: "",
  });

  // Stations
  const [stations, setStations] = useState<Station[]>([]);
  const [stationForm, setStationForm] = useState({
    name: "",
    kind: "KITCHEN" as "KITCHEN" | "BAR" | "OTHER",
    active: true,
    sortOrder: 0,
  });
  const [editingStation, setEditingStation] = useState<Station | null>(null);

  // Routing
  const [routing, setRouting] = useState<RoutingEntry[]>([]);
  const [routingForm, setRoutingForm] = useState({ productId: "", stationId: "" });

  async function fetchCategories() {
    const res = await fetch(`${api}/admin/catalog/categories`, { credentials: "include" });
    if (res.ok) setCategories(await res.json());
  }
  async function fetchProducts() {
    const res = await fetch(`${api}/admin/catalog/products`, { credentials: "include" });
    if (res.ok) setProducts(await res.json());
  }
  async function fetchModifiers() {
    const res = await fetch(`${api}/admin/catalog/modifiers`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setGroups(data.groups || []);
      setOptions(data.options || []);
    }
  }
  async function fetchBranding() {
    const res = await fetch(`${api}/admin/catalog/branding`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setBranding(data);
      if (data) setBrandForm({
        displayName: data.displayName || "",
        primaryColor: data.primaryColor || "#c2410c",
        logoMediaId: data.logoMediaId || "",
        coverMediaId: data.coverMediaId || "",
      });
    }
  }
  async function fetchStations() {
    const res = await fetch(`${api}/admin/production/stations`, { credentials: "include" });
    if (res.ok) setStations(await res.json());
  }
  async function fetchRouting() {
    const res = await fetch(`${api}/admin/production/routing`, { credentials: "include" });
    if (res.ok) setRouting(await res.json());
  }

  useEffect(() => {
    async function loadAll() {
      await fetchCategories();
      await fetchProducts();
      await fetchModifiers();
      await fetchBranding();
      await fetchStations();
      await fetchRouting();
    }
    loadAll();
  }, [tab]);

  function showSuccess(msg: string) { setMessage(msg); setError(""); setTimeout(() => setMessage(""), 3000); }
  function showError(msg: string) { setError(msg); setMessage(""); setTimeout(() => setError(""), 5000); }

  async function apiCall(url: string, options: RequestInit) {
    setSaving(true);
    try {
      const res = await fetch(`${api}${url}`, { ...options, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Erro na requisição" }));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Erro desconhecido");
      throw e;
    } finally {
      setSaving(false);
    }
  }

  // Categories
  async function handleCatSubmit(e: FormEvent) {
    e.preventDefault();
    const data = { name: catForm.name, description: catForm.description || null, sortOrder: catForm.sortOrder, active: catForm.active };
    if (editingCat) {
      await apiCall(`/admin/catalog/categories/${editingCat.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Categoria atualizada");
      setEditingCat(null);
    } else {
      await apiCall("/admin/catalog/categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Categoria criada");
    }
    setCatForm({ name: "", description: "", sortOrder: 0, active: true });
    fetchCategories();
  }

  function editCat(cat: Category) { setEditingCat(cat); setCatForm({ name: cat.name, description: cat.description || "", sortOrder: cat.sortOrder, active: cat.active }); }
  function cancelCat() { setEditingCat(null); setCatForm({ name: "", description: "", sortOrder: 0, active: true }); }

  // Products
  async function uploadProductPhotos(productId: string) {
    for (const file of prodPhotos) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", prodForm.name);
      await apiCall("/admin/catalog/media", { method: "POST", body: formData });
      // The upload returns the media object, we need to attach it to the product
      // We'll do this by calling the attach endpoint
    }
    // Actually, the upload endpoint returns the media, we need to attach each
    // Let's do it properly: upload each, then attach
    for (const file of prodPhotos) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("altText", prodForm.name);
      const res = await fetch(`${api}/admin/catalog/media`, { method: "POST", credentials: "include", body: formData });
      if (res.ok) {
        const media = await res.json();
        await apiCall(`/admin/catalog/products/${productId}/media`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId: media.id, sortOrder: 0 }) });
      }
    }
  }

  async function handleProdSubmit(e: FormEvent) {
    e.preventDefault();
    const data = {
      categoryId: prodForm.categoryId,
      name: prodForm.name,
      description: prodForm.description || null,
      priceMinor: prodForm.priceMinor,
      active: prodForm.active,
      available: prodForm.available,
      sortOrder: prodForm.sortOrder,
    };
    let productId: string;
    if (editingProd) {
      await apiCall(`/admin/catalog/products/${editingProd.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Produto atualizado");
      productId = editingProd.id;
      setEditingProd(null);
    } else {
      const created = await apiCall("/admin/catalog/products", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Produto criado");
      productId = created.id;
    }
    if (prodPhotos.length > 0 && productId) {
      await uploadProductPhotos(productId);
    }
    setProdForm({ categoryId: "", name: "", description: "", priceMinor: 0, active: true, available: true, sortOrder: 0 });
    setProdPhotos([]);
    setProdPhotoPreviews([]);
    fetchProducts();
  }

  function editProd(prod: Product) { setEditingProd(prod); setProdForm({ categoryId: prod.categoryId, name: prod.name, description: prod.description || "", priceMinor: prod.priceMinor, active: prod.active, available: prod.available, sortOrder: prod.sortOrder }); setProdPhotos([]); setProdPhotoPreviews([]); }
  function cancelProd() { setEditingProd(null); setProdForm({ categoryId: "", name: "", description: "", priceMinor: 0, active: true, available: true, sortOrder: 0 }); setProdPhotos([]); setProdPhotoPreviews([]); }

  // Modifier Groups
  async function handleGroupSubmit(e: FormEvent) {
    e.preventDefault();
    const data = { name: groupForm.name, required: groupForm.required, minSelections: groupForm.minSelections, maxSelections: groupForm.maxSelections, active: groupForm.active, sortOrder: groupForm.sortOrder };
    if (editingGroup) {
      await apiCall(`/admin/catalog/modifier-groups/${editingGroup.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Grupo atualizado");
      setEditingGroup(null);
    } else {
      await apiCall("/admin/catalog/modifier-groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Grupo criado");
    }
    setGroupForm({ name: "", required: false, minSelections: 0, maxSelections: 1, active: true, sortOrder: 0 });
    fetchModifiers();
  }

  function editGroup(g: ModifierGroup) { setEditingGroup(g); setGroupForm({ name: g.name, required: g.required, minSelections: g.minSelections, maxSelections: g.maxSelections, active: g.active, sortOrder: g.sortOrder }); }
  function cancelGroup() { setEditingGroup(null); setGroupForm({ name: "", required: false, minSelections: 0, maxSelections: 1, active: true, sortOrder: 0 }); }

  // Modifier Options
  async function handleOptionSubmit(e: FormEvent) {
    e.preventDefault();
    if (!optionForm.groupId) { showError("Selecione um grupo"); return; }
    const data = { groupId: optionForm.groupId, name: optionForm.name, priceDeltaMinor: optionForm.priceDeltaMinor, active: optionForm.active, sortOrder: optionForm.sortOrder };
    if (editingOption) {
      await apiCall(`/admin/catalog/modifier-options/${editingOption.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Opção atualizada");
      setEditingOption(null);
    } else {
      await apiCall(`/admin/catalog/modifier-groups/${optionForm.groupId}/options`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Opção criada");
    }
    setOptionForm({ groupId: "", name: "", priceDeltaMinor: 0, active: true, sortOrder: 0 });
    fetchModifiers();
  }

  function editOption(o: ModifierOption) { setEditingOption(o); setOptionForm({ groupId: o.groupId, name: o.name, priceDeltaMinor: o.priceDeltaMinor, active: o.active, sortOrder: o.sortOrder }); }
  function cancelOption() { setEditingOption(null); setOptionForm({ groupId: "", name: "", priceDeltaMinor: 0, active: true, sortOrder: 0 }); }

  // Identity
  async function handleBrandSubmit(e: FormEvent) {
    e.preventDefault();
    const data = { displayName: brandForm.displayName, primaryColor: brandForm.primaryColor, logoMediaId: brandForm.logoMediaId || null, coverMediaId: brandForm.coverMediaId || null };
    await apiCall("/admin/catalog/branding", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    showSuccess("Identidade atualizada");
    fetchBranding();
  }

  // Stations
  async function handleStationSubmit(e: FormEvent) {
    e.preventDefault();
    const data = { name: stationForm.name, kind: stationForm.kind, active: stationForm.active, sortOrder: stationForm.sortOrder };
    if (editingStation) {
      await apiCall(`/admin/production/stations/${editingStation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Estação atualizada");
      setEditingStation(null);
    } else {
      await apiCall("/admin/production/stations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      showSuccess("Estação criada");
    }
    setStationForm({ name: "", kind: "KITCHEN", active: true, sortOrder: 0 });
    fetchStations();
  }

  function editStation(s: Station) { setEditingStation(s); setStationForm({ name: s.name, kind: s.kind, active: s.active, sortOrder: s.sortOrder }); }
  function cancelStation() { setEditingStation(null); setStationForm({ name: "", kind: "KITCHEN", active: true, sortOrder: 0 }); }

  // Routing
  async function handleRoutingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!routingForm.productId || !routingForm.stationId) { showError("Selecione produto e estação"); return; }
    await apiCall("/admin/production/routing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(routingForm) });
    showSuccess("Roteamento salvo");
    setRoutingForm({ productId: "", stationId: "" });
    fetchRouting();
  }

  async function handleRoutingRemove(productId: string) {
    await apiCall(`/admin/production/routing/${productId}`, { method: "DELETE" });
    showSuccess("Roteamento removido");
    fetchRouting();
  }

  const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);

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
            ["stations", "Estações"],
            ["routing", "Roteamento"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? styles.active : ""}
            onClick={() => { setTab(id); setMessage(""); setError(""); }}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className={styles.panel}>
        {message && <p className={styles.message} role="status">{message}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {tab === "categories" && (
          <form onSubmit={handleCatSubmit}>
            <Title title="Categorias" subtitle={editingCat ? "Editando categoria" : "Organize a ordem de leitura do cardápio."} />
            <Field label="Nome"><input required maxLength={100} value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} /></Field>
            <Field label="Descrição (opcional)"><textarea maxLength={1000} value={catForm.description} onChange={e => setCatForm({...catForm, description: e.target.value})} /></Field>
            <Field label="Ordem"><input type="number" min="0" value={catForm.sortOrder} onChange={e => setCatForm({...catForm, sortOrder: Number(e.target.value)})} /></Field>
            <Toggle label="Categoria ativa" checked={catForm.active} onChange={e => setCatForm({...catForm, active: e.target.checked})} />
            {editingCat && <button type="button" className={styles.secondary} onClick={cancelCat}>Cancelar</button>}
            <Save disabled={saving} />
          </form>
        )}

        {tab === "products" && (
          <form onSubmit={handleProdSubmit}>
            <Title title="Produtos" subtitle={editingProd ? "Editando produto" : "Preço, disponibilidade, descrição e fotos."} />
            <Field label="Categoria">
              <select value={prodForm.categoryId} onChange={e => setProdForm({...prodForm, categoryId: e.target.value})} required>
                <option value="">Selecione</option>
                {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Nome"><input required maxLength={140} value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} /></Field>
            <Field label="Descrição"><textarea maxLength={3000} value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})} /></Field>
            <div className={styles.columns}>
              <Field label="Preço (R$)"><input inputMode="decimal" placeholder="0,00" required value={prodForm.priceMinor} onChange={e => { const v = e.target.value.replace(",", "."); setProdForm({...prodForm, priceMinor: Math.round(parseFloat(v) * 100) || 0}); }} /></Field>
              <Field label="Ordem"><input type="number" min="0" value={prodForm.sortOrder} onChange={e => setProdForm({...prodForm, sortOrder: Number(e.target.value)})} /></Field>
            </div>
            <Field label="Fotos">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => {
                const files = Array.from(e.target.files || []);
                setProdPhotos(files);
                setProdPhotoPreviews(files.map(f => URL.createObjectURL(f)));
              }} />
              {prodPhotoPreviews.length > 0 && (
                <div className={styles.photoPreviews}>
                  {prodPhotoPreviews.map((preview, i) => (
                    <img key={i} src={preview} alt={`Preview ${i + 1}`} />
                  ))}
                </div>
              )}
            </Field>
            <Toggle label="Produto ativo" checked={prodForm.active} onChange={e => setProdForm({...prodForm, active: e.target.checked})} />
            <Toggle label="Disponível agora" checked={prodForm.available} onChange={e => setProdForm({...prodForm, available: e.target.checked})} />
            {editingProd && <button type="button" className={styles.secondary} onClick={cancelProd}>Cancelar</button>}
            <Save disabled={saving} />
          </form>
        )}

        {tab === "modifiers" && (
          <>
            <form onSubmit={handleGroupSubmit}>
              <Title title="Grupos de Adicionais" subtitle={editingGroup ? "Editando grupo" : "Crie grupos reutilizáveis e associe aos produtos."} />
              <Field label="Nome do grupo"><input required maxLength={100} value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} /></Field>
              <div className={styles.columns}>
                <Field label="Mínimo"><input type="number" min="0" value={groupForm.minSelections} onChange={e => setGroupForm({...groupForm, minSelections: Number(e.target.value)})} /></Field>
                <Field label="Máximo"><input type="number" min="1" value={groupForm.maxSelections} onChange={e => setGroupForm({...groupForm, maxSelections: Number(e.target.value)})} /></Field>
              </div>
              <Toggle label="Obrigatório" checked={groupForm.required} onChange={e => setGroupForm({...groupForm, required: e.target.checked})} />
              <Toggle label="Grupo ativo" checked={groupForm.active} onChange={e => setGroupForm({...groupForm, active: e.target.checked})} />
              {editingGroup && <button type="button" className={styles.secondary} onClick={cancelGroup}>Cancelar</button>}
              <Save disabled={saving} />
            </form>

            <form onSubmit={handleOptionSubmit} style={{ marginTop: 24 }}>
              <Title title="Opções do Grupo" subtitle={editingOption ? "Editando opção" : "Adicione opções a um grupo existente."} />
              <Field label="Grupo">
                <select value={optionForm.groupId} onChange={e => setOptionForm({...optionForm, groupId: e.target.value})} required>
                  <option value="">Selecione</option>
                  {groups.filter(g => g.active).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Nome"><input maxLength={100} value={optionForm.name} onChange={e => setOptionForm({...optionForm, name: e.target.value})} /></Field>
              <Field label="Acréscimo (R$)"><input inputMode="decimal" placeholder="0,00" value={optionForm.priceDeltaMinor} onChange={e => { const v = e.target.value.replace(",", "."); setOptionForm({...optionForm, priceDeltaMinor: Math.round(parseFloat(v) * 100) || 0}); }} /></Field>
              <Toggle label="Opção ativa" checked={optionForm.active} onChange={e => setOptionForm({...optionForm, active: e.target.checked})} />
              {editingOption && <button type="button" className={styles.secondary} onClick={cancelOption}>Cancelar</button>}
              <Save disabled={saving} />
            </form>
          </>
        )}

        {tab === "identity" && (
          <form onSubmit={handleBrandSubmit}>
            <Title title="Identidade visual" subtitle="Sua marca, com legibilidade controlada pela plataforma." />
            <Field label="Nome de exibição"><input required maxLength={160} value={brandForm.displayName} onChange={e => setBrandForm({...brandForm, displayName: e.target.value})} /></Field>
            <Field label="Cor principal"><input type="color" value={brandForm.primaryColor} onChange={e => setBrandForm({...brandForm, primaryColor: e.target.value})} /></Field>
            <Field label="Logo (mediaId)"><input value={brandForm.logoMediaId} onChange={e => setBrandForm({...brandForm, logoMediaId: e.target.value})} placeholder="ID da mídia" /></Field>
            <Field label="Imagem de capa (mediaId)"><input value={brandForm.coverMediaId} onChange={e => setBrandForm({...brandForm, coverMediaId: e.target.value})} placeholder="ID da mídia" /></Field>
            <Save disabled={saving} />
          </form>
        )}

        {tab === "stations" && (
          <form onSubmit={handleStationSubmit}>
            <Title title="Estações de Produção" subtitle={editingStation ? "Editando estação" : "Configure cozinha, bar e outras estações."} />
            <Field label="Nome"><input required maxLength={80} value={stationForm.name} onChange={e => setStationForm({...stationForm, name: e.target.value})} /></Field>
            <Field label="Tipo">
              <select value={stationForm.kind} onChange={e => setStationForm({...stationForm, kind: e.target.value as "KITCHEN" | "BAR" | "OTHER"})}>
                <option value="KITCHEN">Cozinha</option>
                <option value="BAR">Bar</option>
                <option value="OTHER">Outra</option>
              </select>
            </Field>
            <Toggle label="Estação ativa" checked={stationForm.active} onChange={e => setStationForm({...stationForm, active: e.target.checked})} />
            <Field label="Ordem"><input type="number" min="0" value={stationForm.sortOrder} onChange={e => setStationForm({...stationForm, sortOrder: Number(e.target.value)})} /></Field>
            {editingStation && <button type="button" className={styles.secondary} onClick={cancelStation}>Cancelar</button>}
            <Save disabled={saving} />
          </form>
        )}

        {tab === "routing" && (
          <form onSubmit={handleRoutingSubmit}>
            <Title title="Roteamento de Produtos" subtitle="Associe cada produto à estação responsável." />
            <Field label="Produto">
              <select value={routingForm.productId} onChange={e => setRoutingForm({...routingForm, productId: e.target.value})} required>
                <option value="">Selecione</option>
                {products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Estação">
              <select value={routingForm.stationId} onChange={e => setRoutingForm({...routingForm, stationId: e.target.value})} required>
                <option value="">Selecione</option>
                {stations.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
              </select>
            </Field>
            <Save disabled={saving} />
          </form>
        )}

        {tab === "categories" && categories.length && (
          <table className={styles.table}>
            <thead><tr><th>Nome</th><th>Descrição</th><th>Ordem</th><th>Ativa</th><th>Ações</th></tr></thead>
            <tbody>{categories.map(c => (<tr key={c.id}><td>{c.name}</td><td>{c.description || "-"}</td><td>{c.sortOrder}</td><td>{c.active ? "Sim" : "Não"}</td><td><button type="button" onClick={() => editCat(c)}>Editar</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === "products" && products.length && (
          <table className={styles.table}>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Ativo</th><th>Disp.</th><th>Ações</th></tr></thead>
            <tbody>{products.map(p => (<tr key={p.id}><td>{p.name}</td><td>{categories.find(c => c.id === p.categoryId)?.name || "-"}</td><td>{money(p.priceMinor)}</td><td>{p.active ? "Sim" : "Não"}</td><td>{p.available ? "Sim" : "Não"}</td><td><button type="button" onClick={() => editProd(p)}>Editar</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === "modifiers" && groups.length && (
          <table className={styles.table}>
            <thead><tr><th>Grupo</th><th>Obrig.</th><th>Min</th><th>Max</th><th>Ativo</th><th>Ações</th></tr></thead>
            <tbody>{groups.map(g => (<tr key={g.id}><td>{g.name}</td><td>{g.required ? "Sim" : "Não"}</td><td>{g.minSelections}</td><td>{g.maxSelections}</td><td>{g.active ? "Sim" : "Não"}</td><td><button type="button" onClick={() => editGroup(g)}>Editar</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === "modifiers" && options.length && (
          <table className={styles.table} style={{ marginTop: 16 }}>
            <thead><tr><th>Grupo</th><th>Opção</th><th>Acréscimo</th><th>Ativa</th><th>Ações</th></tr></thead>
            <tbody>{options.map(o => (<tr key={o.id}><td>{groups.find(g => g.id === o.groupId)?.name || "-"}</td><td>{o.name}</td><td>{money(o.priceDeltaMinor)}</td><td>{o.active ? "Sim" : "Não"}</td><td><button type="button" onClick={() => editOption(o)}>Editar</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === "stations" && stations.length && (
          <table className={styles.table}>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Ordem</th><th>Ativa</th><th>Ações</th></tr></thead>
            <tbody>{stations.map(s => (<tr key={s.id}><td>{s.name}</td><td>{s.kind}</td><td>{s.sortOrder}</td><td>{s.active ? "Sim" : "Não"}</td><td><button type="button" onClick={() => editStation(s)}>Editar</button></td></tr>))}</tbody>
          </table>
        )}
        {tab === "routing" && routing.length && (
          <table className={styles.table}>
            <thead><tr><th>Produto</th><th>Estação</th><th>Tipo</th><th>Ações</th></tr></thead>
            <tbody>{routing.map(r => (<tr key={r.productId}><td>{r.productName}</td><td>{r.stationName}</td><td>{r.stationKind}</td><td><button type="button" className={styles.danger} onClick={() => handleRoutingRemove(r.productId)}>Remover</button></td></tr>))}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return (<div className={styles.title}><h2>{title}</h2><p>{subtitle}</p></div>);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className={styles.field}><span>{label}</span>{children}</label>);
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (<label className={styles.toggle}><input type="checkbox" checked={checked} onChange={onChange} /><span>{label}</span></label>);
}
function Save({ disabled }: { disabled?: boolean }) {
  return <button className={styles.save} disabled={disabled}>{disabled ? "Salvando…" : "Salvar alterações"}</button>;
}