# Desenvolvimento da plataforma CETI

O princípio do produto é: **Tudo em um só lugar. Simples para todos.**

## Antes de alterar

- Inspecione código, documentação, dependências e estado do banco afetados. Preserve implementações corretas.
- Trabalhe incrementalmente. Não apresente módulos ausentes, dados simulados ou testes não executados como funcionalidades reais.
- Identifique endpoints, dados, perfis, escolas e superfícies de ataque afetados por cada mudança.

## Segurança em todas as tarefas

- Autorize operações no servidor. Nunca aceite perfil de gestor, schoolId ou userId como prova de autorização.
- Separe estado da conta e estado do vínculo. Exija conta ativa, e-mail confirmado, vínculo aprovado e MFA de gestor nas operações administrativas.
- Escopo escolar obrigatório em consultas de dados escolares. Teste IDOR entre escolas e acesso por perfil.
- Use Zod com objetos estritos, limites de corpo e queries parametrizadas. Não use SQL inseguro ou HTML não sanitizado.
- Preserve origem/CSRF, CSP por nonce, cookies HttpOnly/Secure/SameSite, expiração, revogação e rate limiting compartilhado.
- Nunca registre senhas, tokens, códigos MFA, segredos SMTP, corpos de requisição ou dados pessoais em logs. Não comite `.env`, `.local` ou caixas de e-mail.
- Mensagens privadas não entram em análises acadêmicas. Dificuldades individuais só podem ser vistas por profissionais com vínculo pedagógico autorizado.
- Revise OWASP Top 10/ASVS proporcionalmente: injeção, XSS, CSRF, autenticação, IDOR, mass assignment, SSRF, arquivos, WebSockets, dependências e concorrência, conforme a superfície existente.
- Corrija riscos críticos/altos identificados. Consulte alertas e compatibilidade antes de instalar ou atualizar pacotes; atualize o lockfile e repita os testes afetados.

## Verificação e documentação

- Execute `pnpm db:generate`, `pnpm db:validate`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm security:scan`, `pnpm security:audit`, `pnpm build` e E2E quando afetados.
- Integração/E2E só usam `TEST_DATABASE_URL` apontando para banco local dedicado com nome terminado em `_test`. Nunca limpe bancos de produção.
- Registre resultados reais e limitações em `docs/security-reviews/`; mantenha README, ARCHITECTURE, DATABASE, API, SECURITY e CHANGELOG atualizados.
- Ao concluir, relate A: implementação/arquivos; B: testes executados e pendentes; C: segurança e riscos; D: compatibilidade/banco/dependências; E: próxima etapa.
- Nunca declare segurança absoluta ou prontidão para produção só por aparência, build ou testes passarem.

## Operação

- Não faça deploy em produção sem aprovação explícita do usuário.
- Não altere destrutivamente dados de produção sem autorização, migração revisada, backup e plano de recuperação.
- Documente a necessidade de infraestrutura, configuração institucional de privacidade, monitoramento e testes de restauração antes de liberar dados reais de estudantes.
