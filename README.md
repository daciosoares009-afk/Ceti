# CETI · Plataforma escolar integrada

Tudo em um só lugar. Simples para todos.

Fundação funcional de uma plataforma escolar com Next.js App Router, TypeScript estrito, Tailwind, componentes no padrão shadcn, React Hook Form, Zod, Prisma e PostgreSQL. **Etapa inicial, sem deploy e sem dados de demonstração na aplicação.**

## O que está implementado

- Cadastro público de aluno/professor, confirmação por e-mail e análise administrativa por escola.
- Contas e vínculos com estados independentes; uma pessoa pode solicitar vínculo em várias escolas.
- Login com Argon2id, sessão opaca revogável e MFA TOTP obrigatório para gestores.
- Recuperação de senha com token de uso único; revogação de sessões após a troca.
- Dashboard responsivo com dados persistentes, busca nas próprias escolas, avisos de estado do acesso e configuração da conta.
- Aprovação, recusa, suspensão e auditoria de vínculos com autorização no servidor.
- Outbox de e-mail persistente, worker com lease/retries e captura SMTP local para desenvolvimento.
- Testes unitários, integração com PostgreSQL/SMTP e Playwright; CI e revisão de segurança documentada.

Chat, turmas, disciplinas, atividades, biblioteca, calendário, notificações assíncronas e acompanhamento pedagógico ainda não estão implementados. Não há telas simulando esses módulos.

## Iniciar no Windows, sem Docker

Requisitos: Node **24.15+ da linha 24**, pnpm **11.25.0**. Instale dependências com o gerenciador indicado em `packageManager`.

```powershell
pnpm install --frozen-lockfile
pnpm services:local
```

O segundo comando permanece ativo. No primeiro uso, cria `.env` com segredos aleatórios e PostgreSQL em **127.0.0.1:55432**, dois bancos (`ceti`, `ceti_test`) e SMTP em **127.0.0.1:1025**. Arquivos ficam em `.local/`, ignorados pelo Git. PostgreSQL é real; este recurso é exclusivamente local, com wrapper/bins de desenvolvimento em versão beta fixada.

Em outro terminal:

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:test
pnpm worker:email
```

Em um terceiro terminal:

```powershell

```

Abra [a plataforma local](http://localhost:3000). E-mails enviados pelo worker são arquivos `.eml` em `.local/mailbox/`; abra-os em um leitor de e-mail para usar os links. A caixa contém tokens sensíveis: não versionar, compartilhar ou usar em produção.

## Alternativa com Docker

Copie `.env.example` para `.env`, configure `MFA_ENCRYPTION_KEY` aleatória de 32 bytes em hexadecimal e uma senha local própria, mantendo coerência entre `POSTGRES_PASSWORD` e `DATABASE_URL`. Execute `docker compose up -d`. O Compose usa PostgreSQL **5432** e Mailpit [8025](http://localhost:8025), com SMTP **1025**. Crie o banco de testes com `docker compose exec postgres createdb -U ceti ceti_test` uma única vez. Depois use os comandos de migração, worker e aplicação acima. Não execute ambas as alternativas de SMTP ao mesmo tempo.

## Cadastrar a primeira escola e o gestor

Não existe gestor ou senha padrão. O comando `pnpm bootstrap` recebe **um objeto JSON por stdin**, sem eco ou gravação do conteúdo. Execute por um gerenciador de segredos ou script local privado; não coloque o JSON em argumentos, histórico de shell ou arquivos versionados.

Campos obrigatórios: `name`, `email`, `password` (12–128 caracteres), `schoolName`, `schoolSlug` (minúsculas e hífens), `totpSecret` (Base32, 32–64 caracteres) e `totpCode` (código atual de seis dígitos). Cadastre o segredo em um autenticador antes de executar. O código comprova a posse do autenticador e não poderá ser reutilizado no login.

O comando cria a escola (ou usa a mesma escola ativa com slug e nome idênticos), cria uma conta nova de gestor, cifra o segredo MFA e enfileira a confirmação de e-mail. Confirme o e-mail, aguarde o próximo código TOTP e entre. Contas existentes não são promovidas silenciosamente. Acesso ao banco/CLI deve ser restrito à operação da plataforma. Sem bootstrap, o cadastro mostra corretamente que não existem escolas disponíveis.

## Verificar

```powershell
pnpm db:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm security:scan
pnpm security:audit
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Integração e E2E recusam bancos que não sejam locais e dedicados com nome terminado em `_test`. `pnpm db:migrate:test` usa `TEST_DATABASE_URL`. E2E inicia seu próprio Next na porta 3100 e gera/remove apenas suas próprias fixtures. Não há limpeza global do banco.

`pnpm maintenance` remove apenas sessões/tokens/rate limits expirados e informa a quantidade de e-mails com cinco falhas. Programe essa manutenção na infraestrutura. O worker tenta entregar em até cinco tentativas com backoff; após isso, a operação deve investigar SMTP e o usuário solicitar novo link.

## Documentação

- [Arquitetura](ARCHITECTURE.md) e [decisões](docs/decisions/0001-foundation.md).
- [Banco e migrações](DATABASE.md), [API](API.md), [segurança e operação](SECURITY.md).
- [Revisão desta etapa](docs/security-reviews/2026-11-18-foundation.md), [contribuição](CONTRIBUTING.md), [histórico](CHANGELOG.md).

CI está configurada em `.github/workflows/`. Sua execução remota e regras de proteção só podem ser verificadas após conectar este diretório a um repositório GitHub. Nenhum repositório remoto ou publicação foi criado.
