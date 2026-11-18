# Histórico

## 0.1.0 — 2026-11-18

- Criado monorepositório pnpm em diretório inicialmente vazio.
- Implementados identidade, e-mail, MFA de gestores, sessões, recuperação, vínculos escolares e gestão de acessos.
- Dashboard responsivo com dados persistentes e estados vazios reais.
- PostgreSQL/Prisma com migrações, outbox transacional, rate limiting e auditoria.
- Infra local Docker e alternativa PostgreSQL/SMTP no Windows, sem fixtures na aplicação.
- Testes de autorização, concorrência, segurança HTTP e fluxos no navegador.
- Configuração de CI, scanners e documentação permanente.
- Auditoria encontrou dependência transitiva vulnerável no Prisma 6.19.3; atualização avaliada para Prisma 7.10.1 e adapter PostgreSQL, com nova rodada de verificações.
- Corrigida discrepância real de fuso horário de expiração/outbox com timestamptz e conexões UTC; adicionada regressão.
- Auditoria axe identificou link dependente de cor; corrigido com sublinhado e revalidado.
- Gitleaks local executado com checksum oficial; única detecção era vetor público RFC 6238, marcado por exceção restrita à linha do teste.
- Nenhuma publicação, recurso remoto ou migração de banco de produção realizada.
