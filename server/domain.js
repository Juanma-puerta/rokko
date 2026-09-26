export class BusinessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status) {
  if (!condition) throw new BusinessError(message, status);
}
export function splitGrams(total, count) {
  return Array.from(
    { length: count },
    (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0),
  );
}
export async function audit(tx, user, action, detail) {
  await tx.query(
    "INSERT INTO audit(branch_id,user_id,action,detail) VALUES ($1,$2,$3,$4)",
    [user.branch_id, user.id, action, JSON.stringify(detail)],
  );
}
export async function lockBranch(tx, user) {
  return (
    await tx.query("SELECT * FROM branches WHERE id=$1 FOR UPDATE", [
      user.branch_id,
    ])
  ).rows[0];
}
export async function openCash(tx, user) {
  const cash = (
    await tx.query(
      "SELECT * FROM cash_sessions WHERE branch_id=$1 AND closed_at IS NULL FOR UPDATE",
      [user.branch_id],
    )
  ).rows[0];
  assert(cash, "Abrí la caja para registrar esta operación.");
  return cash;
}
export async function cashExpected(tx, cash) {
  const result = await tx.query(
    "SELECT COALESCE(SUM(amount),0)::int AS amount FROM cash_movements WHERE cash_id=$1",
    [cash.id],
  );
  return cash.opening + result.rows[0].amount;
}
export async function recordPayments(tx, user, order, payments) {
  assert(order.status !== "cancelled", "El pedido está anulado.");
  const cash = await openCash(tx, user);
  const paid = (
    await tx.query(
      "SELECT COALESCE(SUM(amount),0)::int AS amount FROM payments WHERE order_id=$1",
      [order.id],
    )
  ).rows[0].amount;
  const amount = payments.reduce((a, p) => a + p.amount, 0);
  assert(paid + amount <= order.total, "El importe supera el saldo pendiente.");
  for (const p of payments) {
    assert(
      p.method !== "cash" || (p.received ?? p.amount) >= p.amount,
      "El efectivo recibido es insuficiente.",
    );
    await tx.query(
      "INSERT INTO payments(order_id,cash_id,method,amount,received) VALUES ($1,$2,$3,$4,$5)",
      [
        order.id,
        cash.id,
        p.method,
        p.amount,
        p.method === "cash" ? (p.received ?? p.amount) : null,
      ],
    );
    if (p.method === "cash")
      await tx.query(
        "INSERT INTO cash_movements(cash_id,user_id,order_id,amount,reason) VALUES ($1,$2,$3,$4,$5)",
        [cash.id, user.id, order.id, p.amount, "Cobro de pedido"],
      );
  }
  if (payments.length)
    await audit(tx, user, "payment", { order: order.id, payments });
}
export async function createOrder(db, user, input) {
  return db.transaction(async (tx) => {
    const branch = await lockBranch(tx, user);
    const existing = (
      await tx.query(
        "SELECT * FROM orders WHERE branch_id=$1 AND request_key=$2",
        [user.branch_id, input.requestKey],
      )
    ).rows[0];
    if (existing) return existing;
    const cash = await openCash(tx, user);
    const items = [],
      consumption = { products: {}, flavors: {} };
    for (const line of input.items) {
      const product = (
        await tx.query(
          "SELECT * FROM products WHERE id=$1 AND branch_id=$2 AND active=true",
          [line.productId, user.branch_id],
        )
      ).rows[0];
      assert(product, "Producto no disponible.");
      const ids = line.flavorIds;
      assert(
        new Set(ids).size === ids.length,
        "No repitas sabores en una misma presentación.",
      );
      assert(
        product.max_flavors
          ? ids.length > 0 && ids.length <= product.max_flavors
          : ids.length === 0,
        "Revisá la cantidad de sabores.",
      );
      const flavors = [];
      const weights = splitGrams(
        product.grams || product.scoops * branch.scoop_grams,
        ids.length,
      );
      for (let i = 0; i < ids.length; i++) {
        const flavor = (
          await tx.query(
            "SELECT * FROM flavors WHERE id=$1 AND branch_id=$2 AND active=true",
            [ids[i], user.branch_id],
          )
        ).rows[0];
        assert(flavor, "Sabor no disponible.");
        consumption.flavors[flavor.id] =
          (consumption.flavors[flavor.id] || 0) + weights[i] * line.quantity;
        flavors.push({ id: flavor.id, name: flavor.name, grams: weights[i] });
      }
      consumption.products[product.id] =
        (consumption.products[product.id] || 0) + line.quantity;
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: line.quantity,
        flavors,
      });
    }
    for (const target of ["products", "flavors"])
      for (const [id, amount] of Object.entries(consumption[target])) {
        const updated = await tx.query(
          `UPDATE ${target} SET stock=stock-$1 WHERE id=$2 AND branch_id=$3 AND stock >= $1 RETURNING name`,
          [amount, Number(id), user.branch_id],
        );
        assert(
          updated.rows.length,
          "Stock insuficiente. Revisá los productos y sabores seleccionados.",
        );
        await tx.query(
          "INSERT INTO stock_movements(branch_id,user_id,target,target_id,amount,reason) VALUES ($1,$2,$3,$4,$5,$6)",
          [user.branch_id, user.id, target, Number(id), -amount, "Venta"],
        );
      }
    const subtotal = items.reduce((a, i) => a + i.price * i.quantity, 0),
      delivery = input.channel === "delivery" ? branch.delivery_fee : 0;
    assert(
      subtotal + delivery <= 2000000000,
      "El pedido supera el importe máximo permitido.",
    );
    assert(
      input.channel !== "delivery" ||
        (input.customer.name && input.customer.phone && input.customer.address),
      "Completá nombre, teléfono y dirección del delivery.",
    );
    const order = (
      await tx.query(
        "INSERT INTO orders(request_key,branch_id,user_id,cash_id,channel,customer,notes,items,consumption,subtotal,delivery,total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
        [
          input.requestKey,
          user.branch_id,
          user.id,
          cash.id,
          input.channel,
          JSON.stringify(input.customer),
          input.notes,
          JSON.stringify(items),
          JSON.stringify(consumption),
          subtotal,
          delivery,
          subtotal + delivery,
        ],
      )
    ).rows[0];
    const paid = input.payments.reduce((a, p) => a + p.amount, 0);
    assert(
      input.channel === "delivery" || paid === order.total,
      "El pedido presencial debe quedar completamente pagado.",
    );
    await recordPayments(tx, user, order, input.payments);
    await audit(tx, user, "order.create", { id: order.id });
    return order;
  });
}
