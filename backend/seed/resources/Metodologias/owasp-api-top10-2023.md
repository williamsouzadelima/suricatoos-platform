# OWASP API Security Top 10 (2023) — Referência de Teste e Remediação

> Documento de referência rápida para testes AUTORIZADOS de APIs (REST/GraphQL/gRPC). Use somente em escopo contratado, com autorização por escrito. Foque em validação de PoC mínima e remediação. Não execute ações destrutivas (DELETE/PUT em massa, fuzz de produção) sem aprovação explícita.

## Setup rápido do ambiente de teste

```bash
# Proxy intercept (capture/replay)
mitmproxy --listen-port 8080            # ou Burp Suite / OWASP ZAP

# Cliente HTTP para PoC reproduzível
curl -s -X GET 'https://api.alvo.tld/v1/users/1042' \
  -H 'Authorization: Bearer <TOKEN_A>' -i

# httpie (mais legível)
http GET https://api.alvo.tld/v1/users/1042 "Authorization:Bearer <TOKEN_A>"

# Descoberta de superfície / specs
curl -s https://api.alvo.tld/openapi.json | jq '.paths | keys'
curl -s https://api.alvo.tld/swagger.json
curl -s https://api.alvo.tld/.well-known/openapi
# GraphQL introspection
curl -s -X POST https://api.alvo.tld/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{__schema{types{name fields{name}}}}"}' | jq
```

Ferramentas úteis: `Burp Suite` (Repeater/Intruder/Autorize), `OWASP ZAP`, `Postman`, `ffuf`/`feroxbuster` (enum de endpoints), `kiterunner` (`kr scan` para descoberta de rotas de API), `jwt_tool`/`jwt.io` (análise de JWT), `arjun` (descoberta de parâmetros), `graphql-cop`/`InQL` (GraphQL).

---

## API1:2023 — Broken Object Level Authorization (BOLA / IDOR)

O objeto é acessado por um ID, mas o servidor não valida se o usuário autenticado pode acessar AQUELE objeto. É a falha nº1 mais comum e impactante.

**Como testar**
- Capture uma requisição autenticada que referencie um objeto por ID (`/orders/9001`, `?account_id=42`, UUID no corpo).
- Repita com o token de OUTRO usuário (usuário B) e o ID do usuário A. Se retornar dados de A, é BOLA.
- Teste IDs sequenciais, decremento/incremento, IDs de outro tenant, e também UUIDs vazados em respostas anteriores.
- Cubra todos os verbos: `GET` (leitura), `PUT/PATCH` (alteração), `DELETE` (remoção) do mesmo objeto.

```bash
# PoC: usuário B lê recurso do usuário A
curl -s 'https://api.alvo.tld/v1/invoices/A1023' -H 'Authorization: Bearer <TOKEN_USER_B>' -i
# Burp: extensão Autorize compara respostas com/sem privilégio automaticamente.
```

**Remediação**
- Verificação de autorização por objeto em CADA acesso, no servidor, baseada na identidade da sessão — nunca confie em ID vindo do cliente.
- Use UUIDs/IDs aleatórios (não previsíveis) como defesa em profundidade, nunca como controle único.
- Centralize a checagem (ex.: policy/ABAC) e teste com casos negativos automatizados em CI.

---

## API2:2023 — Broken Authentication

Mecanismos de autenticação implementados incorretamente: credenciais fracas, tokens mal validados, fluxos de recuperação quebrados.

**Como testar**
- Endpoints sem rate limit em `/login`, `/token`, `/otp` → credential stuffing / brute force / OTP brute.
- JWT: `alg:none`, troca de algoritmo (RS256→HS256 usando a chave pública como segredo), assinatura não validada, `exp` ignorado.
- Tokens que não expiram, não são revogados em logout, ou são previsíveis.
- Reset de senha por token fraco/previsível; enumeração de usuário por mensagens distintas.

```bash
# Inspecionar claims do JWT
jwt_tool <JWT> -T          # tampering interativo
jwt_tool <JWT> -X a        # ataque alg:none
jwt_tool <JWT> -X k -pk public.pem   # confusão de algoritmo RS256->HS256

# Testar ausência de rate limit (use lista pequena e autorizada)
ffuf -w senhas.txt -X POST -u https://api.alvo.tld/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"user":"vitima@tld","pass":"FUZZ"}' -mc all -fr 'invalid'
```

**Remediação**
- Rate limiting + lockout progressivo + CAPTCHA em endpoints de auth; MFA para contas sensíveis.
- JWT: fixar `alg` esperado no servidor, validar assinatura/`exp`/`aud`/`iss`; segredos fortes; rotacionar chaves.
- Tokens curtos + refresh com revogação; invalidar sessão no logout/troca de senha.
- Mensagens de erro genéricas (sem enumeração).

---

## API3:2023 — Broken Object Property Level Authorization

Fusão de "Excessive Data Exposure" e "Mass Assignment". O usuário lê/escreve propriedades de objeto que não deveria.

**Como testar (exposição)**
- Compare a resposta da API com o que a UI realmente exibe; procure campos sensíveis vazando (`password_hash`, `is_admin`, `internal_notes`, PII).

**Como testar (mass assignment)**
- Adicione propriedades extras no corpo de `POST/PUT/PATCH` para escalar privilégio ou burlar lógica.

```bash
# Mass assignment: injetar campo privilegiado
curl -s -X PATCH 'https://api.alvo.tld/v1/users/me' \
  -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' \
  -d '{"display_name":"teste","role":"admin","verified":true,"balance":99999}'
```

**Remediação**
- Allow-list explícita de propriedades retornadas e editáveis por endpoint/papel (DTO/schema), nunca `to_dict()` do modelo inteiro nem bind automático de todo o body.
- Separar schemas de leitura/escrita; validar com JSON Schema/Pydantic.
- Negar campos não esperados (`additionalProperties: false`).

---

## API4:2023 — Unrestricted Resource Consumption

Falta de limites permite DoS e custo financeiro (cobranças por chamada/CPU/SMS).

**Como testar (cuidado: potencialmente disruptivo — só com janela autorizada)**
- Paginação sem teto (`?limit=1000000`), payloads grandes, profundidade/aninhamento de GraphQL, upload sem limite de tamanho.
- Ausência de rate limit por IP/token; endpoints que disparam e-mail/SMS sem throttle.

```bash
# Teste de limite de paginação (resposta enorme = risco)
curl -s 'https://api.alvo.tld/v1/items?limit=1000000&offset=0' -H 'Authorization: Bearer <TOKEN>' -o /dev/null -w '%{size_download} bytes em %{time_total}s\n'

# GraphQL: aninhamento profundo (depth/alias abuse)
# { a { b { c { d { e { f { ... } } } } } } }  -> rejeitar acima de N níveis
```

**Remediação**
- Rate limiting e quotas por cliente/token; `max page size`; timeouts; limites de tamanho de payload e upload.
- GraphQL: limitar profundidade, complexidade e número de aliases; desabilitar introspection em produção quando não necessário.
- Circuit breakers e billing alerts para recursos pagos.

---

## API5:2023 — Broken Function Level Authorization (BFLA)

Usuário comum acessa funções administrativas/de outro papel (vertical privilege escalation).

**Como testar**
- Enumere endpoints administrativos (`/admin/...`, `/v1/users/{id}/role`) e chame com token de usuário comum.
- Troque o método HTTP (`GET`→`DELETE`/`PUT`) em rotas que só deveriam permitir leitura.
- Mapear rotas a partir do OpenAPI e testar acesso por papel.

```bash
# Usuário comum tentando função admin
curl -s -X DELETE 'https://api.alvo.tld/v1/admin/users/55' \
  -H 'Authorization: Bearer <TOKEN_USER_COMUM>' -i
# Burp Autorize: repete cada request com sessão de menor privilégio.
```

**Remediação**
- Deny-by-default; checagem de papel/permissão no servidor por função e por método.
- Não expor rotas admin por obscuridade; aplicar RBAC/ABAC consistente e testar com matriz de papéis.

---

## API6:2023 — Unrestricted Access to Sensitive Business Flows

Automação abusa de fluxos de negócio legítimos (compra de ingressos/estoque, criação em massa de contas, spam de comentários) sem ataque "técnico".

**Como testar**
- Identifique fluxos sensíveis e tente automatizar em escala: criação de contas, reserva, checkout, cupons.
- Verifique se há anti-automation (device fingerprint, CAPTCHA, throttling por entidade de negócio).

**Remediação**
- Detecção de automação (fingerprint, comportamento), CAPTCHA, limites por fluxo de negócio (não só por IP).
- Filas/aprovação para ações de alto impacto; análise de fraude.

---

## API7:2023 — Server Side Request Forgery (SSRF)

A API busca um recurso a partir de URL fornecida pelo usuário sem validar o destino.

**Como testar**
- Campos que aceitam URL: webhooks, import por URL, geração de preview/thumbnail, avatar por link.
- Aponte para endereços internos/metadata e observe respostas, tempos ou interações fora de banda.

```bash
# PoC fora-de-banda (use seu próprio colaborador/oast autorizado)
curl -s -X POST 'https://api.alvo.tld/v1/import' \
  -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' \
  -d '{"url":"http://SEU-OAST.example/abc123"}'
# Alvos clássicos a validar (metadata cloud): 169.254.169.254 (IMDS), localhost, faixas RFC1918.
```

**Remediação**
- Allow-list de hosts/esquemas/portas; resolver DNS e validar IP final (bloquear RFC1918, loopback, link-local, IMDS).
- Desabilitar redirects ou revalidar a cada hop; IMDSv2; egress restrito por firewall; sem retornar corpo bruto da requisição interna.

---

## API8:2023 — Security Misconfiguration

Configs inseguras em qualquer camada: CORS permissivo, headers ausentes, verbose errors, TLS fraco, debug ligado.

**Como testar**
```bash
# CORS permissivo (reflete Origin arbitrária + credenciais)
curl -s -I 'https://api.alvo.tld/v1/me' -H 'Origin: https://evil.example' \
  -H 'Authorization: Bearer <TOKEN>' | grep -i 'access-control'
# Procurar: Access-Control-Allow-Origin: https://evil.example + Allow-Credentials: true

# Headers de segurança e stack trace
curl -s -I https://api.alvo.tld/v1/health
curl -s 'https://api.alvo.tld/v1/items/abc' -H 'Authorization: Bearer <TOKEN>'  # erro deve ser genérico

# Métodos HTTP permitidos
curl -s -X OPTIONS https://api.alvo.tld/v1/items -i
# TLS
nmap --script ssl-enum-ciphers -p 443 api.alvo.tld
```

**Remediação**
- CORS restrito (sem `*` com credenciais); headers (`HSTS`, `X-Content-Type-Options`, `Cache-Control`); desligar debug/verbose errors em prod.
- Hardening por baseline (CIS), TLS 1.2+, desabilitar métodos não usados, patching contínuo.

---

## API9:2023 — Improper Inventory Management

Versões antigas/expostas (`/v1` legado, `/beta`, `/internal`), hosts esquecidos, docs vazadas.

**Como testar**
```bash
# Enumerar versões e ambientes
ffuf -w wordlist-api.txt -u https://api.alvo.tld/FUZZ -mc 200,401,403
kr scan https://api.alvo.tld -w routes-large.kite   # kiterunner
# Subdomínios (escopo!): api-staging, api-old, dev-api
subfinder -d alvo.tld | httpx -title -status-code
```
- Compare versões: a `/v1` legada pode não ter os controles da `/v2`.

**Remediação**
- Inventário vivo de APIs/hosts/versões; depreciar e remover versões antigas; separar ambientes; restringir docs internas; gateway com catálogo central.

---

## API10:2023 — Unsafe Consumption of APIs

A aplicação confia cegamente em dados de APIs de terceiros (integrações, parceiros), abrindo injeção/SSRF/dados maliciosos.

**Como testar**
- Mapeie integrações outbound; verifique se respostas de terceiros são validadas/sanitizadas antes de uso (render, query, redirect).
- Teste se a app segue redirects de terceiros sem validação ou aceita TLS inseguro.

**Remediação**
- Validar e sanitizar dados recebidos de terceiros como entrada não confiável; TLS obrigatório; não seguir redirects cegamente; timeouts e allow-list de integrações; isolar parsing de respostas.

---

## Checklist de bolso (por engajamento)

- [ ] Obter spec (OpenAPI/GraphQL) e mapear TODAS as rotas + métodos
- [ ] Dois usuários de papéis diferentes + um de outro tenant para testes de autz (BOLA/BFLA)
- [ ] Testar cada verbo em cada objeto (GET/POST/PUT/PATCH/DELETE)
- [ ] Analisar todos os JWT/sessões (alg, exp, revogação)
- [ ] Procurar campos sensíveis em respostas (API3) e injetar campos em escrita (mass assignment)
- [ ] Validar limites: paginação, payload, rate, profundidade GraphQL
- [ ] Campos de URL → SSRF (com OAST autorizado)
- [ ] CORS/headers/erros verbosos/TLS
- [ ] Enumerar versões/ambientes legados
- [ ] Confirmar cada achado com PoC reproduzível e impacto de negócio

## Referências
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/
- OWASP API Security Project / cheatsheets associadas (Authorization Testing, GraphQL, REST Security).