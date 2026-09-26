import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:5173");
await page.getByLabel("Email", { exact: true }).fill("admin@rokko.local");
await page.getByLabel("Contraseña", { exact: true }).fill("RokkoDemo2026!");
await page.getByRole("button", { name: "Ingresar", exact: true }).click();
await page.getByRole("heading", { name: "Un sabor, una sonrisa." }).waitFor();
await mkdir("test-results", { recursive: true });
await page.screenshot({
  path: "test-results/rokko-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Caja", exact: true }).click();
if (
  await page
    .getByRole("button", { name: "Abrir caja", exact: true })
    .isVisible()
) {
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page.getByLabel("Efectivo inicial ($)").fill("10000");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.locator(".modal").waitFor({ state: "hidden" });
}
await page.getByRole("button", { name: "Venta", exact: true }).click();
await page.getByRole("button", { name: /Hasta 2 sabores Pote ¼ kg/ }).click();
await page.getByRole("button", { name: /Dulce de leche/ }).click();
await page.getByRole("button", { name: /^Chocolate \d/ }).click();
await page.getByRole("button", { name: /Agregar al pedido/ }).click();
await page
  .getByRole("button", { name: "Confirmar pedido", exact: true })
  .click();
await page.getByRole("button", { name: "Confirmar cobro y pedido" }).click();
await page
  .getByRole("heading", { name: "Cada pedido, a su tiempo." })
  .waitFor();
await page
  .getByRole("button", { name: /Ver pedido/ })
  .first()
  .click();
await page.getByRole("button", { name: "Preparar", exact: true }).click();
await page.locator(".modal").waitFor({ state: "hidden" });
for (const name of [
  "Dashboard",
  "Productos",
  "Stock",
  "Historial",
  "Usuarios",
  "Configuración",
]) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.screenshot({
    path: `test-results/rokko-${name}.png`,
    fullPage: true,
  });
}
await page.getByRole("button", { name: "Venta", exact: true }).click();
const mobile=await page.context().newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto('http://localhost:5173');
await mobile.getByRole('heading',{name:'Un sabor, una sonrisa.'}).waitFor();
await mobile.evaluate(() => document.fonts.ready);
await mobile.screenshot({
  path: "test-results/rokko-mobile.png",
  fullPage: true,
});
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
if (overflow) throw new Error("Desborde horizontal en móvil");
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Browser OK: login, apertura, venta, sabores, cobro, preparación, navegación y móvil.",
);
await browser.close();
