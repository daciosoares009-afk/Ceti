# Arquitetura

## Estrutura

```text
apps/web/src/app/                Rotas App Router, páginas e API
apps/web/src/components/         Componentes reutilizáveis e formulários
apps/web/src/modules/identity/   Conta, sessões, MFA, tokens, outbox e e-mail
apps/web/src/modules/schools/    Escolas, solicitações e gestão de vínculos
apps/web/src/modules/security/   Configuração, criptografia, validação HTTP, limites
packages/database/              Cliente Prisma, schema e migrações
scripts/                        Provisionamento, worker, manutenção e verificações
tests/                          Unidade, integração e navegador
```

Serviços de domínio fazem autorização; esconder menus não concede nem remove direitos. API tem lista explícita de operações, validação estrita, limites de corpo, origem e rate limiting. Páginas protegidas consultam a sessão no servidor; resultados não são armazenados em cache compartilhado. Nonce CSP exige renderização dinâmica.

## Identidade

Conta global com e-mail único normalizado e status ACTIVE/SUSPENDED. `Membership` representa o perfil e o estado **por escola**. Cadastro só permite STUDENT/TEACHER. O operador provisiona gestores por CLI; e-mail e TOTP precisam ser verificados antes do acesso administrativo.

Sessão é token aleatório de 256 bits em cookie HttpOnly; banco contém SHA-256, prazo e comprovação MFA. Privilégios vêm dos vínculos atuais em cada requisição. Sessões duram 12 horas ou 2 horas para gestores, sem renovação automática. Troca de senha remove todas as sessões. Não há token em localStorage.

## E-mail

Cadastro e provisionamento persistem usuário, vínculo, token e job na mesma transação. Token fica em hash, com cópia temporária cifrada na outbox necessária para entrega. Worker lê até dez jobs com `SKIP LOCKED`, lease de 2 minutos e cinco tentativas com backoff. Processa o lote em paralelo limitado e fecha cada transporte SMTP após prazo total de 45 segundos, evitando que o último job aguarde além do lease. A cópia cifrada é removida na entrega; consumo/expiração do token elimina jobs por cascata. Entrega é pelo menos uma vez: uma falha depois do aceite SMTP pode repetir o mesmo e-mail, mantendo o token de uso único.

Links usam fragmento da URL, não query string. A página limpa o fragmento e só consome o token em POST explícito, evitando consumo por scanners de e-mail e exposição em access logs.

## Banco e concorrência

PostgreSQL com Prisma 7 e adapter `pg`, pool limitado por processo, constraints, índices e migrações SQL. Datas usam `timestamptz`; toda conexão de runtime força UTC e limites de 15s para statements/transações ociosas. Isso é necessário porque o adapter serializa datas sem offset. Queries raw são templates parametrizados. Consumo de token é `DELETE RETURNING` transacional. Aprovações bloqueiam vínculos do gestor/alvo em ordem estável. Rate limiting usa UPSERT atômico compartilhado. Login verifica novamente a conta sob lock antes de criar sessão, impedindo uma senha já trocada de abrir sessão numa corrida.

## Evolução planejada

Próximos módulos usam serviços de domínio próprios: turmas/disciplinas e vínculo pedagógico antes de chat/feedback. Socket.IO será serviço Node separado com autenticação, autorização por operação e persistência. Inteligência acadêmica começa por etiquetas/regras e conteúdos autorizados, sem conversas privadas. Não há serviço de IA, Socket.IO ou upload exposto nesta etapa.
