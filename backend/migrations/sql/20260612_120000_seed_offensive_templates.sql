-- +goose Up
-- +goose StatementBegin
-- Seed: biblioteca de templates de engajamento ofensivo (red team / pentest) da Suricatoos.
-- Inseridos para usuarios super_admin (role_id = 1). Idempotente via NOT EXISTS por titulo.
INSERT INTO flow_templates (user_id, title, text)
SELECT u.id, v.title, v.text
FROM users u
CROSS JOIN (VALUES
  ($SCTPL$Pentest de Aplicação Web — OWASP WSTG Completo$SCTPL$, $SCTPL$## Objetivo
Conduzir um teste de invasão abrangente de uma aplicação web (e suas APIs de suporte), validando a postura de segurança de ponta a ponta sob a metodologia OWASP WSTG v4.2. O engajamento busca demonstrar, com evidência reproduzível, o impacto real de falhas de autenticação/sessão, controle de acesso, injeção, SSRF, deserialização, lógica de negócio, upload de arquivos e vulnerabilidades client-side — sempre priorizando o valor defensivo: para cada achado, entregar caminho de exploração comprovado e remediação acionável.

## Escopo & Autorização
- **NÃO inicie nenhuma atividade sem autorização por escrito** (Rules of Engagement assinadas), com escopo de hosts/domínios/URLs/APIs explicitamente listados, janelas de teste e contatos de emergência.
- Trate como **fora de escopo** qualquer host, subdomínio, integração de terceiros (gateways de pagamento, SSO externo, CDNs) ou ambiente de produção não autorizado explicitamente. Na dúvida sobre limites de escopo, **pare e peça confirmação**.
- **Evite dano e DoS**: não execute fuzzing agressivo, brute-force massivo, stress de recursos, nem payloads que possam corromper dados. Respeite rate limits e prefira ambiente de staging quando disponível.
- Diante de qualquer ação **destrutiva ou de alto impacto** (DROP/DELETE em SQLi, exclusão em massa via IDOR, deploy de webshell, alteração de dados reais de clientes, RCE confirmado), **interrompa imediatamente, documente a prova-de-conceito mínima não destrutiva e solicite confirmação** antes de prosseguir.
- Não exfiltre dados sensíveis reais (PII, credenciais, segredos): comprove acesso com amostra mínima ofuscada/redigida e registre apenas metadados suficientes para a evidência.
- Respeite leis aplicáveis (LGPD) e cláusulas de confidencialidade; mantenha logs de todas as ações para auditoria e rollback.

## Metodologia
Fases ordenadas, ancoradas em OWASP WSTG v4.2, OWASP API Security Top 10, PTES e NIST SP 800-115; mapeie técnicas relevantes ao MITRE ATT&CK.
1. **Information Gathering (WSTG-INFO)** — fingerprinting de servidor/framework, descoberta de superfície (subdomínios, endpoints, parâmetros), revisão de metafiles (robots.txt, sitemap), enumeração de tecnologias e mapeamento da aplicação.
2. **Configuration & Deployment Management (WSTG-CONF)** — headers de segurança, métodos HTTP, TLS, arquivos expostos, interfaces administrativas, tratamento de erros, configurações de cloud/storage.
3. **Identity & Authentication (WSTG-IDNT / WSTG-ATHN)** — enumeração de usuários, políticas de senha, fluxos de recuperação, MFA, credenciais default, bypass de autenticação.
4. **Session Management (WSTG-SESS)** — geração e entropia de tokens, atributos de cookie, fixation, logout/timeout, CSRF.
5. **Authorization (WSTG-ATHZ)** — IDOR/BOLA, escalonamento de privilégio horizontal e vertical, path traversal, bypass de controle de acesso.
6. **Input Validation & Injection (WSTG-INPV)** — SQLi, NoSQLi, XSS (refletido/armazenado/DOM), SSTI, command injection, LDAP/XML/header injection.
7. **Server-Side Threats** — SSRF, deserialização insegura, XXE, file inclusion.
8. **Business Logic (WSTG-BUSL)** — abuso de fluxos, manipulação de preço/quantidade, race conditions, contornos de workflow.
9. **File Upload & Client-Side (WSTG-BUSL/WSTG-CLNT)** — validação de upload, web shells (apenas PoC controlada), DOM-based issues, postMessage, CORS, clickjacking.
10. **Análise, validação e relatório** — confirmação de impacto, deduplicação, priorização por risco e recomendações.

## Técnicas & Ferramentas
- **Recon/Mapeamento**: nmap, httpx, subfinder/amass, ffuf/feroxbuster (wordlists controladas), katana/gau, Wappalyzer, Burp Suite (proxy/spider), nuclei (templates).
- **Auth/Sessão**: análise manual no Burp Repeater/Intruder (com throttling), avaliação de JWT (jwt_tool — verificação de alg/none, claims, expiração), testes de cookie e CSRF.
- **Autorização/IDOR**: comparação de respostas entre contas de teste (mín. dois usuários por perfil), Autorize/AuthMatrix, manipulação de identificadores e tokens.
- **Injeção**: sqlmap (modo conservador, sem `--os-shell`/dump massivo sem autorização), payloads manuais de XSS/SSTI (tplmap como apoio), validação de command injection com comandos benignos (ex.: identificadores de tempo/eco controlado).
- **SSRF/Deserialização/XXE**: canais OOB com colaborador/interactsh, inspeção de objetos serializados, payloads XXE de leitura limitada e não destrutiva.
- **Upload/Client-side**: testes de bypass de extensão/Content-Type/magic bytes com PoC mínima; análise de DOM e mensagens de console.
- Prefira **PoC não destrutiva**; toda ferramenta automatizada deve rodar com rate limiting e validação manual dos resultados (sem confiar cegamente em scanners).

## Entregáveis
- **Relatório executivo e técnico** com achados priorizados por risco (CVSS v3.1/v4.0 + contexto de negócio), incluindo sumário de exposição.
- Para cada achado: descrição, **passos de reprodução**, requests/responses ou capturas como **evidência/PoC reproduzível** (redigida quando contiver dados sensíveis), impacto e classificação.
- **Recomendações de remediação** específicas e priorizadas (curto/médio prazo), com referências a OWASP/WSTG e boas práticas de hardening.
- Inventário de superfície testada vs. não testada, limitações do engajamento e sugestão de re-teste pós-correção.
- Mapeamento dos achados para MITRE ATT&CK e OWASP Top 10 para apoiar a equipe de defesa.$SCTPL$),
  ($SCTPL$Pentest Focado — Controle de Acesso & APIs (IDOR/BOLA & Privilege Escalation)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em **falhas de controle de acesso** em uma aplicação web e suas APIs REST/GraphQL: validar isolamento entre tenants/usuários, ausência de IDOR/BOLA, e impossibilidade de escalonamento de privilégio horizontal e vertical. O objetivo é demonstrar, com evidência reproduzível e mínima exposição de dados, onde a autorização falha — e como corrigir — alinhado ao OWASP API Security Top 10 (API1:2023 BOLA, API5 BFLA) e WSTG-ATHZ.

## Escopo & Autorização
- Exigir **autorização por escrito** com escopo claro de endpoints/APIs, domínios e contas de teste provisionadas (idealmente múltiplos perfis: usuário comum, usuário de outro tenant, admin).
- **Não testar fora dos endpoints/identificadores autorizados.** Não pivotar para sistemas internos descobertos sem nova autorização — **pare e peça confirmação**.
- **Evitar dano/DoS**: nada de enumeração massiva de IDs que sobrecarregue o backend; use amostragem e rate limiting. Não modifique nem exclua dados de contas que não sejam as de teste controladas.
- Ao confirmar acesso indevido a dados de **terceiros reais**, **não exfiltre**: registre apenas a evidência mínima (ex.: um identificador e um campo redigido) que comprove o cross-tenant, **interrompa e reporte** antes de ampliar.
- Qualquer ação **destrutiva ou de alto impacto** (alteração de role real, deleção via IDOR, takeover de conta de terceiro) deve **parar e aguardar confirmação** explícita.

## Metodologia
Ancorada em OWASP WSTG-ATHZ, OWASP API Security Top 10 (2023) e PTES; controles mapeados a MITRE ATT&CK (ex.: Valid Accounts, Exploitation for Privilege Escalation).
1. **Mapeamento de papéis e fluxos** — documentar perfis, matriz de permissões esperada e todos os endpoints/objetos sensíveis (incl. GraphQL introspection quando autorizado).
2. **Baseline autenticado** — capturar requests legítimos por perfil para servir de referência.
3. **IDOR/BOLA (API1)** — substituir identificadores de objeto (IDs sequenciais, UUIDs vazados, slugs) entre contas e tenants; testar todos os verbos (GET/PUT/PATCH/DELETE).
4. **Privilege escalation vertical (BFLA/API5)** — acessar funções administrativas com token de baixo privilégio; testar endpoints não referenciados na UI.
5. **Privilege escalation horizontal** — acessar recursos de outro usuário do mesmo nível.
6. **Bypass de controle** — manipulação de parâmetros de role/flags, mass assignment (API3), parameter pollution, forced browsing, path traversal de autorização.
7. **Validação e impacto** — confirmar reprodutibilidade e mensurar alcance (quantos objetos/contas afetados, conceitualmente).

## Técnicas & Ferramentas
- **Mapeamento**: Burp Suite (sitemap), katana/gau para endpoints, GraphQL introspection + GraphQL Voyager, coleções Postman.
- **Testes de autorização**: extensões Autorize / AuthMatrix do Burp para diffing automático entre sessões; comparação manual de respostas (status, tamanho, conteúdo) entre perfis.
- **IDOR/BOLA**: Burp Repeater/Intruder com listas curtas e controladas de identificadores; ffuf para forced browsing de endpoints administrativos com wordlists moderadas.
- **Mass assignment / parameter tampering**: injeção de campos extras (ex.: `role`, `is_admin`) em payloads JSON e revalidação do efeito.
- **JWT/sessão**: jwt_tool para inspeção de claims e tentativa de manipulação de escopo/role (verificação de assinatura, não bypass cego).
- Toda automação com **rate limiting**; priorizar confirmação manual sobre saída de scanner.

## Entregáveis
- Lista de achados de controle de acesso **priorizados por risco** (CVSS + impacto de negócio: exposição de dados, takeover, fraude).
- **Matriz de autorização observada vs. esperada**, evidenciando cada quebra.
- Para cada achado: **PoC reproduzível** (request/response com dados de terceiros redigidos), conta/perfil usado, e alcance estimado.
- **Recomendações de remediação**: autorização server-side por objeto (deny-by-default), checagem de ownership/tenant, evitar IDs previsíveis, controle de função por endpoint, proteção contra mass assignment.
- Mapeamento para OWASP API Top 10 e WSTG-ATHZ, com sugestão de re-teste após correção.$SCTPL$),
  ($SCTPL$Pentest Focado — Injeção & Server-Side (SQLi, XSS, SSTI, SSRF, Deserialização)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em **falhas de validação de entrada e ameaças server-side** de uma aplicação web: SQLi/NoSQLi, XSS (refletido/armazenado/DOM), SSTI, command injection, SSRF, XXE e deserialização insegura. O objetivo é comprovar a presença e o impacto dessas classes de vulnerabilidade com **PoC controlada e não destrutiva**, fornecendo à equipe de desenvolvimento evidência e remediação acionáveis (WSTG-INPV / WSTG-CLNT e PTES).

## Escopo & Autorização
- Iniciar somente com **autorização por escrito** e escopo de URLs/parâmetros/APIs definidos; preferir **ambiente de staging** representativo para reduzir risco a dados de produção.
- **Não atuar fora do escopo**: SSRF que alcance metadados de cloud ou rede interna deve ser tratado com cautela máxima — comprovar a *capacidade* (ex.: callback OOB) e **parar antes de pivotar** para sistemas internos; pedir confirmação.
- **Evitar dano/DoS**: não usar payloads de SQLi destrutivos (DROP/DELETE/UPDATE em massa), não dumpar bases inteiras, não disparar fuzzing pesado. SQLi deve ser comprovada por inferência/booleana/time-based controlada ou leitura de versão/usuário do banco.
- Em **command injection / RCE / deserialização** que renda execução: validar com **comando benigno e idempotente** (ex.: eco de string única ou medição de tempo), **não** instalar webshell/persistência, **interromper e solicitar confirmação** antes de qualquer escalonamento.
- XSS armazenado: usar payloads **inócuos e auto-identificáveis** (ex.: `alert`/marcador único), nunca capturar sessões reais de usuários terceiros nem injetar conteúdo persistente que afete produção. Remover artefatos de teste ao final.
- Diante de exposição de dados sensíveis reais, **não exfiltrar**; registrar evidência mínima redigida e reportar.

## Metodologia
Ancorada em OWASP WSTG-INPV/WSTG-CLNT, OWASP Top 10 (A03 Injection), NIST SP 800-115; técnicas mapeadas a MITRE ATT&CK (ex.: Exploitation of Public-Facing Application, Server-Side Request Forgery).
1. **Descoberta de superfície de entrada** — enumerar parâmetros, headers, cookies, campos JSON/GraphQL, uploads e qualquer sink que reflita ou processe entrada do usuário.
2. **Injeção em banco** — SQLi/NoSQLi por inferência (booleana/time-based) e baseada em erro, com confirmação manual e payloads conservadores.
3. **Cross-Site Scripting** — refletido, armazenado e DOM-based; análise de contexto de saída (HTML/atributo/JS/URL) e bypass de filtros com marcadores inócuos.
4. **Template & Command Injection** — detecção de SSTI por expressões matemáticas controladas; command injection validada por temporização/eco benigno.
5. **Server-Side Request Forgery** — identificação de fetchers de URL; comprovação via canal OOB (interactsh) sem alcançar dados internos.
6. **XXE & Deserialização** — parsers XML (leitura limitada e não destrutiva) e endpoints que aceitam objetos serializados; comprovação de processamento inseguro sem payload de RCE persistente.
7. **Validação, deduplicação e classificação de impacto.**

## Técnicas & Ferramentas
- **Mapeamento de inputs**: Burp Suite (proxy/Repeater), katana para crawling, Param Miner para descoberta de parâmetros ocultos.
- **SQLi/NoSQLi**: validação manual + sqlmap em modo conservador (sem `--os-shell`, sem dump massivo; nível/risco baixos), confirmando apenas versão/usuário/uma linha de prova.
- **XSS**: payloads manuais por contexto, DOM Invader (Burp) para DOM-based, marcadores únicos para rastrear sinks.
- **SSTI**: expressões de teste por engine (Jinja2/Twig/Freemarker), tplmap apenas como apoio de detecção.
- **SSRF/XXE/OOB**: Burp Collaborator ou interactsh para callbacks; payloads de leitura limitada.
- **Deserialização**: inspeção de tokens/objetos (base64, gadgets conhecidos) com foco em *detecção*, não em weaponização.
- **Triagem em escala**: nuclei com templates específicos, sempre seguido de validação manual; toda automação com rate limiting.

## Entregáveis
- Achados **priorizados por risco** (CVSS + criticidade do dado/função afetada), separando confirmados de suspeitos.
- Para cada achado: parâmetro/endpoint, **payload mínimo de PoC**, request/response como **evidência reproduzível** (dados sensíveis redigidos), contexto de saída e impacto.
- **Recomendações de remediação** específicas: consultas parametrizadas/ORM seguro, output encoding contextual e CSP, sandbox/allowlist de templates, allowlist de destinos e bloqueio de IPs internos/metadados para SSRF, parsers XML com entidades externas desabilitadas, e substituição de deserialização insegura por formatos seguros.
- Confirmação de remoção de artefatos de teste (payloads armazenados) e sugestão de re-teste pós-correção, com mapeamento para OWASP Top 10 e WSTG.$SCTPL$),
  ($SCTPL$Pentest de APIs REST/GraphQL — OWASP API Security Top 10 (Abrangente)$SCTPL$, $SCTPL$## Objetivo
Validar de ponta a ponta a postura de segurança de uma API (REST e/ou GraphQL) contra o OWASP API Security Top 10 (2023), demonstrando, com evidência reproduzível, falhas de autorização (BOLA/IDOR, BFLA), autenticação quebrada, exposição excessiva de dados, mass assignment, ausência de rate limiting/controle de recursos, configuração indevida de segurança e fragilidades no manejo de tokens (JWT/OAuth2). O foco é provar impacto real ao negócio (acesso indevido a dados/funções de outros tenants ou usuários) e produzir recomendações de remediação acionáveis.

## Escopo & Autorização
- NÃO inicie qualquer atividade sem autorização por escrito (carta de autorização / Rules of Engagement assinada) identificando hosts, domínios, ranges de IP, endpoints base, ambientes (preferir staging/homologação) e janelas de teste permitidas.
- Restrinja-se estritamente ao escopo informado pelo usuário no momento do uso. Endpoints, subdomínios ou serviços de terceiros (gateways, IdPs externos, provedores de pagamento) fora do escopo estão proibidos, mesmo que descobertos durante o teste.
- Use exclusivamente contas/credenciais de teste fornecidas. Não exfiltre, não baixe em massa, nem armazene dados pessoais reais (PII/PHI/cardholder data); ao tocar dados sensíveis, registre apenas o mínimo necessário como evidência e mascare/redija o conteúdo.
- Evite dano e DoS: nenhum teste de stress/flood agressivo; ajuste concorrência e throttling; não execute ações destrutivas (DELETE/PUT em massa, exclusão de registros, alteração de configs de produção).
- PARE e peça confirmação humana antes de qualquer ação de alto impacto ou irreversível: escrita/edição/exclusão de dados de produção, alteração de permissões, criação de usuários privilegiados, disparo de webhooks externos, ou qualquer indício de acesso a dados de terceiros reais. Em caso de dúvida sobre impacto, pare e pergunte.
- Respeite dados de LGPD/contratos: nenhum dado coletado sai do ambiente de teste autorizado.

## Metodologia
Alinhada a PTES, OWASP API Security Top 10 (2023), OWASP WSTG v4.2 (seções aplicáveis) e NIST SP 800-115. Fases ordenadas:
1. Pré-engajamento & reconhecimento autorizado: coletar documentação (OpenAPI/Swagger, Postman collections, GraphQL SDL), identificar versões da API, esquemas de autenticação e papéis/funções (roles).
2. Mapeamento da superfície (enumeração de endpoints, métodos, parâmetros, schema GraphQL via introspection quando habilitada).
3. Autenticação & gestão de sessão/token: validar fluxos de login, refresh, logout, expiração e robustez de JWT/OAuth2 (API2:2023).
4. Autorização objeto a objeto e função a função: BOLA/IDOR (API1:2023) e BFLA (API5:2023) entre usuários e entre tenants.
5. Exposição de dados & manipulação de propriedades: excessive data exposure e mass assignment (API3:2023).
6. Consumo de recursos & limites: rate limiting, paginação, paginação profunda, query depth/complexity em GraphQL (API4:2023).
7. Configuração & cabeçalhos: CORS, métodos HTTP permitidos, verbosidade de erros, headers de segurança (API8:2023); inventário/versões obsoletas (API9:2023); SSRF via parâmetros de URL (API7:2023, validação cuidadosa e sem alcançar metadados de cloud sem autorização explícita).
8. Mapeamento ATT&CK quando aplicável (ex.: T1190 Exploit Public-Facing Application, T1078 Valid Accounts) para contextualizar técnicas defensivas.
9. Consolidação, validação cruzada e priorização por risco.

## Técnicas & Ferramentas
- Reconhecimento/descoberta: importar OpenAPI/Swagger e coleções no Burp Suite/OWASP ZAP; descoberta de endpoints e versões com ffuf/feroxbuster (wordlists de API), katana; nuclei com templates de exposições e misconfigs.
- Proxy & manipulação: Burp Suite (Repeater, Intruder de baixa intensidade, extensões Autorize/AuthMatrix para BOLA/BFLA), mitmproxy.
- BOLA/IDOR & BFLA: troca de identificadores de objeto (numéricos, UUIDs, slugs) entre duas contas/tenants; matriz de autorização role x endpoint; comparação de respostas autenticadas vs. trocadas.
- JWT/OAuth2: inspeção e teste com jwt_tool e decoders; checar alg:none, confusão de algoritmo (RS256→HS256), assinatura ausente/fraca, claims (exp, aud, iss, sub, scope), kid injection, segredos fracos; validar PKCE, redirect_uri e escopos em OAuth2/OIDC.
- Excessive data exposure & mass assignment: diff de campos retornados vs. necessários; injeção de propriedades extras (ex.: isAdmin, role, account_id) em payloads JSON e verificação de persistência server-side.
- Rate limiting & recursos: medir presença/ausência de limites com bursts controlados e de baixo volume; testar paginação e limites de tamanho; em GraphQL, query depth, aliasing e batching (sem flood).
- GraphQL: introspection (graphql introspection query, clairvoyance quando introspection desabilitada), InQL/GraphQL-cop/graphql-cop para detectar batching, CSRF, field suggestions; verificar autorização por field e por resolver.
- Injeções correlatas (quando indicado e autorizado): sqlmap apenas em parâmetros suspeitos e de baixo risco, com flags conservadoras; NoSQL/operadores em filtros JSON.
- Toda automação com concorrência limitada e respeito a janelas; nada de armamento/payloads destrutivos ou malware.

## Entregáveis
- Relatório executivo + técnico com achados priorizados por risco (CVSS v3.1/v4.0 e classificação OWASP API Top 10), incluindo impacto ao negócio por tenant/usuário.
- PoC reproduzível para cada achado: requisições HTTP completas (sanitizadas), passos exatos, contas/roles usadas, e diffs de resposta evidenciando o acesso indevido — com dados sensíveis mascarados.
- Matriz de autorização (usuário/role x endpoint/objeto) destacando violações de BOLA/BFLA.
- Recomendações de remediação concretas: enforcement de autorização server-side por objeto e função, validação de allow-list de propriedades (contra mass assignment), retorno mínimo de campos (schemas de saída/serializers), rate limiting e cost analysis em GraphQL, hardening de JWT (validação de assinatura/alg/claims, rotação de chaves), CORS restritivo e supressão de erros verbosos, governança de inventário/versões.
- Recomendações de detecção/monitoramento (logging de tentativas de autorização negada, alertas de enumeração) para reforço defensivo.
- Retest plan para validação das correções.$SCTPL$),
  ($SCTPL$Teste Focado de Autorização em API — BOLA/IDOR & BFLA Multi-Tenant$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em validar o controle de autorização de uma API multi-tenant/multiusuário, provando (ou refutando) a existência de Broken Object Level Authorization (BOLA/IDOR — API1:2023) e Broken Function Level Authorization (BFLA — API5:2023). A meta é demonstrar, com evidência reproduzível, se um usuário consegue ler/alterar objetos de outro usuário/tenant ou invocar funções administrativas sem privilégio, e quantificar o impacto.

## Escopo & Autorização
- Exija autorização por escrito (RoE assinada) e escopo explícito: base URLs, endpoints/recursos no escopo, ambiente (preferencialmente staging), e PELO MENOS dois pares de contas de teste por papel relevante (ex.: dois usuários comuns em tenants distintos, mais uma conta de privilégio elevado) fornecidas pelo cliente.
- Restrinja-se aos endpoints e tenants autorizados. Não pivote para outros serviços, subdomínios ou objetos de clientes reais.
- Trabalhe somente com dados sintéticos/de teste. Se um acesso cruzado expuser dados reais de terceiros, PARE imediatamente, não copie o conteúdo, registre apenas o identificador/evidência mínima mascarada e reporte ao ponto de contato.
- Evite dano: priorize operações de leitura (GET) para provar BOLA; só teste escrita (POST/PUT/PATCH/DELETE) com objetos de teste descartáveis. NUNCA exclua/altere objetos cuja origem/proprietário não esteja claramente sob controle do teste.
- PARE e peça confirmação humana antes de qualquer escrita que possa afetar dados de produção ou de outro tenant, antes de escalar privilégios de forma persistente, e diante de qualquer ação irreversível. Em dúvida sobre impacto, pare e pergunte.

## Metodologia
Alinhada a OWASP API Security Top 10 (2023), OWASP WSTG v4.2 (Authorization Testing) e PTES:
1. Modelagem de papéis e objetos: mapear roles, tenants e tipos de objeto (e seus identificadores: IDs sequenciais, UUIDs, slugs, hashes).
2. Baseline autenticado: para cada conta, capturar requisições legítimas e respostas esperadas (linha de base por usuário/tenant).
3. Teste horizontal (BOLA/IDOR): substituir identificadores de objeto da conta A por objetos da conta B (e entre tenants), em todos os métodos suportados, comparando respostas.
4. Teste vertical (BFLA): acessar endpoints/funções administrativas ou de outro papel usando token de papel inferior; testar métodos HTTP não documentados (ex.: PUT/DELETE onde só GET é esperado) e endpoints "ocultos".
5. Variações de canal: identificadores em path, query string, corpo JSON, headers (ex.: X-Tenant-Id), e cookies; testar IDs em lote/arrays e em sub-recursos aninhados.
6. Validação cruzada e descarte de falsos positivos (confirmar com a segunda conta).
7. Priorização por impacto (leitura vs. escrita, sensibilidade do dado, abrangência multi-tenant).

## Técnicas & Ferramentas
- Captura e replay: Burp Suite / OWASP ZAP como proxy; importar OpenAPI/Swagger e coleções Postman para cobertura completa de endpoints.
- Automação de autorização: extensões Burp Autorize e AuthMatrix para comparar respostas entre sessões/roles automaticamente; matriz role x endpoint x objeto.
- Enumeração controlada de IDs: para IDs sequenciais, varredura de baixo volume e com throttling; para UUIDs, usar IDs reais coletados das contas de teste (sem brute force massivo).
- Descoberta de funções ocultas: ffuf/feroxbuster com wordlists de API e verbos HTTP; revisão de JS/SPA para rotas e endpoints não documentados.
- GraphQL (se aplicável): testar autorização por field/resolver, acessar nós por id de outro tenant, abusar de aliasing/batching para múltiplos objetos; InQL/graphql-cop para mapear o schema.
- Evidência: scripts/coleções reproduzíveis (curl/Postman) que demonstrem o acesso cruzado de forma determinística, com dados sensíveis mascarados.
- Sem payloads destrutivos, sem flood, sem armamento de malware.

## Entregáveis
- Achados priorizados por risco (CVSS + OWASP API1/API5:2023), separando violações horizontais (BOLA) e verticais (BFLA), com indicação de leitura vs. escrita e alcance multi-tenant.
- PoC reproduzível por achado: par de requisições (conta legítima vs. acesso cruzado), respostas comparadas/diff, contas/roles e identificadores usados — tudo sanitizado.
- Matriz de autorização consolidada (usuário/role x objeto/função) destacando cada quebra.
- Recomendações de remediação: enforcement de autorização por objeto no server-side (ownership checks atrelados ao sujeito autenticado, não a parâmetros do cliente), uso de identificadores não previsíveis (UUID) como camada adicional (não como único controle), checagens de role por função/endpoint, deny-by-default, e testes automatizados de autorização no CI.
- Recomendações de detecção (alertas para padrões de enumeração de IDs e respostas 403 em série) e plano de retest pós-correção.$SCTPL$),
  ($SCTPL$Avaliação de Segurança de API GraphQL — Introspection, Abuso e Autenticação$SCTPL$, $SCTPL$## Objetivo
Avaliar especificamente uma API GraphQL quanto a riscos próprios da tecnologia e ao OWASP API Security Top 10: exposição de schema via introspection, autorização por field/resolver (BOLA/BFLA em nível de campo), excessive data exposure, mass assignment via mutations, abuso de recursos (query depth/complexity, aliasing, batching) por ausência de rate limiting/cost analysis, e fragilidades de autenticação/JWT. O objetivo é demonstrar impacto com PoC reproduzível e orientar a remediação.

## Escopo & Autorização
- Exija autorização por escrito (RoE assinada) e escopo definido: endpoint(s) GraphQL, ambiente (preferir staging), e contas de teste por papel (no mínimo dois usuários/tenants e, quando aplicável, uma conta administrativa).
- Atue apenas no endpoint GraphQL autorizado; não pivote para APIs REST adjacentes, serviços internos ou provedores externos fora do escopo.
- Use somente dados de teste. Ao consultar dados, evite extrações em massa; em caso de exposição de dados reais de terceiros, PARE, não copie o conteúdo e reporte com evidência mínima mascarada.
- Controle de recursos: testes de profundidade/complexidade/batching devem ser de baixa intensidade e estritamente para PROVAR a ausência de limites — sem flood que cause indisponibilidade. Não execute DoS.
- Mutations: teste apenas com objetos de teste descartáveis. PARE e peça confirmação humana antes de qualquer mutation que escreva/altere/exclua dados de produção ou de outro tenant, antes de criar contas privilegiadas, e diante de qualquer ação irreversível. Em dúvida sobre impacto, pare e pergunte.

## Metodologia
Alinhada a OWASP API Security Top 10 (2023), OWASP WSTG v4.2 e PTES:
1. Reconhecimento do schema: tentar introspection; se desabilitada, inferir tipos/campos por field suggestion e ferramentas de "clairvoyance".
2. Mapeamento de queries, mutations e subscriptions; identificar tipos sensíveis, nós com id e resolvers de escrita.
3. Autenticação & tokens: validar fluxos de login/refresh e robustez de JWT/OAuth2 usados pelo endpoint (claims, assinatura, expiração).
4. Autorização por field/resolver: testar BOLA acessando nós por id de outro usuário/tenant e BFLA invocando mutations/queries privilegiadas com token de papel inferior.
5. Excessive data exposure: identificar campos retornados além do necessário e relações que vazam dados de objetos não autorizados.
6. Mass assignment: enviar argumentos/inputs extras em mutations (ex.: role, isAdmin, ownerId) e verificar persistência server-side.
7. Abuso de recursos: medir ausência de limites via query depth aninhada, aliasing e batching (arrays de operações) de baixa intensidade; avaliar cost/complexity analysis.
8. Configuração: erros verbosos, CSRF em GraphQL (requisições via GET/form), CORS e exposição de stack traces.
9. Consolidação e priorização por risco.

## Técnicas & Ferramentas
- Schema & exploração: queries de introspection; clairvoyance para inferência quando introspection está desabilitada; GraphQL Voyager para visualização; InQL (extensão Burp) e Altair/GraphiQL para construção de queries.
- Proxy & teste: Burp Suite / OWASP ZAP; graphql-cop e graphql-cop-like checks para detectar introspection, batching, field suggestions, CSRF e GET-based queries.
- BOLA/BFLA por field: acessar nós por id de outra conta; comparar respostas entre duas sessões (apoio do Burp Autorize); testar resolvers de mutation com papéis inferiores.
- JWT/OAuth2: jwt_tool e decoders para checar alg:none, confusão RS256→HS256, claims (exp/aud/iss/scope), assinatura e segredos fracos.
- Mass assignment & excessive exposure: variação de inputs de mutation com propriedades extras; diff de campos retornados vs. necessários.
- Abuso de recursos: queries com aninhamento controlado, aliasing repetido e batching de poucas operações para evidenciar ausência de limites — sempre de baixa intensidade e com throttling.
- Evidência: documentos/queries reproduzíveis (curl/Altair) determinísticos, com dados sensíveis mascarados.
- Sem payloads destrutivos, sem flood, sem malware.

## Entregáveis
- Achados priorizados por risco (CVSS + OWASP API Top 10), cobrindo introspection/exposição de schema, BOLA/BFLA por field, excessive data exposure, mass assignment, abuso de recursos e autenticação/JWT.
- PoC reproduzível por achado: query/mutation exata, variáveis, conta/role usada, resposta evidenciando o impacto e diff quando aplicável — sanitizados.
- Mapa do schema com anotações de campos/resolvers sensíveis e pontos de quebra de autorização.
- Recomendações de remediação: desabilitar introspection e field suggestions em produção; enforcement de autorização por resolver/field atrelado ao sujeito autenticado; allow-list de inputs (contra mass assignment) e schemas de saída mínimos; query depth limiting, complexity/cost analysis e desativação/limite de batching; rate limiting; hardening de JWT (validação de assinatura/alg/claims, rotação de chaves); proteção contra CSRF (rejeitar GET para mutations, exigir content-type adequado) e supressão de erros verbosos.
- Recomendações de detecção (alertas para introspection, batching anômalo e queries de alta complexidade) e plano de retest pós-correção.$SCTPL$),
  ($SCTPL$Pentest Externo de Perímetro — Enumeração de Superfície de Ataque (PTES + NIST SP 800-115)$SCTPL$, $SCTPL$## Objetivo
Demonstrar e validar a exposição real do perímetro externo da organização a partir da perspectiva de um atacante não autenticado na Internet. O engajamento busca: (1) mapear a superfície de ataque externa completa (hosts, serviços, aplicações, e-mail, DNS, VPN, infraestrutura em nuvem voltada para a Internet); (2) identificar e VALIDAR vulnerabilidades em serviços de borda que possam levar a comprometimento, acesso não autorizado ou pivot para a rede interna; (3) produzir evidência reproduzível e recomendações de remediação priorizadas por risco. O foco é valor defensivo: confirmar o que é genuinamente explorável, não apenas listar achados de scanner.

## Escopo & Autorização
- **NÃO PROSSIGA sem autorização por escrito.** Antes de qualquer atividade, confirme que existe uma Regra de Engajamento (RoE) assinada e uma carta de autorização ("authorization letter" / "get-out-of-jail-free card") com: faixas de IP/CIDR, domínios e subdomínios explicitamente no escopo, janela de testes permitida, contatos de emergência e procedimento de parada.
- Trate como **fora de escopo** tudo que não estiver listado explicitamente. IPs de terceiros (provedores de CDN, SaaS, hosting compartilhado) frequentemente respondem por domínios do cliente mas pertencem a outra organização — confirme propriedade antes de testar e respeite os termos de teste do provedor de nuvem (ex.: políticas de pentest da AWS/Azure/GCP).
- **Evite dano e DoS.** Não execute ataques volumétricos, stress/flood, fuzzing agressivo contra serviços de produção frágeis, nem exploits conhecidos por causar crash sem aprovação. Limite a taxa de varredura e de brute-force para não degradar serviços.
- **Pare e peça confirmação explícita** antes de: qualquer ação destrutiva ou irreversível; exploração que possa derrubar um serviço; modificação/escrita de dados; uso de credenciais válidas obtidas; movimento lateral ou pivot para a rede interna; exfiltração de dados reais (use prova mínima/sintética). Registre data/hora e justificativa de cada ação de maior impacto.
- Documente todo IP de origem usado nos testes e mantenha um log cronológico de atividades para correlação e desconflito com a equipe de blue team/SOC.

## Metodologia
Siga as fases do PTES e do NIST SP 800-115, mapeando técnicas a MITRE ATT&CK (táticas de Reconnaissance e Initial Access) quando aplicável.
1. **Pre-engagement** — Validar escopo/autorização, contatos, janela e critérios de parada.
2. **Intelligence Gathering / OSINT (passivo)** — Footprinting de domínios, ASN, faixas de IP, registros DNS, certificados (CT logs), tecnologias e pegada em nuvem. Coleta de e-mails e identificação de exposição de credenciais vazadas em breaches públicos.
3. **Enumeração ativa da superfície** — Descoberta de subdomínios, hosts vivos, varredura de portas/serviços, fingerprinting de versões, mapeamento de aplicações web e endpoints de e-mail/DNS/VPN.
4. **Vulnerability Analysis** — Identificação de vulnerabilidades em serviços de borda, correlação versão→CVE, revisão de configurações (TLS, headers, e-mail anti-spoofing, exposição de painéis administrativos).
5. **Validação / Exploitation controlada** — Confirmação prática e segura das vulnerabilidades de maior risco, com PoC mínima, sem causar indisponibilidade. Priorize técnicas seguras (validação de autenticação, leitura de banner, requisições controladas) sobre exploits de impacto.
6. **Post-exploitation (se autorizado e no escopo)** — Avaliar o que o acesso obtido permite, sempre dentro dos limites da RoE, sem persistência destrutiva.
7. **Reporting** — Consolidar achados, evidências, classificação de risco e remediação.

## Técnicas & Ferramentas
- **OSINT/footprinting:** amass, subfinder, assetfinder, dnsx, crt.sh/CT logs, Shodan/Censys, theHarvester, whois/ASN lookup (Hurricane Electric BGP), análise de registros DNS (MX, TXT, SPF/DKIM/DMARC, NS, AXFR test com dig). Para credenciais vazadas: consultar serviços de breach monitoring autorizados (ex.: HaveIBeenPwned) e dorking — validar exposição SEM tentar autenticar com credenciais sem permissão explícita.
- **Descoberta de hosts/serviços:** nmap (varredura TCP/UDP comedida com controle de taxa, scripts NSE seguros), masscan (com rate-limit conservador e apenas no escopo), naabu.
- **Web/aplicações de borda:** httpx, nuclei (templates de CVE/misconfig/exposições, evitando templates intrusivos sem aprovação), ffuf/feroxbuster para descoberta de conteúdo (rate-limited), Burp Suite/ZAP para análise manual, testssl.sh/sslscan para TLS.
- **E-mail/DNS:** verificação de SPF/DKIM/DMARC e risco de spoofing, teste de open relay (somente verificação, sem envio em massa), checagem de transferência de zona (AXFR), enumeração de registros.
- **VPN/serviços de acesso remoto:** identificação de gateways VPN (IKE/IPsec, SSL-VPN), fingerprinting de produto/versão, validação de CVEs conhecidos de borda sem disparar exploits destrutivos; teste de políticas de senha/lockout em portais de login com brute-force de baixa intensidade SOMENTE se autorizado.
- **Sem armamento de malware:** nenhuma criação/entrega de payloads maliciosos, ransomware ou implantes ofensivos. PoCs limitadas a demonstrar a vulnerabilidade de forma reversível.

## Entregáveis
- **Sumário executivo** com a postura de risco do perímetro e os caminhos de ataque mais críticos em linguagem de negócio.
- **Inventário da superfície de ataque externa** (hosts, serviços, versões, domínios, exposições em nuvem) — útil também como linha de base defensiva.
- **Achados priorizados por risco** (ex.: CVSS + contexto de explorabilidade real), cada um com: descrição, ativo afetado, evidência/PoC reproduzível (comandos, requisições, screenshots), impacto e probabilidade.
- **Recomendações de remediação acionáveis** por achado (patch/versão, hardening de configuração, redução de exposição, correção de SPF/DKIM/DMARC, MFA em VPN/painéis), além de recomendações estratégicas de redução da superfície de ataque.
- **Apêndices:** metodologia, ferramentas/versões, IPs de origem, log cronológico de atividades e lista de itens fora de escopo ou não testados.$SCTPL$),
  ($SCTPL$Pentest Externo Focado — E-mail, DNS e VPN/Acesso Remoto$SCTPL$, $SCTPL$## Objetivo
Validar, de forma direcionada, a segurança dos serviços de borda de comunicação e acesso remoto expostos à Internet: infraestrutura de e-mail (anti-spoofing e exposição de servidores), serviços de DNS (configuração e vazamento de informação) e gateways de VPN/acesso remoto (autenticação, exposição de versão e MFA). O engajamento busca demonstrar cenários realistas como spoofing/phishing por configuração fraca de e-mail, enumeração via DNS e acesso não autorizado via VPN por credenciais válidas ou vulnerabilidades de borda — sempre com evidência reproduzível e recomendações de remediação.

## Escopo & Autorização
- **NÃO INICIE sem autorização por escrito e escopo definido.** Exija RoE assinada com domínios, hostnames e IPs de e-mail/DNS/VPN explicitamente no escopo, janela de testes e contatos de emergência.
- Confirme **propriedade dos ativos**: servidores de e-mail e DNS podem ser operados por terceiros (Microsoft 365, Google Workspace, provedores de DNS). Teste apenas o que o cliente controla e o que o provedor autoriza.
- **Evite dano, DoS e impacto a usuários reais.** Não envie campanhas de phishing reais nem e-mails em massa sem aprovação e escopo específico de social engineering. Não execute brute-force que dispare bloqueio em massa de contas reais ou degrade o serviço.
- **Pare e peça confirmação** antes de: usar credenciais válidas para autenticar em VPN/webmail; qualquer brute-force/password spraying (que exige aprovação explícita, lista de contas autorizada e limites de taxa para evitar lockout); explorar CVE de gateway VPN com risco de indisponibilidade; ou qualquer ação que afete a entrega de e-mail em produção.
- Mantenha log cronológico e registre IPs de origem para desconflito com o SOC.

## Metodologia
Ancorada em NIST SP 800-115, PTES (Intelligence Gathering, Vulnerability Analysis, Exploitation controlada) e MITRE ATT&CK (Reconnaissance, Credential Access, Initial Access).
1. **Footprinting de e-mail/DNS/VPN** — Enumerar registros DNS (MX, NS, TXT, SPF, DKIM, DMARC, SRV), identificar provedores e gateways de acesso remoto.
2. **Análise de configuração de e-mail** — Avaliar SPF, DKIM e DMARC quanto à eficácia anti-spoofing; identificar exposição de servidores SMTP/IMAP/POP, open relay e banners de versão.
3. **Análise de DNS** — Testar transferência de zona (AXFR), DNSSEC, registros que vazam infraestrutura interna, subdomínios órfãos/dangling (risco de subdomain takeover).
4. **Análise de VPN/acesso remoto** — Fingerprint de produto e versão (SSL-VPN, IKE/IPsec, RDP/gateways), correlação com CVEs de borda, avaliação de TLS, presença/ausência de MFA, e políticas de senha/lockout.
5. **Validação controlada** — Confirmar spoofing por SPF/DMARC fraco com prova mínima; demonstrar subdomain takeover de forma não destrutiva; validar exposição de VPN sem disparar exploits de impacto; password spraying de baixa intensidade SOMENTE com autorização e lista de contas aprovada.
6. **Reporting** — Consolidar achados com risco, evidência e remediação.

## Técnicas & Ferramentas
- **DNS:** dig/dnsx (consulta de MX, TXT, NS, SRV), tentativa de AXFR, verificação de DNSSEC, detecção de subdomínios dangling (subjack/nuclei templates de takeover), enumeração com amass/subfinder.
- **E-mail:** análise de SPF/DKIM/DMARC (parsers e checagem manual de políticas, ex.: `p=none` indica baixa proteção), teste de open relay com verificação controlada (sem envio em massa), fingerprint de SMTP/IMAP/POP com nmap NSE seguro, swaks para teste pontual de spoofing autorizado. Avaliar exposição em CT logs e cabeçalhos de e-mail.
- **VPN/acesso remoto:** ike-scan para gateways IPsec/IKE, fingerprint de SSL-VPN via httpx/nmap, testssl.sh para TLS, nuclei para detecção de CVEs de borda conhecidos (modo não intrusivo), verificação de MFA e de mecanismos de lockout. Para password spraying autorizado: ferramentas com controle estrito de taxa e janela, respeitando políticas de bloqueio.
- **Credenciais vazadas:** consulta a fontes de breach autorizadas (ex.: HaveIBeenPwned) para correlacionar usuários expostos; validar reutilização SOMENTE mediante autorização explícita e dentro dos limites de lockout.
- **Sem armamento de malware:** nenhuma entrega de payloads; PoCs limitadas a demonstrar a falha de configuração ou exposição de forma reversível.

## Entregáveis
- **Achados priorizados por risco** com foco em cenários concretos: spoofing por DMARC ausente/`p=none`, subdomain takeover, exposição de VPN sem MFA, gateway vulnerável a CVE de borda, vazamento de infraestrutura via DNS.
- **Evidência/PoC reproduzível** por achado: consultas DNS, cabeçalhos de e-mail spoofado de teste (sandbox/autorizado), screenshots de portais de login, banners de versão, resultados de TLS.
- **Recomendações de remediação** específicas: implementar/endurecer SPF/DKIM/DMARC (`p=reject`), habilitar DNSSEC, remover registros DNS órfãos, aplicar MFA em VPN/webmail, atualizar gateways, configurar lockout e detecção de password spraying.
- **Apêndices:** metodologia, ferramentas/versões, IPs de origem, log de atividades e itens fora de escopo/não testados.$SCTPL$),
  ($SCTPL$Pentest de Rede Interna e Active Directory — Engajamento Abrangente (MITRE ATT&CK)$SCTPL$, $SCTPL$## Objetivo
Validar a postura de segurança do domínio Active Directory a partir de uma posição de "assumed breach" (foothold inicial em rede interna, com ou sem credenciais de usuário de baixo privilégio). O engajamento busca demonstrar, com evidência reproduzível, caminhos de ataque viáveis que levem de acesso inicial a comprometimento de domínio (Domain Admin / Tier-0), quantificando o impacto real e priorizando a remediação. O foco é defensivo: cada caminho explorado deve gerar recomendações acionáveis e detecções (telemetria) correspondentes.

## Escopo & Autorização
- **Pré-requisito obrigatório:** autorização formal por escrito (Rules of Engagement assinadas) contendo escopo de rede (sub-redes, VLANs, ranges de IP), domínios/florestas em escopo, contas de teste fornecidas, janela de execução, contatos de emergência e critérios de parada ("stop conditions").
- Os agentes **NÃO** devem agir fora dos ranges/identidades autorizados. Qualquer host, domínio de confiança (trust) ou sistema de terceiros fora do escopo é proibido, mesmo que alcançável.
- **Proibido causar dano ou indisponibilidade:** não executar DoS, não desabilitar/encerrar contas, não alterar GPOs de produção, não modificar ACLs persistentemente, não tocar em controladores de domínio de forma intrusiva sem aprovação explícita.
- **Parar e pedir confirmação** antes de qualquer ação destrutiva ou de alto impacto: DCSync em produção, criação/modificação de objetos AD (usuários, computadores, GPOs), abuso de delegação que crie tickets de alto privilégio, NTLM relay que resulte em escrita, persistência (Golden/Silver/Diamond Ticket, AdminSDHolder, DCShadow), ou qualquer técnica que altere o estado do domínio. Documentar a intenção, aguardar o ponto de contato autorizar.
- Coleta de credenciais (hashes, tickets) deve ser tratada como dado sensível: armazenar cifrado, restringir, e destruir ao fim do engajamento conforme contrato.
- Evitar lockout de contas: respeitar a política de bloqueio (account lockout threshold) ao testar senhas; usar password spraying controlado (1 tentativa por conta por janela), nunca brute-force.

## Metodologia
Fases ordenadas, ancoradas em PTES, NIST SP 800-115 e mapeadas ao MITRE ATT&CK Enterprise:
1. **Reconhecimento interno / Discovery (ATT&CK TA0007):** descoberta de hosts, serviços, controladores de domínio, e estrutura do AD a partir do foothold. Sem credenciais: enumeração anônima/SMB null session, LLMNR/NBT-NS/mDNS sniffing.
2. **Enumeração de credenciais e do domínio (Credential Access TA0006 / Discovery):** AS-REP Roasting (contas sem pré-autenticação Kerberos), Kerberoasting (SPNs de contas de serviço), enumeração de usuários/grupos/GPOs/ACLs, identificação de caminhos via grafo (BloodHound).
3. **Acesso a credenciais via captura/relay:** poisoning controlado de protocolos de resolução de nomes e NTLM relay (apenas onde SMB signing estiver ausente e dentro do escopo), coercion (PetitPotam/PrinterBug) somente com autorização.
4. **Análise de caminhos de ataque:** modelar grafos de privilégio (BloodHound/SharpHound) para identificar ACL abuse, delegação (unconstrained/constrained/RBCD), GenericAll/WriteDACL, nested groups e shortest path para Tier-0.
5. **Movimentação lateral (Lateral Movement TA0008):** validar reutilização de credenciais (pass-the-hash/pass-the-ticket), execução remota autorizada (WMI/WinRM/SMB) em hosts em escopo, comprovando alcance sem causar disrupção.
6. **Escalonamento de domínio (Privilege Escalation TA0004):** demonstrar caminho até Domain/Enterprise Admin (ex.: abuso de ACL → reset de senha → DCSync) — executar a etapa final destrutiva/DCSync apenas com confirmação explícita.
7. **Persistência (Persistence TA0003) — demonstração controlada:** descrever e, se autorizado e em ambiente apropriado, demonstrar de forma reversível vetores como Golden/Silver Ticket, AdminSDHolder, RBCD; sempre com reversão documentada. Nunca deixar persistência ativa.
8. **Análise de detecção & limpeza:** correlacionar ações com a telemetria esperada (Event IDs, Sysmon) e remover artefatos de teste.

## Técnicas & Ferramentas
- **Descoberta/enumeração:** nmap, NetExec/CrackMapExec, enum4linux-ng, ldapsearch, rpcclient, BloodHound + SharpHound/bloodhound.py, PingCastle (avaliação de exposição AD), ADRecon.
- **Resolução de nomes / relay:** Responder (modo de análise/captura controlada), Inveigh, ntlmrelayx (Impacket) — somente onde SMB signing ausente e com autorização; mitm6 apenas se IPv6 estiver em escopo.
- **Kerberos:** Impacket (GetUserSPNs para Kerberoasting, GetNPUsers para AS-REP Roasting), Rubeus; cracking offline com hashcat/john em ambiente controlado.
- **ACL/delegação:** BloodHound para descoberta de paths; PowerView/Impacket para validar GenericAll/WriteDACL, constrained/unconstrained/Resource-Based Constrained Delegation.
- **Movimentação lateral / validação:** Impacket (psexec/wmiexec/smbexec), evil-winrm, NetExec — em hosts autorizados, preferindo métodos menos intrusivos e evitando despejar processos críticos.
- **Coercion/escalonamento (sob aprovação):** Coercer/PetitPotam, certipy (ESC1-ESC8 em AD CS quando em escopo), secretsdump/DCSync — etapas de alto impacto exigem confirmação prévia.
- **Observação:** preferir ferramentas que permitam modo "dry-run"/análise antes de qualquer escrita. Não armar, distribuir ou implantar malware; usar somente ferramentas de teste de segurança reconhecidas.

## Entregáveis
- **Sumário executivo** com nível de risco do domínio e caminho(s) crítico(s) até Tier-0 em linguagem de negócio.
- **Achados priorizados por risco** (Crítico/Alto/Médio/Baixo) com CVSS/contexto, mapeados a MITRE ATT&CK (técnica/ID) e ao caminho de ataque (BloodHound path quando aplicável).
- **Evidência/PoC reproduzível** por achado: comandos executados, saída sanitizada, screenshots, timestamps e grafo de ataque — sem expor segredos em claro no relatório.
- **Recomendações de remediação** concretas: SMB/LDAP signing e channel binding, LAPS, tiering administrativo (Tier-0/1/2), remoção de SPNs/delegações desnecessárias, hardening de senhas de contas de serviço (gMSA), desabilitar protocolos legados (LLMNR/NBT-NS), Protected Users / Authentication Policies, AD CS hardening.
- **Recomendações de detecção:** Event IDs e regras (ex.: 4769 para Kerberoasting, 4768/4771, 4662 para DCSync, 4624/4625 anômalos) e queries de telemetria (Sysmon/EDR/SIEM) para cada técnica demonstrada.
- **Confirmação de limpeza:** lista de artefatos criados e evidência de remoção/reversão (contas, tickets, modificações).$SCTPL$),
  ($SCTPL$Avaliação Focada de Kerberos — Kerberoasting e AS-REP Roasting$SCTPL$, $SCTPL$## Objetivo
Avaliar de forma focada a exposição do domínio a ataques contra o protocolo Kerberos: **Kerberoasting** (extração offline de senhas de contas de serviço com SPN) e **AS-REP Roasting** (contas com pré-autenticação Kerberos desabilitada). O objetivo é identificar contas crackáveis, demonstrar o impacto de senhas fracas em contas de serviço e fornecer remediação direta — gerando alto valor defensivo com baixa pegada operacional.

## Escopo & Autorização
- **Obrigatório:** autorização por escrito, escopo definido (domínio(s) alvo, faixa de IPs/DCs, conta de usuário autenticado de baixo privilégio fornecida) e janela de testes acordada.
- Os agentes **NÃO** devem sair do escopo nem mirar trusts/domínios não autorizados.
- **Sem dano / sem DoS:** a coleta de tickets (TGS/AS-REP) é uma operação de leitura legítima do Kerberos e não deve sobrecarregar o DC; limitar a taxa de solicitações para não impactar o serviço.
- **Cracking estritamente offline** e em infraestrutura autorizada do engajamento; nunca tentar autenticar repetidamente contra o DC (evita lockout). Não testar senhas obtidas para login ativo sem confirmação explícita.
- **Parar e pedir confirmação** antes de: usar qualquer credencial crackeada para movimentação lateral/escalonamento, antes de enumerar/forjar tickets (Silver Ticket) ou qualquer ação que vá além da coleta e análise offline.
- Senhas/hashes recuperados são dados sensíveis: armazenar cifrado, acesso restrito, destruição ao término conforme contrato. Reportar imediatamente ao contato se uma conta Tier-0 for crackeada.

## Metodologia
Mapeada a MITRE ATT&CK (Credential Access — T1558.003 Kerberoasting, T1558.004 AS-REP Roasting) e a NIST SP 800-115:
1. **Enumeração de alvos Kerberos:** com a conta autenticada fornecida, enumerar contas com SPN (candidatas a Kerberoasting) e contas com `DONT_REQ_PREAUTH` (candidatas a AS-REP Roasting). Sem credenciais, tentar AS-REP Roasting a partir de lista de usuários válidos (user enumeration controlada).
2. **Coleta de material crackável:** solicitar TGS para os SPNs identificados (Kerberoasting) e AS-REP para contas sem pré-auth — operações de leitura, com rate limiting.
3. **Triagem de exposição:** priorizar contas de serviço de alto valor (SQL, IIS, contas em grupos privilegiados, contas com SPN que também são Domain Admin — alto risco) e tipo de criptografia (RC4 vs AES) que facilita o crack.
4. **Cracking offline:** ataque de dicionário/regras em hardware autorizado, com limite de tempo definido, para medir a fração de senhas fracas — não para necessariamente quebrar tudo.
5. **Avaliação de impacto (somente com confirmação):** para contas crackeadas, descrever o caminho de abuso potencial sem executá-lo, a menos que autorizado.
6. **Correlação com detecção:** documentar a telemetria gerada (Event ID 4769 com cifragem RC4, volume anômalo de TGS) para apoiar a defesa.

## Técnicas & Ferramentas
- **Enumeração:** Impacket `GetUserSPNs` (Kerberoasting), `GetNPUsers` (AS-REP Roasting), Rubeus (`kerberoast`, `asreproast`), NetExec/CrackMapExec módulos de Kerberos, ldapsearch/PowerView para listar SPNs e flag de pré-autenticação, BloodHound para identificar quais contas crackeadas dão maior vantagem ("high value").
- **Cracking offline:** hashcat (modos 13100 para TGS-REP / 18200 para AS-REP) ou john, com wordlists e regras; medir tempo até quebra.
- **Boas práticas operacionais:** preferir solicitar tickets apenas das contas relevantes (evitar "roast" indiscriminado de todo o domínio que gera ruído e carga), e priorizar contas marcadas como sensíveis.
- Não armar malware nem usar credenciais para acesso ativo sem aprovação.

## Entregáveis
- **Inventário de exposição:** lista de contas com SPN e de contas sem pré-autenticação, com classificação de risco (privilégio da conta, tipo de cifragem, idade da senha).
- **Achados priorizados por risco:** contas com senhas fracas/crackeadas (Crítico se Tier-0), tempo de crack como métrica de fraqueza, mapeados a ATT&CK T1558.003/T1558.004.
- **Evidência/PoC reproduzível:** comandos de enumeração e coleta, hash sanitizado/parcial como prova (sem expor a senha em claro no corpo do relatório), e tempo/método de crack — em ambiente controlado.
- **Recomendações de remediação:** senhas longas e aleatórias (25+ caracteres) para contas de serviço, migração para **gMSA/dMSA**, remoção de SPNs órfãos, desabilitar RC4 e forçar AES, habilitar pré-autenticação Kerberos em todas as contas, retirar contas de serviço de grupos privilegiados.
- **Recomendações de detecção:** alertas para Event ID 4769 com RC4 (0x17), volume incomum de solicitações TGS por conta/host, e baselining de contas de serviço — para que o time defensivo detecte futuros ataques reais.$SCTPL$),
  ($SCTPL$Avaliação Focada de Coercion e NTLM Relay em Rede Interna$SCTPL$, $SCTPL$## Objetivo
Avaliar de forma focada a exposição da rede interna a ataques de **NTLM relay** e **coercion** (coerção de autenticação): poisoning de protocolos de resolução de nomes legados (LLMNR/NBT-NS/mDNS) e técnicas de coercion (ex.: PrinterBug, PetitPotam) que forçam um host privilegiado a autenticar contra um sistema controlado, retransmitindo (relay) essa autenticação para serviços sem assinatura. O objetivo é demonstrar o risco de captura/relay de credenciais e fornecer remediação direta (signing, channel binding, desativação de protocolos legados), com forte valor defensivo.

## Escopo & Autorização
- **Obrigatório:** autorização por escrito, escopo de rede preciso (sub-redes/VLANs em que o poisoning e o relay são permitidos), hosts-alvo de relay autorizados, janela acordada e contatos de emergência. Poisoning de rede é abrangente por natureza — exigir confirmação explícita do segmento.
- Os agentes **NÃO** devem realizar poisoning/relay em segmentos fora do escopo. Como o LLMNR/NBT-NS poisoning afeta toda a sub-rede (multicast/broadcast), confinar estritamente à VLAN autorizada e à janela definida; preferir horários de baixo impacto.
- **Sem dano / sem DoS:** não envenenar de forma que cause perda de conectividade em massa; mitm6/IPv6 takeover pode impactar DNS de toda a rede — usar somente se explicitamente autorizado e com filtros restritivos. Não derrubar serviços.
- **Relay com escrita = alto impacto:** o relay que resulta em ações de escrita (ex.: adicionar computador, configurar RBCD, modificar AD CS via ESC8, enrollment de certificado) pode alterar o estado do domínio. **Parar e pedir confirmação** antes de qualquer relay que vá além de validar a conexão/capturar hash; documentar a intenção e a reversão.
- Coercion contra controladores de domínio é sensível: só executar com aprovação explícita. Hashes/credenciais capturados são dados sensíveis (armazenamento cifrado, destruição ao fim).

## Metodologia
Mapeada a MITRE ATT&CK (T1557 Adversary-in-the-Middle / LLMNR-NBT-NS Poisoning and SMB Relay, T1187 Forced Authentication) e NIST SP 800-115:
1. **Reconhecimento de pré-condições:** identificar na rede a presença de LLMNR/NBT-NS/mDNS, hosts com **SMB signing desabilitado** (alvos de relay) e exposição de IPv6/DHCPv6. Levantar serviços de coercion (spooler, EFSRPC) e endpoints de AD CS web (potencial ESC8).
2. **Captura controlada (análise):** rodar o listener em modo de análise/captura para observar quais hashes Net-NTLM seriam coletados, sem relay, estabelecendo baseline de exposição.
3. **Forced authentication / coercion (sob aprovação):** acionar coercion de hosts autorizados para gerar a autenticação a ser retransmitida.
4. **Relay validado:** retransmitir a autenticação para um serviço-alvo autorizado **sem assinatura**, validando o acesso resultante de forma mínima (enumeração/leitura) — parar antes de qualquer escrita sem confirmação.
5. **Cadeia de impacto (somente com confirmação explícita):** se autorizado, demonstrar o caminho até privilégio (ex.: relay para LDAP→RBCD, ou relay para AD CS→certificado de máquina/usuário) de forma reversível e documentada.
6. **Detecção & limpeza:** correlacionar com telemetria e remover quaisquer artefatos/configurações de teste.

## Técnicas & Ferramentas
- **Poisoning/captura:** Responder (modo Analyze para baseline; captura controlada), Inveigh; mitm6 apenas se IPv6 em escopo e com filtros de alvo.
- **Coercion (sob aprovação):** Coercer, PetitPotam (EFSRPC), PrinterBug/SpoolSample (MS-RPRN) — direcionado a hosts autorizados.
- **Relay:** ntlmrelayx (Impacket) com alvos restritos; certipy/ntlmrelayx para cenários de AD CS (ESC8) somente sob confirmação.
- **Descoberta de pré-condições:** NetExec/CrackMapExec (`--gen-relay-list`, verificação de SMB signing), nmap (smb2-security-mode), enumeração de spooler/AD CS.
- **Análise offline:** se apenas captura (sem relay) for autorizada, hashes Net-NTLMv2 podem ser submetidos a cracking offline em ambiente controlado (hashcat).
- Preferir sempre o caminho menos intrusivo; não armar malware nem deixar relays/listeners ativos fora da janela.

## Entregáveis
- **Mapa de exposição:** segmentos com LLMNR/NBT-NS/mDNS ativos, inventário de hosts sem SMB signing (alvos de relay) e exposição de IPv6/DHCPv6 e de endpoints AD CS.
- **Achados priorizados por risco:** caminhos de relay viáveis (Crítico quando levam a privilégio de domínio via RBCD/AD CS), mapeados a ATT&CK T1557/T1187, com indicação de pré-condições.
- **Evidência/PoC reproduzível:** baseline de captura, comandos de coercion/relay executados, conexões resultantes e acesso validado (sanitizado), com timestamps — sem expor credenciais em claro.
- **Recomendações de remediação:** habilitar e exigir **SMB signing** (e LDAP signing + channel binding), desabilitar LLMNR/NBT-NS/mDNS via GPO, mitigar IPv6 não usado (RA Guard/DHCPv6 guard), aplicar Extended Protection for Authentication, hardening de AD CS (desabilitar web enrollment HTTP, EPA, remover ESC8), restringir/patch do serviço de spooler em DCs, e Protected Users para contas privilegiadas.
- **Recomendações de detecção:** alertas para respostas LLMNR/NBT-NS anômalas, autenticações NTLM de máquinas para destinos incomuns, eventos de coercion (chamadas EFSRPC/MS-RPRN), e logon NTLM em serviços que deveriam usar Kerberos — habilitando o time defensivo a detectar o ataque real.$SCTPL$),
  ($SCTPL$Pentest de Nuvem — Avaliação Abrangente Multi-Conta (AWS/Azure/GCP)$SCTPL$, $SCTPL$## Objetivo
Demonstrar e validar, de forma autorizada, o risco real decorrente de misconfigurations e fraquezas de identidade no ambiente de nuvem do cliente (AWS, Azure e/ou GCP). O engajamento busca evidenciar caminhos plausíveis de comprometimento — desde a postura inicial (CSPM) até cenários de movimentação lateral entre contas/subscriptions/projetos — com ênfase em: enumeração de IAM e identidades, privilege escalation, exposição de segredos, misconfigurations de storage e abuso do metadata service via SSRF. O produto final é uma narrativa de risco priorizada e acionável, não um simples dump de findings.

## Escopo & Autorização
- **OBRIGATÓRIO:** confirmar a existência de autorização por escrito (carta de autorização / Rules of Engagement assinadas) ANTES de qualquer ação. Sem isso, não prossiga — pare e solicite ao operador.
- O escopo deve definir explicitamente: contas/subscriptions/projects autorizados, regiões, serviços incluídos/excluídos, janelas de teste, identidades/credenciais fornecidas (cenário gray-box) e contatos de emergência.
- Os agentes **NÃO** devem agir fora do escopo definido. Recursos de outras contas, tenants de terceiros, ou serviços compartilhados (ex.: provedor SaaS subjacente) estão fora dos limites salvo autorização expressa.
- **Evitar dano e DoS:** não executar operações que degradem disponibilidade (ex.: enumeração em alta cardinalidade que dispare throttling severo, deleção/modificação de recursos, alteração de policies em produção). Preferir operações `Describe`/`List`/`Get` somente-leitura.
- **Parar e pedir confirmação** antes de qualquer ação destrutiva, de alto impacto ou que altere estado: criar/assumir roles, anexar policies, criar usuários/keys, modificar buckets, exfiltrar dados reais em volume, ou tocar em recursos de produção. Capturar a intenção, o comando exato e o impacto previsto, e aguardar aprovação humana.
- Tratar quaisquer credenciais, segredos ou dados sensíveis descobertos como material confidencial: registrar a existência e o caminho de acesso como evidência, sem extrair conteúdo sensível além do mínimo necessário para PoC.

## Metodologia
Ancorada em PTES, NIST SP 800-115 e MITRE ATT&CK (matriz Cloud / IaaS), com mapeamento aos controles CIS Benchmarks de cada provedor.
1. **Pré-engajamento & validação de escopo** — confirmar autorização, credenciais, contas e janelas; estabelecer baseline de logging (verificar se CloudTrail/Azure Activity Log/GCP Audit Logs estão ativos para registrar a atividade do teste).
2. **Reconhecimento & inventário (CSPM baseline)** — enumerar contas, identidades, recursos e postura geral; identificar superfícies expostas à internet.
3. **Análise de identidade e acesso (IAM)** — mapear usuários, roles, service principals/service accounts, policies, trust relationships e permissões efetivas; identificar excesso de privilégio e identidades dormentes.
4. **Identificação de misconfigurations** — storage público/legível, segredos em variáveis de ambiente / user-data / código, chaves expostas, MFA ausente, secrets em parameter stores acessíveis.
5. **Exploração validada (privilege escalation & lateral movement)** — comprovar caminhos de escalonamento e movimentação lateral entre contas/subscriptions/projects, sempre dentro do escopo e sem causar dano.
6. **Análise de impacto** — articular o que um adversário com o acesso obtido conseguiria atingir (dados, sistemas críticos, blast radius).
7. **Documentação & remediação** — consolidar achados, evidências reproduzíveis e recomendações priorizadas.

## Técnicas & Ferramentas
- **Reconhecimento/CSPM:** ScoutSuite, Prowler (AWS/Azure/GCP), CloudSploit, Steampipe; verificação contra CIS Benchmarks; identificação de recursos com IP público.
- **IAM & análise de permissões:** AWS IAM Access Analyzer, `aws iam` (somente-leitura), PMapper / Cloudsplaining para análise de policies; pacu (apenas módulos de enumeração/análise autorizados); para Azure: ROADtools, AzureHound (coleta para análise de privilege paths); para GCP: enumeração de service accounts e bindings.
- **Privilege escalation (validação):** análise de policies para padrões conhecidos (ex.: `iam:PassRole` + criação de recurso, `iam:CreatePolicyVersion`, atualização de Lambda/Function com role privilegiada); confirmar viabilidade de forma controlada antes de executar, e pedir aprovação para qualquer ação de mudança de estado.
- **Storage:** verificação de ACLs/policies de S3/Blob/GCS, bucket public access, listagem anônima; usar ferramentas de enumeração de buckets apenas contra alvos no escopo.
- **Metadata / SSRF:** quando uma aplicação no escopo for testável, validar acesso ao Instance Metadata Service (IMDSv1 vs IMDSv2 no AWS; endpoints equivalentes em Azure/GCP) como caminho SSRF→credenciais; confirmar exposição sem abusar das credenciais além da PoC.
- **Segredos:** trufflehog/gitleaks contra repositórios e artefatos no escopo, inspeção de user-data, env vars e parameter/secret stores acessíveis.
- **Não** incluir armamento de malware, persistência destrutiva ou técnicas que visem indisponibilidade.

## Entregáveis
- **Sumário executivo** com a narrativa de risco e o blast radius dos caminhos comprovados.
- **Achados priorizados por risco** (Crítico→Baixo), cada um com: descrição, ativo afetado, mapeamento a MITRE ATT&CK e ao CIS Benchmark correspondente, e severidade justificada (impacto × explorabilidade).
- **Evidências/PoC reproduzíveis:** comandos exatos (somente-leitura sempre que possível), respostas redigidas (com segredos mascarados), e passo a passo das cadeias de privilege escalation / lateral movement validadas.
- **Recomendações de remediação** concretas e priorizadas: least privilege, rotação/eliminação de segredos, IMDSv2 obrigatório, bloqueio de acesso público a storage, MFA, e melhorias de detecção (alertas em CloudTrail/Activity/Audit Logs).
- **Matriz de cobertura** indicando o que foi e não foi testado, para suportar reteste.$SCTPL$),
  ($SCTPL$Pentest de IAM em Nuvem — Privilege Escalation e Lateral Movement (Gray-Box)$SCTPL$, $SCTPL$## Objetivo
Validar, a partir de uma identidade de baixo privilégio fornecida (cenário gray-box / "assumed breach"), se um adversário consegue escalar privilégios e se mover lateralmente dentro do ambiente de nuvem autorizado. O foco é exclusivamente o plano de identidade e acesso: políticas excessivas, trust relationships frágeis, `PassRole`/impersonation, e caminhos de escalonamento até privilégios administrativos. O objetivo é provar (ou refutar) caminhos concretos de escalonamento e quantificar o blast radius — sustentando decisões de hardening de IAM.

## Escopo & Autorização
- **OBRIGATÓRIO:** autorização por escrito assinada e Rules of Engagement antes de qualquer ação. Sem autorização confirmada, pare e solicite ao operador.
- O escopo deve especificar: a(s) identidade(s) de partida fornecida(s), contas/subscriptions/projects autorizados, e quais ações de mudança de estado (se alguma) são pré-aprovadas.
- Os agentes **NÃO** devem sair do escopo: não pivotar para contas não autorizadas, não tocar em identidades de terceiros, não usar acesso obtido para alcançar dados/sistemas fora dos limites acordados.
- **Evitar dano/DoS:** priorizar enumeração somente-leitura (`Get`/`List`/`Describe`, simulação de policy). Não criar usuários/keys persistentes, não modificar trust policies de produção, não deletar recursos.
- **Parar e pedir confirmação** antes de QUALQUER ação que altere estado — criar role, anexar policy, criar policy version, assumir role privilegiada de produção, criar access key. Reportar a intenção e o comando exato e aguardar aprovação humana. Sempre que possível, validar a viabilidade do escalonamento via análise estática de policy / `iam simulate` em vez de execução real.
- Reverter qualquer artefato criado durante a validação (com aprovação) e documentar a limpeza.

## Metodologia
Alinhada a MITRE ATT&CK (táticas Privilege Escalation, Lateral Movement, Defense Evasion na matriz Cloud) e PTES.
1. **Estabelecer contexto da identidade** — determinar quem é a identidade fornecida, suas permissões efetivas e a conta/projeto de origem.
2. **Enumeração de IAM** — listar usuários, roles, groups, service principals/service accounts, policies inline e gerenciadas, e trust relationships acessíveis com a permissão atual.
3. **Mapeamento de privilege paths** — modelar grafos de "quem pode assumir/impersonar/modificar o quê" e identificar arestas que levam a privilégios elevados.
4. **Validação de escalonamento** — confirmar, de forma controlada, os caminhos mais promissores (ex.: `iam:PassRole`, `CreatePolicyVersion`, `UpdateFunctionCode`/`UpdateAssumeRolePolicy`, impersonation de service account no GCP, role assignment no Azure).
5. **Lateral movement** — a partir do privilégio escalado, avaliar pivôs para outras roles/contas/subscriptions no escopo.
6. **Quantificação de impacto** — descrever o nível de controle alcançável (ex.: equivalente a admin) e o blast radius.
7. **Documentação & remediação.**

## Técnicas & Ferramentas
- **Enumeração & permissões efetivas:** `aws iam`/`az role`/`gcloud` somente-leitura; AWS IAM Policy Simulator; Cloudsplaining e PMapper (grafos de privilege escalation no AWS); ROADtools/AzureHound (Azure); enumeração de IAM bindings e service accounts no GCP.
- **Padrões de escalonamento a investigar:** PassRole + criação de compute, edição de policy version, atualização de funções serverless com role privilegiada, assume-role via trust policy permissiva, impersonation/`actAs` de service accounts (GCP), atribuição de roles privilegiadas (Azure RBAC / Entra ID).
- **Análise de relacionamentos:** BloodHound/AzureHound para Azure/Entra; geração de grafos para visualizar caminhos de ataque de identidade.
- **Validação controlada:** pacu (somente módulos de enumeração/escalonamento autorizados e não-destrutivos); preferir `simulate-principal-policy` para confirmar viabilidade sem executar.
- **Não** empregar persistência maliciosa, criação de backdoors duradouros, nem técnicas destrutivas.

## Entregáveis
- **Grafo de privilege paths** com os caminhos de escalonamento e lateral movement validados, da identidade inicial ao privilégio máximo alcançado.
- **Achados priorizados por risco**, cada um mapeado a MITRE ATT&CK, com a policy/trust relationship exata que habilita o caminho.
- **PoC reproduzível:** sequência de comandos somente-leitura e/ou de simulação que comprovam o escalonamento, com saídas redigidas; quaisquer ações de mudança de estado documentadas com sua aprovação correspondente e limpeza realizada.
- **Recomendações de remediação:** aplicação de least privilege, remoção de `PassRole` amplo, restrição de trust policies, separação de duties, eliminação de identidades dormentes, e guardrails (SCPs / Azure Policy / Org Policy) para prevenir reintrodução.
- **Recomendações de detecção:** quais eventos de IAM monitorar/alertar para flagrar tentativas reais de escalonamento.$SCTPL$),
  ($SCTPL$Pentest de Nuvem Focado — SSRF, Metadata Service e Exposição de Segredos$SCTPL$, $SCTPL$## Objetivo
Validar, de forma autorizada, a cadeia de ataque que parte de uma vulnerabilidade de SSRF (Server-Side Request Forgery) em uma aplicação hospedada em nuvem até a obtenção de credenciais via metadata service, e avaliar a exposição de segredos no ambiente. O engajamento demonstra o impacto concreto de SSRF + metadata + segredos expostos: que credenciais um atacante obteria, com quais permissões, e o que conseguiria alcançar com elas — fornecendo evidência clara para priorizar correções de aplicação e de hardening de instância.

## Escopo & Autorização
- **OBRIGATÓRIO:** autorização por escrito e escopo definido antes de qualquer ação. Sem autorização confirmada, pare e solicite ao operador.
- Escopo deve listar: aplicação(ões)/endpoints alvo, instâncias/recursos de compute autorizados, conta/subscription/project e janela de teste.
- Os agentes **NÃO** devem atacar endpoints internos não autorizados via SSRF (ex.: usar o SSRF para varrer redes ou serviços de terceiros fora do escopo). Limitar o pivô interno aos alvos acordados.
- **Evitar dano/DoS:** não usar SSRF para inundar serviços internos, não fazer varreduras de porta em alto volume, não causar indisponibilidade da aplicação.
- **Parar e pedir confirmação** antes de USAR as credenciais obtidas do metadata service para ações além da PoC mínima (uma chamada `get-caller-identity` / equivalente para provar a posse e o escopo das credenciais já é suficiente). Qualquer uso adicional das credenciais — listar/ler dados, assumir roles, mudar estado — requer aprovação humana explícita.
- Tratar credenciais e segredos descobertos como confidenciais: mascarar nos relatórios, não persistir, e confirmar revogação/rotação na fase de remediação.

## Metodologia
Ancorada em OWASP WSTG (testes de SSRF) e OWASP API Security Top 10, com a fase de pós-exploração mapeada a MITRE ATT&CK (Cloud — Credential Access via metadata).
1. **Mapeamento da superfície** — identificar funcionalidades da aplicação que buscam URLs/recursos remotos (webhooks, importadores, geradores de PDF, fetch de imagem, integrações).
2. **Descoberta e validação de SSRF** — confirmar que entradas controláveis levam a requisições server-side, observando respostas e canais out-of-band.
3. **Acesso ao metadata service** — direcionar o SSRF ao endpoint de metadados da instância (verificando IMDSv1 vs IMDSv2 no AWS; endpoints equivalentes Azure/GCP com seus cabeçalhos exigidos) e determinar se credenciais/roles são recuperáveis.
4. **Prova de posse de credenciais** — validar a identidade/escopo das credenciais com chamada somente-leitura mínima; PARAR antes de uso adicional sem aprovação.
5. **Exposição de segredos (em paralelo)** — avaliar user-data, variáveis de ambiente, secret/parameter stores e artefatos por segredos expostos.
6. **Análise de impacto & blast radius.**
7. **Documentação & remediação.**

## Técnicas & Ferramentas
- **Descoberta de SSRF:** Burp Suite (Collaborator para detecção out-of-band), ffuf para fuzzing de parâmetros que aceitam URL, nuclei (templates de SSRF), interactsh.
- **Pivô ao metadata:** payloads SSRF apontando ao endpoint de metadados da instância; verificação de IMDSv2 (token obrigatório) como controle mitigante; análise da role anexada e suas permissões via chamada de identidade somente-leitura.
- **Segredos:** trufflehog/gitleaks em repositórios e artefatos no escopo; inspeção de user-data e env vars; verificação de acessibilidade de parameter/secret stores.
- **Validação de permissões das credenciais:** simulação/análise estática das permissões da role obtida (sem exercê-las) para descrever o blast radius sem causar impacto.
- **Não** incluir varredura interna agressiva, exfiltração em volume, nem qualquer técnica de armamento de malware.

## Entregáveis
- **Cadeia de ataque documentada** end-to-end: entrada vulnerável → SSRF → metadata → credenciais → permissões/impacto, com cada etapa reproduzível.
- **Achados priorizados por risco**, mapeados a OWASP WSTG/API Top 10 e MITRE ATT&CK, com severidade justificada.
- **PoC reproduzível:** requisições exatas (com payloads), respostas redigidas comprovando o acesso ao metadata e a identidade das credenciais (com segredos mascarados), e inventário de segredos expostos por localização.
- **Recomendações de remediação:** correção do SSRF na aplicação (allowlist de destinos, validação de URL/resolução DNS), aplicação obrigatória de IMDSv2, least privilege na instance role, rotação imediata de credenciais/segredos expostos e movê-los para secret stores gerenciados.
- **Recomendações de detecção:** monitorar acessos anômalos ao metadata service e uso de credenciais de instância fora do host de origem.$SCTPL$),
  ($SCTPL$Pentest de Cluster Kubernetes — Avaliação Abrangente (CIS Benchmark + MITRE ATT&CK for Containers)$SCTPL$, $SCTPL$## Objetivo
Validar a postura de segurança de um cluster Kubernetes de ponta a ponta, demonstrando, com evidência reproduzível, o impacto real de configurações inseguras. O engajamento busca responder: um atacante com acesso inicial limitado (ex.: credencial de service account de baixo privilégio, pod comprometido ou rede do cluster) consegue escalar privilégios, escapar do container, mover-se lateralmente entre namespaces, ler secrets sensíveis e, no pior caso, comprometer o control plane? Mede-se a eficácia dos controles de RBAC, isolamento de workloads, hardening de nós e segurança da supply chain de imagens.

## Escopo & Autorização
- Execução SOMENTE mediante autorização formal por escrito (Rules of Engagement assinadas), com janela de testes, contatos de emergência e identificação explícita dos clusters/namespaces/contas em escopo.
- O usuário fornece no momento do uso: endpoints do API server e kubelets, contexto(s)/kubeconfig autorizados, registries de imagens, namespaces alvo e quaisquer ambientes EXCLUÍDOS (ex.: produção, namespaces de terceiros, clusters compartilhados multi-tenant que pertencem a outros clientes).
- Os agentes NÃO devem atuar fora do escopo definido. É proibido pivotar para clusters, contas cloud (IAM/metadata de outras contas) ou tenants não autorizados.
- Evitar dano e DoS: não esgotar recursos do cluster (CPU/memória/etcd), não excluir/escalar/cordon-drain nós ou workloads de produção, não saturar o API server com varreduras agressivas. Preferir consultas read-only e enumeração de baixo impacto.
- PARAR e pedir confirmação humana explícita antes de qualquer ação destrutiva ou de alto impacto: criar pods privilegiados em produção, modificar RBAC/admission controllers, montar o filesystem do host, escrever em volumes persistentes com dados, alterar secrets, ou qualquer passo que possa interromper serviços. Documentar a intenção e aguardar aprovação antes de executar.
- Manipular secrets descobertos com cuidado: comprovar acesso sem exfiltrar valores em claro nos relatórios (usar hashes/redação parcial).

## Metodologia
Fases ordenadas, ancoradas em NIST SP 800-115, PTES, CIS Kubernetes Benchmark e MITRE ATT&CK for Containers.
1. **Reconhecimento & Enumeração (ATT&CK TA0007/Discovery)** — identificar versão do Kubernetes, distribuição (vanilla, EKS/AKS/GKE, OpenShift, k3s), CNI, endpoints expostos (API server, kubelet :10250, etcd :2379, dashboard, metrics-server). Mapear namespaces, nós, workloads e CRDs visíveis com a credencial inicial.
2. **Avaliação de exposição externa** — verificar se API server/kubelet/etcd/dashboard estão acessíveis sem autenticação ou com auth anônima (`system:anonymous`, `--anonymous-auth=true` no kubelet), e se endpoints administrativos vazam informação.
3. **Análise de RBAC & Identidade (Privilege Escalation)** — enumerar Roles/ClusterRoles/Bindings, mapear permissões da identidade atual e de service accounts, e identificar caminhos de escalonamento (ex.: verbs perigosos como `create pods`, `escalate`, `bind`, `impersonate`, acesso a secrets, `pods/exec`, controle sobre nós).
4. **Avaliação de workloads & isolamento** — revisar Pod Security Standards/admission (PSA, OPA Gatekeeper, Kyverno), pods privilegiados, `hostPID/hostNetwork/hostIPC`, hostPath mounts, capabilities Linux excessivas, ausência de seccomp/AppArmor, e secrets montados.
5. **Container Escape & comprometimento de nó (ATT&CK Escape to Host)** — a partir de um workload autorizado, avaliar (com aprovação) vetores de escape: socket do Docker/containerd montado, hostPath em `/`, capabilities `CAP_SYS_ADMIN`, acesso ao kubelet/credenciais do nó, e acesso ao endpoint de metadata da cloud (IMDS) para roubo de credenciais de IAM do nó.
6. **Movimentação lateral & acesso a secrets (Credential Access/Lateral Movement)** — usar tokens de service account obtidos para acessar outros namespaces, ler secrets, ConfigMaps e atingir o etcd se exposto.
7. **Supply chain de imagens** — avaliar registries quanto a acesso anônimo/credenciais expostas, ausência de assinatura/verificação (cosign/sigstore, admission de verificação), imagens com vulnerabilidades conhecidas e secrets embutidos em layers.
8. **Análise de impacto & consolidação** — encadear achados em cenários de ataque realistas (do acesso inicial ao impacto) e priorizar por risco.

## Técnicas & Ferramentas
- **Enumeração e auditoria de config:** `kubectl` (auth can-i, get/describe), kube-hunter (descoberta de superfícies), kube-bench (CIS Benchmark dos componentes/nós), kubeaudit, `kubeletctl` para sondar o kubelet.
- **RBAC e caminhos de escalonamento:** rbac-tool / rbac-police, KubiScan (tokens e privilégios arriscados), `kubectl-who-can`, e mapeamento de grafo de privilégios.
- **Avaliação de postura/CSPM:** kubescape (frameworks NSA/CISA, MITRE, CIS), Trivy (cluster scan e misconfig), Polaris, Checkov para manifests/IaC.
- **Escape de container & nó:** verificação de capabilities (`capsh`), DeepCE / amicontained para enumerar contexto do container, teste de socket de runtime montado e hostPath; consulta ao IMDS da cloud para credenciais (somente com aprovação explícita).
- **Supply chain de imagens:** Trivy/Grype (CVE scan de imagens), Syft (SBOM), Dockle (hardening), cosign (verificar assinatura), e busca de secrets em layers com trufflehog/gitleaks.
- **Rede do cluster:** avaliação de NetworkPolicies e segmentação entre namespaces/pods.
Nenhuma das atividades envolve desenvolvimento ou armamento de malware; o foco é enumeração, prova de conceito controlada e validação defensiva.

## Entregáveis
- Achados priorizados por risco (Crítico/Alto/Médio/Baixo) com classificação CVSS quando aplicável e mapeamento para CIS Benchmark, MITRE ATT&CK for Containers e Pod Security Standards.
- Para cada achado: descrição, evidência reproduzível (comandos/saídas redatados, screenshots), pré-condições e impacto demonstrado (PoC controlada, sem exfiltração de dados reais).
- Cenários de ataque encadeados (attack paths) ilustrando a progressão de acesso inicial até control plane/secrets, com diagrama do caminho de privilégios.
- Recomendações de remediação acionáveis e priorizadas: hardening de RBAC (least privilege), aplicação de Pod Security Standards/admission policies, remoção de pods privilegiados e hostPath, restrição de auth anônima no kubelet/API server, isolamento de IMDS, NetworkPolicies, e assinatura/verificação de imagens.
- Resumo executivo para gestão e seção técnica para os times de plataforma/DevSecOps, com quick wins e plano de médio prazo.$SCTPL$),
  ($SCTPL$Pentest Focado — Escape de Container e Comprometimento de Nó (ATT&CK: Escape to Host)$SCTPL$, $SCTPL$## Objetivo
Determinar, de forma focada e com profundidade, se um atacante que já obteve execução de código dentro de um container/pod em escopo consegue romper o isolamento do runtime e comprometer o nó subjacente (host), e a partir dele acessar o control plane, credenciais da cloud ou outros workloads. O engajamento valida a robustez do isolamento de containers, do hardening de nós e do contexto de segurança dos pods, assumindo um modelo de ameaça de "workload comprometido" (ex.: pós-RCE em aplicação containerizada).

## Escopo & Autorização
- Requer autorização formal por escrito e definição precisa de quais pods/namespaces/nós podem ser usados como ponto de partida. Nenhuma ação fora desse escopo.
- O usuário informa no uso: o(s) pod(s)/deployment(s) autorizados como foothold, os nós/grupos de nós em escopo, e ambientes proibidos (produção crítica, nós compartilhados com outros tenants).
- Os agentes devem operar exclusivamente a partir do foothold autorizado e NÃO comprometer nós ou workloads fora do escopo, nem acessar contas/projetos cloud não autorizados via metadata.
- Evitar dano e DoS: não desestabilizar o kubelet/containerd, não consumir recursos do host a ponto de afetar coworkloads, não reiniciar serviços do nó.
- PARAR e solicitar confirmação humana antes de: montar o filesystem do host para escrita, interagir com o socket do runtime (docker/containerd) para criar containers privilegiados, instalar/carregar módulos, modificar arquivos do sistema do nó, ou usar credenciais de IAM obtidas via IMDS para acessar a cloud. Tais passos só prosseguem com aprovação explícita e registro da intenção.
- Credenciais/secrets/tokens descobertos devem ser comprovados sem exfiltração e redatados nos artefatos.

## Metodologia
Fases ordenadas, ancoradas em MITRE ATT&CK for Containers (Escape to Host, Privilege Escalation, Credential Access), NIST SP 800-115 e CIS Benchmark.
1. **Caracterização do container (Discovery)** — a partir do foothold, identificar runtime, namespaces Linux ativos, cgroups, capabilities efetivas, perfis seccomp/AppArmor, usuário (root vs. non-root), montagens e variáveis de ambiente.
2. **Identificação de vetores de escape** — verificar condições inseguras: `privileged: true`, `hostPID/hostNetwork/hostIPC`, hostPath montando diretórios sensíveis do host (`/`, `/var/run`, `/etc`, `/proc`), socket do Docker/containerd montado, capabilities perigosas (`CAP_SYS_ADMIN`, `CAP_SYS_PTRACE`, `CAP_DAC_READ_SEARCH`), e ausência de user namespace remapping.
3. **Prova de conceito de escape (com aprovação)** — demonstrar de forma controlada o vetor mais provável (ex.: uso de socket de runtime montado para alcançar o host, abuso de hostPath, ou capability excessiva), comprovando acesso ao host sem causar dano.
4. **Pós-escape: acesso ao nó & credenciais** — uma vez no host, avaliar acesso ao kubelet e suas credenciais, ao kubeconfig do nó, aos tokens de service account de pods coresidentes (em `/var/lib/kubelet`), e ao endpoint de metadata da cloud (IMDS) para credenciais de IAM do nó.
5. **Escalonamento para o cluster (Lateral Movement)** — usar credenciais/tokens obtidos para interagir com o API server, ler secrets de outros namespaces e avaliar alcance ao control plane.
6. **Avaliação de impacto** — documentar até onde o comprometimento de um único workload pode chegar (raio de explosão).

## Técnicas & Ferramentas
- **Enumeração de contexto do container:** amicontained, DeepCE, `capsh --print`, inspeção de `/proc`, `mount`, e checagem de namespaces (`lsns`).
- **Detecção de vetores de escape:** scripts de checagem de breakout (verificação de socket de runtime, hostPath, capabilities), `nsenter`/`unshare` em testes controlados de namespace, `kubeletctl` para sondar o kubelet do nó (`/pods`, `/run`, `/exec` conforme exposição).
- **Credenciais de nó/cloud:** leitura de tokens de service account montados, consulta ao IMDS (AWS/GCP/Azure metadata) para credenciais de IAM/identidade gerenciada — somente com aprovação explícita.
- **Hardening de referência:** kube-bench (CIS node checks), Trivy (misconfig do pod/manifest), kubescape para correlacionar a config do workload com frameworks NSA/CISA e MITRE.
- **Pivot para o cluster:** `kubectl auth can-i`, enumeração de RBAC com a nova identidade obtida.
Sem desenvolvimento ou uso de malware; ênfase em PoC controlada, mínima e reversível.

## Entregáveis
- Lista priorizada de vetores de escape identificados, com severidade e mapeamento para MITRE ATT&CK (Escape to Host) e Pod Security Standards violados.
- Para cada vetor: pré-condições exatas (ex.: qual flag/montagem o habilita), PoC reproduzível e redatada, e impacto demonstrado (acesso a host, credenciais, ou cluster).
- Diagrama do raio de explosão: do workload comprometido ao host, ao IMDS/cloud e ao control plane.
- Recomendações de remediação específicas: aplicar `runAsNonRoot`, dropar capabilities, habilitar seccomp/AppArmor, proibir `privileged`/`hostPath`/`hostPID` via Pod Security Admission ou OPA/Kyverno, remover montagem de sockets de runtime, restringir acesso ao IMDS (hop limit/IMDSv2/NetworkPolicy) e revisar permissões do service account.
- Resumo executivo do risco e plano de correção priorizado para o time de plataforma.$SCTPL$),
  ($SCTPL$Pentest Focado — RBAC do Cluster, Secrets e Supply Chain de Imagens$SCTPL$, $SCTPL$## Objetivo
Avaliar de forma direcionada se o modelo de identidade e privilégios do cluster (RBAC), o manejo de secrets e a cadeia de suprimentos de imagens contêm fraquezas que permitam escalonamento de privilégios, acesso indevido a dados sensíveis ou injeção de imagens não confiáveis. Parte-se de uma identidade de baixo privilégio (ex.: token de service account de uma aplicação ou credencial de desenvolvedor) e busca-se demonstrar caminhos para privilégios de cluster-admin, leitura de secrets entre namespaces e comprometimento via imagens vulneráveis ou não assinadas.

## Escopo & Autorização
- Somente com autorização formal por escrito e escopo explícito de namespaces, service accounts/identidades de partida, registries e pipelines de build em escopo.
- O usuário fornece no uso: a credencial/contexto inicial autorizado, namespaces alvo, endpoints de registry e (se aplicável) o pipeline CI/CD, além de ambientes proibidos.
- Os agentes NÃO devem usar privilégios obtidos para agir fora do escopo (ex.: alterar produção, exfiltrar dados reais de secrets, publicar imagens em registries de produção).
- Evitar dano e DoS: enumeração de RBAC e registries deve ser read-only sempre que possível; não criar workloads em massa nem poluir registries.
- PARAR e pedir confirmação antes de: usar verbs como `escalate`/`bind`/`impersonate` para efetivamente elevar privilégios, criar/alterar bindings ou admission policies, modificar secrets, ou enviar (push) qualquer imagem a um registry. Demonstrar o caminho de exploração de forma controlada e, quando possível, em ambiente de teste; ações com efeito colateral exigem aprovação.
- Secrets acessados devem ser comprovados (ex.: nome, namespace, tipo, evidência de acesso) sem expor valores em claro nos relatórios.

## Metodologia
Fases ordenadas, ancoradas em CIS Kubernetes Benchmark, MITRE ATT&CK for Containers (Privilege Escalation, Credential Access), NIST SP 800-115 e boas práticas de supply chain (SLSA, Sigstore).
1. **Enumeração de identidade & RBAC (Discovery)** — mapear a identidade inicial e suas permissões (`auth can-i --list`), enumerar Roles/ClusterRoles, RoleBindings/ClusterRoleBindings, service accounts e seus tokens, e identificar bindings excessivamente amplos (ex.: wildcard `*`, `cluster-admin` indevido).
2. **Identificação de caminhos de escalonamento (Privilege Escalation)** — localizar verbs e recursos perigosos acessíveis: `create/patch pods` (montar SA privilegiado), `pods/exec`, `secrets get/list`, `escalate`/`bind` em roles, `impersonate` de usuários/grupos/SA, controle sobre `clusterrolebindings`, ou criação de workloads que herdam SAs poderosos.
3. **Acesso a secrets (Credential Access)** — avaliar leitura de Secrets e ConfigMaps no namespace e cross-namespace, secrets montados em pods, e secrets de tipo `kubernetes.io/service-account-token`/imagePullSecrets que possam vazar credenciais de registry.
4. **Supply chain de imagens** — avaliar os registries em escopo quanto a: acesso anônimo ou credenciais vazadas, tags mutáveis sem digest pinning, ausência de assinatura/atestação (cosign/sigstore) e de admission de verificação (ex.: política que rejeita imagens não assinadas), imagens com CVEs críticos, e segredos embutidos em layers/Dockerfiles.
5. **Validação de admission & políticas** — testar se PSA/OPA Gatekeeper/Kyverno efetivamente bloqueiam imagens não confiáveis, registries não permitidos e configurações inseguras.
6. **Encadeamento & impacto** — combinar achados (ex.: RBAC permite criar pod -> pod usa SA privilegiado -> lê secrets -> obtém credenciais de registry -> injeta imagem) em um attack path coerente.

## Técnicas & Ferramentas
- **RBAC e privilégios:** `kubectl auth can-i`, rbac-tool / rbac-police, KubiScan (detecção de SAs e tokens arriscados), `kubectl-who-can`, e geração de grafo de escalonamento de privilégios.
- **Secrets e tokens:** enumeração via API, inspeção de imagePullSecrets, e busca por secrets em ConfigMaps/variáveis de ambiente; trufflehog/gitleaks para credenciais em manifests/IaC do repositório (se em escopo).
- **Supply chain de imagens:** Trivy/Grype (CVE scan), Syft (SBOM), Dockle (hardening de imagem), cosign (verificação de assinatura/atestação), e teste de pull anônimo nos registries.
- **Postura geral:** kubescape e kube-bench para correlacionar RBAC e admission com CIS/NSA-CISA; Checkov/Kubesc+ para manifests e políticas como código.
- **Validação de admission:** submissão controlada de manifests de teste para verificar enforcement (com aprovação, em namespace de teste).
Sem armamento de malware; foco em prova de conceito mínima, evidência e remediação.

## Entregáveis
- Achados priorizados por risco, com severidade e mapeamento para CIS Benchmark, MITRE ATT&CK (Privilege Escalation/Credential Access) e princípios de least privilege.
- Para cada achado: identidade/permissão envolvida, evidência reproduzível e redatada (saídas de `auth can-i`, listagens de bindings, resultados de scan de imagem), pré-condições e impacto.
- Inventário de service accounts e bindings sobreprivilegiados, com recomendação de menor privilégio para cada um.
- Relatório de supply chain: imagens com CVEs críticos, ausência de assinatura/digest pinning, registries com acesso fraco e secrets em layers.
- Recomendações priorizadas: aplicar least privilege no RBAC (remover wildcards/cluster-admin desnecessário, restringir `escalate`/`bind`/`impersonate`), externalizar secrets (KMS/secret manager, criptografia em repouso do etcd), enforce de assinatura/atestação de imagens via admission, digest pinning e allowlist de registries.
- Resumo executivo e seção técnica para os times de plataforma e DevSecOps, com quick wins e roadmap de hardening.$SCTPL$),
  ($SCTPL$Pentest de Aplicação Mobile — OWASP MASVS/MASTG Completo (Android & iOS)$SCTPL$, $SCTPL$## Objetivo
Validar a postura de segurança de uma aplicação mobile (Android e/ou iOS) de ponta a ponta, demonstrando exposições reais e exploráveis alinhadas ao OWASP MASVS (Mobile Application Security Verification Standard) e testadas conforme o OWASP MASTG (Mobile Application Security Testing Guide). O engajamento deve cobrir as oito categorias de controle do MASVS: STORAGE (armazenamento de dados), CRYPTO (criptografia), AUTH (autenticação e sessão), NETWORK (comunicação), PLATFORM (interação com a plataforma), CODE (qualidade e configuração de build), RESILIENCE (resistência a engenharia reversa e adulteração) e PRIVACY. O foco é evidenciar impacto de negócio: vazamento de dados sensíveis, contornar autenticação, interceptar tráfego, extrair secrets hardcoded e adulterar a aplicação — sempre com PoC reproduzível e recomendação de remediação.

## Escopo & Autorização
- **PRÉ-REQUISITO OBRIGATÓRIO:** só inicie qualquer atividade após confirmar autorização formal por escrito (Rules of Engagement assinado) cobrindo: pacotes/bundle IDs (ex.: `com.exemplo.app`), versões e builds (debug/release), plataformas (Android/iOS), backends e APIs associados, janela de testes, contas de teste fornecidas e contatos de emergência. Se qualquer item estiver ausente ou ambíguo, **PARE e solicite confirmação** antes de prosseguir.
- Teste APENAS os artefatos e endpoints explicitamente autorizados (o operador informa o alvo no momento do uso). Não pivote para sistemas, contas, lojas de aplicativos ou tenants de terceiros fora do escopo.
- **Evite dano e DoS:** não execute fuzzing destrutivo, brute-force massivo, nem volumes que degradem serviços de produção. Prefira ambientes de staging/QA quando disponíveis.
- **Dados sensíveis:** trate qualquer PII, credencial ou token descoberto como confidencial; não exfiltre além do mínimo necessário para a PoC; mascare segredos nas evidências; siga retenção e descarte definidos no contrato.
- **Gatilho de parada:** diante de qualquer ação potencialmente destrutiva, irreversível, de alto impacto, ou que exponha dados reais de usuários (ex.: modificar registros, invalidar sessões em massa, push de build adulterado), **interrompa e peça confirmação explícita** ao responsável autorizado antes de continuar.
- Engenharia reversa e bypass de proteções devem servir exclusivamente à validação defensiva; **não** produza, distribua ou armarmenge malware, nem versões trojanizadas para uso fora do laboratório de teste.

## Metodologia
Fases ordenadas, ancoradas em OWASP MASTG/MASVS, PTES e NIST SP 800-115, mapeando técnicas a MITRE ATT&CK for Mobile quando aplicável.

1. **Pré-engajamento e preparação de ambiente.** Confirmar escopo/autorização. Montar laboratório: emuladores/dispositivos com root/jailbreak controlado, dispositivos físicos quando exigido por hardware-backed keystore. Obter o artefato (APK/AAB para Android; IPA para iOS) e contas de teste.
2. **Reconhecimento e análise estática (MASTG-STATIC).** Inventário do app, permissões, componentes exportados, bibliotecas de terceiros e SDKs. Inspeção de manifesto/Info.plist, App Transport Security, network security config, esquemas de deep link/universal links.
3. **STORAGE — armazenamento inseguro (MASVS-STORAGE).** Inspecionar dados em repouso: SharedPreferences/NSUserDefaults, bancos SQLite/Realm/Core Data, arquivos em sandbox, cache, logs, backups, clipboard e screenshots/snapshots em background. Avaliar uso correto de Keychain/Keystore.
4. **CRYPTO (MASVS-CRYPTO).** Identificar algoritmos fracos/obsoletos, chaves e IVs hardcoded ou previsíveis, ECB, geração de aleatoriedade insegura e armazenamento impróprio de material criptográfico.
5. **AUTH e gestão de sessão (MASVS-AUTH).** Avaliar fluxo de login, tokens (JWT/OAuth), expiração, revogação, biometria, fallback de PIN e proteção de endpoints sensíveis no backend.
6. **NETWORK — comunicação (MASVS-NETWORK).** Interceptação de tráfego, validação de TLS, certificate/public-key pinning, downgrade para texto claro, exposição de dados sensíveis em trânsito e headers.
7. **PLATFORM — interação com a plataforma (MASVS-PLATFORM).** Componentes exportados (Activities/Services/Broadcast Receivers/Content Providers), IPC, intents implícitos, deep links, WebViews (JavaScript bridge, `file://`, carregamento de conteúdo não confiável), pasteboard e overlays.
8. **RESILIENCE — engenharia reversa e anti-tampering (MASVS-RESILIENCE).** Avaliar detecção de root/jailbreak, anti-debugging, detecção de emulador, integridade/anti-tampering, ofuscação e proteção de runtime. Demonstrar contornos quando relevante ao risco.
9. **CODE & secrets (MASVS-CODE / hardcoded secrets).** Buscar API keys, credenciais, endpoints internos, tokens de cloud e secrets embarcados em código, recursos e binários.
10. **Análise dinâmica e abuso de backend (API).** Instrumentação em runtime, mapeamento de chamadas à API e testes alinhados ao OWASP API Security Top 10 (BOLA/IDOR, autorização quebrada, exposição excessiva de dados).
11. **Pós-exploração controlada, correlação e relatório.** Consolidar achados, priorizar por risco e produzir evidências reproduzíveis.

## Técnicas & Ferramentas
- **Aquisição/Recon:** download do artefato autorizado, `apktool`, `jadx`/`jadx-gui`, `apkid`, `aapt`/`aapt2`, análise de `Info.plist` e entitlements (iOS), `class-dump`, `otool`/`nm`.
- **Análise estática automatizada:** MobSF (Mobile Security Framework), `semgrep` com regras mobile, `nuclei` (templates para endpoints expostos), varredura de secrets com `gitleaks`/`trufflehog` sobre recursos descompilados.
- **Instrumentação dinâmica:** Frida e `objection` (hooking, bypass de pinning, root/jailbreak detection, inspeção de Keychain/Keystore, dump de memória), `frida-trace`.
- **Interceptação de rede:** Burp Suite ou OWASP ZAP como proxy; `mitmproxy`; instalação de CA de teste; teste de pinning via Frida; validação TLS com `testssl.sh`/`sslscan`.
- **STORAGE/forense em sandbox:** `adb` (pull de dados, logcat), `frida` para Keychain, inspeção de SQLite (`sqlite3`), Realm/Core Data; verificação de `allowBackup`, snapshots e clipboard.
- **PLATFORM/IPC:** `drozer` (Android — componentes exportados, content providers, intents), teste de deep links com `adb shell am`, análise de WebView bridges.
- **Backend/API:** Burp (Repeater/Intruder em volume controlado), `ffuf` para descoberta de endpoints autorizada, testes de BOLA/IDOR e authz.
- **Observação:** todo bypass de proteção (pinning, root detection) destina-se à validação; conduza com cautela, sem armar payloads maliciosos e respeitando o gatilho de parada.

## Entregáveis
- **Relatório executivo e técnico** com achados priorizados por risco (CVSS v3.1/v4.0 e severidade de negócio), mapeados às categorias MASVS e ao nível de verificação aplicável (MASVS-L1/L2 e MASVS-R).
- **Evidências e PoC reproduzíveis** por achado: passos exatos, comandos/scripts Frida/objection, capturas de tráfego, trechos descompilados e dumps de armazenamento — com secrets/PII mascarados.
- **Matriz de cobertura MASTG** indicando casos de teste executados e resultado (pass/fail/N-A).
- **Recomendações de remediação acionáveis** por achado (ex.: migrar segredos para backend e usar atestação; aplicar Keystore/Keychain hardware-backed; implementar pinning robusto; remover dados sensíveis de logs/backups; fortalecer authz no servidor) e orientações estratégicas (SDLC seguro, gestão de secrets, hardening de build, anti-tampering).
- **Retestes** das correções priorizadas, confirmando o fechamento dos riscos.$SCTPL$),
  ($SCTPL$Auditoria Focada — Armazenamento Inseguro & Hardcoded Secrets em App Mobile (MASVS-STORAGE/CRYPTO)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em demonstrar exposição de dados sensíveis em repouso e secrets embarcados em uma aplicação mobile (Android e/ou iOS), validando os controles MASVS-STORAGE, MASVS-CRYPTO e MASVS-CODE do OWASP MASVS. O objetivo é identificar, com PoC reproduzível, dados sensíveis gravados sem proteção (credenciais, tokens, PII, material criptográfico) e secrets hardcoded (API keys, chaves, endpoints internos, credenciais de cloud) que poderiam ser extraídos por um atacante com acesso ao dispositivo ou ao binário distribuído. O entregável deve quantificar o impacto e orientar a remediação.

## Escopo & Autorização
- **PRÉ-REQUISITO OBRIGATÓRIO:** exigir autorização por escrito e escopo definido antes de qualquer atividade — bundle ID/pacote, versão/build, plataforma, artefato (APK/AAB/IPA) e, se aplicável, backend correlato. Sem autorização e escopo claros, **PARE e solicite confirmação**.
- Limite-se estritamente ao artefato e às contas de teste autorizados (o operador informa o alvo ao usar o template). Não acesse contas reais de usuários, dados de produção fora do escopo, nem sistemas de terceiros.
- **Evite dano e DoS:** este engajamento é predominantemente estático/forense local; não execute ações que alterem dados de produção ou degradem serviços.
- **Manuseio de segredos:** qualquer credencial/token/chave descoberto é confidencial — não o utilize para acessar sistemas de produção sem autorização explícita; mascare nas evidências; valide a explorabilidade de forma minimamente invasiva. Diante de um secret válido com acesso a produção, **PARE e peça confirmação** antes de qualquer validação ativa.
- Engenharia reversa destina-se exclusivamente à validação defensiva; **não** crie ou distribua builds adulterados/malware.

## Metodologia
Alinhada ao OWASP MASTG (testes de STORAGE/CRYPTO/CODE), PTES (análise) e NIST SP 800-115.

1. **Preparação.** Confirmar escopo/autorização; preparar dispositivo/emulador com root/jailbreak controlado para inspeção de sandbox; obter o artefato.
2. **Descompilação e análise estática.** Extrair e descompilar o app; mapear recursos, assets, strings, bibliotecas e arquivos de configuração embarcados.
3. **Caça a hardcoded secrets (MASVS-CODE).** Varredura de código descompilado, recursos, `strings.xml`/plists, arquivos de config e o binário nativo por API keys, tokens, chaves privadas, credenciais e endpoints internos.
4. **Análise de dados em repouso (MASVS-STORAGE).** Exercitar fluxos sensíveis (login, pagamento, perfil) e então inspecionar a sandbox: SharedPreferences/NSUserDefaults, SQLite/Realm/Core Data, arquivos, cache, logs (`logcat`/console), clipboard, snapshots em background e backups (`allowBackup`, iTunes/iCloud backup). Avaliar uso de Keystore/Keychain.
5. **Análise criptográfica (MASVS-CRYPTO).** Verificar algoritmos/modos fracos, chaves/IVs hardcoded, aleatoriedade insegura e proteção do material criptográfico em repouso.
6. **Validação de explorabilidade.** Demonstrar como os dados/secrets seriam recuperados na prática (ex.: pull via `adb`, leitura de Keychain via Frida) de forma controlada.
7. **Correlação e relatório.**

## Técnicas & Ferramentas
- **Descompilação/estática:** `apktool`, `jadx`, `class-dump`, `otool`/`strings`; MobSF para triagem automatizada.
- **Secrets scanning:** `gitleaks`, `trufflehog`, `semgrep` (regras de secrets), grep por padrões de chaves (AWS/GCP/Firebase, JWT, private keys) sobre o output descompilado.
- **Inspeção de armazenamento:** `adb pull`/`logcat`, `sqlite3`, leitura de plists/UserDefaults; Frida/`objection` para dump de Keychain/Keystore e inspeção em runtime; verificação de `android:allowBackup` e snapshots.
- **Crypto:** revisão de chamadas de API criptográfica no código descompilado; identificação de ECB, MD5/SHA1 para senhas, PRNG inseguro.
- **Validação de endpoints expostos (se autorizado):** `nuclei` para checar se endpoints/keys descobertos respondem, em volume mínimo e não destrutivo.

## Entregáveis
- **Inventário de achados** priorizado por risco (severidade + impacto de negócio), mapeado a MASVS-STORAGE/CRYPTO/CODE e ao MASTG correspondente.
- **PoC reproduzível** por achado: caminho exato do dado/secret, comando de extração, e evidência com valores sensíveis mascarados.
- **Recomendações de remediação:** mover segredos para o backend com atestação/short-lived tokens; usar Keystore/Keychain hardware-backed e `EncryptedSharedPreferences`/Data Protection do iOS; desabilitar backups de dados sensíveis; remover PII de logs/cache/clipboard; substituir cripto fraca por algoritmos atuais com gestão de chaves adequada; rotacionar imediatamente quaisquer secrets expostos.
- **Reteste** das correções priorizadas para confirmar fechamento.$SCTPL$),
  ($SCTPL$Teste Focado — Segurança de Comunicação & Resistência a Engenharia Reversa (MASVS-NETWORK/RESILIENCE)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em validar a proteção do tráfego de rede e a resistência a engenharia reversa/adulteração de uma aplicação mobile, cobrindo MASVS-NETWORK e MASVS-RESILIENCE do OWASP MASVS. O objetivo é demonstrar, com PoC reproduzível: (a) se o tráfego sensível pode ser interceptado, alterado ou sofrer downgrade (falhas de TLS, ausência ou bypass de certificate pinning, dados em texto claro); e (b) a eficácia das proteções de runtime (detecção de root/jailbreak, anti-debugging, detecção de emulador, anti-tampering e ofuscação), evidenciando contornos quando relevantes ao risco. O foco é orientar o fortalecimento defensivo.

## Escopo & Autorização
- **PRÉ-REQUISITO OBRIGATÓRIO:** autorização por escrito e escopo definido antes de qualquer ação — bundle ID/pacote, versão/build, plataforma, artefato e os domínios/endpoints de backend que o app contata. Sem isso, **PARE e solicite confirmação**.
- Intercepte e teste APENAS o tráfego do app autorizado e seus endpoints em escopo (o operador define o alvo ao usar o template). Não capture tráfego de terceiros, redes compartilhadas ou usuários reais; isole o ambiente de teste.
- **Evite dano e DoS:** manipulações de tráfego devem ser pontuais e não destrutivas; não realize replay/brute-force em volume que afete produção. Prefira staging/QA.
- **Bypass de proteções:** contornos de pinning e de detecção de root/jailbreak/anti-tampering servem exclusivamente à validação defensiva. **Não** distribua builds adulterados, repackaged ou trojanizados para fora do laboratório de teste; **não** publique bypasses como ferramenta de ataque.
- **Gatilho de parada:** diante de qualquer modificação de tráfego que possa alterar dados reais, transações ou estado de produção — ou de adulteração que possa escapar do ambiente controlado — **interrompa e peça confirmação** ao responsável autorizado.

## Metodologia
Alinhada ao OWASP MASTG (testes de NETWORK/RESILIENCE), PTES, NIST SP 800-115 e MITRE ATT&CK for Mobile (ex.: técnicas de interceptação e de evasão de defesas) quando aplicável.

1. **Preparação.** Confirmar escopo/autorização; configurar proxy de interceptação, CA de teste e dispositivo/emulador instrumentável.
2. **Mapeamento de comunicação (MASVS-NETWORK).** Enumerar todos os canais de rede do app (APIs REST/gRPC, WebSockets, terceiros), domínios, e configurações de ATS/network security config.
3. **Interceptação e validação de TLS.** Configurar proxy; avaliar uso de HTTPS em todos os fluxos, versões/cifras TLS, validação de certificado, e exposição de dados sensíveis em headers/corpo.
4. **Teste de certificate/public-key pinning.** Verificar presença e robustez do pinning; tentar bypass controlado via instrumentação para avaliar a eficácia.
5. **Downgrade e texto claro.** Identificar fallback para HTTP, conteúdo misto e dados sensíveis trafegando sem proteção.
6. **Resistência a engenharia reversa (MASVS-RESILIENCE).** Avaliar detecção de root/jailbreak, anti-debugging, detecção de emulador, integridade/anti-tampering, ofuscação e proteção de runtime; demonstrar contornos relevantes ao risco em ambiente controlado.
7. **Correlação de impacto.** Relacionar falhas de NETWORK e RESILIENCE (ex.: ausência de pinning + fraca resistência a tampering ampliando a superfície de ataque MITM).
8. **Relatório.**

## Técnicas & Ferramentas
- **Interceptação/proxy:** Burp Suite ou OWASP ZAP; `mitmproxy`; instalação de CA de teste; análise de WebSockets.
- **TLS:** `testssl.sh`, `sslscan`, `nmap` (scripts de TLS) para versões/cifras; revisão de ATS (iOS) e network security config (Android).
- **Pinning bypass (validação):** Frida e `objection` (`android sslpinning disable`, hooks customizados), scripts de bypass de pinning para avaliar robustez.
- **RESILIENCE:** Frida/`objection` para testar root/jailbreak detection, anti-debug e anti-tampering; `apktool` para análise de integridade/repackaging em laboratório; `apkid` para identificar packers/ofuscadores; análise de ofuscação no código descompilado (`jadx`).
- **Apoio estático:** MobSF para triagem de configurações de rede e proteções declaradas.
- **Observação:** conduza bypasses estritamente para mensurar a defesa; respeite o gatilho de parada e a proibição de armamento.

## Entregáveis
- **Achados priorizados por risco** (severidade + impacto), mapeados a MASVS-NETWORK/RESILIENCE e aos casos MASTG, com indicação do nível MASVS-R quando o app exigir resistência.
- **PoC reproduzível** por achado: configuração do proxy/CA, scripts Frida/objection usados, capturas demonstrando interceptação/alteração de tráfego ou contorno de proteção — com dados sensíveis mascarados.
- **Recomendações de remediação:** impor HTTPS em todos os fluxos com TLS moderno; implementar certificate/public-key pinning robusto (e resistente a bypass trivial); eliminar fallback para texto claro; fortalecer detecção de root/jailbreak, anti-debugging e anti-tampering com defesa em profundidade; aplicar ofuscação e atestação de integridade; e tratar pinning/RESILIENCE como camadas complementares, não substitutas de segurança no servidor.
- **Reteste** das correções priorizadas para confirmar a eficácia.$SCTPL$),
  ($SCTPL$Emulação de Adversário — Operação Full-Chain MITRE ATT&CK (Ambiente Corporativo Windows/AD)$SCTPL$, $SCTPL$## Objetivo
Demonstrar, de forma controlada e auditável, como um adversário realista poderia obter acesso inicial, estabelecer persistência, escalar privilégios, mover-se lateralmente e exfiltrar dados em um ambiente corporativo Windows/Active Directory. O foco é validar a eficácia dos controles preventivos e detectivos (EDR/SIEM/SOC), medir o tempo de detecção e resposta (MTTD/MTTR) e produzir evidências reproduzíveis que orientem a priorização da remediação. Esta é uma operação de **valor defensivo**: cada técnica executada deve gerar um achado acionável.

## Escopo & Autorização
- **Pré-requisito obrigatório:** Não inicie qualquer atividade sem **autorização por escrito** (Rules of Engagement assinadas) contendo: ranges de IP/CIDR e domínios em escopo, janelas de teste permitidas, contatos de emergência (POC técnico e gestor), e exclusões explícitas.
- Os agentes devem operar **estritamente dentro do escopo definido pelo usuário**. Qualquer host, subnet ou identidade fora do escopo é **proibido** — não enumere, não toque, não pivoteie para fora.
- **Evite dano e indisponibilidade:** nada de DoS, exhaustion de recursos, password spraying agressivo que cause lockout em massa, ou alteração/destruição de dados de produção.
- **Regra de parada (stop condition):** diante de qualquer ação **destrutiva, irreversível ou de alto impacto** (ex.: desabilitar EDR, alterar GPOs, criar contas de domínio persistentes, modificar ACLs sensíveis, mexer em controladores de domínio, manipular backups), **PARE e solicite confirmação explícita** ao POC antes de prosseguir.
- Registre timestamp, host de origem, comando e justificativa de cada ação relevante para garantir trilha de auditoria e desconflito com o blue team.
- Prefira técnicas de baixo impacto e cleanup ao final (remover artefatos, contas e tarefas criadas para teste).

## Metodologia
Operação encadeada e ordenada, mapeada para **MITRE ATT&CK Enterprise** e alinhada a **PTES** e **NIST SP 800-115**:
1. **Reconnaissance / Resource Development (TA0043/TA0042):** OSINT passivo, footprinting de superfície externa, identificação de tecnologias e possíveis vetores — sem tocar alvos fora do escopo.
2. **Initial Access (TA0001):** validação de vetores autorizados — serviços externos expostos, credenciais vazadas (validação controlada), valid accounts. *Phishing simulado somente se explicitamente autorizado no RoE.*
3. **Execution (TA0002):** execução em foothold autorizado via mecanismos nativos (LOLBins), shells legítimos; sem deploy de malware armado.
4. **Persistence (TA0003):** demonstrar (não armar) mecanismos como scheduled tasks/serviços de teste claramente marcados, com remoção garantida.
5. **Privilege Escalation (TA0004):** misconfigurations locais, tokens, serviços vulneráveis, abuso de privilégios.
6. **Defense Evasion (TA0005):** validar visibilidade do EDR/SIEM — verificar o que é/não é detectado, sem desabilitar controles sem autorização.
7. **Credential Access (TA0006):** Kerberoasting, AS-REP Roasting, credential validation — sem dump de produção em massa.
8. **Discovery / Lateral Movement (TA0007/TA0008):** mapeamento de relações de confiança e caminhos de ataque no AD; movimento lateral controlado.
9. **Collection / Exfiltration (TA0009/TA0010):** demonstrar caminho de exfiltração com **dados sintéticos/canary**, medindo se DLP/egress controls detectam — nunca exfiltrar dados reais sensíveis.
10. **Purple-teaming & cleanup:** correlacionar com telemetria defensiva, documentar gaps de detecção, remover todos os artefatos.

## Técnicas & Ferramentas
- **Recon/OSINT:** nmap, masscan (rate-limited), amass, dnsx, httpx, Shodan/Censys (consulta passiva).
- **AD Discovery & Attack Paths:** BloodHound/SharpHound (coleta autorizada), ldapsearch, PowerView, ADExplorer.
- **Credential Access:** Rubeus / Impacket (GetUserSPNs para Kerberoasting, GetNPUsers para AS-REP Roasting), hashcat/John para cracking offline controlado.
- **Lateral Movement:** Impacket (psexec/wmiexec/smbexec) em hosts em escopo, evil-winrm, CrackMapExec/NetExec (modo enumeração e validação, sem spray destrutivo).
- **Priv Esc:** WinPEAS, PowerUp, SharpUp para identificar misconfigs; abuso de service permissions/unquoted paths.
- **Evasion validation (defensivo):** comparar execução de LOLBins (certutil, rundll32, mshta) contra detecções do EDR para mapear gaps.
- **Exfil (controlado):** canary tokens, transferência de arquivo sintético via canais comuns (HTTPS/DNS) para testar egress/DLP.
- *Sem instruções de armamento de malware, sem payloads ofuscados para uso fora do laboratório autorizado.*

## Entregáveis
- **Attack narrative / kill chain** completa, com cada passo mapeado para a técnica MITRE ATT&CK correspondente (Txxxx) e timestamps.
- **Achados priorizados por risco** (Crítico/Alto/Médio/Baixo) com base em probabilidade x impacto, incluindo o caminho de ataque mais curto até Domain Admin / dado crítico (BloodHound path).
- **PoC reproduzível** por achado: comando exato, saída sanitizada, screenshot/evidência, e host afetado.
- **Matriz de detecção (Detection Gap Analysis):** para cada técnica, indicar se foi Prevenida / Detectada / Não detectada pelo SOC, com MTTD observado.
- **Recomendações de remediação** acionáveis e priorizadas (hardening, tiering de AD, gMSA, LAPS, regras de detecção sugeridas).
- Confirmação de **cleanup** de todos os artefatos criados durante a operação.$SCTPL$),
  ($SCTPL$Red Team Focado — Validação de Acesso Inicial e Foothold em Superfície Externa$SCTPL$, $SCTPL$## Objetivo
Validar de forma focada e controlada o vetor de **Initial Access (TA0001)** e o estabelecimento de um foothold inicial a partir do perímetro externo, demonstrando até onde um adversário chegaria após o primeiro acesso, **sem** progredir para impacto destrutivo. O objetivo é responder com evidência: "um atacante consegue entrar pelo perímetro? Quão profundo? E somos capazes de detectar?". Engajamento de curta duração e cirúrgico, ideal como complemento a operações full-chain ou validação pós-remediação.

## Escopo & Autorização
- **Não comece sem autorização por escrito** definindo a superfície externa exata em escopo (IPs, FQDNs, aplicações) e janelas de teste. Ativos não listados estão **fora de escopo** e não devem ser tocados.
- Agentes devem **respeitar rigorosamente o escopo** — sem enumeração de terceiros, supply chain ou ativos de provedores não autorizados.
- **Sem DoS, sem brute-force que cause lockout, sem degradação de serviço de produção.** Aplique rate-limiting e prefira validação a exploração agressiva.
- **Stop condition:** ao obter foothold, **PARE antes de qualquer movimento lateral, persistência ou ação de alto impacto** e solicite confirmação ao POC. Não exfiltre dados reais; use marcadores/canary.
- Documente cada tentativa (sucesso e falha) com timestamp para desconflito com o blue team.

## Metodologia
Fases ordenadas, ancoradas em **MITRE ATT&CK**, **PTES** e **OWASP WSTG/API Top 10** para a porção aplicacional:
1. **External Recon (TA0043):** mapeamento de superfície de ataque — subdomínios, serviços expostos, tecnologias, possíveis pontos de entrada.
2. **Vulnerability Identification:** triagem de exposições em serviços e aplicações web/API expostas (config errada, default creds, CVEs conhecidos, SSRF, IDOR, injeções).
3. **Initial Access (TA0001):** validação controlada de vetores — exploração de serviço externo vulnerável, valid accounts (credenciais vazadas validadas com cautela), ou falha de autenticação. *Phishing apenas se autorizado no RoE.*
4. **Execution & Foothold (TA0002):** confirmar capacidade de execução no host comprometido via mecanismos legítimos, evidenciando o acesso.
5. **Discovery limitada (TA0007):** enumeração mínima do contexto do foothold (privilégios atuais, conectividade) **apenas para evidenciar o blast radius potencial** — sem pivotar.
6. **Parada & relatório:** consolidar evidências e correlacionar com a telemetria defensiva (o acesso foi detectado?).

## Técnicas & Ferramentas
- **Recon externo:** amass, subfinder, dnsx, httpx, naabu, nmap (service/version detection rate-limited).
- **Web/API discovery:** ffuf/feroxbuster (content discovery controlado), nuclei (templates de CVE/misconfig/exposure), Burp Suite para análise manual.
- **App vulns:** sqlmap (modo cauteloso, sem dump em massa), testes manuais de SSRF/IDOR/auth bypass conforme OWASP WSTG.
- **Validação de credenciais:** verificação controlada de credenciais vazadas contra serviços em escopo, com baixo volume para evitar lockout.
- **Foothold:** confirmação de execução via shell/web interface legítima; transferência de canary token para evidência.
- *Sem armamento de malware, sem payloads para uso fora do alvo autorizado.*

## Entregáveis
- **Relatório do vetor de acesso inicial** com a cadeia exata Recon → Vuln → Initial Access → Foothold, mapeada às técnicas MITRE ATT&CK.
- **Achados priorizados por risco**, destacando o vetor de entrada mais viável e o blast radius potencial estimado.
- **PoC reproduzível** por achado: requisição/comando exato, resposta sanitizada, screenshot e ativo afetado.
- **Detection check:** indicação se o acesso inicial foi detectado pelo SOC e em quanto tempo (MTTD).
- **Recomendações de remediação** focadas em redução da superfície externa, hardening de serviços expostos, correção das vulnerabilidades de entrada e melhoria de detecção de perímetro.$SCTPL$),
  ($SCTPL$Emulação de Adversário — Credential Access e Lateral Movement (Assume Breach)$SCTPL$, $SCTPL$## Objetivo
Sob premissa de **assume breach** (ponto de partida já com um foothold de baixo privilégio autorizado), emular as fases de **Credential Access (TA0006)**, **Discovery (TA0007)** e **Lateral Movement (TA0008)** para demonstrar quão rapidamente um adversário interno escalaria privilégios e alcançaria ativos críticos / Domain Admin. Foco em revelar caminhos de ataque (attack paths), trust relationships exploráveis e lacunas de segmentação, gerando evidência priorizada para hardening de identidade e da rede interna.

## Escopo & Autorização
- **Autorização por escrito obrigatória**, especificando o host/conta de partida (assume-breach starting point), os ranges internos em escopo, ativos críticos alvo e exclusões (ex.: sistemas de produção sensíveis, OT/SCADA, backups).
- Agentes operam **somente dentro do escopo**; trust relationships ou domínios fora do escopo não devem ser explorados, apenas documentados se descobertos.
- **Sem DoS e sem ações destrutivas:** evitar password spraying que cause lockouts em massa; evitar dump de credenciais em escala de produção; não alterar ACLs, GPOs ou objetos de domínio sem autorização.
- **Stop condition:** antes de qualquer ação irreversível ou de alto impacto (DCSync, criação de contas persistentes, modificação de grupos privilegiados, desabilitar EDR), **PARE e peça confirmação explícita** ao POC.
- Demonstrar o caminho até o alvo é suficiente — **não é necessário causar impacto real**; pare ao provar o acesso. Garanta cleanup de quaisquer artefatos/contas de teste.

## Metodologia
Fases ordenadas mapeadas a **MITRE ATT&CK Enterprise** e **NIST SP 800-115**:
1. **Host Discovery & Situational Awareness (TA0007):** a partir do foothold, enumerar contexto local, privilégios, conectividade e domínio.
2. **Credential Access (TA0006):** Kerberoasting, AS-REP Roasting, busca por credenciais expostas em shares/configs/scripts, abuso de cache — sempre de forma controlada.
3. **Attack Path Mapping:** coleta e análise de relações no AD para identificar o caminho mais curto a privilégios altos.
4. **Privilege Escalation (TA0004):** explorar misconfigs locais e de domínio (delegação, ACLs, grupos aninhados) conforme aplicável.
5. **Lateral Movement (TA0008):** movimento controlado para hosts em escopo, demonstrando pass-the-hash/ticket e remote execution onde autorizado.
6. **Objective validation:** provar acesso ao ativo crítico/identidade-alvo — e **parar**.
7. **Purple-teaming & cleanup:** correlacionar com telemetria do SOC, documentar gaps de detecção e remover artefatos.

## Técnicas & Ferramentas
- **Discovery/Attack Paths:** BloodHound/SharpHound, PowerView, ldapsearch, ADExplorer.
- **Credential Access:** Impacket GetUserSPNs (Kerberoasting), GetNPUsers (AS-REP Roasting), busca por secrets em SYSVOL/shares; hashcat/John para cracking offline controlado.
- **Lateral Movement:** Impacket (wmiexec/psexec/smbexec), evil-winrm, NetExec/CrackMapExec em modo enumeração e validação (sem spray destrutivo), pass-the-hash/pass-the-ticket controlado.
- **Priv Esc:** WinPEAS/PowerUp/SharpUp, análise de delegação Kerberos (unconstrained/constrained/RBCD) e ACLs abusáveis.
- **Validação defensiva:** comparar cada técnica com detecções do EDR/SIEM para identificar gaps de visibilidade.
- *Sem armamento de malware; sem dump em massa de credenciais de produção.*

## Entregáveis
- **Mapa de attack paths** (com visualização BloodHound) mostrando o caminho mais curto do foothold ao Domain Admin / ativo crítico, com cada passo mapeado a técnicas MITRE ATT&CK.
- **Achados priorizados por risco**, destacando misconfigs de identidade (Kerberoastable SPNs, delegação perigosa, ACLs, grupos aninhados) e falhas de segmentação.
- **PoC reproduzível** por achado: comando exato, evidência sanitizada e hosts/contas afetados.
- **Detection Gap Analysis:** por técnica — Prevenida / Detectada / Não detectada, com MTTD observado.
- **Recomendações de remediação** priorizadas: tiering administrativo, gMSA/LAPS, redução de SPNs, correção de delegação/ACLs, microssegmentação e regras de detecção sugeridas.
- Confirmação de **cleanup** completo dos artefatos da operação.$SCTPL$),
  ($SCTPL$Escalonamento de Privilégios Local — Linux & Windows (Abrangente)$SCTPL$, $SCTPL$## Objetivo
Validar, a partir de um acesso inicial com privilégios limitados (usuário não-privilegiado já estabelecido por um vetor autorizado), se é possível escalar privilégios localmente até `root` (Linux) ou `SYSTEM`/`Administrator` (Windows) explorando misconfigurations, componentes vulneráveis e credenciais expostas. O foco é demonstrar caminhos de elevação reproduzíveis, medir o impacto no controle do host e produzir recomendações de hardening acionáveis (valor defensivo). Mapear o resultado às táticas MITRE ATT&CK TA0004 (Privilege Escalation) e TA0006 (Credential Access).

## Escopo & Autorização
- NÃO inicie qualquer atividade sem **autorização por escrito** (Rules of Engagement assinadas) que identifique explicitamente os hosts/sistemas em escopo, janelas de execução, contas de partida fornecidas e contatos de emergência.
- Opere **exclusivamente** nos hosts autorizados. Não pivote para sistemas fora do escopo, não toque em domínio/AD além do que estiver explicitamente permitido, e não exfiltre dados reais — use apenas provas mínimas necessárias.
- **Evite dano e DoS:** não derrube serviços, não modifique permissões/ACLs persistentes, não altere senhas de contas reais, não desabilite controles de segurança de forma persistente. Prefira técnicas read-only e de baixo impacto para enumeração.
- Diante de qualquer ação **destrutiva, irreversível ou de alto impacto** (ex.: explorar vulnerabilidade de kernel com risco de panic/crash, sobrescrever binários do sistema, manipular o `/etc/passwd` ou registro crítico, reiniciar serviços), **PARE e solicite confirmação explícita** ao responsável antes de prosseguir.
- Toda persistência criada para fins de demonstração deve ser documentada e **removida ao final**; registre artefatos deixados no sistema para limpeza pelo cliente.

## Metodologia
Alinhada a PTES (Post-Exploitation), NIST SP 800-115 e MITRE ATT&CK.

1. **Preparação & contexto** — Confirmar host, SO/versão, contexto da conta inicial (`id`/`whoami /all`), e snapshot/baseline quando o cliente fornecer ambiente descartável.
2. **Enumeração local (host triage)** — Levantar usuários e grupos, privilégios efetivos, serviços/daemons e seus contextos, tarefas agendadas, software instalado e versões, variáveis de ambiente, montagens, e arquivos sensíveis legíveis.
3. **Identificação de vetores** — Catalogar misconfigurations candidatas: regras `sudo`, binários SUID/SGID e capabilities (Linux); serviços com binário/permissão fracos, unquoted service paths, AlwaysInstallElevated, tarefas agendadas graváveis, e privilégios de token (Windows).
4. **Análise de credenciais locais** — Procurar segredos em arquivos de config, histórico de shell, scripts, repositórios locais, cofres/credential stores e dumps acessíveis sem ação destrutiva.
5. **Validação controlada** — Provar cada vetor com a menor elevação necessária para evidenciar o impacto (ex.: obter shell elevado de teste), preferindo verificação em ambiente descartável quando disponível.
6. **Documentação & limpeza** — Capturar evidência reproduzível, reverter alterações e registrar achados priorizados por risco.

## Técnicas & Ferramentas
**Enumeração automatizada (read-only):** LinPEAS/WinPEAS, linux-smart-enumeration (lse.sh), linenum, Seatbelt, PowerUp/PrivescCheck, JAWS. Sempre revisar a saída manualmente — não confiar cegamente em scoring automatizado.

**Linux:**
- `sudo -l` para mapear regras `sudo` permissivas; cruzar com GTFOBins para binários que permitem elevação via funcionalidade legítima.
- Enumeração de SUID/SGID (`find / -perm -4000`) e Linux capabilities (`getcap -r /`), também cruzando com GTFOBins.
- Inspeção de serviços/systemd, cron jobs e timers graváveis, PATH-hijacking em scripts privilegiados, wildcards inseguros em tar/rsync.
- NFS `no_root_squash`, montagens com `nosuid` ausente, e revisão de kernel/distro version contra avisos públicos (validar exploits de kernel apenas com aprovação e, de preferência, em VM descartável).

**Windows:**
- `whoami /priv` para tokens abusáveis (SeImpersonate/SeAssignPrimaryToken — família "Potato", SeBackup/SeRestore, SeDebug); validação via ferramentas públicas reconhecidas em ambiente de teste.
- Serviços com permissões fracas e unquoted service paths; weak service binary/registry ACLs (accesschk, sc).
- `AlwaysInstallElevated`, autostart/registry run keys graváveis, DLL hijacking em diretórios graváveis no PATH.
- Credenciais armazenadas: Credential Manager, GPP cpassword, arquivos de unattend/sysprep, `cmdkey /list`.

*Não inclua nesta atividade desenvolvimento ou armamento de malware; use ferramentas e PoCs públicos de validação, com a menor pegada possível.*

## Entregáveis
- **Findings priorizados por risco** (Critical/High/Medium/Low) com CVSS quando aplicável e mapeamento MITRE ATT&CK.
- **PoC reproduzível** por achado: passo-a-passo, comando/saída relevante, contexto antes (`id`/`whoami`) e depois da elevação, e evidência (logs/screenshots) sem dados sensíveis reais.
- **Cadeia de ataque** ilustrando o caminho do acesso inicial até root/SYSTEM, destacando o elo mais fraco.
- **Recomendações de remediação** concretas por classe: revisão de regras `sudo` (NOPASSWD, binários GTFOBins), remoção de SUID/capabilities desnecessários, correção de ACLs de serviços/tarefas, gestão de patches de kernel/SO, eliminação de credenciais em texto claro, e endurecimento de tokens/políticas.
- **Registro de limpeza:** lista de artefatos/persistência criados e confirmação de reversão.$SCTPL$),
  ($SCTPL$Privilege Escalation Linux — Sudo, SUID & Capabilities (Focado)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em hosts **Linux/Unix** para validar, a partir de um shell de usuário não-privilegiado autorizado, se misconfigurations de **`sudo`, binários SUID/SGID e Linux capabilities** permitem elevação a `root`. O objetivo é demonstrar caminhos concretos e fáceis de remediar, com baixa probabilidade de impacto operacional, e mapear achados a MITRE ATT&CK T1548 (Abuse Elevation Control Mechanism) e técnicas relacionadas.

## Escopo & Autorização
- Exija **autorização por escrito** com a lista exata de hosts Linux em escopo, contas iniciais fornecidas, janela de testes e contatos de escalonamento. Não comece sem isso.
- Restrinja-se aos hosts autorizados; **não** pivote para outros sistemas nem manipule serviços de rede/produção fora do escopo.
- Priorize técnicas **read-only**; ao explorar um vetor, use a menor elevação necessária para provar o impacto e reverta imediatamente.
- **Evite DoS e dano:** não substitua binários do sistema, não edite `/etc/passwd`/`/etc/shadow`/`/etc/sudoers` de forma persistente, não execute exploits de kernel com risco de panic sem aprovação explícita.
- Diante de qualquer ação **destrutiva ou irreversível**, **PARE e peça confirmação** antes de prosseguir. Documente e remova toda alteração ao final.

## Metodologia
Alinhada a PTES (Post-Exploitation) e NIST SP 800-115.

1. **Contexto inicial** — Registrar `id`, `sudo -l`, kernel/distro (`uname -a`, `/etc/os-release`) e contexto da conta.
2. **Enumeração de `sudo`** — Mapear regras permitidas, entradas NOPASSWD, `env_keep`/`secure_path` fracos e binários executáveis como root.
3. **Enumeração de SUID/SGID** — Localizar binários com bit setuid/setgid e identificar quais permitem quebra de privilégio.
4. **Enumeração de capabilities** — Localizar binários com Linux capabilities perigosas (ex.: `cap_setuid`, `cap_dac_override`).
5. **Correlação com GTFOBins** — Para cada binário candidato (sudo/SUID/cap), verificar técnica de abuso documentada.
6. **Validação controlada** — Provar a elevação obtendo um contexto root de teste, com evidência mínima, preferindo VM/ambiente descartável quando disponível.
7. **Documentação & limpeza** — Capturar PoC e reverter qualquer alteração.

## Técnicas & Ferramentas
- **Enumeração:** LinPEAS, lse.sh (linux-smart-enumeration), LinEnum, `pspy` para observar processos/cron de root sem privilégio.
- **Sudo:** `sudo -l`; abuso de binários permitidos via **GTFOBins** (ex.: spawn de shell por funcionalidade legítima); inspeção de `env_keep`/PATH; revisão de versão do `sudo` contra avisos públicos (validar CVEs de sudo só com aprovação).
- **SUID/SGID:** `find / -perm -4000 -type f 2>/dev/null` e `-perm -2000`; cruzar com **GTFOBins**; análise de wildcards inseguros e PATH-hijacking em scripts chamados por binários privilegiados.
- **Capabilities:** `getcap -r / 2>/dev/null`; abuso de `cap_setuid`/`cap_dac_read_search` conforme técnica documentada.
- **Cron/scripts:** revisar `/etc/cron*`, scripts graváveis executados como root, e wildcards em comandos de backup.

*Sem desenvolvimento de malware; usar apenas PoCs públicos de validação com pegada mínima.*

## Entregáveis
- **Findings priorizados por risco** com severidade, host afetado e mapeamento MITRE ATT&CK (T1548.001/.003 etc.).
- **PoC reproduzível** por achado: comando exato, saída relevante, e prova de elevação (`id` antes/depois) sem expor segredos reais.
- **Recomendações de remediação específicas:** remoção/ajuste de regras `sudo` (eliminar NOPASSWD perigosos e binários GTFOBins), remoção de bits SUID/SGID desnecessários, revisão de capabilities atribuídas, correção de PATH/wildcards e atualização de pacotes vulneráveis.
- **Registro de limpeza** confirmando que nenhuma alteração persistente foi deixada no host.$SCTPL$),
  ($SCTPL$Privilege Escalation Windows — Serviços, Tarefas & Tokens (Focado)$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em hosts **Windows** para validar, a partir de uma sessão de usuário padrão autorizada, se é possível elevar privilégios a `SYSTEM`/`Administrator` explorando **serviços mal configurados, tarefas agendadas graváveis, privilégios de token abusáveis e credenciais locais armazenadas**. O objetivo é demonstrar caminhos reproduzíveis de elevação e fornecer hardening acionável, mapeando achados a MITRE ATT&CK T1548, T1134 (Access Token Manipulation) e T1543 (Create or Modify System Process).

## Escopo & Autorização
- Exija **autorização por escrito** com hosts Windows em escopo, contas iniciais fornecidas, janela de execução e contatos de emergência. Não inicie sem isso.
- Atue **apenas** nos hosts autorizados. Não pivote para o Active Directory nem para outros sistemas a menos que explicitamente incluídos no escopo.
- Prefira enumeração **read-only**; ao validar um vetor, use a menor elevação necessária e reverta de imediato.
- **Evite dano e DoS:** não pare/recrie serviços de produção de forma disruptiva, não altere ACLs ou chaves de registro críticas de forma persistente, não troque senhas de contas reais, não execute exploits que possam travar o host.
- Diante de qualquer ação **destrutiva, persistente ou de alto impacto** (reinício de serviço, modificação de registro sensível, criação de conta), **PARE e solicite confirmação** ao responsável. Documente e remova toda alteração ao final.

## Metodologia
Alinhada a PTES (Post-Exploitation), NIST SP 800-115 e MITRE ATT&CK.

1. **Contexto inicial** — `whoami /all`, `whoami /priv`, versão do SO/patch level e grupos da conta.
2. **Enumeração de serviços** — Identificar serviços com permissões fracas no binário/registro e **unquoted service paths**.
3. **Tarefas agendadas & autostart** — Localizar tarefas/scripts e diretórios de autostart graváveis pelo usuário atual.
4. **Privilégios de token** — Avaliar privilégios abusáveis (SeImpersonate/SeAssignPrimaryToken, SeBackup/SeRestore, SeDebug).
5. **Credenciais locais** — Procurar segredos em Credential Manager, GPP cpassword, arquivos unattend/sysprep e configs.
6. **Outras misconfigs** — `AlwaysInstallElevated`, DLL hijacking em diretórios graváveis do PATH.
7. **Validação controlada** — Provar a elevação com evidência mínima, preferindo ambiente descartável.
8. **Documentação & limpeza** — Capturar PoC e reverter alterações.

## Técnicas & Ferramentas
- **Enumeração:** WinPEAS, Seatbelt, PowerUp/PrivescCheck, JAWS; `accesschk` (Sysinternals) para ACLs de serviços/arquivos; `sc qc`/`sc query`.
- **Serviços:** detecção de weak service binary/registry permissions e **unquoted service paths**; validação via substituição em diretório gravável **somente em ambiente de teste autorizado**.
- **Tokens:** `whoami /priv`; abuso de SeImpersonate via ferramentas públicas reconhecidas da família "Potato" para validação controlada; SeBackup/SeRestore para leitura de hives sensíveis com aprovação.
- **Tarefas agendadas:** `schtasks /query /fo LIST /v`; revisão de scripts/binários graváveis executados em contexto privilegiado.
- **Credenciais:** `cmdkey /list`, Credential Manager, GPP `cpassword` em SYSVOL/cache, arquivos `unattend.xml`/`sysprep.xml`, e registro de autologon.
- **Outros:** chaves `AlwaysInstallElevated` (HKLM/HKCU), DLL search order hijacking em paths graváveis.

*Sem desenvolvimento/armamento de malware; usar apenas ferramentas e PoCs públicos de validação, com pegada mínima e reversível.*

## Entregáveis
- **Findings priorizados por risco** com severidade, host, e mapeamento MITRE ATT&CK (T1548, T1134, T1543, T1552 etc.).
- **PoC reproduzível** por achado: passos, comando/saída, e prova de elevação (`whoami` antes/depois) sem expor segredos reais.
- **Cadeia de ataque** do usuário padrão até SYSTEM/Administrator, destacando o vetor mais crítico.
- **Recomendações de remediação:** correção de ACLs de serviços e tarefas, citação de unquoted paths, restrição de privilégios de token, desativação de `AlwaysInstallElevated`, eliminação de credenciais em texto claro (GPP/unattend/autologon) e gestão de patches.
- **Registro de limpeza** confirmando reversão de toda alteração e remoção de artefatos.$SCTPL$),
  ($SCTPL$OSINT & Reconhecimento Passivo — Footprint Completo da Organização$SCTPL$, $SCTPL$## Objetivo
Mapear de forma abrangente e estritamente passiva a superfície de exposição pública da organização-alvo, demonstrando quanto da sua infraestrutura, identidade digital, tecnologias e pessoas pode ser reconstruído por um adversário **sem tocar ativamente os sistemas do alvo**. O engajamento busca validar:
- A extensão do footprint externo (domínios, subdomínios, ranges de IP, ASNs, serviços em nuvem expostos a metadados públicos).
- Vazamentos de credenciais, segredos e dados sensíveis em fontes de terceiros (breaches, repositórios de código, pastebins, buckets indexados).
- A superfície de engenharia social (colaboradores, e-mails, cargos, padrões de nomenclatura, tecnologias declaradas).
- O grau de exposição que viabiliza ataques subsequentes (phishing direcionado, password spraying, abuso de credenciais reutilizadas).
O valor central é **defensivo**: cada achado deve apontar redução de superfície e remediação.

## Escopo & Autorização
- **Pré-requisito obrigatório:** autorização por escrito assinada (Rules of Engagement / carta de autorização) com escopo, janela temporal e domínios/identidades-alvo explicitamente listados. Sem isso, **NÃO INICIE** e solicite o documento.
- Este engajamento é **100% passivo**: agentes NÃO devem enviar pacotes, requisições, conexões, scans, brute-force, enumeração ativa de DNS por força bruta contra resolvers do alvo, nem qualquer interação direta com a infraestrutura do alvo. Apenas fontes públicas e de terceiros (OSINT) são permitidas.
- **Não saia do escopo:** ignore domínios, marcas, subsidiárias ou pessoas não autorizadas, mesmo que apareçam nas correlações. Registre-os como "fora de escopo — requer autorização adicional" e não os investigue.
- **Privacidade e legalidade:** trate dados pessoais (PII) com minimização — colete apenas o necessário para demonstrar risco, não exfiltre nem armazene dumps completos de bases de vazamento. Respeite leis de proteção de dados (LGPD/GDPR) e os Termos de Serviço das fontes.
- **Pare e peça confirmação** antes de qualquer ação que (a) implique login/autenticação em qualquer serviço com credenciais encontradas, (b) faça download em massa de dados de vazamento, (c) entre em contato com pessoas, ou (d) cruze a fronteira para reconhecimento ativo. Nenhuma ação destrutiva, intrusiva ou de validação ativa de credenciais é autorizada nesta fase.

## Metodologia
Ancorada na fase de **Intelligence Gathering do PTES**, no **MITRE ATT&CK — Tactic Reconnaissance (TA0043)** e na fase de pré-engajamento do **NIST SP 800-115**.

1. **Definição do alvo e seeds (PTES Pre-engagement):** consolidar domínios raiz, marcas e identidades autorizadas a partir das Rules of Engagement.
2. **Footprint de infraestrutura (ATT&CK T1590 — Gather Victim Network Information):** WHOIS/RDAP, registros DNS públicos via fontes passivas, descoberta de subdomínios por Certificate Transparency e datasets passivos, mapeamento de ASNs/ranges, identificação de provedores de nuvem e CDN por dados públicos.
3. **Footprint de tecnologias e serviços (ATT&CK T1592 — Gather Victim Host Information):** identificação de stacks, headers e tecnologias a partir de mecanismos de busca de internet (não interativos com o alvo) e de páginas em cache/arquivos.
4. **Pessoas e organização (ATT&CK T1591 / T1589 — Gather Victim Org & Identity Information):** colaboradores, cargos, e-mails, padrões de nomenclatura (formato de username), presença em redes profissionais, fornecedores e parceiros declarados.
5. **Vazamento de credenciais e segredos (ATT&CK T1589.001 — Credentials):** busca em bases de breach públicas, repositórios de código, histórico de commits, gists, pastebins, e segredos hardcoded indexados.
6. **Documentos e metadados:** documentos públicos (PDF/DOCX/XLSX) e seus metadados (autores, software, caminhos internos).
7. **Correlação e modelagem de risco:** cruzar achados para construir cenários realistas de ataque (ex.: e-mail válido + credencial vazada + serviço de autenticação exposto = risco de account takeover).
8. **Priorização e relatório.**

## Técnicas & Ferramentas
- **Footprint de domínios/DNS passivo:** consultas WHOIS/RDAP; Certificate Transparency (crt.sh, censys/certspotter via dados públicos); agregadores de DNS passivo (amass em modo **passivo**, subfinder, assetfinder); datasets de DNS histórico.
- **Descoberta de superfície sem tocar o alvo:** motores de busca de dispositivos/serviços (Shodan, Censys, FOFA) e Google/Bing dorking (operadores avançados, `site:`, `filetype:`, `inurl:`). Web archive (Wayback Machine) e gau/waybackurls para URLs históricas.
- **Tecnologias:** Wappalyzer/whatweb a partir de dados em cache, e fingerprints públicos — **sem requisição direta ao alvo**.
- **Pessoas e e-mails:** theHarvester (fontes passivas), hunter.io, validação de **padrão** de e-mail (não validação ativa SMTP), enumeração de colaboradores em fontes públicas.
- **Credenciais e segredos:** Have I Been Pwned, DeHashed e bases de breach públicas; busca de segredos em repositórios com trufflehog/gitleaks/github-dorks contra repos **públicos**; pastebin scrapers.
- **Metadados de documentos:** FOCA, exiftool, metagoofil.
- **Correlação e visualização:** SpiderFoot, Maltego, recon-ng como frameworks de agregação OSINT.
- **Restrição:** nenhuma ferramenta deve operar em modo ativo (brute-force de DNS contra o alvo, scans de porta, fuzzing, login com credenciais). Configure explicitamente os modos passivos.

## Entregáveis
- **Sumário executivo** com a história do adversário: o que é reconstruível publicamente e o impacto plausível.
- **Inventário de footprint** priorizado por risco: domínios, subdomínios, IPs/ASNs, serviços expostos identificados via OSINT, tecnologias e versões inferidas.
- **Achados de vazamento** classificados por severidade (ex.: credenciais corporativas em breach recente = alta; segredo/API key em repo público = crítica), cada um com **evidência reproduzível** (fonte, URL/cache, data de coleta, screenshot/hash) — sem incluir o segredo/credencial em claro no corpo do relatório, apenas referência redigida e prova de existência.
- **Mapa de superfície de engenharia social:** padrão de e-mail, lista de identidades expostas e cenários de phishing/password spraying viáveis (descritos, não executados).
- **Recomendações de remediação** acionáveis: rotação de segredos vazados, takedown de dados expostos, redução de subdomínios órfãos, hardening de metadados de documentos, monitoramento de Certificate Transparency e de breaches, conscientização de pessoal.
- **Matriz de rastreabilidade** mapeando cada achado às técnicas MITRE ATT&CK correspondentes e ao framework PTES, facilitando a priorização defensiva.$SCTPL$),
  ($SCTPL$Reconhecimento Passivo Focado — Vazamento de Credenciais & Segredos$SCTPL$, $SCTPL$## Objetivo
Engajamento OSINT **focado e cirúrgico** para identificar e validar a existência de **credenciais corporativas vazadas, segredos e chaves de API expostos** associados à organização-alvo, demonstrando o risco concreto de comprometimento inicial (Initial Access) por reutilização de credenciais, password spraying ou abuso de segredos. Diferentemente de um footprint amplo, este template prioriza profundidade sobre largura: o alvo é a **higiene de credenciais e gestão de segredos**. Busca-se responder: *"Um adversário consegue obter uma credencial ou segredo válido da organização hoje, apenas com fontes públicas e de terceiros?"* O entregável tem forte orientação defensiva — rotação, revogação e detecção.

## Escopo & Autorização
- **Autorização por escrito obrigatória:** carta de autorização / Rules of Engagement assinada listando explicitamente os domínios corporativos, organizações no GitHub/GitLab, marcas e identidades em escopo. **NÃO INICIE** sem o documento e sem confirmação de quem pode autorizar.
- **Engajamento estritamente passivo:** proibido qualquer toque ativo no alvo — sem login, sem teste de credenciais contra serviços do alvo, sem validação SMTP ativa, sem scans. A coleta limita-se a fontes públicas e de terceiros.
- **Manuseio de credenciais vazadas — regra de ouro:** **NÃO USE** nenhuma credencial ou segredo encontrado para autenticar em qualquer sistema. A simples tentativa de login pode constituir acesso não autorizado e está **fora de escopo**. Demonstre o risco por evidência de existência, não por exploração.
- **Minimização de dados:** não baixe dumps completos de bases de vazamento; extraia apenas o registro correlacionado ao alvo, redija segredos no armazenamento e no relatório, e descarte material sensível ao fim do engajamento conforme as Rules of Engagement.
- **Não saia do escopo:** credenciais de terceiros, parceiros ou indivíduos fora da lista autorizada devem ser ignoradas e apenas sinalizadas como "fora de escopo".
- **Pare e peça confirmação** antes de: contatar a organização que hospeda um segredo exposto, baixar grandes volumes de dados, ou qualquer passo que se aproxime de validação ativa. Nenhuma ação destrutiva ou de alto impacto é autorizada.

## Metodologia
Ancorada em **PTES (Intelligence Gathering)**, **MITRE ATT&CK T1589.001 (Gather Victim Identity Information: Credentials)** e **T1552 (Unsecured Credentials)** como contexto de risco, e **OWASP (Secrets Management / WSTG-ATHN)** para classificação.

1. **Definição de seeds:** domínios de e-mail corporativos, organizações de código, nomes de produtos e padrões de nomenclatura autorizados.
2. **Coleta em bases de breach:** correlação de e-mails/domínios do alvo com vazamentos públicos conhecidos; identificação de credenciais combo-list e de data/origem do breach.
3. **Mineração de segredos em código público:** varredura de repositórios, forks, gists e histórico de commits por chaves de API, tokens, credenciais de banco, chaves privadas e arquivos de configuração sensíveis.
4. **Fontes secundárias:** pastebins, fóruns, buckets de armazenamento indexados publicamente, e artefatos de CI/CD expostos.
5. **Correlação e modelagem:** cruzar credencial/segredo com o serviço-alvo correspondente para estimar impacto (ex.: chave de API com escopo de produção = crítica) — **sem testar**.
6. **Classificação de risco e relatório.**

## Técnicas & Ferramentas
- **Breaches e credenciais:** Have I Been Pwned (API de domínio), DeHashed, e bases públicas de vazamento para correlação por domínio.
- **Segredos em código:** trufflehog, gitleaks, gitrob e GitHub/GitLab dorking por padrões (`org:`, regex para tokens, `filename:.env`, `extension:pem`); análise de histórico de commits e de forks órfãos.
- **Pastebins e fóruns:** scrapers de pastebin, monitoramento de menções ao domínio/marca.
- **Buckets e artefatos expostos:** busca de buckets S3/GCS/Azure indexados por nome derivado do alvo via dorking (sem acesso ativo de enumeração contra o alvo).
- **Validação de existência de e-mail por padrão** (não SMTP ativo): theHarvester em modo passivo, inferência do formato de username.
- **Agregação:** SpiderFoot, recon-ng (módulos passivos).
- **Restrição explícita:** nenhuma ferramenta de password spraying, credential stuffing ou login automatizado deve ser executada nesta fase.

## Entregáveis
- **Lista priorizada de exposições** por severidade: credenciais corporativas em breaches (com data e fonte), segredos/chaves em repositórios públicos (com escopo inferido e criticidade), e configurações sensíveis expostas.
- **Evidência reproduzível e redigida** para cada achado: fonte, URL/commit hash, data de coleta, e prova de existência (screenshot com o segredo mascarado, hash do valor) — **nunca o segredo em claro** no relatório.
- **Análise de impacto** por achado: qual serviço/conta é afetado e qual o cenário de abuso plausível (account takeover, acesso a infraestrutura, pivoting).
- **Plano de remediação imediato:** rotação/revogação de credenciais e chaves expostas, invalidação de tokens, takedown/purge de histórico de commits, adoção de secret scanning em CI/CD (pre-commit hooks, push protection), MFA obrigatório, e monitoramento contínuo de breaches.
- **Mapeamento MITRE ATT&CK** dos achados (T1589.001, T1552, T1078 como risco downstream) para apoiar a equipe de detecção e a priorização defensiva.$SCTPL$),
  ($SCTPL$Pentest de CI/CD e Cadeia de Suprimentos — Avaliação Abrangente$SCTPL$, $SCTPL$## Objetivo
Demonstrar e validar, de forma autorizada, riscos de segurança em toda a cadeia de entrega de software (source-to-deploy): vazamento de segredos em pipelines, dependências e artefatos comprometidos/adulterados, runners e workers expostos, configuração insegura de Infrastructure-as-Code (Terraform/Ansible) e ausência de integridade de build (supply-chain integrity). O foco é evidenciar caminhos de comprometimento realistas (ex.: do commit ao deploy em produção), medir o impacto (raio de explosão / blast radius) e produzir recomendações de remediação acionáveis, alinhadas a SLSA, CIS e OWASP CI/CD Top 10.

## Escopo & Autorização
- **Pré-requisito obrigatório:** só inicie com **autorização por escrito** assinada (rules of engagement), contendo: organizações/repositórios, plataformas de CI/CD (ex.: GitHub Actions, GitLab CI, Jenkins, Azure DevOps), registries de artefatos, contas de cloud e janelas de teste autorizadas.
- O usuário informa o(s) **alvo(s)** no momento do uso. **NÃO** atue sobre nenhum repositório, runner, registry ou conta fora da lista explicitamente autorizada.
- **Não cause dano nem DoS:** evite saturar runners, esgotar minutos de build, poluir registries de produção ou disparar deploys em ambientes produtivos.
- Trate segredos descobertos como dados sensíveis: **registre apenas evidência mínima** (ex.: prefixo mascarado + localização), **não exfiltre** e **não os utilize** para acessar serviços de terceiros sem autorização específica.
- **PARE e peça confirmação explícita** antes de qualquer ação destrutiva ou de alto impacto: modificar/mesclar pipelines, publicar artefatos, rotacionar/revogar credenciais, executar `terraform apply`/`ansible-playbook` que altere estado, escalar privilégios em cloud ou pivotar para produção. Na dúvida, prefira prova-de-conceito não destrutiva (dry-run, ambiente de staging).

## Metodologia
Fases ordenadas, ancoradas em **PTES**, **NIST SP 800-115**, **OWASP CI/CD Top 10**, **MITRE ATT&CK** e **SLSA**:
1. **Pré-engajamento & Reconhecimento** (PTES): inventário de repos, pipelines, runners, registries, contas de service e provedores IaC; mapeamento de gatilhos (push, PR, tag, cron) e do fluxo source→build→artifact→deploy.
2. **Análise de Segredos & Configuração**: varredura histórica de segredos no código/histórico Git, variáveis de CI, logs de build e estado de IaC (CICD-SEC-6 Insufficient Credential Hygiene).
3. **Análise da Cadeia de Dependências (SCA)**: identificação de dependências vulneráveis, dependency confusion, typosquatting e lockfiles ausentes/adulterados (CICD-SEC-3).
4. **Integridade de Pipeline & Execução** (ATT&CK TA0001/TA0002): avaliação de PPE (Poisoned Pipeline Execution), injeção via inputs não confiáveis (ex.: títulos de PR, branch names), uso de actions/plugins de terceiros sem pin por hash (CICD-SEC-1/4).
5. **Runners & Isolamento**: exposição de runners self-hosted, reutilização de estado entre jobs, escape de container, acesso ao metadata endpoint da cloud (CICD-SEC-7).
6. **Integridade de Artefatos & Deploy**: ausência de assinatura/atestação (signing/provenance), controles de registry, possibilidade de promover artefato não verificado a produção (CICD-SEC-9/10, SLSA).
7. **IaC & Pós-exploração controlada**: revisão de Terraform/Ansible para misconfigurations e excesso de privilégio; análise do blast radius com PoC não destrutiva.
8. **Documentação & Limpeza**: consolidação de evidências e remoção de quaisquer artefatos de teste introduzidos (com autorização).

## Técnicas & Ferramentas
- **Segredos:** `trufflehog`, `gitleaks`, `git-secrets`, `detect-secrets`; inspeção de logs de build e variáveis de ambiente; busca por tokens em caches/artefatos.
- **SCA / dependências:** `osv-scanner`, `trivy`, `grype`, `dependency-check`, `npm audit`/`pip-audit`; verificação de lockfiles, fontes de registry e resolução de pacotes internos (dependency confusion).
- **Pipeline / IaC estático:** `checkov`, `tfsec`, `terrascan`, `kics`, `semgrep` (rulesets de CI/CD), `actionlint`, `zizmor` (GitHub Actions); revisão de uso de `pull_request_target`, secrets em PRs de fork e actions sem pin.
- **Runners / containers / cloud:** `nmap` para mapear runners/serviços expostos, `nuclei` para exposições conhecidas, `trivy`/`docker scout` para imagens, `ScoutSuite`/`prowler`/`pacu` para postura de cloud; teste de acesso ao metadata service (SSRF/credential exposure) **apenas em escopo**.
- **Integridade de artefatos:** `cosign`/`sigstore` e SLSA provenance para verificar (ou evidenciar ausência de) assinatura e atestação; checagem de imutabilidade de tags em registry.
- Sem instruções de armamento de malware: as provas-de-conceito devem ser benignas e reproduzíveis (ex.: arquivo-canário, comentário em log, recurso inócuo marcado em staging).

## Entregáveis
- **Achados priorizados por risco** (Crítico→Baixo) mapeados a CICD-SEC / ATT&CK / SLSA, com avaliação de likelihood e blast radius.
- **Evidências/PoC reproduzíveis:** trechos mascarados de segredos com localização, comandos executados, capturas, e o caminho de ataque encadeado (ex.: "segredo em log → token de registry → push de artefato → deploy").
- **Mapa da cadeia de suprimentos** com pontos de confiança e ausências de controle (gaps de provenance/assinatura).
- **Recomendações de remediação** acionáveis: rotação de segredos e secret scanning bloqueante, pin de actions/dependências por hash + lockfiles, OIDC/short-lived credentials em vez de tokens estáticos, isolamento de runners e least-privilege, assinatura/atestação de artefatos (cosign/SLSA), políticas de branch/environment protection e gates de aprovação para deploy.
- **Resumo executivo** com nível de risco geral e roadmap de hardening em ondas (quick wins vs. estruturais).$SCTPL$),
  ($SCTPL$Pentest Focado — Segredos e Integridade em Pipelines GitHub Actions / GitLab CI$SCTPL$, $SCTPL$## Objetivo
Validar, de forma autorizada e focada, dois vetores de alto impacto em pipelines de CI/CD modernos (GitHub Actions / GitLab CI ou equivalente): (1) **vazamento e mau uso de segredos** (credential hygiene) e (2) **integridade de execução do pipeline**, em especial **Poisoned Pipeline Execution (PPE)** e injeção via inputs não confiáveis. O objetivo é demonstrar se um ator com acesso de baixo privilégio (ex.: autor de um Pull/Merge Request) consegue obter segredos ou executar código no contexto do pipeline, e fornecer remediação concreta.

## Escopo & Autorização
- Exige **autorização por escrito** com lista explícita de repositórios, pipelines, branches e runners no escopo, além da janela de teste. O usuário fornece o alvo no uso.
- **NÃO** teste repositórios, organizações ou runners fora do escopo. **NÃO** abra PRs/MRs contra branches de produção sem autorização específica.
- Evite **DoS** e consumo abusivo: não dispare loops de jobs, não esgote minutos de CI nem polua caches/registries compartilhados.
- Segredos eventualmente expostos devem ser **mascarados na evidência**, **não exfiltrados** e **não reutilizados** contra serviços externos.
- **PARE e confirme** antes de: mesclar qualquer alteração, modificar workflows em branch protegido, publicar artefatos, ou usar credenciais obtidas para acessar cloud/registry. Prefira PoC em **fork/branch de teste descartável** e use canários (ex.: variável dummy) em vez de segredos reais sempre que possível.

## Metodologia
Ancorada em **OWASP CICD-SEC (1 Insufficient Flow Control, 4 Poisoned Pipeline Execution, 6 Credential Hygiene)**, **MITRE ATT&CK** e **NIST SP 800-115**:
1. **Recon de pipeline:** enumerar workflows/jobs, gatilhos (`push`, `pull_request`, `pull_request_target`, `workflow_run`, tags, schedules) e quais segredos/permissões cada job acessa.
2. **Análise de segredos:** varredura do histórico Git, de logs de execução e de variáveis (CI/CD variables, masked/protected flags) em busca de exposições e de práticas de hygiene fracas.
3. **Modelagem de PPE:** identificar onde código controlado por contribuidor não confiável (fork, branch de PR) influencia a execução — scripts de build, `make`, pré-/pós-install de dependências, steps que rodam comandos de arquivos do repositório.
4. **Injeção via inputs:** avaliar uso inseguro de contextos não confiáveis (ex.: título/corpo de PR, nome de branch, labels) interpolados em `run:`/shell (script injection).
5. **Permissões & token de pipeline:** revisar escopo do token automático (ex.: `GITHUB_TOKEN`/`CI_JOB_TOKEN`), `permissions:` excessivas e possibilidade de escalonar para push/registry.
6. **PoC controlada & documentação:** comprovar o vetor com prova benigna e remover artefatos de teste.

## Técnicas & Ferramentas
- **Segredos:** `gitleaks`, `trufflehog`, `detect-secrets`; análise de logs de job e de artefatos/caches em busca de tokens; verificação de flags masked/protected.
- **Análise estática de workflow:** `actionlint`, `zizmor`, `semgrep` (regras de CI/CD), `checkov`; identificação de `pull_request_target` + checkout de código de fork, actions sem pin por commit SHA, secrets expostos a PRs de fork.
- **PPE / injeção:** revisão manual de steps `run:`, scripts referenciados, hooks de package manager (`npm`/`pip`/`yarn` lifecycle scripts), e interpolação de `${{ github.event.* }}` / variáveis de MR em shell.
- **Permissões:** avaliação do escopo de tokens automáticos e da configuração de branch/environment protection e required reviewers.
- PoC sempre **benigna e reproduzível** (ex.: `echo` de marcador, criação de arquivo-canário, comentário automatizado), sem qualquer armamento de malware.

## Entregáveis
- **Achados priorizados por risco**, mapeados a CICD-SEC e ATT&CK, distinguindo exposição teórica de exploração comprovada.
- **PoC reproduzível** com passos exatos (workflow/branch usados, gatilho, comando, resultado mascarado) e cadeia de impacto (ex.: "PR de fork → execução de script → leitura de segredo no log").
- **Inventário de segredos expostos** (mascarados) com localização e recomendação de rotação imediata.
- **Recomendações de remediação:** pin de actions por SHA, mínimo privilégio em `permissions:`, separar `pull_request` de `pull_request_target`, não expor secrets a builds de fork, sanitizar inputs não confiáveis (usar variáveis de ambiente intermediárias em vez de interpolação direta), required reviewers e branch/environment protection, secret scanning bloqueante e rotação via OIDC/credenciais efêmeras.$SCTPL$),
  ($SCTPL$Pentest Focado — Segurança de IaC (Terraform/Ansible) e Integridade de Artefatos$SCTPL$, $SCTPL$## Objetivo
Validar, de forma autorizada e focada, riscos na camada de **Infrastructure-as-Code (Terraform/Ansible)** e na **integridade de artefatos** da cadeia de suprimentos. Busca demonstrar: misconfigurations de IaC que criam exposição ou excesso de privilégio (least-privilege violado), segredos em código/estado de IaC, e a ausência de garantias de integridade (assinatura/atestação/provenance) que permitiria promover um artefato não confiável a produção. O resultado deve evidenciar o blast radius e orientar hardening alinhado a SLSA, CIS Benchmarks e NIST.

## Escopo & Autorização
- Requer **autorização por escrito** especificando repositórios de IaC, contas/projetos de cloud, registries de artefatos e ambientes (preferir staging) no escopo. O usuário informa o alvo no uso.
- **NÃO** aplique mudanças de infraestrutura nem altere recursos fora do escopo. Operação padrão é **read-only / plan / dry-run**.
- Evite **DoS** e custos: não provisione recursos caros, não dispare pipelines de apply, não corrompa estado remoto (state) nem registries.
- **PARE e peça confirmação explícita** antes de qualquer `terraform apply`, `ansible-playbook` sem `--check`, modificação de state, publicação/promoção de artefato ou alteração de IAM. Use `terraform plan`, `validate` e `ansible --check`/`--diff` como padrão.
- Segredos descobertos em código ou state devem ser **mascarados**, **não exfiltrados** e **não reutilizados** sem autorização específica.

## Metodologia
Ancorada em **NIST SP 800-115**, **CIS Benchmarks**, **OWASP CICD-SEC (9 Improper Artifact Integrity Validation, 6 Credential Hygiene)** e **SLSA (provenance/attestation)**:
1. **Recon de IaC:** inventariar módulos Terraform, playbooks/roles Ansible, backends de state, e fluxo de promoção de artefatos (build→registry→deploy).
2. **Análise estática de IaC:** detectar misconfigurations (recursos públicos, criptografia desabilitada, security groups abertos, IAM permissivo) e violações de least-privilege.
3. **Higiene de segredos em IaC/state:** procurar credenciais hardcoded em variáveis, `tfvars`, `vault` Ansible mal configurado e segredos em plaintext no state remoto.
4. **Drift & blast radius (controlado):** via `plan`/`--check`, avaliar o que uma mudança não autorizada poderia alcançar; mapear privilégios efetivos do pipeline de apply.
5. **Integridade de artefatos:** verificar existência (ou ausência) de assinatura, atestação e provenance; testar se o deploy aceita artefato não verificado/adulterado e se tags de imagem são imutáveis.
6. **Documentação & limpeza:** consolidar evidências, remover artefatos de teste e confirmar que nenhum estado foi alterado.

## Técnicas & Ferramentas
- **IaC estático:** `checkov`, `tfsec`, `terrascan`, `kics`, `ansible-lint`; revisão de `terraform plan -out` e parsing do plano para análise de impacto.
- **Segredos:** `gitleaks`, `trufflehog`, `detect-secrets`; inspeção de state remoto (com autorização) e de `tfvars`/inventários Ansible em busca de credenciais.
- **Postura de cloud (read-only):** `prowler`, `ScoutSuite`, `cloudsplaining`/análise de políticas IAM para evidenciar excesso de privilégio; `nuclei`/`nmap` para confirmar exposições resultantes de recursos provisionados, somente no escopo.
- **Integridade de artefatos:** `cosign`/`sigstore` e atestações SLSA para verificar ou evidenciar ausência de assinatura/provenance; `trivy`/`grype` para conteúdo das imagens; checagem de imutabilidade e controle de acesso do registry.
- PoC **não destrutiva e reproduzível** (ex.: plan demonstrando recurso público, artefato-canário não assinado aceito em staging), sem armamento de malware.

## Entregáveis
- **Achados priorizados por risco** mapeados a CIS/CICD-SEC/SLSA, com avaliação de blast radius e probabilidade.
- **Evidências/PoC reproduzíveis:** saída de scanners, trechos de `plan`/`--check`, segredos mascarados com localização, e demonstração da lacuna de integridade (ex.: "artefato sem assinatura promovido a staging sem bloqueio").
- **Mapa de privilégios e exposição** derivado do IaC (recursos públicos, IAM excessivo, state inseguro).
- **Recomendações de remediação:** policy-as-code bloqueante no pipeline (checkov/tfsec/OPA), state remoto criptografado com acesso restrito e sem segredos em plaintext, gestão de segredos via vault/secret manager + credenciais efêmeras, least-privilege em IAM, e assinatura/atestação obrigatória de artefatos (cosign/SLSA) com verificação de provenance e tags imutáveis como gate de deploy.
- **Resumo executivo** com risco geral e plano de hardening priorizado.$SCTPL$),
  ($SCTPL$Avaliação Wireless Corporativa — Abrangente (WPA2/3-Enterprise, Evil Twin, Segmentação)$SCTPL$, $SCTPL$## Objetivo
Demonstrar e validar, de forma autorizada e controlada, a postura de segurança da infraestrutura sem fio corporativa. O engajamento busca evidenciar: (1) a robustez da autenticação WPA2/3-Enterprise (802.1X/EAP) contra captura e abuso de credenciais; (2) a viabilidade de ataques de Evil Twin / Rogue AP e a eficácia das proteções de cliente (validação de certificado do servidor RADIUS); (3) a força de PSKs em redes WPA2/3-Personal eventualmente presentes; (4) o isolamento efetivo entre a rede de convidados, a rede corporativa e segmentos sensíveis (servidores, OT/IoT, gestão). O resultado deve quantificar o risco real e orientar remediação priorizada.

## Escopo & Autorização
- **Pré-requisito obrigatório:** autorização formal POR ESCRITO (Rules of Engagement assinadas) cobrindo testes de RF, contendo SSIDs/BSSIDs autorizados, faixas de horário (janelas de teste), endereços físicos/perímetro do site, faixas de IP/VLANs em escopo e contatos de emergência.
- Tratar SSIDs e BSSIDs **fora da lista autorizada como estritamente proibidos** — não há "vizinho em escopo". Antes de qualquer ação direcionada, confirmar que o BSSID/SSID consta na autorização. Redes de terceiros próximas devem ser ignoradas e nunca atacadas.
- **Evitar dano e DoS:** não conduzir deauth/disassoc em massa, jamming, flood ou qualquer técnica que degrade a disponibilidade de produção. Deauth direcionado, quando autorizado, deve ser mínimo, limitado a clientes de teste designados e nunca a dispositivos críticos (médicos, OT, telefonia de emergência).
- **Parar e pedir confirmação** ao operador humano antes de qualquer ação de alto impacto ou potencialmente destrutiva: deauth de clientes de produção, levantar Evil Twin que possa capturar usuários reais, pivot para dentro de segmentos sensíveis, ou qualquer ação que ultrapasse a fronteira de segmentação. Capturar credenciais reais de usuários finais exige consentimento explícito e tratamento conforme privacidade/LGPD.
- Não exfiltrar dados reais. PoCs devem usar contas/dispositivos de teste sempre que possível. Toda credencial obtida deve ser tratada como sensível, armazenada cifrada e descartada ao fim do engajamento.

## Metodologia
Ancorada em **NIST SP 800-115** (planejamento, descoberta, ataque, relatório), **PTES** e **MITRE ATT&CK** (táticas de Network Sniffing T1040, Adversary-in-the-Middle T1557, Credential Access).

1. **Planejamento & Reconhecimento passivo (RF survey):** mapear SSIDs/BSSIDs em escopo, canais, bandas (2.4/5/6 GHz), tipos de criptografia/auth (WPA2/3-Personal vs Enterprise, métodos EAP), clientes associados, força de sinal e cobertura. Tudo em modo monitor, sem interação.
2. **Enumeração de autenticação:** identificar o método EAP (PEAP, EAP-TTLS, EAP-TLS), o RADIUS em uso e se os clientes validam o certificado do servidor (vetor crítico para Evil Twin).
3. **Validação de Evil Twin / Rogue AP (controlado):** com dispositivos de teste designados, avaliar se um AP impostor com o mesmo SSID consegue induzir associação e captura de identidade/credencial EAP — medindo a eficácia da validação de certificado do lado cliente.
4. **Captura de handshake & análise de PSK (quando aplicável):** em redes WPA2/3-Personal em escopo, capturar handshake (preferencialmente via cliente de teste) e avaliar a força do PSK por análise offline.
5. **Teste de segmentação:** a partir da rede de convidados e da rede corporativa, validar isolamento de cliente (client isolation), filtragem entre VLANs e alcance a segmentos sensíveis e à internet apenas.
6. **Pós-associação (se autorizado):** uma vez na rede corporativa, enumeração leve de rede para confirmar o blast radius, sem armar payloads nem comprometer hosts.
7. **Relatório:** consolidação, priorização por risco e recomendações.

## Técnicas & Ferramentas
- **RF survey / descoberta:** placa em modo monitor; `airodump-ng` (suite Aircrack-ng), `Kismet`, `hcxdumptool` para coleta; análise de espectro/cobertura com ferramentas de site survey.
- **Enumeração EAP / Enterprise:** `eaphammer`, `hostapd-wpe` para avaliar validação de certificado e captura de identidade EAP em ambiente de teste; inspeção de tráfego RADIUS com `Wireshark`.
- **Evil Twin controlado:** `eaphammer`/`hostapd-wpe` ou `airbase-ng` apenas com SSID autorizado e clientes de teste; captive portal somente quando explicitamente autorizado.
- **Handshake & análise de PSK:** captura com `hcxdumptool`/`airodump-ng`; conversão com `hcxpcapngtool`; avaliação de força offline com `hashcat`/`aircrack-ng` usando wordlists, **sem incluir credenciais reais no relatório em texto claro**.
- **Deauth direcionado (se autorizado, mínimo):** `aireplay-ng` limitado a clientes de teste — nunca em massa.
- **Segmentação / pós-associação:** `nmap` (host discovery e port scan controlado entre VLANs), `arp-scan`, `responder` apenas em modo de análise quando autorizado, verificação de rotas e ACLs. Sem exploração de hosts nem deploy de malware.
- **Frameworks de referência:** mapear achados a MITRE ATT&CK e controles do NIST.

## Entregáveis
- **Sumário executivo** com a postura geral da rede wireless e o risco agregado.
- **Achados priorizados por risco** (Crítico→Baixo), cada um com: descrição, BSSID/SSID/segmento afetado, evidência reproduzível (capturas, logs de associação, prova de cross-VLAN), e impacto. Ex.: clientes que não validam certificado RADIUS (Evil Twin viável), PSK fraco, ausência de client isolation no guest, vazamento entre VLAN de convidados e corporativa.
- **PoCs reproduzíveis** com passos, ferramentas e parâmetros — sem material de armamento ofensivo.
- **Recomendações de remediação:** preferência por EAP-TLS (certificados de cliente); enforcement de validação de certificado do servidor via configuração gerenciada/MDM; PSKs fortes e únicos / migração para WPA3-SAE; PMF (802.11w) habilitado; client isolation e segmentação L3 com ACLs entre guest/corp/sensível; WIDS/WIPS para detecção de rogue AP; rotação de credenciais comprometidas.
- **Matriz de evidências** vinculando cada achado a frameworks (NIST SP 800-115 / MITRE ATT&CK) para rastreabilidade defensiva.$SCTPL$),
  ($SCTPL$Pentest Wireless Focado — Resiliência WPA2/3-Enterprise a Evil Twin e Roubo de Credencial EAP$SCTPL$, $SCTPL$## Objetivo
Avaliação focada e profunda da resiliência da rede WPA2/3-Enterprise (802.1X/EAP) a ataques de Adversary-in-the-Middle via Evil Twin / Rogue AP. O objetivo central é validar, de forma autorizada, se os clientes corporativos validam corretamente o certificado do servidor RADIUS e se o método EAP em uso protege as credenciais de identidade contra captura e quebra offline. Entregar evidência clara sobre se um atacante na faixa de RF conseguiria induzir associação e coletar material de autenticação — e como fechar essa lacuna.

## Escopo & Autorização
- **Autorização POR ESCRITO obrigatória**, com Rules of Engagement assinadas listando: SSIDs/BSSIDs corporativos autorizados, perímetro físico, janelas de teste, dispositivos e contas de teste designados, e contatos de escalonamento.
- Atuar **somente** sobre o(s) SSID(s) explicitamente autorizado(s). Qualquer rede não listada (incluindo vizinhança) está fora de escopo e não deve ser tocada. Validar BSSID/SSID contra a autorização antes de cada ação.
- **Sem DoS / sem disrupção de produção:** proibido deauth em massa, jamming ou flood. Deauth, se autorizado, restrito a clientes de teste designados e mínimo — nunca a dispositivos de produção ou críticos.
- **Parar e confirmar com o operador humano** antes de: levantar um Evil Twin em ambiente onde usuários reais possam se associar, capturar identidades/credenciais que possam pertencer a usuários reais, ou qualquer ação de impacto não trivial. Captura de credencial real só com consentimento explícito e tratamento conforme privacidade/LGPD.
- Credenciais/identidades coletadas: tratar como dados sensíveis, armazenar cifrado, **não** publicar em texto claro no relatório, e descartar com segurança ao final.

## Metodologia
Ancorada em **MITRE ATT&CK** (T1557 Adversary-in-the-Middle, T1040 Network Sniffing, T1110 Brute Force para análise offline) e **NIST SP 800-115**.

1. **Reconhecimento passivo:** identificar BSSIDs do SSID alvo, canais, banda, e o método EAP anunciado/observado (PEAP-MSCHAPv2, EAP-TTLS, EAP-TLS). Sem interação ativa.
2. **Caracterização do cliente:** com dispositivos de teste, observar o comportamento de associação e, crucialmente, se há validação do certificado do servidor RADIUS (CN/SAN/CA confiável) e "server name" fixado.
3. **Avaliação Evil Twin controlada:** com SSID autorizado e apenas clientes de teste, levantar AP impostor para verificar se o cliente associa e entrega material EAP — medindo a eficácia da validação de certificado.
4. **Análise do material capturado:** para PEAP/TTLS-MSCHAPv2, avaliar offline a força/quebra do challenge-response em laboratório; para EAP-TLS, confirmar a proteção por certificado de cliente.
5. **Conclusão de risco & remediação.**

## Técnicas & Ferramentas
- **Descoberta passiva:** modo monitor; `airodump-ng`, `Kismet`; inspeção de troca EAP/RADIUS com `Wireshark`.
- **Evil Twin / captura de identidade (ambiente de teste):** `eaphammer` ou `hostapd-wpe` configurados para o SSID autorizado, usados para verificar validação de certificado e captura de identidade/challenge com clientes de teste designados.
- **Análise offline:** extração do hash MSCHAPv2 capturado e avaliação com `hashcat` / `asleap` em laboratório, apenas para mensurar exposição — **sem expor segredos reais no relatório**.
- **Deauth direcionado (se autorizado):** `aireplay-ng` limitado a clientes de teste para acelerar a captura de associação, mínimo e controlado.
- **Sem** deploy de malware, sem pivot para dentro da rede neste template (escopo focado em autenticação wireless).

## Entregáveis
- **Achado central com classificação de risco:** os clientes validam ou não o certificado do servidor RADIUS? Evil Twin é viável? Qual o esforço para quebra de credencial PEAP-MSCHAPv2?
- **Evidência reproduzível:** logs de associação ao AP de teste, captura da troca EAP (sanitizada), demonstração de validação ausente/presente — passos reproduzíveis.
- **Recomendações de remediação priorizadas:** migrar para **EAP-TLS** com certificados de cliente; impor validação de certificado do servidor e "trusted server name" via política gerenciada/MDM/GPO; desabilitar fallback para métodos inseguros; PMF (802.11w); monitoramento WIDS/WIPS para rogue AP; rotação de credenciais expostas.
- **Mapeamento** dos achados a MITRE ATT&CK e NIST SP 800-115 para rastreabilidade e métricas defensivas.$SCTPL$),
  ($SCTPL$Validação de Segmentação Wi-Fi de Convidados — Isolamento Guest x Corporativo$SCTPL$, $SCTPL$## Objetivo
Engajamento focado em validar, de forma autorizada, o isolamento e a segmentação da rede Wi-Fi de convidados (guest). O objetivo é demonstrar se um dispositivo conectado ao SSID de convidados consegue: (1) alcançar outros clientes no mesmo SSID (falha de client isolation); (2) atravessar para a rede corporativa, VLANs internas ou segmentos sensíveis (servidores, gestão, OT/IoT); (3) abusar de serviços expostos (DNS, DHCP, captive portal) ou exceder o acesso pretendido (somente internet). Entregar evidência objetiva da fronteira de segmentação e priorizar correções.

## Escopo & Autorização
- **Autorização POR ESCRITO obrigatória** com Rules of Engagement assinadas: SSID de convidados autorizado, faixas de IP/VLANs em escopo, segmentos explicitamente permitidos e proibidos para teste, janela de execução e contatos de emergência.
- Operar **somente** a partir do SSID de convidados autorizado e dentro das faixas/segmentos listados. Tratar qualquer host/segmento não autorizado como **fora de escopo** — não escanear nem interagir. Confirmar alvo contra a autorização antes de cada ação.
- **Evitar dano e DoS:** scans devem ser controlados (rate-limit, sem varreduras agressivas que afetem disponibilidade). Proibido flood, exaustão de DHCP, ou qualquer técnica disruptiva. Nada de ataques de RF (deauth/jamming) — o foco é a camada de rede após associação legítima de um dispositivo de teste.
- **Parar e pedir confirmação** ao operador humano antes de: cruzar de fato para um segmento sensível identificado como alcançável, interagir com qualquer host de produção, ou qualquer ação de impacto não trivial. A confirmação de cross-segmentação deve ser a mínima necessária para provar o caminho — sem exploração nem comprometimento de hosts.
- Não exfiltrar dados reais; usar hosts/contas de teste sempre que possível. Logs e evidências tratados como sensíveis.

## Metodologia
Ancorada em **NIST SP 800-115** (descoberta e validação de controles de rede) e **PTES**, com mapeamento a **MITRE ATT&CK** (T1046 Network Service Discovery, T1040 Network Sniffing, Lateral Movement).

1. **Associação legítima** ao SSID de convidados com dispositivo de teste e caracterização do que é entregue (IP, gateway, DNS, captive portal, restrições de portal).
2. **Client isolation:** verificar se clientes no mesmo SSID se enxergam (ARP, ping, descoberta de serviços) — falha comum de configuração.
3. **Mapeamento de fronteira L3:** a partir do guest, descoberta controlada de gateways, rotas e alcance a faixas internas vs. apenas internet.
4. **Travessia de VLAN / segmento:** testar filtragem entre guest e corporativo/sensível; avaliar VLAN hopping, ACLs ausentes e serviços indevidamente expostos ao guest.
5. **Serviços de borda:** avaliar DNS aberto/recursivo, fuga do captive portal, e DHCP.
6. **Conclusão de risco & remediação.**

## Técnicas & Ferramentas
- **Caracterização de rede:** inspeção de DHCP/DNS/rotas; `Wireshark`/`tcpdump` em modo análise.
- **Descoberta controlada:** `nmap` (host discovery, port scan com rate-limit), `arp-scan` para client isolation, `fping` para alcance — todos limitados às faixas autorizadas.
- **Travessia / VLAN:** avaliação de tags 802.1Q e VLAN hopping (ex.: `yersinia`/`scapy` somente se autorizado e controlado), verificação de ACLs entre segmentos.
- **Borda:** testes de DNS recursivo/exfil via DNS, técnicas de bypass de captive portal (validação de filtragem por MAC/IP/DNS) — para mensurar exposição, sem armar payloads.
- **Sem** exploração de hosts, sem deploy de malware, sem comprometimento — apenas prova de alcance/segmentação.

## Entregáveis
- **Achados priorizados por risco** com escopo claro do que o guest alcança indevidamente: falha de client isolation, cross-VLAN para corporativo, acesso a segmento sensível, DNS aberto, bypass de captive portal.
- **Evidência reproduzível:** saídas de scan sanitizadas, capturas mostrando o caminho de travessia, prova de alcance a host/serviço fora do pretendido — com passos reproduzíveis.
- **Recomendações de remediação:** habilitar client isolation no SSID guest; segmentação L3 com ACLs/firewall negando guest→corp/sensível (default-deny, somente internet); VLANs dedicadas e bem filtradas; DNS de convidados restrito; endurecimento do captive portal; monitoramento de tentativas de travessia.
- **Mapeamento** a MITRE ATT&CK e NIST SP 800-115 para rastreabilidade defensiva e verificação de re-teste.$SCTPL$)
) AS v(title, text)
WHERE u.role_id = 1
  AND NOT EXISTS (
    SELECT 1 FROM flow_templates ft WHERE ft.user_id = u.id AND ft.title = v.title
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DELETE FROM flow_templates WHERE title IN ($SCTPL$Pentest de Aplicação Web — OWASP WSTG Completo$SCTPL$, $SCTPL$Pentest Focado — Controle de Acesso & APIs (IDOR/BOLA & Privilege Escalation)$SCTPL$, $SCTPL$Pentest Focado — Injeção & Server-Side (SQLi, XSS, SSTI, SSRF, Deserialização)$SCTPL$, $SCTPL$Pentest de APIs REST/GraphQL — OWASP API Security Top 10 (Abrangente)$SCTPL$, $SCTPL$Teste Focado de Autorização em API — BOLA/IDOR & BFLA Multi-Tenant$SCTPL$, $SCTPL$Avaliação de Segurança de API GraphQL — Introspection, Abuso e Autenticação$SCTPL$, $SCTPL$Pentest Externo de Perímetro — Enumeração de Superfície de Ataque (PTES + NIST SP 800-115)$SCTPL$, $SCTPL$Pentest Externo Focado — E-mail, DNS e VPN/Acesso Remoto$SCTPL$, $SCTPL$Pentest de Rede Interna e Active Directory — Engajamento Abrangente (MITRE ATT&CK)$SCTPL$, $SCTPL$Avaliação Focada de Kerberos — Kerberoasting e AS-REP Roasting$SCTPL$, $SCTPL$Avaliação Focada de Coercion e NTLM Relay em Rede Interna$SCTPL$, $SCTPL$Pentest de Nuvem — Avaliação Abrangente Multi-Conta (AWS/Azure/GCP)$SCTPL$, $SCTPL$Pentest de IAM em Nuvem — Privilege Escalation e Lateral Movement (Gray-Box)$SCTPL$, $SCTPL$Pentest de Nuvem Focado — SSRF, Metadata Service e Exposição de Segredos$SCTPL$, $SCTPL$Pentest de Cluster Kubernetes — Avaliação Abrangente (CIS Benchmark + MITRE ATT&CK for Containers)$SCTPL$, $SCTPL$Pentest Focado — Escape de Container e Comprometimento de Nó (ATT&CK: Escape to Host)$SCTPL$, $SCTPL$Pentest Focado — RBAC do Cluster, Secrets e Supply Chain de Imagens$SCTPL$, $SCTPL$Pentest de Aplicação Mobile — OWASP MASVS/MASTG Completo (Android & iOS)$SCTPL$, $SCTPL$Auditoria Focada — Armazenamento Inseguro & Hardcoded Secrets em App Mobile (MASVS-STORAGE/CRYPTO)$SCTPL$, $SCTPL$Teste Focado — Segurança de Comunicação & Resistência a Engenharia Reversa (MASVS-NETWORK/RESILIENCE)$SCTPL$, $SCTPL$Emulação de Adversário — Operação Full-Chain MITRE ATT&CK (Ambiente Corporativo Windows/AD)$SCTPL$, $SCTPL$Red Team Focado — Validação de Acesso Inicial e Foothold em Superfície Externa$SCTPL$, $SCTPL$Emulação de Adversário — Credential Access e Lateral Movement (Assume Breach)$SCTPL$, $SCTPL$Escalonamento de Privilégios Local — Linux & Windows (Abrangente)$SCTPL$, $SCTPL$Privilege Escalation Linux — Sudo, SUID & Capabilities (Focado)$SCTPL$, $SCTPL$Privilege Escalation Windows — Serviços, Tarefas & Tokens (Focado)$SCTPL$, $SCTPL$OSINT & Reconhecimento Passivo — Footprint Completo da Organização$SCTPL$, $SCTPL$Reconhecimento Passivo Focado — Vazamento de Credenciais & Segredos$SCTPL$, $SCTPL$Pentest de CI/CD e Cadeia de Suprimentos — Avaliação Abrangente$SCTPL$, $SCTPL$Pentest Focado — Segredos e Integridade em Pipelines GitHub Actions / GitLab CI$SCTPL$, $SCTPL$Pentest Focado — Segurança de IaC (Terraform/Ansible) e Integridade de Artefatos$SCTPL$, $SCTPL$Avaliação Wireless Corporativa — Abrangente (WPA2/3-Enterprise, Evil Twin, Segmentação)$SCTPL$, $SCTPL$Pentest Wireless Focado — Resiliência WPA2/3-Enterprise a Evil Twin e Roubo de Credencial EAP$SCTPL$, $SCTPL$Validação de Segmentação Wi-Fi de Convidados — Isolamento Guest x Corporativo$SCTPL$);
-- +goose StatementEnd
