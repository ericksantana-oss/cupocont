import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CupoCont — Planejamento de Conteúdo",
  description: "Plataforma interna de planejamento e criação de conteúdo para redes sociais",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-papel text-tinta">{children}</body>
    </html>
  );
}
