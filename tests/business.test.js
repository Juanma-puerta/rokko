import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase, seed } from "../server/db.js";
import { createOrder, splitGrams } from "../server/domain.js";
import { createApp } from "../server/app.js";
let db, server, base, cookie;
const user = { id: 1, branch_id: 1, role: "admin" };
const order = (overrides = {}) => ({
  requestKey: randomUUID(),
  channel: "local",
  customer: {},
  notes: "",
  items: [{ productId: 1, quantity: 1, flavorIds: [1, 2] }],
  payments: [{ method: "cash", amount: 550000, received: 600000 }],
  ...overrides,
});
before(async () => {
  db = await createDatabase({ memory: true });
  await seed(db);
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const response = await fetch(base + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "admin@rokko.local",
      password: "RokkoDemo2026!",
    }),
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get("set-cookie").split(";")[0];
});
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
});
async function request(path, body, method = "POST", auth = cookie) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      Cookie: auth || "",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
test("el reparto conserva el peso exacto", () => {
  assert.deepEqual(splitGrams(500, 3), [167, 167, 166]);
  assert.equal(
    splitGrams(1000, 3).reduce((a, b) => a + b),
    1000,
  );
});
test("la API exige autenticación", async () => {
  assert.equal((await request("/state", undefined, "GET", "")).status, 401);
});
test("bloquea ventas con caja cerrada", async () => {
  await assert.rejects(createOrder(db, user, order()), /Abrí la caja/);
});
test("apertura única y venta con pagos combinados e idempotencia", async () => {
  assert.equal((await request("/cash/open", { opening: 1000000 })).status, 200);
  assert.equal((await request("/cash/open", { opening: 0 })).status, 400);
  const input = order({
    requestKey: randomUUID(),
    payments: [
      { method: "cash", amount: 200000, received: 300000 },
      { method: "qr", amount: 350000 },
    ],
  });
  const created = await createOrder(db, user, input);
  const repeated = await createOrder(db, user, input);
  assert.equal(created.id, repeated.id);
  const flavor = (await db.query("SELECT stock FROM flavors WHERE id=1"))
    .rows[0];
  assert.equal(flavor.stock, 11875);
  const payments = (
    await db.query("SELECT * FROM payments WHERE order_id=$1", [created.id])
  ).rows;
  assert.equal(payments.length, 2);
  const movements = (
    await db.query("SELECT * FROM cash_movements WHERE order_id=$1", [
      created.id,
    ])
  ).rows;
  assert.equal(movements[0].amount, 200000);
});
test("stock insuficiente revierte todos los descuentos y no crea pedidos", async () => {
  const before = (await db.query("SELECT stock FROM flavors WHERE id=1"))
    .rows[0].stock;
  await db.query("UPDATE flavors SET stock=1 WHERE id=2");
  const count = (await db.query("SELECT count(*)::int AS value FROM orders"))
    .rows[0].value;
  await assert.rejects(createOrder(db, user, order()), /Stock insuficiente/);
  assert.equal(
    (await db.query("SELECT stock FROM flavors WHERE id=1")).rows[0].stock,
    before,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS value FROM orders")).rows[0].value,
    count,
  );
  await db.query("UPDATE flavors SET stock=12000 WHERE id=2");
});
test("dos pedidos simultáneos no pueden consumir la misma unidad", async () => {
  await db.query("UPDATE products SET stock=1 WHERE id=8");
  const input = () =>
    order({
      items: [{ productId: 8, quantity: 1, flavorIds: [] }],
      payments: [{ method: "card", amount: 180000 }],
    });
  const results = await Promise.allSettled([
    createOrder(db, user, input()),
    createOrder(db, user, input()),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.query("SELECT stock FROM products WHERE id=8")).rows[0].stock,
    0,
  );
});
test("delivery admite cobro pendiente; exige datos y evita entregar sin cobrar", async () => {
  await assert.rejects(
    createOrder(db, user, order({ channel: "delivery", payments: [] })),
    /Completá/,
  );
  const created = await createOrder(
    db,
    user,
    order({
      channel: "delivery",
      customer: { name: "Ana", phone: "1122223333", address: "Calle 123" },
      payments: [],
    }),
  );
  assert.equal(created.total, 700000);
  assert.equal(
    (
      await request(
        `/orders/${created.id}/status`,
        { status: "preparing" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/orders/${created.id}/status`,
        { status: "ready" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        `/orders/${created.id}/status`,
        { status: "delivered" },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/orders/${created.id}/payments`, {
        requestKey: randomUUID(),
        payments: [{ method: "qr", amount: 700000 }],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/orders/${created.id}/payments`, {
        requestKey: randomUUID(),
        payments: [{ method: "qr", amount: 1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        `/orders/${created.id}/status`,
        { status: "delivered" },
        "PATCH",
      )
    ).status,
    200,
  );
});
test("anulación devuelve cobros y repone existencias solamente una vez", async () => {
  const created = await createOrder(db, user, order());
  const previous = (await db.query("SELECT stock FROM flavors WHERE id=1"))
    .rows[0].stock;
  assert.equal(
    (
      await request(`/orders/${created.id}/cancel`, {
        reason: "Pedido duplicado",
        restock: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.query("SELECT stock FROM flavors WHERE id=1")).rows[0].stock,
    previous + 125,
  );
  assert.equal(
    (
      await request(`/orders/${created.id}/cancel`, {
        reason: "Pedido duplicado",
        restock: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await db.query(
        "SELECT SUM(amount)::int AS value FROM refunds WHERE order_id=$1",
        [created.id],
      )
    ).rows[0].value,
    550000,
  );
});
test("restringe catálogo al administrador y revoca la sesión al salir", async () => {
  const login = await fetch(base + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "caja@rokko.local",
      password: "RokkoDemo2026!",
    }),
  });
  const cashierCookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await request(
        "/stock",
        { target: "flavors", id: 1, quantity: 0, reason: "Prueba" },
        "POST",
        cashierCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/logout", {}, "POST", cashierCookie)).status,
    200,
  );
  assert.equal(
    (await request("/state", undefined, "GET", cashierCookie)).status,
    401,
  );
});
test("rechaza origen ajeno y cierra caja con diferencia registrada", async () => {
  const denied = await fetch(base + "/cash/withdraw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.com",
      Cookie: cookie,
    },
    body: JSON.stringify({ amount: 1, reason: "Prueba" }),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (
      await request("/cash/withdraw", {
        amount: 10000,
        reason: "Compra de insumos",
      })
    ).status,
    200,
  );
  const state = (await request("/state", undefined, "GET")).data;
  assert.equal(
    (await request("/cash/close", { counted: state.cash.expected - 100 }))
      .status,
    200,
  );
  const closed = (await request("/state", undefined, "GET")).data.cash;
  assert.ok(closed.closed_at);
  assert.equal(closed.counted - closed.expected, -100);
});
test("un reintento de cobro no duplica el pago", async () => {
  await request("/cash/open", { opening: 0 });
  const created = await createOrder(
    db,
    user,
    order({
      channel: "delivery",
      customer: { name: "Ana", phone: "111", address: "Calle 1" },
      payments: [],
    }),
  );
  const body = {
    requestKey: randomUUID(),
    payments: [{ method: "qr", amount: 200000 }],
  };
  assert.equal(
    (await request(`/orders/${created.id}/payments`, body)).status,
    200,
  );
  assert.equal(
    (await request(`/orders/${created.id}/payments`, body)).status,
    200,
  );
  const payments = (
    await db.query("SELECT * FROM payments WHERE order_id=$1", [created.id])
  ).rows;
  assert.equal(payments.length, 1);
});
test("el backend impide utilizar productos de otra sucursal", async () => {
  await db.query("INSERT INTO branches(name) VALUES ('Otra sucursal')");
  await db.query(
    "INSERT INTO users(name,email,password,role,branch_id) SELECT 'Otro','otro@rokko.local',password,'admin',2 FROM users WHERE id=1",
  );
  const other = (
    await db.query("SELECT * FROM users WHERE email='otro@rokko.local'")
  ).rows[0];
  await db.query(
    "INSERT INTO cash_sessions(branch_id,opened_by,opening) VALUES (2,$1,0)",
    [other.id],
  );
  await assert.rejects(
    createOrder(db, other, order()),
    /Producto no disponible/,
  );
});
test("cambiar contraseña verifica la actual y mantiene la sesión activa", async () => {
  assert.equal(
    (
      await request("/password", {
        currentPassword: "incorrecta",
        newPassword: "NuevaRokko2026!",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/password", {
        currentPassword: "RokkoDemo2026!",
        newPassword: "NuevaRokko2026!",
      })
    ).status,
    200,
  );
  assert.equal((await request("/state", undefined, "GET")).status, 200);
});
