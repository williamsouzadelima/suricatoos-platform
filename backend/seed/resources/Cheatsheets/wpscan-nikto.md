# WPScan e Nikto — Cheatsheet de Enumeração Web

> **USO AUTORIZADO.** WPScan e Nikto geram tráfego identificável e podem disparar alertas/WAF. Rode apenas no escopo contratado, idealmente com a janela de teste acordada. Enumeração de usuários e brute force só com autorização explícita.

---

## WPScan — auditoria de WordPress

### Setup

```bash
# Instalação
gem install wpscan        # ou: docker run -it --rm wpscanteam/wpscan

# Token da API (vuln database) — recomendado p/ CVEs
export WPSCAN_API_TOKEN='seu_token'   # plano free: 25 reqs/dia
wpscan --update                       # atualiza a base local
```

### Scan básico (enumeração padrão)

```bash
wpscan --url https://blog.cliente.com

# Com token de vulnerabilidades e User-Agent realista
wpscan --url https://blog.cliente.com \
  --api-token "$WPSCAN_API_TOKEN" \
  --random-user-agent
```

### Enumeração granular (`-e`)

```bash
wpscan --url https://blog.cliente.com -e vp,vt,tt,cb,dbe,u1-5
```

| Código | Enumera |
|--------|---------|
| `vp` | Plugins **vulneráveis** |
| `ap` | **Todos** os plugins (mais ruidoso) |
| `vt` | Temas vulneráveis |
| `at` | Todos os temas |
| `tt` | Timthumbs |
| `cb` | Config backups (`wp-config.php.bak` etc.) |
| `dbe` | Db exports |
| `u`  | Usuários (ex.: `u1-10`) |
| `m`  | Media IDs |

### Modo conservador (reduzir ruído/carga)

```bash
wpscan --url https://blog.cliente.com \
  --plugins-detection passive \   # passive | aggressive | mixed
  --throttle 500 \                # ms entre requests
  --max-threads 5 \
  --random-user-agent \
  --disable-tls-checks
```

- `passive` lê o HTML em busca de pistas (menos requests). `aggressive` faz brute force de caminhos de plugins (muito ruidoso).
- Use `--throttle` e `--max-threads` baixos em produção.

### Enumeração de usuários e brute force (somente autorizado)

```bash
# Enumerar usuários
wpscan --url https://blog.cliente.com -e u

# Password attack contra usuários encontrados — RISCO de lockout
wpscan --url https://blog.cliente.com \
  -U admin,editor \
  -P /usr/share/wordlists/rockyou.txt \
  --password-attack wp-login \    # wp-login | xmlrpc | xmlrpc-multicall
  --throttle 1000
```

> xmlrpc-multicall é mais rápido porém mais agressivo. Só execute brute force com janela acordada e monitoramento, para evitar bloqueio de contas legítimas.

### Output / evidências

```bash
wpscan --url https://blog.cliente.com \
  -o /tmp/wpscan-blog.txt -f cli-no-color

# JSON para parsing/laudo
wpscan --url https://blog.cliente.com -f json -o /tmp/wpscan.json
```

### Validação manual de achados WordPress

```bash
# Versão exposta
curl -s https://blog.cliente.com/ | grep -i 'content="WordPress'
curl -s https://blog.cliente.com/readme.html | head

# user enumeration via REST API (confirma sem WPScan)
curl -s 'https://blog.cliente.com/wp-json/wp/v2/users'

# xmlrpc habilitado?
curl -s -X POST https://blog.cliente.com/xmlrpc.php \
  -d '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName></methodCall>'
```

### Remediação WordPress

- Manter core, temas e plugins **atualizados**; remover plugins/temas inativos.
- Bloquear enumeração de usuários (plugin de hardening; restringir `wp-json/wp/v2/users`).
- Desabilitar **XML-RPC** se não usado (`xmlrpc.php`) — mitiga brute force/amplificação.
- 2FA no `wp-admin`, senhas fortes, **rate limiting**/lockout no login.
- Remover `readme.html`, backups de config e arquivos expostos; ocultar versão.
- Referência: CIS WordPress Benchmark, OWASP WSTG.

---

## Nikto — scanner de servidor web

> Nikto é **barulhento por design** (milhares de requests, assinaturas conhecidas). Espere logs e alertas no alvo. É bom para um sweep rápido de misconfigurations, não para furtividade.

### Uso básico

```bash
nikto -h https://app.cliente.com
nikto -h 10.0.0.5 -p 80,443,8080      # múltiplas portas
nikto -h https://app.cliente.com -ssl # força SSL
```

### Opções úteis

```bash
# Output para o laudo
nikto -h https://app.cliente.com -o /tmp/nikto-app.html -Format htm
nikto -h https://app.cliente.com -o /tmp/nikto.csv -Format csv

# Reduzir falsos positivos / passar por proxy (auditoria via Burp)
nikto -h https://app.cliente.com -useproxy http://127.0.0.1:8080

# Tuning: selecionar classes de teste (-T)
nikto -h https://app.cliente.com -Tuning 1234567890abc
```

Valores de `-Tuning` (combináveis):

| Valor | Categoria |
|-------|-----------|
| `1` | Interesting File / arquivos vistos em logs |
| `2` | Misconfiguration / Default File |
| `3` | Information Disclosure |
| `4` | Injection (XSS/Script/HTML) |
| `5` | Remote File Retrieval (dentro do webroot) |
| `6` | Denial of Service — **NÃO usar em produção** |
| `8` | Command Execution / Remote Shell |
| `9` | SQL Injection |
| `b` | Software Identification |
| `x` | Reverse Tuning (tudo exceto o especificado) |

### Modo mais comedido

```bash
# Evita testes de DoS e foca em info/misconfig
nikto -h https://app.cliente.com -Tuning 123b \
  -Pause 1 \                       # pausa (s) entre testes
  -useragent 'Mozilla/5.0 (pentest-autorizado)' \
  -maxtime 600s
```

- **Sempre** exclua o tuning `6` (DoS) em ambientes produtivos.
- Use `-Pause` para reduzir carga.
- Roteie por Burp (`-useproxy`) para registrar e revisar manualmente os achados.

### Validação manual dos achados Nikto

Nikto reporta muitos itens por assinatura — **confirme cada um** antes do laudo:

```bash
# Arquivo/diretório supostamente exposto
curl -sI https://app.cliente.com/backup.zip      # confira status 200 e Content-Type
curl -sI https://app.cliente.com/server-status   # Apache status exposto?

# Headers de segurança ausentes
curl -sI https://app.cliente.com/ | grep -iE 'x-frame|content-security|strict-transport|x-content-type'

# Métodos HTTP perigosos
curl -sX OPTIONS https://app.cliente.com/ -i | grep -i allow
```

### Remediação (achados típicos de Nikto)

- Remover arquivos default/exemplo, backups e diretórios de teste do webroot.
- Desabilitar **directory listing** e endpoints de status (`/server-status`, `/server-info`).
- Restringir **métodos HTTP** (desabilitar `TRACE`, `PUT`, `DELETE` se não usados).
- Adicionar headers de segurança (`HSTS`, `CSP`, `X-Content-Type-Options`, `X-Frame-Options`).
- Atualizar o servidor web/aplicação para versões suportadas; ocultar banners de versão.
- Referência: OWASP WSTG-CONF, CIS Benchmarks (Apache/Nginx).

---

## Checklist de execução responsável

- [ ] Escopo e autorização por escrito confirmados
- [ ] Janela de teste acordada (especialmente p/ brute force e Nikto)
- [ ] Tráfego roteado/registrado (proxy ou `-o`) para evidência
- [ ] Tuning de DoS desabilitado em produção
- [ ] Achados automatizados validados manualmente antes do laudo
- [ ] Dados sensíveis redigidos nas evidências
