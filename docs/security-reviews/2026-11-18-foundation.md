# Revisão da fundação — 2026-11-18

Escopo: primeira etapa funcional solicitada. Revisão técnica proporcional de código novo; não é pentest nem certificação de produção.

## A. Implementação e diagnóstico

Inspeção inicial encontrou diretório vazio, sem código, Git, dependências ou banco existentes. Não havia vulnerabilidades de código anterior a relatar nem módulos a recriar. Ambiente: Windows, Node 24.15.0, pnpm 11.25.0. Docker CLI disponível, daemon indisponível mesmo após tentativa de inicialização. O desenvolvimento prosseguiu com PostgreSQL real local e SMTP de loopback.

Criados:

- Configuração: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, TypeScript estrito, ESLint, Vitest, Playwright, Compose, `.env.example` e arquivos de ignore.
- Banco: `prisma.config.ts`, `packages/database/src/index.ts`, schema e três migrações versionadas.
- Identidade: `apps/web/src/modules/identity/` com cadastro, verificação, login, sessões, MFA, recuperação, outbox e transporte SMTP.
- Segurança: `apps/web/src/modules/security/` com configuração validada, Argon2id/AES-GCM/TOTP, fronteira HTTP, erros sem detalhes sensíveis e rate limiting no PostgreSQL.
- Escolas: `apps/web/src/modules/schools/service.ts` com solicitações, escopo escolar, decisões e auditoria.
- UI/API: `apps/web/src/app/`, `src/components/`, `src/proxy.ts`, layouts responsivos e operações reais; nenhum dado de demonstração no banco da aplicação.
- Operação: `scripts/bootstrap.ts`, `email-worker.ts`, `maintenance.ts`, serviços locais, scanners e gate SARIF.
- Qualidade: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `.github/workflows/`, Dependabot, Gitleaks e documentação permanente/AGENTS.

Versões finais: Next 16.4.6, React 19.3.1, Prisma/client/adapter 7.10.1, TypeScript 6.0.3, Tailwind 4.3.5, Vitest 5.1.0 e Playwright 1.65.1. Dependências diretas fixadas e lockfile reconciliado. ESLint 9.39.5 mantido pelas faixas declaradas dos plugins Next; descontinuação documentada como dívida de compatibilidade. Wrapper PostgreSQL 18.6.0-beta.19 é exclusivamente de desenvolvimento; Compose/CI usam PostgreSQL 17.

## B. Verificações executadas

| Verificação | Evidência / resultado |
| --- | --- |
| Instalação congelada | `pnpm install --frozen-lockfile` concluída; lockfile consistente |
| Compatibilidade | `pnpm peers check`: nenhuma incompatibilidade final |
| Prisma | generate, validate e migrate deploy executados; três migrações em `ceti` e `ceti_test` locais |
| Divergência de schema | `prisma migrate diff --from-config-datasource --to-schema ... --exit-code`: sem diferenças |
| TypeScript | Aplicação e scripts/testes verificados em modo estrito |
| Lint | ESLint executado; avisos de export e caminho de monorepositório corrigidos |
| Unitários | 9 testes: Argon2id, tokens, cifra autenticada, vetor TOTP RFC 6238, replay, validação, mass assignment, escopo, CSRF e tamanho/JSON |
| Integração | 12 testes em PostgreSQL e SMTP reais, incluindo CLI real via stdin; sem mocks do banco ou transporte |
| Navegador | 2 cenários Playwright/Chromium: MFA, decisão administrativa persistida, perfil aluno, revogação e autorização HTTP; cadastro móvel, largura e CSRF/cabeçalhos |
| Acessibilidade | axe 4.14.0 com tags WCAG A/AA até 2.2 em login, dashboard e cadastro móvel; falha observada de link dependente de cor corrigida e reexecutada |
| Revisão visual | Capturas de login desktop, cadastro em 390px e dashboard com fixtures explicitamente de teste, inspecionadas; ficam em `.local/screenshots/` |
| Scanner local | `security-scan.mjs` sem ocorrências nas regras configuradas |
| Gitleaks | 8.30.0 oficial, download verificado contra checksum SHA-256; varredura de fontes com redaction, sem vazamentos após exceção específica de vetor público RFC |
| Dependências | Auditoria npm via pnpm reexecutada após correção; zero advisories retornados nessa execução |
| Produção local | Build Next executado sem publicação; todas as rotas renderizadas dinamicamente para CSP com nonce |

Integração cobre: cadastro → entrega SMTP → confirmação → aprovação; duplicidade e respostas genéricas; MFA obrigatório/antirreplay; recuperação atômica e revogação; tokens expirados/contas suspensas; isolamento entre escolas; UPSERT concorrente de rate limits; decisões concorrentes; expiração sob servidor inicialmente em fuso -03; retries/backoff/limite de entrega; revogação de gestor com sessão já lida; workers concorrentes; provisionamento atômico sem eco de segredos.

**Pendentes:** execução dos workflows GitHub/CodeQL e varredura do histórico remoto; proteção real de branches e alertas; teste de PostgreSQL no Docker nesta máquina; pentest externo; carga; navegação assistiva manual e auditoria WCAG completa; SMTP real externo; backup/restauração de produção. Há configuração, mas não se declara execução dessas verificações. Esta entrega não tem remoto nem deploy.

## C. Segurança: achados e correções

1. **Dependência com severidade alta:** Prisma 6.19.3 trazia `deepmerge-ts@7.1.5`, apontado por `GHSA-ggr8-5vv4-36mx` (exaustão de stack). Compatibilidade avaliada e cadeia atualizada para Prisma 7.10.1, config de migração e adapter PostgreSQL. Cadeia final usa deepmerge-ts 8.0.2; nova auditoria retornou zero alertas.
2. **Expiração e outbox com fuso incorreto:** teste SMTP falhou porque datas sem offset eram interpretadas no fuso do servidor (-03), adiando jobs e potencialmente a expiração de tokens. Correção em migração aditiva para timestamptz e pool forçando UTC. Adicionado teste de token expirado há um segundo e de configuração UTC; fluxo SMTP real passou. Schema sem divergência após migração.
3. **CSP e prerenderização:** build inicial mostrou páginas estáticas. Com nonce por requisição, isso impediria execução coerente de scripts. Renderização dinâmica foi aplicada à raiz e confirmada no build. Proxy não decide autorização; serviços e rotas fazem a verificação.
4. **Entrega de e-mail na resposta pública:** substituída por outbox transacional e worker, reduzindo diferenças de tempo por existência da conta e permitindo retries reais. Respostas públicas não prometem entrega SMTP. Payload cifrado removido após entrega; token continua de uso único.
5. **Concorrência do worker:** lote limitado processado em paralelo, com prazo total por transporte menor que o lease. Teste com dois workers confirmou uma entrega por lease ativo. Uma queda após aceite SMTP ainda pode duplicar e-mail, comportamento de entrega pelo menos uma vez documentado.
6. **Acessibilidade:** axe detectou link sem distinção além de cor. Adicionado sublinhado a links em parágrafos e repetidas verificações.
7. **Alerta de segredos falso positivo:** Gitleaks marcou o vetor **público** RFC 6238 no teste unitário. Exceção inline restrita àquela linha, com justificativa; nenhuma regra global de credenciais foi desativada. `.env.example` continua incluído na varredura.

Inspeção manual confirmou escopo por escola e usuário, validação estrita de perfil público, ausência de endpoint de criação de gestor, consultas parametrizadas, tokens não retornados por API, cookies protegidos, erros sem dados sensíveis, MFA antes de sessão administrativa, separação de conta/vínculo, revalidação de permissões e ausência de uploads/WebSockets/SSRF expostos nesta etapa. Os testes exercitam os controles principais; esta inspeção não garante ausência de falhas.

## D. Compatibilidade e banco

Não existiam módulos anteriores. Nenhuma operação foi realizada em banco de produção. Migrações: fundação, outbox e datas com fuso. Prisma 7 exigiu retirar URL do schema, criar `prisma.config.ts`, adicionar adapter-pg e ajustar criação dos clientes e testes. TypeScript 7 e ESLint 10 não foram mantidos porque a instalação revelou peers incompatíveis. Vitest recém-publicado foi bloqueado pela política de maturidade; versão anterior compatível usada. Não há overrides para mascarar advisories.

## E. Próxima etapa e riscos residuais

- Provisionar a escola/gestor reais com dados fornecidos pela instituição e confirmar domínio/SMTP de envio.
- Conectar o repositório remoto, executar CI/CodeQL, exigir checks e habilitar alertas/proteção de segredos.
- Acrescentar paginação completa, reativação auditada e procedimentos de recuperação MFA antes de ampliar a operação.
- Definir controlador, canal de privacidade, retenção, atendimento a responsáveis, monitoramento e recuperação testada antes de armazenar dados reais de estudantes.
- Implementar turmas/disciplinas e permissões pedagógicas antes de chat, feedback ou análises acadêmicas. Mensagens privadas não serão analisadas automaticamente.
- Resolver dívida de plugins/ESLint com uma atualização compatível, acompanhando avisos de segurança; remover wrapper beta de qualquer empacotamento de produção.

Não há declaração de segurança absoluta, conformidade jurídica ou prontidão para produção. Deploy exige aprovação explícita e atendimento dos requisitos operacionais documentados.
