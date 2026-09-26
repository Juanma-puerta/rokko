import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  IceCreamBowl,
  ShoppingBag,
  Wallet,
  Package,
  History,
  Settings,
  LogOut,
  Search,
  Plus,
  Minus,
  X,
  ChevronRight,
  Check,
  Truck,
  Store,
  Printer,
  Trash2,
  Users,
  ArrowUpRight,
  CircleHelp,
  IceCreamCone,
} from "lucide-react";
import "bulma/css/bulma.min.css";
import "./style.css";

const money = (n) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
const date = (d) =>
  new Date(d).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const today = (d) =>
  new Date(d).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  }) ===
  new Date().toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
const labels = {
  pending: "Pendiente",
  preparing: "En preparación",
  ready: "Listo para entregar",
  delivered: "Entregado",
  cancelled: "Anulado",
  cash: "Efectivo",
  qr: "QR",
  card: "Tarjeta",
};
async function api(path, body, method = "POST") {
  const r = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok) {
    const error = new Error(data.error || "No se pudo completar la operación");
    error.status = r.status;
    throw error;
  }
  return data;
}
function Brand() {
  return (
    <div className="brand">
      <span>
        Rokko<span className="brand-star">✳</span>
      </span>
      <small>CASA DE HELADOS</small>
    </div>
  );
}
function ProductArt({ kind = "tub", index = 0 }) {
  const colors = ["#c84938", "#d29466", "#849981"];
  const color = colors[index % 3];
  return (
    <svg viewBox="0 0 180 145" aria-hidden="true">
      <ellipse cx="91" cy="126" rx="46" ry="8" fill="#000" opacity=".06" />
      {kind === "ice" ? (
        <>
          <rect x="64" y="16" width="53" height="83" rx="24" fill={color} />
          <path
            d="M74 38v39"
            stroke="white"
            opacity=".35"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect x="85" y="98" width="12" height="30" rx="5" fill="#cfa77c" />
        </>
      ) : kind === "cone" || kind === "wafer" ? (
        <>
          <path d="M57 62h69l-33 69Z" fill="#d8aa6d" />
          <path
            d="m67 71 36 36m-27-36 31 26m9-27-32 36m25-37L79 96"
            stroke="#b9864d"
            strokeWidth="2"
          />
          <circle cx="77" cy="54" r="25" fill="#e7ceac" />
          <circle cx="108" cy="55" r="24" fill={color} />
          <circle cx="92" cy="31" r="25" fill="#eee0ce" />
        </>
      ) : (
        <>
          <ellipse cx="91" cy="47" rx="47" ry="19" fill="#f3e6d3" />
          <circle cx="66" cy="42" r="19" fill="#c9a486" />
          <circle cx="92" cy="32" r="24" fill="#f7e5c8" />
          <circle cx="116" cy="43" r="20" fill="#dbc3a6" />
          <path d="M44 48h94l-11 67q-36 17-72 0Z" fill={color} />
          <ellipse
            cx="91"
            cy="49"
            rx="47"
            ry="10"
            fill="none"
            stroke="#f6eee1"
            strokeWidth="4"
          />
          <text
            x="91"
            y="88"
            textAnchor="middle"
            fill="#fff5e4"
            fontFamily="Georgia"
            fontWeight="bold"
            fontSize="23"
          >
            Rokko
          </text>
          <text
            x="91"
            y="102"
            textAnchor="middle"
            fill="#fff5e4"
            fontSize="5"
            letterSpacing="2"
          >
            CASA DE HELADOS
          </text>
        </>
      )}
    </svg>
  );
}
function Modal({ title, onClose, children }) {
  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={onClose} />
      <section className="modal-card">
        <header className="modal-card-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={21} />
          </button>
        </header>
        <div className="modal-card-body">{children}</div>
      </section>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }) {
  return (
    <div className="empty">
      <IceCreamBowl size={36} />
      <p>{children}</p>
    </div>
  );
}
function App() {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("Venta"),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(null);
  const [cart, setCart] = useState([]),
    [channel, setChannel] = useState("local"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(0),
    [customer, setCustomer] = useState({ name: "", phone: "", address: "" }),
    [notes, setNotes] = useState("");
  const [selected, setSelected] = useState(null),
    [flavors, setFlavors] = useState([]),
    [quantity, setQuantity] = useState(1),
    [ticket, setTicket] = useState(null),
    [ticketType, setTicketType] = useState("sale");
  const refresh = async () => {
    const d = await api("/state");
    setData(d);
    return d;
  };
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const run = async (fn, success = "Cambios guardados") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setModal(null);
      setToast(success);
    } catch (e) {
      setError(e.message);
      if (e.status === 401) setData(null);
    } finally {
      setBusy(false);
    }
  };
  const show = (m) => {
    setError("");
    setModal(m);
  };
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <p>Preparando la heladería…</p>
      </div>
    );
  if (!data)
    return (
      <div className="login-layout">
        <div className="login-story">
          <Brand />
          <div>
            <span className="eyebrow">COOLTURA ARTESANAL · DESDE 1967</span>
            <h1>
              Un buen día
              <br />
              empieza con
              <br />
              <em>un helado.</em>
            </h1>
            <ProductArt />
          </div>
          <p>Hecho con pasión. Servido con una sonrisa.</p>
        </div>
        <div className="login-form">
          <span className="eyebrow">BIENVENIDO A ROKKO</span>
          <h2>Tu heladería, en orden.</h2>
          <p>Ingresá para comenzar tu jornada.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(
                () => api("/login", Object.fromEntries(f)),
                "¡Bienvenido a Rokko!",
              );
            }}
          >
            <Field label="Email">
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="tu@email.com"
              />
            </Field>
            <Field label="Contraseña">
              <input
                className="input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <div className="error">{error}</div>}
            <button className="button is-primary full" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="demo-note">
            Entorno local de prueba
            <br />
            <b>admin@rokko.local</b> · RokkoDemo2026!
          </div>
        </div>
      </div>
    );
  const { products, categories, orders, branch, user, cash } = data,
    admin = user.role === "admin",
    cashOpen = cash && !cash.closed_at;
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0),
    delivery = channel === "delivery" ? branch.delivery_fee : 0,
    total = subtotal + delivery;
  const activeOrders = orders.filter(
      (o) => !["delivered", "cancelled"].includes(o.status),
    ),
    todays = orders.filter(
      (o) => today(o.created_at) && o.status !== "cancelled",
    );
  const nav = [
    ["Venta", IceCreamBowl],
    ["Pedidos", ShoppingBag],
    ["Caja", Wallet],
    ["Dashboard", LayoutDashboard],
    ["Productos", Package],
    ["Stock", IceCreamCone],
    ["Historial", History],
    ...(admin
      ? [
          ["Usuarios", Users],
          ["Configuración", Settings],
        ]
      : []),
  ];
  const print = (order, type = "sale") => {
    setTicket(order);
    setTicketType(type);
    setTimeout(() => window.print(), 150);
  };
  const selectProduct = (p) => {
    setSelected(p);
    setFlavors([]);
    setQuantity(1);
    show("flavors");
  };
  const addCart = () => {
    setCart([
      ...cart,
      {
        key: crypto.randomUUID(),
        productId: selected.id,
        name: selected.name,
        price: selected.price,
        quantity,
        flavorIds: flavors,
        flavorNames: flavors.map(
          (id) => data.flavors.find((f) => f.id === id).name,
        ),
      },
    ]);
    setModal(null);
  };
  const orderList = (list, history = false) => (
    <div className="table-container">
      <table className="table is-fullwidth">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente / canal</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Cobro</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id}>
              <td>
                <b>#{String(o.id).padStart(4, "0")}</b>
                <small>{date(o.created_at)}</small>
              </td>
              <td>
                {o.customer.name || "Cliente de mostrador"}
                <small>
                  {o.channel === "delivery" ? "Delivery" : "Presencial"}
                </small>
              </td>
              <td>
                <span className={`status ${o.status}`}>{labels[o.status]}</span>
              </td>
              <td>
                <b>{money(o.total)}</b>
              </td>
              <td>
                <span
                  className={
                    o.status === "cancelled"
                      ? "muted"
                      : o.paid === o.total
                        ? "green"
                        : "red"
                  }
                >
                  {o.status === "cancelled"
                    ? "Anulado"
                    : o.paid === o.total
                      ? "Pagado"
                      : `Debe ${money(o.total - o.paid)}`}
                </span>
              </td>
              <td>
                <button
                  className="button is-small"
                  onClick={() => show({ type: "order", order: o })}
                >
                  Ver pedido <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <Empty>
          {history
            ? "Todavía no hay operaciones."
            : "No hay pedidos pendientes. ¡Todo al día!"}
        </Empty>
      )}
    </div>
  );
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <Brand />
          <div className="branch">
            <span className="branch-icon">
              <Store size={19} />
            </span>
            <div>
              <b>{branch.name}</b>
              <small>Sucursal principal</small>
            </div>
            <span className="online-dot" />
          </div>
          <span className="nav-label">TU HELADERÍA</span>
          <nav>
            {nav.map(([name, Icon]) => (
              <button
                aria-label={name}
                title={name}
                key={name}
                className={page === name ? "active" : ""}
                onClick={() => {
                  setPage(name);
                  setSearch("");
                }}
              >
                <Icon size={19} />
                <span>{name}</span>
                {name === "Pedidos" && activeOrders.length > 0 && (
                  <i>{activeOrders.length}</i>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="handmade">
              Con amor.
              <br />
              <em>Y mucho helado.</em>
              <span>✳</span>
            </div>
            <div className="profile">
              <span className="avatar">{user.name[0]}</span>
              <div
                role="button"
                tabIndex={0}
                title="Cambiar contraseña"
                onClick={() => show("password")}
                onKeyDown={(e) => e.key === "Enter" && show("password")}
              >
                <b>{user.name}</b>
                <small>{admin ? "Administrador" : "Heladero"}</small>
              </div>
              <button
                aria-label="Cerrar sesión"
                className="icon-button"
                onClick={() =>
                  run(async () => {
                    await api("/logout", {});
                    setData(null);
                    window.location.reload();
                  })
                }
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div>
              <span className="breadcrumb">Gestión de heladería</span>
              <ChevronRight size={13} />
              <b>{page}</b>
            </div>
            <div>
              <span className={`cash-status ${cashOpen ? "" : "closed"}`}>
                <span />
                {cashOpen ? "Caja abierta" : "Caja cerrada"}
              </span>
              <span className="top-date">
                {new Date().toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <span className="eyebrow">ROKKO · CASA DE HELADOS</span>
                <h1>
                  {
                    {
                      Venta: "Un sabor, una sonrisa.",
                      Pedidos: "Cada pedido, a su tiempo.",
                      Caja: "Las cuentas, claras.",
                      Dashboard: "Así va tu heladería.",
                      Productos: "Nuestros favoritos.",
                      Stock: "Todo listo para servir.",
                      Historial: "Cada venta cuenta.",
                      Usuarios: "El equipo Rokko.",
                      Configuración: "A tu manera.",
                    }[page]
                  }
                </h1>
                <p>
                  {
                    {
                      Venta:
                        "Todo listo para preparar el próximo momento rico.",
                      Pedidos: "Prepará, cobrá y entregá desde un mismo lugar.",
                      Caja: "Controlá el efectivo y los movimientos de tu jornada.",
                      Dashboard: "Una mirada a los números de hoy.",
                      Productos:
                        "Administrá las presentaciones y precios del catálogo.",
                      Stock:
                        "Disponibilidad por producto y sabor en esta sucursal.",
                      Historial:
                        "Consultá pedidos, comprobantes y anulaciones.",
                      Usuarios: "Administrá los accesos de tu sucursal.",
                      Configuración:
                        "Configurá los valores de operación de la sucursal.",
                    }[page]
                  }
                </p>
              </div>
              {page === "Venta" ? (
                <span className="artisan-badge">
                  100%<small>ARTESANAL</small>✳
                </span>
              ) : page === "Productos" && admin ? (
                <button
                  className="button is-primary"
                  onClick={() => show("product")}
                >
                  <Plus size={17} />
                  Nuevo producto
                </button>
              ) : null}
            </div>
            {error && !modal && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {page === "Venta" && (
              <div className="sale-layout">
                <section className="catalog">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      placeholder="Buscar un producto…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <span>⌕</span>
                  </div>
                  <div className="category-tabs">
                    {[{ id: 0, name: "Todos" }, ...categories].map((c) => (
                      <button
                        className={category === c.id ? "active" : ""}
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className="catalog-label">
                    <b>
                      {category
                        ? categories.find((c) => c.id === category)?.name
                        : "Nuestro menú"}
                    </b>
                    <span>
                      {
                        products.filter(
                          (p) =>
                            p.active &&
                            (!category || p.category_id === category) &&
                            p.name.toLowerCase().includes(search.toLowerCase()),
                        ).length
                      }{" "}
                      productos
                    </span>
                  </div>
                  <div className="product-grid">
                    {products
                      .filter(
                        (p) =>
                          p.active &&
                          (!category || p.category_id === category) &&
                          p.name.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((p, i) => (
                        <button
                          key={p.id}
                          className={`product-card ${!p.stock ? "sold-out" : ""}`}
                          onClick={() => selectProduct(p)}
                          disabled={!p.stock}
                        >
                          <div className={`product-art art-${p.kind}`}>
                            <span className="product-tag">
                              {p.max_flavors
                                ? `Hasta ${p.max_flavors} ${p.max_flavors === 1 ? "sabor" : "sabores"}`
                                : "Refrescante"}
                            </span>
                            <ProductArt kind={p.kind} index={i} />
                          </div>
                          <div className="product-info">
                            <h3>{p.name}</h3>
                            <p>
                              {p.grams
                                ? `${p.grams / 1000} kg de felicidad`
                                : p.scoops
                                  ? `${p.scoops} ${p.scoops === 1 ? "bocha artesanal" : "bochas artesanales"}`
                                  : "Un clásico para disfrutar"}
                            </p>
                            <div>
                              <b>{money(p.price)}</b>
                              <span className="add-product">
                                {p.stock ? <Plus size={18} /> : <X size={18} />}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                  <div className="catalog-footer">
                    <span className="online-dot" />
                    Precios en pesos argentinos <span>·</span> Hecho con amor
                    desde 1967
                  </div>
                </section>
                <aside className="cart panel-box">
                  <div className="cart-heading">
                    <div>
                      <ShoppingBag size={20} />
                      <h2>Nuevo pedido</h2>
                    </div>
                    <span className="count">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  </div>
                  <div className="channel-toggle">
                    <button
                      className={channel === "local" ? "active" : ""}
                      onClick={() => setChannel("local")}
                    >
                      <Store size={16} />
                      Presencial
                    </button>
                    <button
                      className={channel === "delivery" ? "active" : ""}
                      onClick={() => setChannel("delivery")}
                    >
                      <Truck size={17} />
                      Delivery
                    </button>
                  </div>
                  {channel === "delivery" && (
                    <div className="delivery-fields">
                      {[
                        ["name", "Nombre del cliente"],
                        ["phone", "Teléfono"],
                        ["address", "Dirección de entrega"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          className="input is-small"
                          placeholder={label}
                          aria-label={label}
                          value={customer[key]}
                          onChange={(e) =>
                            setCustomer({ ...customer, [key]: e.target.value })
                          }
                        />
                      ))}
                    </div>
                  )}
                  <div className="cart-items">
                    {!cart.length ? (
                      <Empty>
                        Tu próximo pedido empieza acá.
                        <small>Elegí un producto y sus sabores.</small>
                      </Empty>
                    ) : (
                      cart.map((i) => (
                        <div className="cart-item" key={i.key}>
                          <div className="mini-art">
                            <ProductArt />
                          </div>
                          <div>
                            <b>{i.name}</b>
                            <small>
                              {i.flavorNames.join(" · ") || "Por unidad"}
                            </small>
                            <div className="quantity-controls">
                              <button
                                aria-label="Quitar unidad"
                                onClick={() =>
                                  setCart(
                                    cart.flatMap((x) =>
                                      x.key !== i.key
                                        ? [x]
                                        : x.quantity > 1
                                          ? [{ ...x, quantity: x.quantity - 1 }]
                                          : [],
                                    ),
                                  )
                                }
                              >
                                <Minus size={12} />
                              </button>
                              <span>{i.quantity}</span>
                              <button
                                aria-label="Agregar unidad"
                                onClick={() =>
                                  setCart(
                                    cart.map((x) =>
                                      x.key === i.key
                                        ? {
                                            ...x,
                                            quantity: Math.min(
                                              100,
                                              x.quantity + 1,
                                            ),
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="cart-price">
                            <b>{money(i.price * i.quantity)}</b>
                            <button
                              className="icon-button"
                              aria-label="Eliminar producto"
                              onClick={() =>
                                setCart(cart.filter((x) => x.key !== i.key))
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <textarea
                    className="textarea order-note"
                    rows="2"
                    placeholder="Agregar una nota al pedido…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <div className="cart-totals">
                    <div>
                      <span>Subtotal</span>
                      <span>{money(subtotal)}</span>
                    </div>
                    {channel === "delivery" && (
                      <div>
                        <span>Envío</span>
                        <span>{money(delivery)}</span>
                      </div>
                    )}
                    <div className="grand-total">
                      <b>Total</b>
                      <b>{money(total)}</b>
                    </div>
                  </div>
                  <button
                    className="button is-primary full checkout"
                    disabled={!cart.length || !cashOpen}
                    onClick={() => show("checkout")}
                  >
                    Confirmar pedido <ChevronRight size={18} />
                  </button>
                  {!cashOpen ? (
                    <button
                      className="cash-link"
                      onClick={() => setPage("Caja")}
                    >
                      Abrí la caja para comenzar a vender
                    </button>
                  ) : (
                    <p className="cart-footnote">
                      Un poquito de felicidad, para llevar.
                    </p>
                  )}
                </aside>
              </div>
            )}
            {page === "Pedidos" && (
              <section className="panel-box">
                <div className="section-title">
                  <h2>
                    Pedidos en curso{" "}
                    <span className="count">{activeOrders.length}</span>
                  </h2>
                  <button
                    className="button is-small"
                    onClick={() => run(async () => {}, "Pedidos actualizados")}
                  >
                    Actualizar
                  </button>
                </div>
                {orderList(activeOrders)}
              </section>
            )}
            {page === "Historial" && (
              <section className="panel-box">
                <div className="section-title">
                  <h2>Últimos 500 pedidos</h2>
                  <input
                    className="input history-search"
                    placeholder="Número o cliente…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {orderList(
                  orders.filter((o) =>
                    `${o.id} ${o.customer.name || ""}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  ),
                  true,
                )}
              </section>
            )}
            {page === "Dashboard" && (
              <>
                <div className="stats-grid">
                  {[
                    [
                      "Ventas de hoy",
                      money(todays.reduce((s, o) => s + o.total, 0)),
                      ShoppingBag,
                    ],
                    ["Pedidos de hoy", todays.length, IceCreamBowl],
                    [
                      "Ticket promedio",
                      money(
                        todays.length
                          ? todays.reduce((s, o) => s + o.total, 0) /
                              todays.length
                          : 0,
                      ),
                      ArrowUpRight,
                    ],
                    [
                      "Pendiente de cobro",
                      money(
                        activeOrders.reduce((s, o) => s + o.total - o.paid, 0),
                      ),
                      Wallet,
                    ],
                  ].map(([title, value, Icon]) => (
                    <div className="stat-card" key={title}>
                      <div>
                        <span>{title}</span>
                        <Icon size={19} />
                      </div>
                      <strong>{value}</strong>
                      <small>Sucursal {branch.name}</small>
                    </div>
                  ))}
                </div>
                <div className="dashboard-grid">
                  <section className="panel-box">
                    <div className="section-title">
                      <h2>Ventas de los últimos 7 días</h2>
                    </div>
                    <div className="chart">
                      {Array.from({ length: 7 }, (_, i) => {
                        const day = new Date();
                        day.setDate(day.getDate() - 6 + i);
                        const key = day.toLocaleDateString("es-AR");
                        const value = orders
                          .filter(
                            (o) =>
                              o.status !== "cancelled" &&
                              new Date(o.created_at).toLocaleDateString(
                                "es-AR",
                              ) === key,
                          )
                          .reduce((s, o) => s + o.total, 0);
                        const max = Math.max(
                          1,
                          ...Array.from({ length: 7 }, (_, j) => {
                            const d = new Date();
                            d.setDate(d.getDate() - j);
                            return orders
                              .filter(
                                (o) =>
                                  o.status !== "cancelled" &&
                                  new Date(o.created_at).toLocaleDateString(
                                    "es-AR",
                                  ) === d.toLocaleDateString("es-AR"),
                              )
                              .reduce((s, o) => s + o.total, 0);
                          }),
                        );
                        return (
                          <div className="chart-column" key={i}>
                            <span>{money(value)}</span>
                            <div
                              style={{
                                height: `${Math.max(3, (value / max) * 150)}px`,
                              }}
                            />
                            <small>
                              {day.toLocaleDateString("es-AR", {
                                weekday: "short",
                              })}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="muted chart-note">
                      Calculado sobre los últimos 500 pedidos de la sucursal.
                    </p>
                  </section>
                  <section className="panel-box">
                    <div className="section-title">
                      <h2>Sabores por reponer</h2>
                    </div>
                    {data.flavors
                      .filter((f) => f.stock < 2000)
                      .map((f) => (
                        <div className="list-row" key={f.id}>
                          <b>{f.name}</b>
                          <span className="red">{f.stock / 1000} kg</span>
                        </div>
                      ))}
                    {!data.flavors.some((f) => f.stock < 2000) && (
                      <Empty>Todos los sabores tienen al menos 2 kg.</Empty>
                    )}
                  </section>
                </div>
                <section className="panel-box">
                  <div className="section-title">
                    <h2>Últimos pedidos</h2>
                  </div>
                  {orderList(orders.slice(0, 5))}
                </section>
              </>
            )}
            {page === "Caja" && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Estado de caja</span>
                    <strong>{cashOpen ? "Abierta" : "Cerrada"}</strong>
                    <small>
                      {cash
                        ? `Apertura: ${date(cash.opened_at)}`
                        : "Todavía no hubo aperturas"}
                    </small>
                  </div>
                  <div className="stat-card">
                    <span>Fondo inicial</span>
                    <strong>{money(cash?.opening)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Efectivo esperado</span>
                    <strong>{money(cash?.expected)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>
                      {cashOpen ? "Movimientos" : "Última diferencia"}
                    </span>
                    <strong>
                      {cashOpen
                        ? cash.movements.length
                        : money(cash ? cash.counted - cash.expected : 0)}
                    </strong>
                  </div>
                </div>
                <div className="action-bar">
                  {cashOpen ? (
                    <>
                      <button
                        className="button"
                        onClick={() => show("withdraw")}
                      >
                        Registrar retiro
                      </button>
                      <button
                        className="button is-primary"
                        onClick={() => show("close")}
                      >
                        Cerrar caja
                      </button>
                    </>
                  ) : (
                    <button
                      className="button is-primary"
                      onClick={() => show("open")}
                    >
                      <Plus size={17} />
                      Abrir caja
                    </button>
                  )}
                </div>
                <section className="panel-box">
                  <div className="section-title">
                    <h2>Cobros netos de esta apertura</h2>
                    <span>Descontadas las devoluciones</span>
                  </div>
                  {["cash", "qr", "card"].map((method) => (
                    <div className="list-row" key={method}>
                      <b>{labels[method]}</b>
                      <span>
                        {money(
                          cash?.methods?.find((m) => m.method === method)
                            ?.amount,
                        )}
                      </span>
                    </div>
                  ))}
                </section>
                <section className="panel-box">
                  <div className="section-title">
                    <h2>Movimientos de efectivo</h2>
                    <span>QR y tarjetas no modifican el efectivo</span>
                  </div>
                  <div className="table-container">
                    <table className="table is-fullwidth">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Concepto</th>
                          <th>Usuario</th>
                          <th>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cash?.movements.map((m) => (
                          <tr key={m.id}>
                            <td>{date(m.created_at)}</td>
                            <td>{m.reason}</td>
                            <td>{m.user_name}</td>
                            <td className={m.amount < 0 ? "red" : "green"}>
                              {money(m.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!cash?.movements.length && (
                      <Empty>No hay movimientos en esta caja.</Empty>
                    )}
                  </div>
                </section>
                <section className="panel-box">
                  <div className="section-title">
                    <h2>Historial de aperturas y cierres</h2>
                  </div>
                  <div className="table-container">
                    <table className="table is-fullwidth">
                      <thead>
                        <tr>
                          <th>Apertura</th>
                          <th>Responsable</th>
                          <th>Cierre</th>
                          <th>Contado</th>
                          <th>Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cashHistory.map((c) => (
                          <tr key={c.id}>
                            <td>{date(c.opened_at)}</td>
                            <td>{c.user_name}</td>
                            <td>
                              {c.closed_at ? date(c.closed_at) : "En curso"}
                            </td>
                            <td>{c.closed_at ? money(c.counted) : "—"}</td>
                            <td>
                              {c.closed_at
                                ? money(c.counted - c.expected)
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {page === "Productos" && (
              <section className="panel-box">
                <div className="section-title">
                  <h2>Catálogo de productos</h2>
                  {admin && (
                    <button
                      className="button is-small"
                      onClick={() => show("category")}
                    >
                      Nueva categoría
                    </button>
                  )}
                </div>
                <div className="table-container">
                  <table className="table is-fullwidth">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Precio</th>
                        <th>Sabores</th>
                        <th>Estado</th>
                        {admin && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <b>{p.name}</b>
                          </td>
                          <td>
                            {
                              categories.find((c) => c.id === p.category_id)
                                ?.name
                            }
                          </td>
                          <td>{money(p.price)}</td>
                          <td>{p.max_flavors || "—"}</td>
                          <td>
                            <span
                              className={`status ${p.active ? "ready" : "cancelled"}`}
                            >
                              {p.active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          {admin && (
                            <td>
                              <button
                                className="button is-small"
                                onClick={() =>
                                  show({ type: "editProduct", product: p })
                                }
                              >
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {page === "Stock" && (
              <>
                <div className="info-note">
                  <CircleHelp size={18} />
                  <span>
                    Helado estimado: {branch.scoop_grams} g por bocha. Los potes
                    se reparten en partes iguales. El stock en unidades
                    representa productos o envases disponibles.
                  </span>
                </div>
                <div className="dashboard-grid">
                  {[
                    ["flavors", "Sabores · kilos", data.flavors],
                    ["products", "Productos · unidades", products],
                  ].map(([target, title, items]) => (
                    <section className="panel-box" key={target}>
                      <div className="section-title">
                        <h2>{title}</h2>
                        {target === "flavors" && admin && (
                          <button
                            className="button is-small"
                            onClick={() => show("flavor")}
                          >
                            <Plus size={15} />
                            Sabor
                          </button>
                        )}
                      </div>
                      {items.map((i) => (
                        <div className="list-row" key={i.id}>
                          <div>
                            <b>{i.name}</b>
                            <small>{i.family || "Unidades disponibles"}</small>
                          </div>
                          <span className={!i.stock ? "red" : ""}>
                            {target === "flavors"
                              ? `${i.stock / 1000} kg`
                              : i.stock}
                          </span>
                          {admin && (
                            <button
                              className="button is-small"
                              onClick={() =>
                                show({ type: "stock", target, item: i })
                              }
                            >
                              Ajustar
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </>
            )}
            {page === "Usuarios" && admin && (
              <section className="panel-box">
                <div className="section-title">
                  <h2>Equipo</h2>
                  <button
                    className="button is-primary"
                    onClick={() => show("user")}
                  >
                    <Plus size={16} />
                    Nuevo usuario
                  </button>
                </div>
                {data.users.map((u) => (
                  <div className="list-row" key={u.id}>
                    <span className="avatar">{u.name[0]}</span>
                    <div>
                      <b>{u.name}</b>
                      <small>
                        {u.email} ·{" "}
                        {u.role === "admin" ? "Administrador" : "Heladero"}
                      </small>
                    </div>
                    <span className="status">
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                    {u.id !== user.id && (
                      <button
                        className="button is-small"
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            api(
                              `/users/${u.id}`,
                              { active: !u.active },
                              "PATCH",
                            ),
                          )
                        }
                      >
                        {u.active ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}
            {page === "Configuración" && admin && (
              <div className="dashboard-grid">
                <section className="panel-box settings-form">
                  <h2>Operación de la sucursal</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run(() =>
                        api(
                          "/settings",
                          {
                            delivery_fee: Math.round(
                              Number(f.get("fee")) * 100,
                            ),
                            scoop_grams: Number(f.get("grams")),
                          },
                          "PATCH",
                        ),
                      );
                    }}
                  >
                    <Field label="Cargo fijo de delivery ($)">
                      <input
                        className="input"
                        name="fee"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={branch.delivery_fee / 100}
                        required
                      />
                    </Field>
                    <Field label="Peso estimado por bocha (gramos)">
                      <input
                        className="input"
                        name="grams"
                        type="number"
                        min="80"
                        max="125"
                        defaultValue={branch.scoop_grams}
                        required
                      />
                    </Field>
                    <button className="button is-primary" disabled={busy}>
                      Guardar configuración
                    </button>
                  </form>
                  <p className="muted">
                    Los cambios se aplican a los nuevos pedidos. Los
                    comprobantes emitidos conservan sus importes.
                  </p>
                </section>
                <section className="panel-box">
                  <div className="section-title">
                    <h2>Registro de actividad</h2>
                  </div>
                  <div className="audit-list">
                    {data.events.map((e) => (
                      <div className="list-row" key={e.id}>
                        <div>
                          <b>{e.action}</b>
                          <small>{e.user_name}</small>
                        </div>
                        <small>{date(e.created_at)}</small>
                      </div>
                    ))}
                    {!data.events.length && (
                      <Empty>Las operaciones quedarán registradas acá.</Empty>
                    )}
                  </div>
                </section>
              </div>
            )}
            <footer className="main-footer">
              <span>Rokko · Cooltura artesanal</span>
              <span>
                {data.demo
                  ? "Entorno de desarrollo · Datos de prueba"
                  : "Gestión de heladería"}{" "}
                <span className="online-dot" />
              </span>
            </footer>
          </main>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            typeof modal === "object"
              ? {
                  order: `Pedido #${String(modal.order?.id).padStart(4, "0")}`,
                  stock: "Ajustar existencias",
                  editProduct: "Editar producto",
                  cancel: "Anular pedido",
                  pay: "Registrar cobro",
                }[modal.type]
              : {
                  flavors: selected?.name,
                  checkout: "Confirmar pedido",
                  open: "Abrir caja",
                  close: "Cerrar caja",
                  withdraw: "Registrar retiro",
                  product: "Nuevo producto",
                  flavor: "Nuevo sabor",
                  category: "Nueva categoría",
                  user: "Nuevo usuario",
                  password: "Cambiar contraseña",
                }[modal]
          }
          onClose={() => !busy && setModal(null)}
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {modal === "flavors" && (
            <>
              <p className="muted">
                {selected.max_flavors
                  ? `Elegí hasta ${selected.max_flavors} sabores. El peso se reparte en partes iguales.`
                  : "Este producto se vende por unidad."}
              </p>
              <div className="flavor-grid">
                {selected.max_flavors > 0 &&
                  data.flavors
                    .filter((f) => f.active)
                    .map((f) => (
                      <button
                        className={`flavor-button ${flavors.includes(f.id) ? "selected" : ""}`}
                        disabled={
                          !f.stock ||
                          (!flavors.includes(f.id) &&
                            flavors.length >= selected.max_flavors)
                        }
                        key={f.id}
                        onClick={() =>
                          setFlavors(
                            flavors.includes(f.id)
                              ? flavors.filter((id) => id !== f.id)
                              : [...flavors, f.id],
                          )
                        }
                      >
                        <span>
                          {f.name}
                          <small>{f.stock / 1000} kg disponibles</small>
                        </span>
                        {flavors.includes(f.id) ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    ))}
              </div>
              <Field label="Cantidad">
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </Field>
              <button
                className="button is-primary full"
                disabled={
                  quantity < 1 ||
                  quantity > 100 ||
                  !Number.isInteger(quantity) ||
                  (selected.max_flavors > 0 && !flavors.length)
                }
                onClick={addCart}
              >
                Agregar al pedido · {money(selected.price * quantity)}
              </button>
            </>
          )}
          {(modal === "checkout" || modal.type === "pay") && (
            <PaymentForm
              total={
                modal === "checkout"
                  ? total
                  : modal.order.total - modal.order.paid
              }
              allowPending={modal === "checkout" && channel === "delivery"}
              busy={busy}
              onSubmit={(payments, paymentKey) =>
                run(async () => {
                  if (modal === "checkout") {
                    const result = await api("/orders", {
                      requestKey: requestKeyForCart({
                        cart,
                        channel,
                        customer,
                        notes,
                        payments,
                      }),
                      channel,
                      customer,
                      notes,
                      items: cart.map(({ productId, quantity, flavorIds }) => ({
                        productId,
                        quantity,
                        flavorIds,
                      })),
                      payments,
                    });
                    setCart([]);
                    setNotes("");
                    setCustomer({ name: "", phone: "", address: "" });
                    setPage("Pedidos");
                    setTicket({
                      ...result,
                      paid: payments.reduce((sum, p) => sum + p.amount, 0),
                      payments,
                    });
                  } else
                    await api(`/orders/${modal.order.id}/payments`, {
                      payments,
                      requestKey: paymentKey,
                    });
                }, "Pedido y cobro registrados")
              }
            />
          )}
          {["open", "close", "withdraw"].includes(modal) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  value = Math.round(Number(f.get("amount")) * 100);
                run(
                  () =>
                    api(
                      `/cash/${modal}`,
                      modal === "open"
                        ? { opening: value }
                        : modal === "close"
                          ? { counted: value }
                          : { amount: value, reason: f.get("reason") },
                    ),
                  "Caja actualizada",
                );
              }}
            >
              {modal === "close" && (
                <p className="info-note">
                  Efectivo esperado: {money(cash.expected)}
                </p>
              )}
              <Field
                label={
                  modal === "open"
                    ? "Efectivo inicial ($)"
                    : modal === "close"
                      ? "Efectivo contado ($)"
                      : "Importe a retirar ($)"
                }
              >
                <input
                  name="amount"
                  className="input"
                  type="number"
                  step="0.01"
                  min={modal === "withdraw" ? "0.01" : "0"}
                  required
                />
              </Field>
              {modal === "withdraw" && (
                <Field label="Motivo">
                  <input
                    name="reason"
                    className="input"
                    minLength="3"
                    required
                  />
                </Field>
              )}
              <button className="button is-primary full" disabled={busy}>
                Confirmar
              </button>
            </form>
          )}
          {modal.type === "order" && (
            <OrderDetail
              order={modal.order}
              onPrint={print}
              onPay={() => show({ type: "pay", order: modal.order })}
              onCancel={() => show({ type: "cancel", order: modal.order })}
              onNext={() =>
                run(
                  () =>
                    api(
                      `/orders/${modal.order.id}/status`,
                      {
                        status: {
                          pending: "preparing",
                          preparing: "ready",
                          ready: "delivered",
                        }[modal.order.status],
                      },
                      "PATCH",
                    ),
                  "Estado actualizado",
                )
              }
              busy={busy}
            />
          )}
          {modal.type === "cancel" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(
                  () =>
                    api(`/orders/${modal.order.id}/cancel`, {
                      reason: f.get("reason"),
                      restock: f.get("restock") === "on",
                    }),
                  "Pedido anulado y devolución registrada",
                );
              }}
            >
              <p>
                Se registrará la devolución de {money(modal.order.paid)} por los
                medios de pago originales. Realizá la devolución externa antes
                de confirmar.
              </p>
              <Field label="Motivo de anulación">
                <textarea
                  className="textarea"
                  name="reason"
                  minLength="3"
                  required
                />
              </Field>
              <label className="checkbox">
                <input name="restock" type="checkbox" /> Reponer existencias: el
                producto no se preparó o es recuperable.
              </label>
              <p className="muted">
                Si no se repone, el consumo queda como merma por anulación.
              </p>
              <button className="button is-primary full" disabled={busy}>
                Confirmar anulación
              </button>
            </form>
          )}
          {modal.type === "stock" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(() =>
                  api("/stock", {
                    target: modal.target,
                    id: modal.item.id,
                    quantity: Math.round(
                      Number(f.get("quantity")) *
                        (modal.target === "flavors" ? 1000 : 1),
                    ),
                    reason: f.get("reason"),
                  }),
                );
              }}
            >
              <p>
                <b>{modal.item.name}</b>
              </p>
              <Field
                label={`Existencia real (${modal.target === "flavors" ? "kg" : "unidades"})`}
              >
                <input
                  className="input"
                  type="number"
                  name="quantity"
                  min="0"
                  step={modal.target === "flavors" ? ".001" : "1"}
                  defaultValue={
                    modal.item.stock / (modal.target === "flavors" ? 1000 : 1)
                  }
                  required
                />
              </Field>
              <Field label="Motivo (ingreso, recuento, merma)">
                <input className="input" name="reason" minLength="3" required />
              </Field>
              <button className="button is-primary full" disabled={busy}>
                Guardar ajuste
              </button>
            </form>
          )}
          {(modal === "product" || modal.type === "editProduct") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const body = {
                  name: f.get("name"),
                  price: Math.round(Number(f.get("price")) * 100),
                };
                run(() =>
                  modal === "product"
                    ? api("/products", {
                        ...body,
                        category_id: Number(f.get("category")),
                        grams: Number(f.get("grams")),
                        scoops: Number(f.get("scoops")),
                        max_flavors: Number(f.get("max")),
                        kind: f.get("kind"),
                      })
                    : api(
                        `/products/${modal.product.id}`,
                        { ...body, active: f.get("active") === "on" },
                        "PATCH",
                      ),
                );
              }}
            >
              <Field label="Nombre">
                <input
                  className="input"
                  name="name"
                  defaultValue={modal.product?.name}
                  required
                  minLength="2"
                />
              </Field>
              <Field label="Precio ($)">
                <input
                  className="input"
                  name="price"
                  type="number"
                  min="0"
                  step=".01"
                  defaultValue={modal.product?.price / 100 || ""}
                  required
                />
              </Field>
              {modal === "product" ? (
                <>
                  <Field label="Categoría">
                    <select className="input" name="category">
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Presentación">
                    <select className="input" name="kind">
                      <option value="tub">Pote</option>
                      <option value="cone">Cucurucho</option>
                      <option value="wafer">Barquillo</option>
                      <option value="ice">Helado de agua</option>
                    </select>
                  </Field>
                  {[
                    ["grams", "Peso fijo en gramos (0 si usa bochas)", 10000],
                    ["scoops", "Cantidad de bochas (0 si usa peso fijo)", 4],
                    ["max", "Máximo de sabores (0 si no lleva selección)", 4],
                  ].map(([name, label, max]) => (
                    <Field label={label} key={name}>
                      <input
                        className="input"
                        type="number"
                        name={name}
                        min="0"
                        max={max}
                        defaultValue="0"
                        required
                      />
                    </Field>
                  ))}
                </>
              ) : (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={modal.product.active}
                  />{" "}
                  Producto activo
                </label>
              )}
              <button className="button is-primary full" disabled={busy}>
                Guardar producto
              </button>
            </form>
          )}
          {(modal === "flavor" || modal === "category") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api(
                    modal === "flavor" ? "/flavors" : "/categories",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ),
                );
              }}
            >
              <Field label="Nombre">
                <input className="input" name="name" minLength="2" required />
              </Field>
              {modal === "flavor" && (
                <Field label="Familia">
                  <input
                    className="input"
                    name="family"
                    placeholder="Clásicos, chocolates, frutales…"
                    minLength="2"
                    required
                  />
                </Field>
              )}
              <button className="button is-primary full" disabled={busy}>
                Guardar
              </button>
            </form>
          )}
          {modal === "password" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () =>
                    api(
                      "/password",
                      Object.fromEntries(new FormData(e.currentTarget)),
                    ),
                  "Contraseña actualizada",
                );
              }}
            >
              <Field label="Contraseña actual">
                <input
                  className="input"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="Nueva contraseña (mínimo 12 caracteres)">
                <input
                  className="input"
                  name="newPassword"
                  type="password"
                  minLength="12"
                  autoComplete="new-password"
                  required
                />
              </Field>
              <button className="button is-primary full" disabled={busy}>
                Actualizar contraseña
              </button>
            </form>
          )}
          {modal === "user" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  api(
                    "/users",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  ),
                );
              }}
            >
              {[
                ["name", "Nombre", "text"],
                ["email", "Email", "email"],
                ["password", "Contraseña (mínimo 12 caracteres)", "password"],
              ].map(([name, label, type]) => (
                <Field label={label} key={name}>
                  <input
                    className="input"
                    name={name}
                    type={type}
                    minLength={name === "password" ? 12 : 2}
                    required
                  />
                </Field>
              ))}
              <Field label="Perfil">
                <select className="input" name="role">
                  <option value="cashier">Heladero</option>
                  <option value="admin">Administrador</option>
                </select>
              </Field>
              <button className="button is-primary full" disabled={busy}>
                Crear usuario
              </button>
            </form>
          )}
        </Modal>
      )}
      {ticket && ticketType === "package" && (
        <div className="print-ticket">
          {ticket.items
            .flatMap((i) => Array.from({ length: i.quantity }, () => i))
            .map((item, index, all) => (
              <section className="package-label" key={index}>
                <Brand />
                <h2>Pedido #{String(ticket.id).padStart(4, "0")}</h2>
                <b>
                  Envase {index + 1} de {all.length}
                </b>
                <p>{item.name}</p>
                <p>{item.flavors.map((f) => f.name).join(" / ")}</p>
                <p>
                  {ticket.channel === "delivery" ? "DELIVERY" : "PRESENCIAL"} ·{" "}
                  {ticket.customer.name || "Mostrador"}
                </p>
                {ticket.notes && <p>{ticket.notes}</p>}
                <b>
                  {ticket.status === "cancelled"
                    ? "ANULADO"
                    : ticket.paid === ticket.total
                      ? "PAGADO"
                      : `Pedido pendiente: ${money(ticket.total - ticket.paid)}`}
                </b>
                <p>{date(ticket.created_at)}</p>
              </section>
            ))}
        </div>
      )}
      {ticket && ticketType === "sale" && (
        <div className="print-ticket">
          <Brand />
          <p>{branch.name}</p>
          <h2>Pedido #{String(ticket.id).padStart(4, "0")}</h2>
          <p>
            {date(ticket.created_at)} ·{" "}
            {ticket.channel === "delivery" ? "DELIVERY" : "PRESENCIAL"}
          </p>
          {ticket.customer.name && (
            <p>
              {ticket.customer.name} · {ticket.customer.phone}
              <br />
              {ticket.customer.address}
            </p>
          )}
          {ticket.items.map((i, index) => (
            <div className="ticket-item" key={index}>
              <b>
                {i.quantity} × {i.name}
              </b>
              <p>{i.flavors.map((f) => f.name).join(" / ")}</p>
              {ticketType === "sale" && (
                <span>{money(i.price * i.quantity)}</span>
              )}
            </div>
          ))}
          {ticket.notes && <p>Nota: {ticket.notes}</p>}
          {ticketType === "sale" && (
            <>
              <p>Subtotal: {money(ticket.subtotal)}</p>
              {ticket.delivery > 0 && <p>Envío: {money(ticket.delivery)}</p>}
              <h3>TOTAL {money(ticket.total)}</h3>
              {ticket.payments?.map((p, i) => (
                <p key={i}>
                  {labels[p.method]}: {money(p.amount)}
                  {p.method === "cash" && p.received > p.amount
                    ? ` · Vuelto: ${money(p.received - p.amount)}`
                    : ""}
                </p>
              ))}
            </>
          )}
          <b>
            {ticket.status === "cancelled"
              ? "ANULADO"
              : ticket.paid === ticket.total
                ? "PAGADO"
                : `PENDIENTE: ${money(ticket.total - (ticket.paid || 0))}`}
          </b>
          <p>Comprobante interno — sin validez fiscal</p>
          <p>¡Gracias por elegir Rokko!</p>
        </div>
      )}
    </>
  );
}
const requestKeys = new Map();
function requestKeyForCart(cart) {
  const key = JSON.stringify(cart);
  if (!requestKeys.has(key)) requestKeys.set(key, crypto.randomUUID());
  return requestKeys.get(key);
}
function PaymentForm({ total, allowPending, busy, onSubmit }) {
  const [rows, setRows] = useState([
    { method: "cash", amount: total / 100, received: "" },
  ]);
  const paid = rows.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  const [pending, setPending] = useState(false);
  const [paymentKey] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          pending
            ? []
            : rows.map((p) => ({
                method: p.method,
                amount: Math.round(Number(p.amount) * 100),
                ...(p.method === "cash" && p.received !== ""
                  ? { received: Math.round(Number(p.received) * 100) }
                  : {}),
              })),
          paymentKey,
        );
      }}
    >
      <div className="payment-total">
        <span>Total a cobrar</span>
        <strong>{money(total)}</strong>
      </div>
      {allowPending && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />{" "}
          Cobrar al entregar
        </label>
      )}
      {!pending && (
        <>
          {rows.map((p, i) => (
            <div className="payment-row" key={i}>
              <Field label="Medio">
                <select
                  className="input"
                  value={p.method}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, method: e.target.value } : r,
                      ),
                    )
                  }
                >
                  <option value="cash">Efectivo</option>
                  <option value="qr">QR</option>
                  <option value="card">Tarjeta</option>
                </select>
              </Field>
              <Field label="Importe ($)">
                <input
                  className="input"
                  type="number"
                  min=".01"
                  step=".01"
                  required
                  value={p.amount}
                  onChange={(e) =>
                    setRows(
                      rows.map((r, j) =>
                        j === i ? { ...r, amount: e.target.value } : r,
                      ),
                    )
                  }
                />
              </Field>
              {p.method === "cash" && (
                <Field label="Recibido ($)">
                  <input
                    className="input"
                    type="number"
                    min={p.amount}
                    step=".01"
                    placeholder={String(p.amount)}
                    value={p.received}
                    onChange={(e) =>
                      setRows(
                        rows.map((r, j) =>
                          j === i ? { ...r, received: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </Field>
              )}
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Eliminar medio"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="button is-small"
            onClick={() =>
              setRows([
                ...rows,
                {
                  method: "qr",
                  amount: Math.max(0, (total - paid) / 100),
                  received: "",
                },
              ])
            }
          >
            + Agregar medio de pago
          </button>
          <p className={paid > total ? "red" : "muted"}>
            Saldo restante: {money(total - paid)}
          </p>
          <p className="muted">
            Vuelto:{" "}
            {money(
              rows.reduce(
                (s, p) =>
                  s +
                  (p.method === "cash"
                    ? Math.max(
                        0,
                        Math.round(
                          (Number(p.received) - Number(p.amount)) * 100,
                        ),
                      )
                    : 0),
                0,
              ),
            )}
          </p>
          <p className="info-note">
            Confirmá los cobros de QR y tarjeta en la terminal o aplicación
            correspondiente.
          </p>
        </>
      )}
      <button
        className="button is-primary full"
        disabled={
          busy ||
          (!pending &&
            (paid > total || paid <= 0 || (!allowPending && paid !== total)))
        }
      >
        {busy
          ? "Registrando…"
          : pending
            ? "Confirmar con cobro pendiente"
            : "Confirmar cobro y pedido"}
      </button>
    </form>
  );
}
function OrderDetail({ order: o, onPrint, onPay, onCancel, onNext, busy }) {
  return (
    <>
      <div className="order-detail-head">
        <span className={`status ${o.status}`}>{labels[o.status]}</span>
        <b>{money(o.total)}</b>
      </div>
      <p>
        {o.customer.name || "Cliente de mostrador"} ·{" "}
        {o.channel === "delivery" ? "Delivery" : "Presencial"}
      </p>
      {o.channel === "delivery" && (
        <p>
          {o.customer.phone}
          <br />
          {o.customer.address}
        </p>
      )}
      {o.items.map((i, index) => (
        <div className="list-row" key={index}>
          <div>
            <b>
              {i.quantity} × {i.name}
            </b>
            <small>{i.flavors.map((f) => f.name).join(" · ")}</small>
          </div>
          <span>{money(i.price * i.quantity)}</span>
        </div>
      ))}
      {o.notes && <p className="info-note">{o.notes}</p>}
      <p>
        Subtotal {money(o.subtotal)} · Envío {money(o.delivery)}
      </p>
      <p>
        {o.status === "cancelled"
          ? `Anulado: ${o.cancellation}`
          : `Abonado ${money(o.paid)} · Pendiente ${money(o.total - o.paid)}`}
      </p>
      <div className="order-actions">
        <button className="button" onClick={() => onPrint(o, "sale")}>
          <Printer size={16} />
          Ticket
        </button>
        <button className="button" onClick={() => onPrint(o, "package")}>
          <Package size={16} />
          Comanda
        </button>
        {o.status !== "cancelled" && (
          <>
            {o.paid < o.total && (
              <button className="button is-primary" onClick={onPay}>
                Cobrar saldo
              </button>
            )}
            {o.status !== "delivered" && (
              <button
                className="button is-primary"
                disabled={busy}
                onClick={onNext}
              >
                {
                  {
                    pending: "Preparar",
                    preparing: "Marcar listo",
                    ready: "Entregar",
                  }[o.status]
                }
              </button>
            )}
            <button className="button is-danger is-light" onClick={onCancel}>
              Anular
            </button>
          </>
        )}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
