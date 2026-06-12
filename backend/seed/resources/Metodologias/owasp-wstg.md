# OWASP WSTG v4.2 — Web Security Testing Guide

> **Uso autorizado.** Teste apenas aplicações dentro do escopo com autorização por escrito. Em produção, prefira PoCs não destrutivas; evite payloads que alterem/derrubem dados. Os exemplos abaixo são de **detecção e PoC mínima**, no espírito do guia OWASP.

O **WSTG v4.2** organiza o teste de aplicações web em categorias com IDs estáveis (`WSTG-XXXX-NN`), ideais para rastrear cobertura e referenciar achados no relatório.

## Categorias (visão geral)

| Prefixo | Categoria |
|---|---|
| INFO | Information Gathering |
| CONF | Configuration & Deployment Management |
| IDNT | Identity Management |
| ATHN | Authentication |
| ATHZ | Authorization |
| SESS | Session Management |
| INPV | Input Validation |
| ERRH | Error Handling |
| CRYP | Cryptography |
| BUSL | Business Logic |
| CLNT | Client-side Testing |
| APIT | API Testing |

---

## INFO — Information Gathering
- [ ] Fingerprint do servidor/web framework, headers, métodos HTTP (`WSTG-INFO-02/03`).
- [ ] Enumerar conteúdo e endpoints; analisar `robots.txt`, sitemaps, comentários, JS.
- [ ] Mapear superfície de ataque e pontos de entrada (`WSTG-INFO-06`).
```bash
whatweb -a 3 https://app.exemplo.com
httpx -u https://app.exemplo.com -title -tech-detect -server
ffuf -u https://app.exemplo.com/FUZZ -w wordlist.txt -mc 200,301,302,403
curl -sI https://app.exemplo.com    # headers, server, métodos
```
**Remediação:** remover banners/versões, desabilitar métodos não usados (`TRACE`), limpar comentários e dados sensíveis no front.

## CONF — Configuration & Deployment Management
- [ ] TLS/SSL e cipher suites (`WSTG-CRYP-01` correlato).
- [ ] Arquivos/diretórios expostos: `.git`, `.env`, backups, `/admin`, `/actuator`.
- [ ] Headers de segurança: `Content-Security-Policy`, `HSTS`, `X-Content-Type-Options`.
- [ ] Permissões e métodos HTTP; CORS mal configurado.
```bash
testssl.sh https://app.exemplo.com
nuclei -u https://app.exemplo.com -t http/exposures/ -t http/misconfiguration/
curl -s https://app.exemplo.com/.git/HEAD
```
**Remediação:** hardening de servidor, remover artefatos de deploy, CSP/HSTS, CORS restritivo (sem `*` com credenciais).

## IDNT — Identity Management
- [ ] Enumeração de usuários (mensagens distintas, timing, registro).
- [ ] Processo de registro/provisionamento e roles atribuídas.
**Remediação:** respostas genéricas, rate limiting, fluxo de provisionamento consistente.

## ATHN — Authentication
- [ ] Credenciais default/fracas; política de senhas (`WSTG-ATHN-07`).
- [ ] Brute force e lockout (`WSTG-ATHN-03`); MFA bypass.
- [ ] Canal de transporte das credenciais (somente HTTPS).
- [ ] Funções de reset/"lembrar senha" e enumeração via reset.
```bash
# Apenas com listas acordadas / contas de teste; respeitar rate limit
hydra -L users.txt -P pass.txt app.exemplo.com https-post-form \
  "/login:user=^USER^&pass=^PASS^:F=invalid credentials"
```
**Remediação:** MFA, lockout/throttling, política de senha + verificação contra senhas vazadas, mensagens genéricas.

## ATHZ — Authorization
- [ ] **IDOR / BOLA**: trocar IDs de objeto e acessar dados de terceiros.
- [ ] Privilege escalation horizontal e vertical (`WSTG-ATHZ-02/03`).
- [ ] Path traversal e bypass de controle de acesso por força bruta de rota.
```bash
# IDOR: comparar resposta entre contas A e B
curl -s -H "Authorization: Bearer $TOKEN_A" https://app.exemplo.com/api/orders/1002
# (1002 pertence ao usuário B?)  -> acesso indevido = IDOR
```
**Remediação:** checagem de autorização **server-side** por objeto/ação, referências indiretas, deny-by-default.

## SESS — Session Management
- [ ] Atributos de cookie: `HttpOnly`, `Secure`, `SameSite`.
- [ ] Fixação de sessão; rotação de ID no login; expiração e logout.
- [ ] **CSRF** (`WSTG-SESS-05`): tokens anti-CSRF presentes e validados.
```bash
curl -sI https://app.exemplo.com/login | grep -i set-cookie
```
**Remediação:** cookies `HttpOnly; Secure; SameSite=Lax/Strict`, renovar sessão pós-login, tokens anti-CSRF, timeout adequado.

## INPV — Input Validation (alta densidade de achados)
- [ ] **SQL Injection** (`WSTG-INPV-05`).
- [ ] **XSS** refletido/armazenado/DOM (`WSTG-INPV-01/02`).
- [ ] Command/OS injection, SSTI, LDAP/XPath, **SSRF** (`WSTG-INPV-19`), XXE.
- [ ] Open redirect, HTTP parameter pollution, deserialização insegura.
```bash
# SQLi (PoC controlada, sem dump destrutivo)
sqlmap -u "https://app.exemplo.com/item?id=1" --batch --level 2 --risk 1

# XSS / fuzzing de parâmetros
dalfox url "https://app.exemplo.com/search?q=FUZZ"

# SSRF (detecção via callback OOB - canary próprio)
curl "https://app.exemplo.com/fetch?url=http://<seu-collaborator>"
```
**Remediação:** queries parametrizadas/ORM, output encoding contextual + CSP (XSS), allowlist de entrada, bloqueio de redes internas/metadata para SSRF, desabilitar entidades externas XML (XXE).

## ERRH — Error Handling
- [ ] Stack traces, mensagens detalhadas, debug habilitado em produção.
**Remediação:** páginas de erro genéricas, logging server-side, desabilitar debug.

## CRYP — Cryptography
- [ ] TLS fraco/desatualizado, certificados inválidos, HSTS ausente.
- [ ] Dados sensíveis em trânsito/repouso sem cifragem; algoritmos obsoletos.
```bash
sslscan app.exemplo.com:443
```
**Remediação:** TLS 1.2+/1.3, suites fortes, HSTS, cifrar dados em repouso, evitar MD5/SHA1/DES.

## BUSL — Business Logic
- [ ] Abuso de fluxo (pular etapas, valores negativos, race conditions).
- [ ] Limites de quantidade/preço, replays, uso indevido de funcionalidade.
**Remediação:** validação de estado/regra no servidor, controles de integridade, idempotência e travas contra corrida.

## CLNT — Client-side Testing
- [ ] DOM-based XSS, manipulação de DOM, `postMessage`, CORS, clickjacking.
- [ ] Armazenamento sensível em `localStorage`/`sessionStorage`.
**Remediação:** CSP, `X-Frame-Options`/`frame-ancestors`, validação de origem em `postMessage`, não armazenar segredos no cliente.

## APIT — API Testing
- [ ] **BOLA/BFLA** (autorização por objeto/função), excesso de dados retornados.
- [ ] Rate limiting, mass assignment, versionamento/endpoints shadow.
- [ ] Auth de tokens JWT (alg `none`, assinatura, expiração).
```bash
ffuf -u https://api.exemplo.com/v1/FUZZ -w api-words.txt -mc 200,401,403
# Inspeção de JWT (sem cracking de segredos reais fora do escopo)
echo $JWT | cut -d. -f2 | base64 -d 2>/dev/null | jq
```
**Remediação:** autorização por objeto e por função no servidor, schema/allowlist de campos, rate limiting, validação rígida de JWT (alg fixo, assinatura, exp).

---

## Rastreamento de cobertura
Use os IDs `WSTG-XXXX-NN` em cada achado para mapear cobertura por categoria e gerar uma matriz de "testado/não testado/aprovado/reprovado" no relatório.

## Referências
- OWASP Web Security Testing Guide v4.2
- OWASP Top 10 (2021) · OWASP API Security Top 10 · CWE
