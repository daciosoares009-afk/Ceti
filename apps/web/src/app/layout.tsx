import type { Metadata } from "next";
import "./globals.css";
// Nonce-based CSP requires fresh server-rendered HTML on every request.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "CETI · Plataforma escolar", template: "%s · CETI" }, description: "Tudo em um só lugar. Simples para todos.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><a className="skip-link" href="#conteudo">Pular para o conteúdo</a>{children}</body></html>;
}
