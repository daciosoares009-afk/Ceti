# Banco de dados

PostgreSQL (Compose 17; alternativa local de teste 18), Prisma 7.10.1 e adapter PostgreSQL. Fonte: `packages/database/prisma/schema.prisma`; conexão de migração em `prisma.config.ts`. Migrações versionadas aplicadas por `pnpm db:migrate`; não usar `db push` em produção.

| Entidade | Finalidade e restrições |
| --- | --- |
| User | E-mail único normalizado, Argon2id, estado global, e-mail verificado, MFA cifrado e último passo TOTP |
| School | Slug único, nome público e ativação |
| Membership | Único por usuário/escola; perfil e estado independentes da conta; metadados de revisão |
| Session | Hash único do token; expiração, usuário e comprovação MFA |
| ActionToken | Hash único, propósito, validade; remoção atômica no consumo |
| EmailJob | Job único por token, payload cifrado, lease, tentativas e disponibilidade |
| RateLimit | Identificador hash, contador e expiração; atualização atômica |
| AuditEvent | Escola/ator/alvo por identificador, ação e horário; sem corpos, e-mails ou credenciais |

Estados do vínculo: `PENDING_EMAIL → PENDING_REVIEW → APPROVED ou REJECTED`; `APPROVED → SUSPENDED`. Não há reapresentação de vínculo rejeitado/suspenso nem reativação pela interface nesta etapa. Só a operação deve executar uma futura transição auditada e explicitamente autorizada; não alterar diretamente para contornar permissões.

A migração inicial cria tabelas e índices sem alterar registros preexistentes; a segunda acrescenta a outbox; a terceira converte datas para `timestamptz` com conversão explícita dos instantes. Foram aplicadas apenas em bancos locais criados nesta tarefa. O runtime força UTC no pool para evitar interpretação local de parâmetros pelo adapter. Antes de migrar dados legados externos, verificar sua semântica de fuso e testar a conversão em cópia restaurada. Exclusões de tokens/sessões/jobs são em cascata a partir do usuário; vínculos e auditoria de escolas têm restrições. Exclusão de uma pessoa requer procedimento institucional e avaliação dos registros que devem ser preservados/anonimizados.

`reviewedBy` e `actorId` são UUIDs de rastreabilidade sem FK para User, permitindo futura anonimização. Não implementar exclusão de histórico de auditoria como efeito colateral de exclusão de conta. O usuário de runtime deve ter DML nas tabelas necessárias, sem DDL; migrações usam credencial separada. Os scripts locais usam proprietário do banco apenas para desenvolvimento.

## Backup e recuperação

Antes de produção, configurar backups cifrados, retenção aprovada e restore em ambiente isolado. Exemplo operacional: `pg_dump --format=custom` com credencial de backup via mecanismo seguro, seguido de `pg_restore` em **banco novo**, aplicação de migrações e testes de integridade/autorização. Não fornecer senha em argumentos nem registrar connection strings. Guardar a chave MFA separada do backup; sem ela os segredos de MFA e jobs não podem ser recuperados.

Nenhum backup/restore de produção foi executado nesta etapa. O teste de restauração e os objetivos de recuperação precisam ser definidos pela instituição antes da liberação.
