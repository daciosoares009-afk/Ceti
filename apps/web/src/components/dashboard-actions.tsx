"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, UserRoundCheck, Settings, LogOut, Menu, X, LoaderCircle } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
export function Navigation({ manager }: { manager: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = [{ href: "/painel", label: "Visão geral", icon: LayoutDashboard }, ...(manager ? [{ href: "/painel/gestao", label: "Gestão de acessos", icon: UserRoundCheck }] : []), { href: "/painel/configuracoes", label: "Minha conta", icon: Settings }];
  return <><button className="mobile-menu icon-button" onClick={() => setOpen(!open)} aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="navigation">{open ? <X /> : <Menu />}</button><aside className={`sidebar ${open ? "sidebar-open" : ""}`} id="navigation"><Brand /><nav aria-label="Menu principal">{items.map(item => <Link key={item.href} onClick={() => setOpen(false)} className={path === item.href ? "nav-active" : ""} aria-current={path === item.href ? "page" : undefined} href={item.href}><item.icon size={20} />{item.label}</Link>)}</nav><div className="sidebar-bottom"><p>Tudo em um só lugar.<br />Simples para todos.</p><ActionButton endpoint="auth/logout" label="Sair da conta" variant="ghost" redirect><LogOut size={18} /></ActionButton></div></aside></>;
}
export function ActionButton({ endpoint, payload = {}, label, variant = "outline", redirect = false, children }: { endpoint: string; payload?: object; label: string; variant?: "default" | "outline" | "ghost" | "destructive"; redirect?: boolean; children?: React.ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else { if (redirect) router.push("/entrar"); router.refresh(); }
    } catch { setError("Não foi possível conectar. Tente novamente."); }
    finally { setPending(false); }
  }
  return <span className="action-wrap"><Button variant={variant} size="sm" disabled={pending} onClick={run}>{pending ? <LoaderCircle size={16} className="spin" /> : children}{label}</Button>{error && <span className="error-message" role="alert">{error}</span>}</span>;
}
export function JoinSchool({ schools }: { schools: { id: string; name: string }[] }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/memberships/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId: form.get("schoolId"), role: form.get("role") }) });
      const result = await response.json(); setMessage(result.message);
      if (response.ok) router.refresh();
    } catch { setMessage("Não foi possível conectar. Tente novamente."); } finally { setPending(false); }
  }
  if (!schools.length) return null;
  return <details className="join-details"><summary>Solicitar vínculo com outra escola</summary><form className="form-stack" onSubmit={submit}><div className="field"><label htmlFor="join-school">Escola</label><select name="schoolId" id="join-school" required>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field"><label htmlFor="join-role">Perfil solicitado</label><select name="role" id="join-role"><option value="STUDENT">Aluno</option><option value="TEACHER">Professor</option></select></div><Button disabled={pending}>{pending ? "Aguarde…" : "Solicitar acesso"}</Button>{message && <p role="status">{message}</p>}</form></details>;
}
