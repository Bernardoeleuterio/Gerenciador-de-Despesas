import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gerenciador de Despesas",
  description:
    "Lance um gasto em segundos e veja no fim do mês quanto a família gastou, em quê e por quem.",
};

// Com o teclado do celular aberto, a página encolhe junto (o campo de
// lançamento, fixo embaixo, sobe e continua à vista).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

// Fonte do sistema (sem next/font): carrega na hora no celular, tem cara de
// app nativo e o build não depende de baixar fonte do Google.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
