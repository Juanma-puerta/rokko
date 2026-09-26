import "dotenv/config";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import bcrypt from "bcryptjs";
export async function createDatabase({ memory = false } = {}) {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL)
    throw new Error("DATABASE_URL es obligatorio en producción");
  const embedded = memory || !process.env.DATABASE_URL;
  if (embedded && !memory) await mkdir("./.data", { recursive: true });
  let snapshot;
  if (embedded && !memory) {
    try {
      snapshot = new Blob([await readFile("./.data/postgres.tar")]);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const connection = embedded
    ? new PGlite(snapshot ? { loadDataDir: snapshot } : undefined)
    : new pg.Pool({ connectionString: process.env.DATABASE_URL });
  // An atomic PostgreSQL snapshot avoids native filesystem incompatibilities on Windows.
  // This adapter is for local development only; production uses a PostgreSQL pool.
  const persist = async () => {
    if (embedded && !memory) {
      const blob = await connection.dumpDataDir();
      await writeFile(
        "./.data/postgres.tmp",
        Buffer.from(await blob.arrayBuffer()),
      );
      await rename("./.data/postgres.tmp", "./.data/postgres.tar");
    }
  };
  let queue = Promise.resolve();
  const serial = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const db = {
    query: embedded
      ? (sql, args) =>
          serial(async () => {
            const result = await connection.query(sql, args);
            if (!/^\s*SELECT\b/i.test(sql)) await persist();
            return result;
          })
      : (sql, args) => connection.query(sql, args),
    transaction: embedded
      ? (fn) =>
          serial(async () => {
            const result = await connection.transaction(fn);
            await persist();
            return result;
          })
      : async (fn) => {
          const client = await connection.connect();
          try {
            await client.query("BEGIN");
            const result = await fn(client);
            await client.query("COMMIT");
            return result;
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
          }
        },
    close: () => (embedded ? connection.close() : connection.end()),
  };
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  if (embedded) await connection.exec(schema);
  else await connection.query(schema);
  return db;
}
export async function seed(db) {
  if ((await db.query("SELECT id FROM branches LIMIT 1")).rows.length) return;
  const production = process.env.NODE_ENV === "production";
  if (
    production &&
    (!process.env.ADMIN_EMAIL || (process.env.ADMIN_PASSWORD || "").length < 12)
  )
    throw new Error(
      "Configurar ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres)",
    );
  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO branches(name) VALUES ('Rokko · Central')");
    const password = await bcrypt.hash(
      process.env.ADMIN_PASSWORD || "RokkoDemo2026!",
      12,
    );
    await tx.query(
      "INSERT INTO users(name,email,password,role,branch_id) VALUES ('Administración',$1,$2,'admin',1)",
      [process.env.ADMIN_EMAIL || "admin@rokko.local", password],
    );
    if (!production)
      await tx.query(
        "INSERT INTO users(name,email,password,role,branch_id) VALUES ('Heladero','caja@rokko.local',$1,'cashier',1)",
        [password],
      );
    for (const name of ["Potes", "Cucuruchos", "Barquillos", "Helados de agua"])
      await tx.query("INSERT INTO categories(name) VALUES ($1)", [name]);
    const products = [
      ["Pote ¼ kg", 1, 550000, 250, 0, 2, "tub"],
      ["Pote ½ kg", 1, 950000, 500, 0, 3, "tub"],
      ["Pote 1 kg", 1, 1700000, 1000, 0, 4, "tub"],
      ["Cucurucho · 1 sabor", 2, 300000, 0, 1, 1, "cone"],
      ["Cucurucho · 2 sabores", 2, 420000, 0, 2, 2, "cone"],
      ["Cucurucho · 3 sabores", 2, 520000, 0, 3, 3, "cone"],
      ["Barquillo · 1 sabor", 3, 350000, 0, 1, 1, "wafer"],
      ["Helado de agua · Limón", 4, 180000, 0, 0, 0, "ice"],
      ["Helado de agua · Frutilla", 4, 180000, 0, 0, 0, "ice"],
    ];
    for (const p of products)
      await tx.query(
        "INSERT INTO products(branch_id,name,category_id,price,grams,scoops,max_flavors,kind,stock) VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8)",
        [...p, production ? 0 : 60],
      );
    for (const [name, family] of [
      ["Dulce de leche", "Clásicos"],
      ["Chocolate", "Chocolates"],
      ["Frutilla", "Frutales"],
      ["Vainilla", "Clásicos"],
      ["Granizado", "Clásicos"],
      ["Chocolate amargo", "Chocolates"],
      ["Limón", "Frutales"],
      ["Pistacho", "Especiales"],
    ])
      await tx.query(
        "INSERT INTO flavors(branch_id,name,family,stock) VALUES (1,$1,$2,$3)",
        [name, family, production ? 0 : 12000],
      );
  });
}
