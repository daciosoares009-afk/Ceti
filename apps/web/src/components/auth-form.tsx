"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, CheckCircle2, Mail } from "lucide-react";
import { Button } from "./ui/button";
import { registrationSchema, loginSchema, requestEmailSchema, consumeSchema, resetSchema } from "../modules/identity/validation";
type Kind = "login" | "register" | "forgot" | "resend" | "verify" | "reset";
type Fields = { name: string; email: string; password: string; schoolId: string; role: "STUDENT" | "TEACHER"; code: string };
export function AuthForm({ kind, schools = [] }: { kind: Kind; schools?: { id: string; name: string }[] }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({ defaultValues: { role: "STUDENT" } });
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (kind === "verify" || kind === "reset") {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
      // Clear URL immediately to avoid accidental sharing; keep only in component memory.
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => setToken(value));
    }
  }, [kind]);
  async function submit(values: Fields) {
    setMessage(""); setError("");
    const schemas = { login: loginSchema, register: registrationSchema, forgot: requestEmailSchema, resend: requestEmailSchema, verify: consumeSchema, reset: resetSchema };
    const input = kind === "register" ? { name: values.name, email: values.email, password: values.password, schoolId: values.schoolId, role: values.role }
      : kind === "login" ? { email: values.email, password: values.password, code: values.code || "" }
      : kind === "verify" ? { token } : kind === "reset" ? { token, password: values.password } : { email: values.email };
    const parsed = schemas[kind].safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    try {
      const response = await fetch(`/api/auth/${kind === "register" ? "register" : kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) { setError(result.message); return; }
      if (kind === "login") { router.push("/painel"); router.refresh(); }
      else setMessage(result.message);
    } catch { setError("Não foi possível conectar. Confira sua conexão e tente novamente."); }
  }
  const hasPassword = ["login", "register", "reset"].includes(kind);
  const needsToken = kind === "verify" || kind === "reset";
  const label = { login: "Entrar", register: "Criar minha conta", forgot: "Enviar link de recuperação", resend: "Reenviar confirmação", verify: "Confirmar meu e-mail", reset: "Salvar nova senha" }[kind];
  return <>
    {message ? <div className="success-panel" role="status"><CheckCircle2 size={26} /><p>{message}</p><Link href="/entrar">Ir para o login</Link></div> : <form onSubmit={handleSubmit(submit)} className="form-stack">
      {kind === "register" && <div className="field"><label htmlFor="name">Nome completo</label><input id="name" autoComplete="name" maxLength={100} required {...register("name")} /></div>}
      {!needsToken && <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" placeholder="seu@email.com" autoComplete="email" maxLength={254} required {...register("email")} /></div>}
      {hasPassword && <div className="field"><div className="field-heading"><label htmlFor="password">{kind === "reset" ? "Nova senha" : "Senha"}</label>{kind === "login" && <Link href="/recuperar-senha">Esqueceu a senha?</Link>}</div><div className="password-field"><input id="password" type={show ? "text" : "password"} autoComplete={kind === "login" ? "current-password" : "new-password"} minLength={kind === "login" ? 1 : 12} maxLength={128} required {...register("password")} /><button type="button" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow(!show)}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{kind !== "login" && <p className="field-hint">Use uma senha exclusiva com 12 a 128 caracteres.</p>}</div>}
      {kind === "register" && <><div className="field"><label htmlFor="schoolId">Sua escola</label><select id="schoolId" required defaultValue="" {...register("schoolId")}><option value="" disabled>Selecione sua escola</option>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select>{schools.length === 0 && <p className="field-hint">Não há escolas disponíveis. O responsável pela plataforma precisa cadastrar uma escola.</p>}</div><fieldset className="role-field"><legend>Como você participa da escola?</legend><label><input type="radio" value="STUDENT" {...register("role")} /> Sou aluno</label><label><input type="radio" value="TEACHER" {...register("role")} /> Sou professor</label></fieldset><p className="form-note">Ao criar sua conta, confirme seu e-mail e aguarde a aprovação da escola. <Link href="/privacidade">Saiba como seus dados são usados.</Link></p></>}
      {kind === "login" && <details className="mfa-details"><summary>Sou gestor e uso autenticação em duas etapas</summary><div className="field"><label htmlFor="code">Código do autenticador</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="6 dígitos" {...register("code")} /></div></details>}
      {needsToken && !token && <p className="notice">Abra o link recebido por e-mail para continuar. <Link href={kind === "verify" ? "/reenviar-confirmacao" : "/recuperar-senha"}>Solicitar novo link</Link></p>}
      {error && <p role="alert" className="error-message">{error}</p>}
      <Button type="submit" disabled={isSubmitting || (kind === "register" && !schools.length) || (needsToken && !token)}>{isSubmitting && <LoaderCircle size={18} className="spin" />}{isSubmitting ? "Aguarde…" : label}</Button>
    </form>}
    {kind === "login" && <><p className="form-switch">Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link></p><Link className="resend-link" href="/reenviar-confirmacao"><Mail size={16} /> Reenviar e-mail de confirmação</Link></>}
    {kind === "register" && <p className="form-switch">Já tem uma conta? <Link href="/entrar">Entrar</Link></p>}
    {["forgot", "resend"].includes(kind) && <p className="form-switch"><Link href="/entrar">Voltar para o login</Link></p>}
  </>;
}
