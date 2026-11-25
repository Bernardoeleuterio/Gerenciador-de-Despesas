import { expect, test, type Page } from "@playwright/test";

/** A tela do dia a dia, no modo demo: o campo embaixo, a prévia e a lista do mês. */

function campo(page: Page) {
  return page.getByLabel("Novo gasto");
}

function linha(page: Page, texto: string) {
  return page.locator("main li", { hasText: texto });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("'50 ifood' e Enter: em menos de 5 segundos o gasto está na lista", async ({ page }) => {
  await expect(campo(page)).toBeFocused();
  const inicio = Date.now();
  await campo(page).pressSequentially("50 ifood", { delay: 100 }); // no ritmo de quem digita
  await expect(page.getByLabel("Prévia do gasto")).toContainText("Delivery e restaurantes");
  await campo(page).press("Enter");
  await expect(linha(page, "ifood")).toContainText("R$ 50,00");
  expect(Date.now() - inicio).toBeLessThan(5_000);
  await expect(campo(page)).toHaveValue("");
});

test("Desfazer tira o gasto que acabou de entrar", async ({ page }) => {
  await campo(page).fill("32,90 farmácia");
  await campo(page).press("Enter");
  await expect(linha(page, "farmácia")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(linha(page, "farmácia")).toHaveCount(0);
  await expect(page.getByText("Gasto desfeito.")).toBeVisible();
});

test("sem valor, o Enter não chuta: pede o valor", async ({ page }) => {
  await campo(page).fill("ifood");
  await campo(page).press("Enter");
  const valor = page.getByLabel("Valor em reais");
  await expect(valor).toBeFocused();
  await valor.fill("35");
  await page.getByRole("button", { name: "Usar" }).click();
  await campo(page).press("Enter");
  await expect(linha(page, "ifood")).toContainText("R$ 35,00");
});

test("corrigir a categoria ensina: da próxima vez, já vem certo", async ({ page }) => {
  await campo(page).fill("50 seu zé");
  await expect(page.getByLabel("Prévia do gasto")).toContainText("Outros?");
  await page.getByRole("button", { name: /^Categoria:/ }).click();
  await page.getByRole("region", { name: "Categoria" }).getByRole("button", { name: /Mercado/ }).click();
  await page.getByRole("button", { name: "Sempre", exact: true }).click();
  await campo(page).press("Enter");
  await expect(linha(page, "seu zé")).toContainText("Mercado");

  await campo(page).fill("30 seu zé");
  await expect(page.getByLabel("Prévia do gasto")).toContainText("Mercado");
  await expect(page.getByText(/Sempre que aparecer/)).toHaveCount(0);
});

test("na demo, o gasto continua lá depois de recarregar a página", async ({ page }) => {
  await campo(page).fill("120 luz pix");
  await campo(page).press("Enter");
  await expect(linha(page, "luz")).toBeVisible();
  await page.reload();
  await expect(linha(page, "luz")).toContainText("Contas da casa");
});
