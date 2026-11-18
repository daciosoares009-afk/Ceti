# ADR 0001 — Fundação modular e identidade escolar

Data: 2026-11-18. Estado: adotada para a etapa inicial.

## Diagnóstico antes do código

O diretório de trabalho estava vazio, sem Git, aplicações, dependências, dados ou configurações. Não havia funcionalidade anterior para preservar nem código existente para auditar. Node 24.15 e pnpm 11.25 estavam disponíveis. Docker CLI estava instalado, mas o daemon não iniciou. A alternativa local usa PostgreSQL real e SMTP de loopback, sem simular persistência.

## Plano incremental

1. Fundação: configuração, identidade, e-mail, aprovação, permissões, dashboard, banco, testes e CI (esta entrega).
2. Turmas, disciplinas e atribuições pedagógicas; autorização e isolamento por turma/disciplina.
3. Comunidade acadêmica, atividades, materiais e calendário com controles de upload.
4. Chat persistente com Socket.IO separado, autorização por conversa e controles de moderação.
5. Feedback e acompanhamento privado autorizado; inteligência por etiquetas/regras somente sobre conteúdo acadêmico permitido.
6. Hardening operacional, acessibilidade independente, carga, restauração e liberação institucional de privacidade antes de produção.

## Escolhas

- Next.js App Router e serviços Node por domínio no monorepositório, PostgreSQL, Prisma, tipos estritos e Zod.
- Autenticação própria pequena com sessões opacas em vez de Auth.js. O domínio exige confirmação, múltiplos vínculos, aprovação por escola e MFA de gestor verificados no servidor. Isso evita depender de callbacks genéricos para controles essenciais, mas aumenta a responsabilidade de revisão da identidade; testes de regressão são obrigatórios.
- Argon2id nativo, TOTP RFC 6238 e AES-GCM. Gestores por CLI sem endpoint público, sem credenciais padrão.
- Outbox no PostgreSQL: sem serviço externo de fila nesta etapa. Entrega eventual com backoff; falhas não são ocultadas por respostas de sucesso simuladas de SMTP.
- Base shadcn de botão via CVA, inputs sem abstrações excessivas e React Hook Form. Validação Zod usada nos dois lados; servidor é autoridade.
- Visual Swiss, branco/cinza neutro/azul #002FA7, sans-serif, grade com linhas. Dados vazios ficam vazios; nenhum aluno, escola ou indicador fictício na aplicação.
- Prisma 6.19.3 foi inicialmente avaliado por compatibilidade. A auditoria encontrou GHSA-ggr8-5vv4-36mx em deepmerge-ts 7.1.5. Migração deliberada para Prisma 7.10.1: URL em `prisma.config.ts`, adapter-pg, engine client e revisão dos construtores/testes. Nenhuma migração destrutiva decorre da mudança do ORM.

## Fontes consultadas

- Registro npm via `npm view`: engines, peers e versões de Next, React, Prisma, TypeScript, Vitest, ESLint e autenticação; lockfile registra os pacotes efetivos.
- [Guia oficial Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).
- [Política oficial Next](https://nextjs.org/support-policy) e [atualizações de segurança](https://nextjs.org/blog).
- [Advisory encontrado](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- Documentação oficial dos repositórios de ações GitHub, com referências resolvidas antes de configurar CI.

## Consequências

Sem implementação antecipada de chat, IA ou módulos acadêmicos. As permissões futuras precisam representar vínculo pedagógico explícito. Nenhum indicador de dashboard deve sugerir existência desses dados. Liberação de produção depende de operação, privacidade, revisão e aprovação explícita; build/testes não substituem esses requisitos.
