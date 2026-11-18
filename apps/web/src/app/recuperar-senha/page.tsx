import { AuthShell } from "../../components/auth-shell";
import { AuthForm } from "../../components/auth-form";
export default function Page() { return <AuthShell title="Recuperar sua conta" description="Informe seu e-mail para receber um link de recuperação."><AuthForm kind="forgot" /></AuthShell>; }
