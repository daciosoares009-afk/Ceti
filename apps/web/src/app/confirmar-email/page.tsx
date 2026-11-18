import { AuthShell } from "../../components/auth-shell";
import { AuthForm } from "../../components/auth-form";
export default function Page() { return <AuthShell title="Só mais um passo." description="Confirme seu e-mail para enviar seu pedido à gestão da escola."><AuthForm kind="verify" /></AuthShell>; }
