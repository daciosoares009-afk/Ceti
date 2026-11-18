import { AuthShell } from "../../components/auth-shell";
import { AuthForm } from "../../components/auth-form";
import { publicSchools } from "../../modules/schools/service";
export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  const schools = await publicSchools();
  return <AuthShell title="Seu próximo passo começa aqui." description="Crie sua conta e solicite acesso à sua escola."><AuthForm kind="register" schools={schools} /></AuthShell>;
}
