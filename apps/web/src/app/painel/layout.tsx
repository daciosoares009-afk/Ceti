import { currentSession } from "../../modules/identity/current-session";
import { Navigation } from "../../components/dashboard-actions";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  const manager = session.mfaVerified && session.user.memberships.some(m => m.role === "MANAGER" && m.status === "APPROVED");
  const pending = session.user.memberships.filter(m => m.status === "PENDING_REVIEW").length;
  return <div className="dashboard"><Navigation manager={manager} /><div className="dashboard-body"><header className="topbar"><form action="/painel" className="global-search" role="search"><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="search">Pesquisar suas escolas</label><input id="search" name="q" placeholder="Pesquisar suas escolas…" maxLength={100} /><button type="submit" className="search-submit">Buscar</button></form><div className="topbar-account"><details className="notifications"><summary className="icon-button" aria-label="Notificações"><Bell size={20} />{pending > 0 && <span className="notification-dot" />}</summary><div className="notification-panel"><strong>Seu acesso</strong><p>{pending ? `${pending} solicitação(ões) aguardando análise da escola.` : "Nenhuma solicitação aguardando análise."}</p><Link href="/painel">Ver meus vínculos</Link></div></details><Link href="/painel/configuracoes" className="account-link"><span className="avatar">{session.user.name.split(/\s+/).slice(0, 2).map(v => v[0]).join("").toUpperCase()}</span><span className="account-name">{session.user.name}<small>Minha conta</small></span></Link></div></header><main id="conteudo" className="main-content">{children}</main><footer className="dashboard-footer"><span>CETI · Plataforma escolar integrada</span><Link href="/privacidade">Privacidade</Link></footer></div></div>;
}
