import "dotenv/config";
import express from "express";
import { createDatabase, seed } from "./db.js";
import { createApp } from "./app.js";
const db = await createDatabase();
await seed(db);
const app = createApp(db);
app.use(express.static("dist"));
app.listen(
  process.env.PORT || 3001,
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  () =>
    console.log(
      `Rokko API lista en http://localhost:${process.env.PORT || 3001}`,
    ),
);
