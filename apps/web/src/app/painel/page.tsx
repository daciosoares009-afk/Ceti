import { currentSession } from "../../modules/identity/current-session";
import { publicSchools } from "../../modules/schools/service";
import { JoinSchool } from "../../components/dashboard-actions";
import { School, ShieldCheck, Clock3, CheckCircle2, Circle, BookOpen, UserRoundCheck } from "lucide-react";
import Link from "next/link";
const roleLabels = { STUDENT: "Aluno", TEACHER: "Professor", MANAGER: "Gestor" };
const statusLabels = { PENDING_EMAIL: "Confirme seu e-mail", PENDING_REVIEW: "Aguardando aprovação", APPROVED: "Acesso aprovado", REJECTED: "Solicitação recusada", SUSPENDED: "Vínculo suspenso" };
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const session = await currentSession();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const query = q.slice(0, 100).toLocaleLowerCase("pt-BR");
  const memberships = session.user.memberships.filter(m => m.school.name.toLocaleLowerCase("pt-BR").includes(query));
  const approved = session.user.memberships.filter(m => m.status === "APPROVED").length;
  const pending = session.user.memberships.filter(m => m.status === "PENDING_REVIEW").length;
  const manager = session.mfaVerified && session.user.memberships.some(m => m.status === "APPROVED" && m.role === "MANAGER");
  const schools = (await publicSchools()).filter(s => !session.user.memberships.some(m => m.schoolId === s.id));
  return <><div className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>Olá, {session.user.name.split(" ")[0]}.</h1><p className="muted">Sua vida escolar começa por aqui.</p></div><span className="verified-label"><ShieldCheck size={17} /> E-mail confirmado</span></div>
    <section className="welcome-banner"><div><span className="eyebrow">Um espaço para sua escola</span><h2>{approved ? "Vamos construir o próximo passo." : "Você já deu o primeiro passo."}</h2><p>{approved ? "Acompanhe seus vínculos e acesse as ferramentas disponíveis para o seu perfil." : "Seu cadastro está confirmado. A escola analisa seu pedido antes de liberar o acesso."}</p>{manager && <Link className="button button-primary" href="/painel/gestao"><UserRoundCheck size={18} /> Gerenciar solicitações</Link>}</div><div className="banner-symbol"><BookOpen size={80} strokeWidth={1} /></div></section>
    <div className="stats-grid"><div className="stat"><span><School size={19} /> Meus vínculos</span><strong>{session.user.memberships.length.toString().padStart(2, "0")}</strong><small>Escolas vinculadas à sua conta</small></div><div className="stat"><span><ShieldCheck size={19} /> Acessos aprovados</span><strong>{approved.toString().padStart(2, "0")}</strong><small>Vínculos autorizados pela escola</small></div><div className="stat"><span><Clock3 size={19} /> Aguardando análise</span><strong>{pending.toString().padStart(2, "0")}</strong><small>Solicitações enviadas à gestão</small></div></div>
    <section className="panel"><div className="section-heading"><div><h2>Minhas escolas</h2><p className="muted">Acompanhe o acesso em cada instituição.</p></div><span className="count-label">{memberships.length} vínculo(s)</span></div>
    {q && <p className="search-result">Resultados para “{q.slice(0, 100)}” · <Link href="/painel">Limpar busca</Link></p>}
    {memberships.length === 0 ? <div className="empty-state"><School size={32} /><h3>Nenhuma escola encontrada</h3><p>{q ? "Tente outro nome ou limpe a busca." : "Solicite um vínculo com uma escola disponível."}</p></div> : memberships.map(m => <article className="school-row" key={m.id}><div className="school-icon"><School size={24} /></div><div className="school-info"><h3>{m.school.name}</h3><p>{roleLabels[m.role]}</p></div><span className={`badge ${m.status === "APPROVED" ? "badge-approved" : m.status === "PENDING_REVIEW" ? "badge-pending" : "badge-neutral"}`}>{m.status === "APPROVED" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{statusLabels[m.status]}</span>{m.role === "MANAGER" && m.status === "APPROVED" && session.mfaVerified && <Link className="school-action" href={`/painel/gestao?schoolId=${m.schoolId}`}>Gerenciar acessos</Link>}{["REJECTED", "SUSPENDED"].includes(m.status) && <p className="school-help">Para mais informações, procure a gestão da escola.</p>}</article>)}
    <JoinSchool schools={schools} /></section>
    <section className="onboarding"><div><span className="eyebrow">Como funciona o acesso</span><h2>Um caminho simples,<br />com a sua escola.</h2></div><ol className="steps"><li className="step-complete"><CheckCircle2 size={22} /><div><strong>Crie sua conta</strong><p>Informe seus dados e escolha a escola.</p></div></li><li className="step-complete"><CheckCircle2 size={22} /><div><strong>Confirme seu e-mail</strong><p>Seu endereço já foi verificado.</p></div></li><li className={approved ? "step-complete" : ""}>{approved ? <CheckCircle2 size={22} /> : <Circle size={22} />}<div><strong>A escola aprova o vínculo</strong><p>Você acompanha a análise neste painel.</p></div></li></ol></section>
  </>;
}
