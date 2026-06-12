# Recon Web — subfinder, amass, httpx & nuclei

> **USO AUTORIZADO:** Enumere subdomínios e execute templates apenas em ativos no escopo. Fontes passivas (subfinder/amass passive) não tocam o alvo, mas a probagem (httpx) e os templates ativos do nuclei geram tráfego — aplique `-rl`/`-rate-limit` e respeite a janela combinada. Nunca rode templates com tag `intrusive`/`dos` sem autorização explícita.

## Pipeline típico de recon
```
subfinder/amass  →  httpx (resolve + probe)  →  nuclei (detecção)
   (subdomínios)      (hosts vivos + metadata)    (CVEs/misconfig/exposições)
```

---

## subfinder — enumeração passiva de subdomínios
```bash
# Básico
subfinder -d alvo.tld -o subs.txt

# Múltiplos domínios a partir de arquivo, silencioso (só resultados)
subfinder -dL dominios.txt -silent -o subs.txt

# Todas as fontes + recursivo + saída em JSON
subfinder -d alvo.tld -all -recursive -oJ -o subs.json

# Usar somente fontes específicas / config de API keys
subfinder -d alvo.tld -sources crtsh,virustotal,securitytrails
# Chaves de API: ~/.config/subfinder/provider-config.yaml (aumenta MUITO a cobertura)
```

## amass — enumeração passiva e ativa
```bash
# Passivo (sem tocar o alvo)
amass enum -passive -d alvo.tld -o amass_passive.txt

# Ativo (resolve, brute, permutações) — gera tráfego DNS
amass enum -active -d alvo.tld -brute -o amass_active.txt

# Limitar taxa de DNS e resolvers (responsável)
amass enum -passive -d alvo.tld -max-dns-queries 200 -rf resolvers.txt

# Consultar o banco/grafo já coletado e listar relações
amass db -names -d alvo.tld
```

> Combine fontes e deduplique:
```bash
cat subs.txt amass_passive.txt | sort -u > all_subs.txt
```

---

## httpx — probe HTTP/HTTPS e enriquecimento
```bash
# Resolver lista de subdomínios para hosts web vivos
httpx -l all_subs.txt -o live.txt

# Enriquecer: status, título, tech, content-length, server
httpx -l all_subs.txt -sc -title -td -cl -server -ct

# Filtrar por status code e seguir redirects
httpx -l all_subs.txt -mc 200,301,302,401,403 -fr

# Captura de screenshot (headless) e detecção de tecnologia
httpx -l all_subs.txt -screenshot -td -o live_meta.txt

# Probar portas específicas e calcular hash do corpo
httpx -l all_subs.txt -p 80,443,8080,8443 -hash sha256

# Rate limiting + threads + timeout (uso responsável)
httpx -l all_subs.txt -rl 50 -threads 50 -timeout 10 -retries 2

# Saída JSON para pipeline/evidência
httpx -l all_subs.txt -json -o live.json

# One-liner do pipeline completo (passivo → vivo)
subfinder -d alvo.tld -all -silent | httpx -silent -sc -title -td -o live.txt
```

Flags úteis do httpx: `-fr` (follow redirects), `-location`, `-ip`, `-cdn` (detecta CDN/WAF), `-favicon` (hash do favicon p/ fingerprint), `-jarm` (TLS fingerprint), `-method` (HTTP method), `-x GET,POST` (probe de métodos).

---

## nuclei — detecção baseada em templates
```bash
# Atualizar engine e templates ANTES de rodar
nuclei -update
nuclei -update-templates

# Scan básico em uma URL ou lista
nuclei -u https://alvo.tld
nuclei -l live.txt -o nuclei_out.txt

# Pipeline direto do httpx
httpx -l all_subs.txt -silent | nuclei -o nuclei_out.txt
```

### Seleção de templates
```bash
# Por severidade
nuclei -l live.txt -severity critical,high,medium

# Por tags (exposures, cve, misconfig, takeover, tech, default-logins)
nuclei -l live.txt -tags cve,exposure,misconfig

# Por diretório/arquivo de template específico
nuclei -l live.txt -t http/cves/ -t http/exposures/
nuclei -l live.txt -t http/technologies/   # fingerprint de tecnologias

# Excluir tags perigosas
nuclei -l live.txt -etags dos,intrusive,fuzz

# Listar/filtrar templates antes de executar (dry run)
nuclei -l live.txt -tags cve -severity critical -tl   # -tl lista os templates que rodariam
```

### Casos de uso comuns
```bash
# Subdomain takeover
nuclei -l all_subs.txt -t http/takeovers/

# Painéis de login e default credentials expostos
nuclei -l live.txt -tags panel,default-login

# Exposições: .git, .env, backups, configs, API keys
nuclei -l live.txt -tags exposure,config,backup
```

### Rate limiting e performance (uso responsável)
```bash
# -rl req/s global, -c concorrência de templates, -bs hosts em paralelo
nuclei -l live.txt -rl 50 -c 25 -bs 25 -timeout 10 -retries 1

# Reduzir agressividade em produção
nuclei -l live.txt -rl 20 -c 10 -severity high,critical
```

### Saída, integração e proxy
```bash
# JSONL para parsing / import na plataforma
nuclei -l live.txt -jsonl -o nuclei.jsonl

# Roteamento por proxy (Burp) para inspeção
nuclei -u https://alvo.tld -proxy http://127.0.0.1:8080

# Templates customizados próprios
nuclei -l live.txt -t ~/meus-templates/ -validate   # valida sintaxe YAML
```

> **CUIDADO:** Tags `dos`, `intrusive` e `fuzz` (e templates de exploit ativo) podem causar indisponibilidade ou alteração de estado. Use `-etags dos,intrusive` por padrão e habilite apenas com autorização e janela combinada.

---

## Anatomia mínima de um template nuclei (referência)
```yaml
id: exemplo-deteccao-header
info:
  name: Detecção de header X-Powered-By
  author: suricatoos
  severity: info
  tags: tech,detect
http:
  - method: GET
    path:
      - "{{BaseURL}}"
    matchers-condition: and
    matchers:
      - type: word
        part: header
        words:
          - "X-Powered-By"
      - type: status
        status:
          - 200
```
Valide com `nuclei -t exemplo.yaml -validate` e teste com `-u https://alvo.tld`.

---

## Remediação (valor defensivo)
- **Subdomínios órfãos / takeover:** remova registros DNS apontando para serviços desprovisionados (S3, GitHub Pages, Heroku, etc.); inventarie e revise periodicamente os CNAMEs.
- **Reduzir footprint de recon:** evite expor subdomínios internos em DNS público; use split-horizon DNS; minimize dados em certificados (CT logs revelam subdomínios via crt.sh).
- **Exposições detectadas pelo nuclei:** bloqueie acesso a `.git/`, `.env`, `/backup`, painéis administrativos; rotacione qualquer credencial/chave vazada.
- **Fingerprinting (httpx):** remova/normalize headers `Server`, `X-Powered-By`, `X-AspNet-Version`; padronize páginas de erro.
- **Patch management:** corrija CVEs sinalizados priorizando `critical`/`high` expostos à internet; mantenha inventário de versões.
- **Detecção:** monitore picos de consultas DNS (brute de subdomínio), padrões de User-Agent de ferramentas (`nuclei`, `httpx`) e probing em massa; aplique WAF + rate limiting no perímetro.
