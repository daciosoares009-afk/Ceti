# API HTTP da fundação

Todas as respostas são JSON com `Cache-Control: no-store`. Erros: `{ "message": "texto compreensível" }`, sem stack, SQL, tokens ou detalhes SMTP. Não há CORS de terceiros.

POST exige `Origin` idêntica à origem de `APP_URL`, `Content-Type: application/json` e corpo de até 16 KiB. Cookies são enviados no mesmo domínio. Objetos são estritos: campos desconhecidos causam 400. UUIDs e tokens são validados antes dos serviços. Nenhum endpoint público aceita papel de gestor.

| Método / caminho | Entrada | Autorização / resultado |
| --- | --- | --- |
| GET `/api/schools` | — | Público, até 200 escolas ativas, apenas id/nome, limite por IP |
| POST `/api/auth/register` | name, email, password, schoolId, role STUDENT/TEACHER | Público; 202 genérico, conta pendente de confirmação e outbox persistida |
| POST `/api/auth/resend` | email | Público; 202 genérico para evitar enumeração |
| POST `/api/auth/forgot` | email | Público; 202 genérico e recuperação com prazo de 30 minutos |
| POST `/api/auth/verify` | token | Público; confirmação de uso único com prazo de 24h |
| POST `/api/auth/reset` | token, password | Público; uso único, revoga todas as sessões |
| POST `/api/auth/login` | email, password, code opcional | Conta ativa e verificada; gestores exigem TOTP; grava cookie, não retorna token |
| GET `/api/me` | — | Sessão; conta e próprios vínculos ativos/inativos de escolas ativas, sem hash/segredo MFA |
| POST `/api/auth/logout` | objeto vazio | Sessão; remove sessão atual e cookie |
| POST `/api/auth/revoke-sessions` | objeto vazio | Sessão; remove todas as sessões do usuário e cookie |
| POST `/api/memberships/join` | schoolId, role STUDENT/TEACHER | Sessão; cria vínculo PENDING_REVIEW; não altera vínculo existente |
| GET `/api/management?schoolId=UUID` | schoolId | Gestor aprovado da escola, MFA; listas limitadas de vínculos e auditoria |
| POST `/api/management/review` | schoolId, membershipId, decision | Gestor aprovado da escola, MFA; APPROVED/REJECTED para pendente, SUSPENDED para aprovado; alvo nunca gestor |

HTTP: 400 validação/token inválido; 401 sessão/credencial inválida; 403 origem/permissão; 404 alvo ausente ou fora da escola; 409 transição inválida; 413 corpo excessivo; 415 formato; 429 limite; 503 indisponibilidade/configuração. Mensagens de validação técnica podem vir do Zod; não contêm o valor recebido.

## Limites iniciais

- Mutações por IP: 120/minuto; usuário autenticado: 60/minuto.
- Cadastro: 10/IP a cada 15 minutos; ações de e-mail: 5/endereço a cada 15 minutos e 10/IP.
- Login: 50/IP e 10/endereço a cada 15 minutos.
- Consumo de token: 20/IP a cada 15 minutos; leitura autenticada: 120/usuário por minuto.
- Listagem pública: 60/IP por minuto. Na configuração direta, todas as conexões compartilham o mesmo bucket. Habilite `TRUST_PROXY` apenas se o proxy remover e substituir o cabeçalho de origem.

Gestão retorna no máximo 50 pendentes mais antigos, 50 aprovados recentes e 10 eventos. Paginação completa será adicionada antes de operar instituições com volume superior ao limite. A busca do painel filtra somente os nomes das escolas do próprio usuário. Avisos no topo refletem os estados dos vínculos; não são um sistema de notificações persistentes.
