import { AuthShell } from "../../components/auth-shell";
import { AuthForm } from "../../components/auth-form";
export default function Page() { return <AuthShell title="Escolha uma nova senha" description="As sessões anteriores serão encerradas após a alteração."><AuthForm kind="reset" /></AuthShell>; }
