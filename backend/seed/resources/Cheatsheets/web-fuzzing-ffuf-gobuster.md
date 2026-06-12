# Web Fuzzing — ffuf & gobuster (dirs, vhosts, params)

> **USO AUTORIZADO:** Fuzzing gera muitas requisições e pode poluir logs, disparar WAF/bloqueios ou causar carga. Limite a taxa (`-rate`/`-t`), respeite a janela combinada e evite endpoints destrutivos. Confirme o escopo de subdomínios/vhosts antes de enumerar.

## Conceitos
- **FUZZ keyword:** no `ffuf`, a palavra `FUZZ` (ou customizada) marca onde a wordlist é injetada — em path, header, body, query, etc.
- **Filtros vs Matchers:** _matchers_ (`-mc`, `-ms`, `-ml`, `-mw`) definem o que é exibido; _filters_ (`-fc`, `-fs`, `-fl`, `-fw`) removem ruído. Calibre filtrando o tamanho/linhas da resposta padrão de "não encontrado".
- Wordlists comuns: SecLists (`/usr/share/seclists/...`), `raft-*`, `directory-list-2.3-*`, `subdomains-top1million-*`.

---

## ffuf

### Diretórios e arquivos
```bash
# Fuzzing básico de diretórios
ffuf -u https://alvo.tld/FUZZ -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt

# Com extensões (procura arquivos)
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -e .php,.bak,.old,.zip,.txt

# Recursivo (entra em diretórios encontrados) com profundidade
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -recursion -recursion-depth 2

# Filtrar por código de status / tamanho / palavras / linhas
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -mc 200,204,301,302,307,401,403
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -fc 404 -fs 1234   # filtra 404 e tamanho 1234
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -fw 12             # filtra por nº de palavras
```

### Virtual hosts (vhost discovery)
```bash
# Fuzz no header Host — IP fixo, descobre vhosts ocultos
ffuf -u https://10.0.0.10/ -H "Host: FUZZ.alvo.tld" \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  -fs 0
# Dica: calibre com -fc/-fs/-fw contra o tamanho da página default para remover falsos positivos.
```

### Parâmetros GET/POST
```bash
# Descobrir nomes de parâmetros GET
ffuf -u "https://alvo.tld/page?FUZZ=test" \
  -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt -fs 4242

# Descobrir valores de um parâmetro
ffuf -u "https://alvo.tld/page?id=FUZZ" -w ids.txt -fc 404

# Fuzz em corpo POST (form-urlencoded)
ffuf -X POST -u https://alvo.tld/login \
  -d "username=admin&password=FUZZ" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -w passwords.txt -fc 401,403
```

### Multi-wordlist (clusterbomb / pitchfork)
```bash
# Duas keywords distintas; modo clusterbomb testa todas as combinações
ffuf -u "https://alvo.tld/W1/W2" \
  -w dirs.txt:W1 -w files.txt:W2 -mode clusterbomb
```

### Performance, rate limiting e saída
```bash
# Threads (-t), atraso entre reqs (-p) e limite global de req/s (-rate)
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -t 40 -p 0.1 -rate 100

# Timeout, seguir redirects, header de auth e cookie
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -timeout 10 -r \
  -H "Authorization: Bearer <token>" -b "session=abc123"

# Saída em JSON para parsing / evidência
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -of json -o resultado.json

# Modo silencioso (-s) para pipelines
ffuf -u https://alvo.tld/FUZZ -w wordlist.txt -s
```

---

## gobuster

### dir — diretórios e arquivos
```bash
gobuster dir -u https://alvo.tld \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -x php,html,txt,bak -t 30 -o gobuster_dir.txt

# Mostrar tamanhos, seguir redirect e ignorar TLS inválido
gobuster dir -u https://alvo.tld -w wordlist.txt --no-tls-validation -r

# Status codes: por padrão a blacklist é 404. Use allowlist explícita se preciso:
gobuster dir -u https://alvo.tld -w wordlist.txt -s "200,204,301,302,307,401,403" -b ""
```

### dns — subdomínios via brute force de DNS
```bash
gobuster dns -d alvo.tld \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt \
  -t 30 -o gobuster_dns.txt

# Mostrar IPs resolvidos e usar resolver custom
gobuster dns -d alvo.tld -w wordlist.txt -i -r 1.1.1.1
```

### vhost — virtual hosts
```bash
gobuster vhost -u https://alvo.tld \
  -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt \
  --append-domain -t 20 -o gobuster_vhost.txt
# --append-domain anexa o domínio base à palavra (gobuster >= 3.2).
```

### Flags úteis (gobuster)
```bash
-H "Authorization: Bearer <token>"   # header custom
-c "session=abc123"                  # cookies
-a "Mozilla/5.0 ..."                 # user-agent
--delay 100ms                        # rate limiting entre reqs
-k / --no-tls-validation             # ignorar cert inválido
-z                                   # quiet (sem progresso)
```

---

## Boas práticas de calibração
1. Faça uma requisição manual a um path inexistente para ver o **status/tamanho/linhas** padrão.
2. No ffuf, aplique `-fc`/`-fs`/`-fw`/`-fl` para remover essa resposta-base.
3. Comece com wordlist pequena (`top-5000`), depois expanda só se necessário.
4. Ajuste `-t`/`-rate`/`--delay` conforme a fragilidade do alvo; reduza ao primeiro sinal de 429/`WAF`.
5. Salve a saída (`-o`/`-of json`) como evidência do achado.

## Remediação (valor defensivo)
- **Diretórios/arquivos expostos:** remova backups (`.bak`, `.old`, `.zip`), arquivos `.git/`, `.env`, dumps de DB; bloqueie listing (`Options -Indexes`).
- **Vhosts ocultos:** não confie em segurança por obscuridade; aplique autenticação e allowlist de Host válido (rejeite `Host` desconhecido com 421/404).
- **Parâmetros sensíveis:** valide/normalize entradas no servidor; não confie em parâmetros ocultos para autorização.
- **Detecção e mitigação:** WAF com regras anti-fuzzing, rate limiting por IP, bloqueio progressivo a 4xx em massa, e monitoramento de spikes de 404/403.
- **Resposta uniforme:** retorne 404 genérico para recursos inexistentes e protegidos, dificultando enumeração por diferença de tamanho/status.
