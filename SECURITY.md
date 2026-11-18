# Segurança e operação

## Controles implementados

- Argon2id (64 MiB, três iterações, paralelismo 1), senha de 12–128 caracteres no cadastro/reset.
- Tokens aleatórios de 256 bits; hashes SHA-256 no banco. Cópia temporária de token de e-mail cifrada por AES-256-GCM na outbox, com chave derivada por contexto. Segredo TOTP cifrado; verificação com janela de ±30s e contador antirreplay atômico.
- Gestor só por provisionamento operacional com prova TOTP e confirmação de e-mail. Sem promoção pública.
- Cookies de produção `__Host-ceti-session`, HttpOnly, Secure, SameSite=Lax e path raiz. Sessões expiram e são revogáveis; sem armazenamento de tokens no navegador fora do cookie.
- Autorização por conta/vínculo/escola em serviços; MFA de sessão para gestores; revalidação em toda requisição.
- Origem exata, JSON obrigatório e proteção por método contra CSRF; sem CORS permissivo.
- CSP por nonce e páginas dinâmicas; sem `unsafe-eval` em produção. Style-src permite inline por compatibilidade de renderização. Frame-ancestors none, base-uri none, object-src none, HSTS em produção, nosniff, no-referrer e permissões de câmera/microfone/localização desativadas.
- Validação Zod no servidor, SQL parametrizado e bloqueios transacionais de decisões, tokens e login.
- Rate limiting distribuído em PostgreSQL e respostas genéricas para solicitações de e-mail; envio SMTP assíncrono evita dependência do tempo de entrega na resposta pública.
- Auditoria de login, recuperação, verificação, logout/revogação, consulta e decisão sobre vínculos. Logs técnicos registram apenas eventos/categorias/contagens; logs de query Prisma desabilitados.
- Sem upload, fetch de URLs arbitrárias, WebSocket, processamento de mensagens privadas ou IA expostos nesta etapa.

## Configuração de produção obrigatória

1. HTTPS na origem e no proxy; `APP_URL` com origem HTTPS única. O proxy deve redirecionar HTTP antes de encaminhar. A aplicação recusa operações sensíveis em produção com origem HTTP.
2. SMTP com TLS (`SMTP_SECURE=true`), usuário/senha e domínio remetente autorizados; SPF/DKIM/DMARC pela operação. Não reutilizar a caixa local.
3. Banco privado com TLS e validação do certificado na conexão PostgreSQL. Não usar `sslmode=no-verify`. Usuário de runtime sem DDL, proprietário/migração separado e credenciais em gerenciador de segredos.
4. Chave MFA aleatória distinta em cada ambiente, guardada fora do banco e dos logs. Rotação exige recifrar segredos/jobs de forma coordenada; não substituir a chave sem plano de recuperação.
5. Processos separados para aplicação, worker e manutenção agendada. Monitorar falhas SMTP, jobs após cinco tentativas, indisponibilidade, 5xx e mudanças administrativas. Logs de proxy/APM precisam remover query strings, cookies e corpos.
6. `TRUST_PROXY=false` é o padrão conservador. Só habilitar quando o proxy remover/substituir x-forwarded-for e a origem não puder ser alcançada diretamente. O limite de contas pode ser abusado para bloqueio temporário; monitorar tentativas e revisar conforme o tráfego real.
7. Configurar backups cifrados, restauração testada, retenção institucional de auditoria/dados e atendimento a titulares/responsáveis. Revisão jurídica/institucional e canal LGPD ainda pendentes; esta documentação técnica não atesta conformidade legal.
8. Habilitar regras de proteção de branch, revisão obrigatória, status de qualidade/segurança, Dependabot, secret scanning e proteção de push quando disponíveis. Não existe pipeline de deploy automático.

## Limitações conhecidas desta etapa

- Sem pentest externo, auditoria WCAG completa, teste de carga, análise jurídica LGPD, MFA self-service/recovery codes ou monitoramento externo configurado.
- Contas pessoais podem alterar senha e revogar sessões; edição/exclusão/retificação é procedimento institucional ainda sem interface operacional.
- Logs de auditoria residem no mesmo banco; exportação imutável e política de retenção devem ser definidas antes de produção.
- Sem RLS PostgreSQL: isolamento está na autorização dos serviços e é coberto por testes. Novos módulos precisam manter escola/turma/disciplina no escopo.
- Gestão limitada a 50 registros por lista; sem paginação completa. Reativação e recurso de recusa/suspensão não expostos.
- Wrapper PostgreSQL beta é dependência de desenvolvimento; produção usa PostgreSQL gerenciado/estável. ESLint 9 foi mantido por compatibilidade declarada dos plugins Next; a linha está descontinuada e exige acompanhar atualização compatível. Nenhuma exceção de auditoria é configurada para esconder vulnerabilidades.
- O scanner JavaScript local é intencionalmente limitado a padrões conhecidos. Gitleaks 8.30.0 também foi executado localmente, com binário oficial e checksum SHA-256 validado; CodeQL está configurado, mas sua execução remota permanece pendente. Nenhum deles substitui revisão humana ou garante ausência de vulnerabilidades.

## Relatar uma vulnerabilidade

Não publique dados de estudantes, tokens ou credenciais. Envie um relato privado ao operador/administrador da instalação, com endpoint, pré-condições e passos sem dados reais. O responsável precisa configurar um canal institucional antes de convidar usuários reais. O repositório não tem canal de suporte externo provisionado.
