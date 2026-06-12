# Burp Suite — Cheatsheet de Fluxos de Teste Web

> **USO AUTORIZADO.** Burp intercepta e modifica tráfego real. Garanta escopo definido (Target > Scope) **antes** de habilitar varreduras ativas, e jamais rode Active Scan/Intruder fora do escopo contratado.

## Setup inicial

1. **Proxy > Options**: listener em `127.0.0.1:8080`.
2. Navegador via proxy (use o **Burp's embedded browser** para evitar config de CA) ou FoxyProxy.
3. Instalar CA do Burp: navegue para `http://burp` > *CA Certificate* > importe no navegador/OS.
4. **Target > Scope**: adicione apenas os hosts autorizados. Marque *"And URL Is in scope"* nos filtros de log.
5. **Proxy > Options > Intercept Client Requests**: desligue o intercept por padrão; deixe o histórico capturando.

```
# Definir escopo por regex (Target > Scope > Use advanced control)
Host: ^([a-z0-9.-]+\.)?app\.cliente\.com$
```

## Mapa das ferramentas e quando usar

| Ferramenta | Quando usar |
|-----------|-------------|
| **Proxy** | Capturar e interceptar tráfego; ponto de partida sempre |
| **Target / Site map** | Mapear superfície; "Engagement tools" |
| **Repeater** | Validação manual, 1 requisição por vez (PoC) |
| **Intruder** | Fuzzing/enumeração controlada de parâmetros |
| **Decoder** | Encode/decode base64, URL, hex, etc. |
| **Comparer** | Diff de respostas (boolean SQLi, IDOR) |
| **Sequencer** | Análise de aleatoriedade de tokens de sessão |
| **Scanner** (Pro) | Varredura ativa/passiva — só no escopo |
| **Extensions (BApp)** | Logger++, Autorize, Param Miner, JWT Editor |

## Fluxo 1 — Reconhecimento passivo (não-destrutivo)

1. Navegue manualmente por **toda** a aplicação com intercept off (popula o Site map).
2. *Target > Site map* > clique direito no host > **Engagement tools > Discover content** (spidering controlado).
3. Revise **Issues** passivas (Scanner Pro identifica headers ausentes, cookies sem flags, info leakage) — zero impacto no alvo.
4. Use **Logger++** ou o histórico do Proxy para inventariar endpoints, parâmetros e tecnologias.

## Fluxo 2 — Validação manual no Repeater (PoC mínima)

O Repeater é onde se **prova** uma vulnerabilidade sem automação ruidosa.

1. No Proxy/Site map, clique direito na requisição > **Send to Repeater** (`Ctrl+R`).
2. Modifique um parâmetro por vez e observe a diferença na resposta.
3. Use **Comparer** (`Ctrl+Shift+C` na request) para diferenças sutis.

Exemplos de PoC não-destrutiva:

```
# IDOR — trocar o identificador para objeto de outro usuário
GET /api/v1/orders/1001  -> 200 (meu)
GET /api/v1/orders/1002  -> 200 (de outro usuário = vuln confirmada)

# Reflected XSS — provar reflexão sem payload disruptivo
GET /search?q=ptmp"<b>poc</b>  -> verifique se renderiza como HTML

# SQLi boolean — comparar respostas com Comparer
id=1 AND 1=1   vs   id=1 AND 1=2
```

> Para XSS use marcadores inofensivos (`<b>poc</b>`, `alert(document.domain)` apenas em ambiente de teste) — nunca exfiltração real de cookies em produção.

## Fluxo 3 — Testes de autorização (Autorize)

Fundamental para detectar quebra de controle de acesso (OWASP A01):

1. Instale a extensão **Autorize** (BApp Store).
2. Cole o cookie/Authorization de um usuário **de menor privilégio**.
3. Navegue como usuário **de maior privilégio**; o Autorize replica cada request com a sessão de baixo privilégio.
4. Resultados: *Bypassed!* (vuln), *Enforced!* (ok), *Is enforced???* (revisar manualmente).

## Fluxo 4 — Intruder (enumeração controlada)

```
# Tipos de ataque
Sniper       -> 1 payload set, 1 posição por vez (fuzzing de 1 param)
Battering ram-> mesmo payload em todas posições
Pitchfork    -> sets paralelos (ex.: user+pass emparelhados)
Cluster bomb -> produto cartesiano (brute force de combos)
```

Boas práticas conservadoras:

- **Resource pool**: limite a *1 concurrent request* + delay para não derrubar o alvo.
- Use *Grep - Match* / *Grep - Extract* para isolar respostas interessantes (ex.: "Welcome", tamanho diferente).
- Para enumeração de usuários, observe **diferença de status/length/timing** entre válido e inválido.
- **Nunca** rode brute force de credenciais sem janela acordada (risco de lockout/DoS).

## Fluxo 5 — Análise de tokens (Sequencer)

1. Capture uma resposta que emita o token de sessão > **Send to Sequencer**.
2. *Live capture* > colete >= 100 (idealmente milhares) tokens.
3. Analise entropia (FIPS, transição de bits). Baixa entropia = tokens previsíveis.

## Extensões essenciais (BApp Store)

| Extensão | Para quê |
|----------|----------|
| **Logger++** | Log avançado, filtros, export |
| **Autorize** | Teste de autorização/IDOR automatizado |
| **Param Miner** | Descoberta de params/headers ocultos (cache poisoning) |
| **JWT Editor** | Manipular/assinar JWT (alg=none, key confusion) |
| **Active Scan++** | Checagens adicionais |
| **Turbo Intruder** | Fuzzing de alta performance (race conditions) |

## Dicas operacionais

```
# Salvar estado do projeto (Pro)
Project file -> .burp  (mantém histórico, escopo, issues)

# Match & Replace global (ex.: forçar header)
Proxy > Options > Match and Replace

# Atalhos úteis
Ctrl+R  Send to Repeater
Ctrl+I  Send to Intruder
Ctrl+Space  Enviar no Repeater (Pro)
```

## Remediação (temas recorrentes para o laudo)

- **Controle de acesso**: validar autorização no servidor por objeto (não confiar em IDs do cliente) — corrige IDOR/BOLA.
- **Cookies**: flags `HttpOnly`, `Secure`, `SameSite`; tokens de sessão com alta entropia e rotação no login.
- **Headers de segurança**: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
- **XSS**: output encoding contextual + CSP; nunca refletir input sem sanitização.
- **JWT**: rejeitar `alg=none`, fixar algoritmo no servidor, validar assinatura e `aud/iss/exp`.
- Referências: **OWASP WSTG v4.2**, **OWASP Top 10 2021**, **OWASP ASVS**.
