import { currentSession } from "../../../modules/identity/current-session";
import { ActionButton } from "../../../components/dashboard-actions";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
export default async function Account() {
  const session = await currentSession();
  return <><div className="page-heading"><div><span className="eyebrow">Configurações</span><h1>Minha conta</h1><p className="muted">Seus dados de acesso e a segurança da sua conta.</p></div></div><section className="panel account-panel"><div className="section-heading"><h2>Informações pessoais</h2></div><dl className="account-data"><div><dt>Nome</dt><dd>{session.user.name}</dd></div><div><dt>E-mail</dt><dd>{session.user.email}</dd></div><div><dt>Verificação</dt><dd><span className="verified-label"><ShieldCheck size={16} /> E-mail confirmado</span></dd></div><div><dt>Autenticação em duas etapas</dt><dd>{session.mfaVerified ? "Verificada nesta sessão" : "Não exigida para este acesso"}</dd></div></dl><p className="panel-empty">Para corrigir seus dados pessoais, procure a gestão da sua escola.</p></section><section className="panel account-panel"><div className="section-heading"><div><h2>Proteja seu acesso</h2><p className="muted">Encerre suas sessões em todos os dispositivos.</p></div></div><div className="account-security"><ActionButton endpoint="auth/revoke-sessions" label="Sair de todos os dispositivos" variant="destructive" redirect /><Link href="/recuperar-senha">Alterar minha senha por e-mail</Link></div></section></>;
}
