# Contribuir

Leia AGENTS.md, ARCHITECTURE.md e SECURITY.md antes de alterar o sistema. Desenvolva em ambiente local separado, sem dados reais de estudantes e sem copiar segredos de produção.

Para cada alteração:

1. Descreva comportamento, perfis, escolas, endpoints e dados afetados.
2. Implemente em serviço de domínio reutilizável; valide toda entrada e autorize no servidor.
3. Adicione testes de comportamento relevantes, incluindo abuso de permissão/isolation quando aplicável.
4. Execute checks de tipos, lint, testes afetados, audit e build. Mudanças de banco usam nova migração, sem editar migração já aplicada.
5. Atualize documentação, CHANGELOG e revisão de segurança com evidências e riscos reais.
6. Abra uma revisão com resultados, limites e plano de implantação/retorno. Não faça deploy sem autorização explícita.

Instalação reproduzível: `pnpm install --frozen-lockfile`. Atualizações deliberadas precisam verificar versões/peer dependencies, manter o lockfile e repetir a auditoria. Evite alterar versões principais sem analisar incompatibilidades. Dependabot propõe alterações; não há auto-merge.

CI deve ser status obrigatório na branch principal. Como não há remoto configurado nesta etapa, regras do servidor GitHub não foram aplicadas. Configure os checks `quality` e `codeql` e o limiar crítico/alto na política de code scanning antes do primeiro deploy.
