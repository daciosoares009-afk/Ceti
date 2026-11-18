import { Brand } from "./brand";
import { BookOpen, Check, Users, ShieldCheck } from "lucide-react";
import Link from "next/link";
export function AuthShell({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return <main className="auth-layout" id="conteudo">
    <aside className="auth-story">
      <Brand />
      <div className="auth-intro"><span className="eyebrow">Sua comunidade escolar</span><h1>Tudo em um<br />só lugar.<br /><span>Simples para todos.</span></h1><p>Um espaço para aprender, ensinar e acompanhar a vida escolar.</p>
      <div className="story-features"><div><BookOpen size={20} /><span>Seu acesso e seus vínculos em um painel</span></div><div><Users size={20} /><span>Contas de alunos, professores e gestores</span></div><div><ShieldCheck size={20} /><span>Acesso autorizado pela sua escola</span></div></div></div>
      <div className="auth-foot"><Check size={16} /> Cada escola aprova seus próprios vínculos.</div>
    </aside>
    <section className="auth-content"><div className="mobile-brand"><Brand /></div><div className="auth-form-wrap"><h2>{title}</h2><p className="muted lead">{description}</p>{children}</div><footer><Link href="/privacidade">Privacidade e seus dados</Link><span>CETI · Plataforma escolar integrada</span></footer></section>
  </main>;
}
