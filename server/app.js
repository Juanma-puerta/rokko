import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  assert,
  audit,
  lockBranch,
  openCash,
  cashExpected,
  recordPayments,
  createOrder,
} from "./domain.js";
const amount = z.number().int().min(0).max(100000000);
const payment = z.object({
  method: z.enum(["cash", "qr", "card"]),
  amount: amount.refine((v) => v > 0),
  received: amount.optional(),
});
const orderSchema = z.object({
  requestKey: z.string().uuid(),
  channel: z.enum(["local", "delivery"]),
  customer: z
    .object({
      name: z.string().max(100).default(""),
      phone: z.string().max(40).default(""),
      address: z.string().max(300).default(""),
    })
    .default({}),
  notes: z.string().max(500).default(""),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100),
        flavorIds: z.array(z.number().int().positive()).max(4),
      }),
    )
    .min(1)
    .max(100),
  payments: z.array(payment).max(10),
});
export function createApp(db) {
  const app = express(),
    production = process.env.NODE_ENV === "production";
  const secret = process.env.JWT_SECRET || randomBytes(48).toString("hex");
  if (production && (!process.env.JWT_SECRET || secret.length < 32))
    throw new Error("JWT_SECRET debe tener al menos 32 caracteres");
  const origin = process.env.APP_ORIGIN || "http://localhost:5173";
  if (production && !process.env.APP_ORIGIN)
    throw new Error("APP_ORIGIN es obligatorio en producción");
  const origins = production ? [origin] : [origin, "http://127.0.0.1:5173"];
  app.set("trust proxy", 1);
  app.use(
    helmet(),
    cors({ origin: origins, credentials: true }),
    express.json({ limit: "100kb" }),
    cookieParser(),
  );
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).json({ error: "Origen no autorizado" });
    next();
  });
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/api",
    maxAge: 8 * 60 * 60 * 1000,
  };
  app.get("/api/health", async (req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  });
  app.post(
    "/api/login",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 }),
    async (req, res) => {
      const input = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(req.body);
      const user = (
        await db.query("SELECT * FROM users WHERE email=$1 AND active=true", [
          input.email.toLowerCase(),
        ])
      ).rows[0];
      assert(
        user && (await bcrypt.compare(input.password, user.password)),
        "Email o contraseña incorrectos.",
        401,
      );
      const sid = randomUUID();
      await db.query(
        "INSERT INTO sessions(id,user_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')",
        [sid, user.id],
      );
      res
        .cookie(
          "rokko_session",
          jwt.sign({ sid }, secret, { expiresIn: "8h", algorithm: "HS256" }),
          cookie,
        )
        .json({ ok: true });
    },
  );
  app.use("/api", async (req, res, next) => {
    let payload;
    try {
      payload = jwt.verify(req.cookies.rokko_session || "", secret, {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({ error: "Iniciá sesión para continuar." });
    }
    const user = (
      await db.query(
        "SELECT u.id,u.name,u.email,u.role,u.branch_id FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=$1 AND s.expires_at>now() AND u.active=true",
        [payload.sid],
      )
    ).rows[0];
    assert(user, "La sesión venció.", 401);
    req.user = user;
    req.sid = payload.sid;
    next();
  });
  const admin = (req, res, next) => {
    assert(
      req.user.role === "admin",
      "Solo administración puede realizar esta acción.",
      403,
    );
    next();
  };
  app.post("/api/logout", async (req, res) => {
    await db.query("DELETE FROM sessions WHERE id=$1", [req.sid]);
    res.clearCookie("rokko_session", cookie).json({ ok: true });
  });
  app.get("/api/state", async (req, res) => {
    const id = req.user.branch_id;
    const branch = (await db.query("SELECT * FROM branches WHERE id=$1", [id]))
      .rows[0];
    const categories = (await db.query("SELECT * FROM categories ORDER BY id"))
      .rows;
    const products = (
      await db.query("SELECT * FROM products WHERE branch_id=$1 ORDER BY id", [
        id,
      ])
    ).rows;
    const flavors = (
      await db.query("SELECT * FROM flavors WHERE branch_id=$1 ORDER BY id", [
        id,
      ])
    ).rows;
    const cash =
      (
        await db.query(
          "SELECT * FROM cash_sessions WHERE branch_id=$1 ORDER BY id DESC LIMIT 1",
          [id],
        )
      ).rows[0] || null;
    if (cash) {
      cash.expected = await cashExpected(db, cash);
      cash.movements = (
        await db.query(
          "SELECT m.*,u.name AS user_name FROM cash_movements m JOIN users u ON u.id=m.user_id WHERE cash_id=$1 ORDER BY id DESC",
          [cash.id],
        )
      ).rows;
      cash.methods = (
        await db.query(
          `SELECT method, SUM(amount)::bigint AS amount FROM (
        SELECT method,amount FROM payments WHERE cash_id=$1
        UNION ALL SELECT method,-amount FROM refunds WHERE cash_id=$1
        ) movements GROUP BY method`,
          [cash.id],
        )
      ).rows.map((row) => ({ ...row, amount: Number(row.amount) }));
    }
    const cashHistory = (
      await db.query(
        "SELECT c.*,u.name AS user_name FROM cash_sessions c JOIN users u ON u.id=c.opened_by WHERE c.branch_id=$1 ORDER BY c.id DESC LIMIT 100",
        [id],
      )
    ).rows;
    const orders = (
      await db.query(
        "SELECT o.*,u.name AS user_name,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0)::int AS paid,COALESCE((SELECT jsonb_agg(p) FROM payments p WHERE p.order_id=o.id),'[]'::jsonb) AS payments FROM orders o JOIN users u ON u.id=o.user_id WHERE o.branch_id=$1 ORDER BY o.id DESC LIMIT 500",
        [id],
      )
    ).rows;
    const users =
      req.user.role === "admin"
        ? (
            await db.query(
              "SELECT id,name,email,role,active FROM users WHERE branch_id=$1 ORDER BY id",
              [id],
            )
          ).rows
        : [];
    const events =
      req.user.role === "admin"
        ? (
            await db.query(
              "SELECT a.*,u.name AS user_name FROM audit a JOIN users u ON u.id=a.user_id WHERE a.branch_id=$1 ORDER BY a.id DESC LIMIT 100",
              [id],
            )
          ).rows
        : [];
    res.json({
      user: req.user,
      branch,
      categories,
      products,
      flavors,
      cash,
      cashHistory,
      orders,
      users,
      events,
      demo: !production,
    });
  });
  app.post("/api/orders", async (req, res) =>
    res
      .status(201)
      .json(await createOrder(db, req.user, orderSchema.parse(req.body))),
  );
  app.post("/api/orders/:id/payments", async (req, res) => {
    const requestKey = z.string().uuid().parse(req.body.requestKey);
    const payments = z.array(payment).min(1).max(10).parse(req.body.payments);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const order = (
        await tx.query(
          "SELECT * FROM orders WHERE id=$1 AND branch_id=$2 FOR UPDATE",
          [Number(req.params.id), req.user.branch_id],
        )
      ).rows[0];
      assert(order, "Pedido no encontrado.", 404);
      const previous = (
        await tx.query("SELECT * FROM payment_requests WHERE request_key=$1", [
          requestKey,
        ])
      ).rows[0];
      if (previous) {
        assert(
          previous.branch_id === req.user.branch_id &&
            previous.order_id === order.id,
          "Solicitud de cobro inválida.",
        );
        return;
      }
      await recordPayments(tx, req.user, order, payments);
      await tx.query(
        "INSERT INTO payment_requests(request_key,branch_id,order_id) VALUES ($1,$2,$3)",
        [requestKey, req.user.branch_id, order.id],
      );
    });
    res.json({ ok: true });
  });
  app.patch("/api/orders/:id/status", async (req, res) => {
    const status = z
      .enum(["preparing", "ready", "delivered"])
      .parse(req.body.status);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const order = (
        await tx.query(
          "SELECT * FROM orders WHERE id=$1 AND branch_id=$2 FOR UPDATE",
          [Number(req.params.id), req.user.branch_id],
        )
      ).rows[0];
      assert(order, "Pedido no encontrado.", 404);
      assert(
        { pending: "preparing", preparing: "ready", ready: "delivered" }[
          order.status
        ] === status,
        "Transición de estado no permitida.",
      );
      if (status === "delivered") {
        const paid = (
          await tx.query(
            "SELECT COALESCE(SUM(amount),0)::int AS value FROM payments WHERE order_id=$1",
            [order.id],
          )
        ).rows[0].value;
        assert(paid === order.total, "Registrá el cobro antes de entregar.");
      }
      await tx.query("UPDATE orders SET status=$1 WHERE id=$2", [
        status,
        order.id,
      ]);
      await audit(tx, req.user, "order.status", { id: order.id, status });
    });
    res.json({ ok: true });
  });
  app.post("/api/orders/:id/cancel", async (req, res) => {
    const input = z
      .object({
        reason: z.string().trim().min(3).max(300),
        restock: z.boolean(),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const order = (
        await tx.query(
          "SELECT * FROM orders WHERE id=$1 AND branch_id=$2 FOR UPDATE",
          [Number(req.params.id), req.user.branch_id],
        )
      ).rows[0];
      assert(order, "Pedido no encontrado.", 404);
      assert(order.status !== "cancelled", "El pedido ya está anulado.");
      const cash = await openCash(tx, req.user);
      const payments = (
        await tx.query("SELECT * FROM payments WHERE order_id=$1", [order.id])
      ).rows;
      for (const p of payments) {
        await tx.query(
          "INSERT INTO refunds(order_id,cash_id,method,amount) VALUES ($1,$2,$3,$4)",
          [order.id, cash.id, p.method, p.amount],
        );
        if (p.method === "cash")
          await tx.query(
            "INSERT INTO cash_movements(cash_id,user_id,order_id,amount,reason) VALUES ($1,$2,$3,$4,$5)",
            [
              cash.id,
              req.user.id,
              order.id,
              -p.amount,
              "Devolución: " + input.reason,
            ],
          );
      }
      if (input.restock)
        for (const target of ["products", "flavors"])
          for (const [id, quantity] of Object.entries(
            order.consumption[target],
          )) {
            await tx.query(
              `UPDATE ${target} SET stock=stock+$1 WHERE id=$2 AND branch_id=$3`,
              [quantity, Number(id), req.user.branch_id],
            );
            await tx.query(
              "INSERT INTO stock_movements(branch_id,user_id,target,target_id,amount,reason) VALUES ($1,$2,$3,$4,$5,$6)",
              [
                req.user.branch_id,
                req.user.id,
                target,
                Number(id),
                quantity,
                "Anulación: " + input.reason,
              ],
            );
          }
      await tx.query(
        "UPDATE orders SET status='cancelled',cancellation=$1 WHERE id=$2",
        [input.reason, order.id],
      );
      await audit(tx, req.user, "order.cancel", {
        id: order.id,
        ...input,
        refunds: payments,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/cash/open", async (req, res) => {
    const opening = amount.parse(req.body.opening);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      assert(
        !(
          await tx.query(
            "SELECT id FROM cash_sessions WHERE branch_id=$1 AND closed_at IS NULL",
            [req.user.branch_id],
          )
        ).rows.length,
        "La caja ya está abierta.",
      );
      await tx.query(
        "INSERT INTO cash_sessions(branch_id,opened_by,opening) VALUES ($1,$2,$3)",
        [req.user.branch_id, req.user.id, opening],
      );
      await audit(tx, req.user, "cash.open", { opening });
    });
    res.json({ ok: true });
  });
  app.post("/api/cash/withdraw", async (req, res) => {
    const input = z
      .object({
        amount: amount.refine((v) => v > 0),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const cash = await openCash(tx, req.user);
      assert(
        input.amount <= (await cashExpected(tx, cash)),
        "El retiro supera el efectivo esperado.",
      );
      await tx.query(
        "INSERT INTO cash_movements(cash_id,user_id,amount,reason) VALUES ($1,$2,$3,$4)",
        [cash.id, req.user.id, -input.amount, input.reason],
      );
      await audit(tx, req.user, "cash.withdraw", input);
    });
    res.json({ ok: true });
  });
  app.post("/api/cash/close", async (req, res) => {
    const counted = amount.parse(req.body.counted);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const cash = await openCash(tx, req.user),
        expected = await cashExpected(tx, cash);
      await tx.query(
        "UPDATE cash_sessions SET closed_at=now(),counted=$1,expected=$2 WHERE id=$3",
        [counted, expected, cash.id],
      );
      await audit(tx, req.user, "cash.close", {
        counted,
        expected,
        difference: counted - expected,
      });
    });
    res.json({ ok: true });
  });
  app.post("/api/stock", admin, async (req, res) => {
    const input = z
      .object({
        target: z.enum(["products", "flavors"]),
        id: z.number().int().positive(),
        quantity: z.number().int().min(0).max(10000000),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const previous = (
        await tx.query(
          `SELECT * FROM ${input.target} WHERE id=$1 AND branch_id=$2 FOR UPDATE`,
          [input.id, req.user.branch_id],
        )
      ).rows[0];
      assert(previous, "Artículo no encontrado.", 404);
      await tx.query(`UPDATE ${input.target} SET stock=$1 WHERE id=$2`, [
        input.quantity,
        input.id,
      ]);
      await tx.query(
        "INSERT INTO stock_movements(branch_id,user_id,target,target_id,amount,reason) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          req.user.branch_id,
          req.user.id,
          input.target,
          input.id,
          input.quantity - previous.stock,
          input.reason,
        ],
      );
      await audit(tx, req.user, "stock.adjust", input);
    });
    res.json({ ok: true });
  });
  app.post("/api/products", admin, async (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        category_id: z.number().int().positive(),
        price: amount,
        grams: z.number().int().min(0).max(10000),
        scoops: z.number().int().min(0).max(4),
        max_flavors: z.number().int().min(0).max(4),
        kind: z.enum(["tub", "cone", "wafer", "ice"]),
      })
      .parse(req.body);
    assert(!(p.grams && p.scoops), "Usá peso fijo o bochas, no ambos.");
    assert(
      Boolean(p.grams || p.scoops) === Boolean(p.max_flavors),
      "El peso y los sabores deben configurarse juntos.",
    );
    await db.transaction(async (tx) => {
      const row = (
        await tx.query(
          "INSERT INTO products(branch_id,name,category_id,price,grams,scoops,max_flavors,kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          [
            req.user.branch_id,
            p.name,
            p.category_id,
            p.price,
            p.grams,
            p.scoops,
            p.max_flavors,
            p.kind,
          ],
        )
      ).rows[0];
      await audit(tx, req.user, "product.create", { ...row, ...p });
    });
    res.json({ ok: true });
  });
  app.patch("/api/products/:id", admin, async (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        price: amount,
        active: z.boolean(),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      const result = await tx.query(
        "UPDATE products SET name=$1,price=$2,active=$3 WHERE id=$4 AND branch_id=$5 RETURNING id",
        [p.name, p.price, p.active, Number(req.params.id), req.user.branch_id],
      );
      assert(result.rows.length, "Producto no encontrado.", 404);
      await audit(tx, req.user, "product.update", { id: req.params.id, ...p });
    });
    res.json({ ok: true });
  });
  app.post("/api/flavors", admin, async (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        family: z.string().trim().min(2).max(50),
      })
      .parse(req.body);
    await db.query(
      "INSERT INTO flavors(branch_id,name,family) VALUES ($1,$2,$3)",
      [req.user.branch_id, p.name, p.family],
    );
    res.json({ ok: true });
  });
  app.post("/api/categories", admin, async (req, res) => {
    await db.query("INSERT INTO categories(name) VALUES ($1)", [
      z.string().trim().min(2).max(60).parse(req.body.name),
    ]);
    res.json({ ok: true });
  });
  app.patch("/api/settings", admin, async (req, res) => {
    const p = z
      .object({
        delivery_fee: amount,
        scoop_grams: z.number().int().min(80).max(125),
      })
      .parse(req.body);
    await db.transaction(async (tx) => {
      await lockBranch(tx, req.user);
      await tx.query(
        "UPDATE branches SET delivery_fee=$1,scoop_grams=$2 WHERE id=$3",
        [p.delivery_fee, p.scoop_grams, req.user.branch_id],
      );
      await audit(tx, req.user, "settings.update", p);
    });
    res.json({ ok: true });
  });
  app.post("/api/users", admin, async (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        password: z.string().min(12).max(100),
        role: z.enum(["admin", "cashier"]),
      })
      .parse(req.body);
    await db.query(
      "INSERT INTO users(branch_id,name,email,password,role) VALUES ($1,$2,$3,$4,$5)",
      [
        req.user.branch_id,
        p.name,
        p.email.toLowerCase(),
        await bcrypt.hash(p.password, 12),
        p.role,
      ],
    );
    res.json({ ok: true });
  });
  app.post("/api/password", async (req, res) => {
    const p = z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(12).max(100),
      })
      .parse(req.body);
    const stored = (
      await db.query("SELECT password FROM users WHERE id=$1", [req.user.id])
    ).rows[0];
    assert(
      await bcrypt.compare(p.currentPassword, stored.password),
      "La contraseña actual es incorrecta.",
    );
    const hash = await bcrypt.hash(p.newPassword, 12);
    await db.transaction(async (tx) => {
      await tx.query("UPDATE users SET password=$1 WHERE id=$2", [
        hash,
        req.user.id,
      ]);
      await tx.query("DELETE FROM sessions WHERE user_id=$1 AND id<>$2", [
        req.user.id,
        req.sid,
      ]);
      await audit(tx, req.user, "user.password", {});
    });
    res.json({ ok: true });
  });
  app.patch("/api/users/:id", admin, async (req, res) => {
    const active = z.boolean().parse(req.body.active),
      id = Number(req.params.id);
    assert(id !== req.user.id, "No podés desactivar tu propia cuenta.");
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE users SET active=$1 WHERE id=$2 AND branch_id=$3",
        [active, id, req.user.branch_id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      await audit(tx, req.user, "user.active", { id, active });
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Ruta no encontrada." }),
  );
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: "Revisá los datos ingresados.", details: error.issues });
    if (error.code === "23505")
      return res.status(409).json({ error: "El registro ya existe." });
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "No se pudo completar la operación.",
    });
  });
  return app;
}
