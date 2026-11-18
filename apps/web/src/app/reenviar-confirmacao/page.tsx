import { AuthShell } from "../../components/auth-shell";
import { AuthForm } from "../../components/auth-form";
export default function Page() { return <AuthShell title="Confirme seu e-mail" description="Solicite um novo link para continuar seu cadastro."><AuthForm kind="resend" /></AuthShell>; }
