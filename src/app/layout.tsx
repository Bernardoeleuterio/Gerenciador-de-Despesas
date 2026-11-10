import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gerenciador de Despesas",
  description:
    "Lance um gasto em segundos e veja no fim do mês quanto a família gastou, em quê e por quem.",
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
