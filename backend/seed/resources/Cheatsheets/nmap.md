# Nmap — Cheatsheet de Descoberta, Enumeração e NSE

> **USO AUTORIZADO:** Execute scans somente contra ativos dentro do escopo formal do engajamento (RoE/contrato). Varreduras agressivas (`-T5`, `--min-rate` alto) podem derrubar serviços frágeis. Em produção, prefira `-T3` ou menos e use rate limiting. Registre timestamps e IP de origem para a trilha de auditoria.

## 1. Descoberta de hosts (host discovery / ping sweep)

```bash
# Sweep só de descoberta, sem port scan (-sn = no port scan)
nmap -sn 10.0.0.0/24

# Descoberta em lista de alvos a partir de arquivo
nmap -sn -iL targets.txt -oA discovery

# Pular descoberta (-Pn): trate todos os hosts como online (útil quando ICMP é bloqueado)
nmap -Pn 10.0.0.10

# Combinações de probe de descoberta
# -PE (ICMP echo), -PP (timestamp), -PM (netmask), -PS/-PA (TCP SYN/ACK), -PU (UDP)
nmap -sn -PE -PS21,22,80,443 -PA80,443 -PU161 10.0.0.0/24

# Apenas listar alvos que seriam escaneados, sem enviar pacotes (-sL)
nmap -sL 10.0.0.0/24
```

## 2. Descoberta de portas (port scanning)

```bash
# TCP SYN scan (half-open, requer root) — o default mais rápido
sudo nmap -sS 10.0.0.10

# TCP connect scan (sem root, completa o handshake — mais ruidoso/logado)
nmap -sT 10.0.0.10

# UDP scan (lento; combine com poucas portas)
sudo nmap -sU --top-ports 50 10.0.0.10

# Todas as 65535 portas TCP
sudo nmap -p- 10.0.0.10

# Portas específicas / faixas / mistas TCP+UDP
sudo nmap -sS -sU -p T:80,443,8080,U:53,161 10.0.0.10

# As N portas mais comuns
nmap --top-ports 1000 10.0.0.10

# Scan rápido das portas mais comuns (-F = fast, ~100 portas)
nmap -F 10.0.0.10
```

## 3. Detecção de serviço, versão e SO

```bash
# Versão de serviço (-sV) com intensidade ajustável (0=leve a 9=tenta tudo)
nmap -sV --version-intensity 5 10.0.0.10

# Detecção de SO (-O) — requer root
sudo nmap -O 10.0.0.10

# Combo agressivo: -A = -O + -sV + -sC (scripts default) + traceroute
nmap -A 10.0.0.10

# Resolver hostnames reversos / desabilitar DNS para velocidade (-n)
nmap -n -sV 10.0.0.10
```

## 4. Timing, performance e rate limiting (responsável)

```bash
# Templates de timing: -T0 (paranoid) .. -T5 (insane). T3 = default.
nmap -T3 10.0.0.10

# Controle fino de taxa de pacotes (use para NÃO sobrecarregar o alvo)
nmap --max-rate 100 --min-rate 50 10.0.0.10

# Controle de paralelismo de host e timeouts
nmap --max-parallelism 10 --host-timeout 30m --max-retries 2 10.0.0.10

# Scan furtivo/educado em redes sensíveis
nmap -T2 --max-rate 50 --scan-delay 200ms 10.0.0.10
```

## 5. NSE — Nmap Scripting Engine

```bash
# Scripts default (seguros, equivalente ao incluso em -A/-sC)
nmap -sC 10.0.0.10

# Por categoria: auth, broadcast, brute, default, discovery, dos, exploit,
# external, fuzzer, intrusive, malware, safe, version, vuln
nmap --script "default,safe" 10.0.0.10
nmap --script vuln 10.0.0.10
nmap --script discovery -sV 10.0.0.10

# Seleção por nome (com wildcard) e múltiplos scripts
nmap --script "http-*" -p 80,443 10.0.0.10
nmap --script "smb-os-discovery,smb-security-mode" -p 445 10.0.0.10

# Passar argumentos para scripts
nmap --script http-enum --script-args http-enum.basepath=/api/ -p 80 10.0.0.10

# Atualizar a base de scripts e ver ajuda de um script
sudo nmap --script-updatedb
nmap --script-help http-title
```

### NSE — scripts úteis por serviço
```bash
# HTTP/Web
nmap -p 80,443 --script http-title,http-headers,http-methods,http-enum,http-robots.txt,ssl-cert,ssl-enum-ciphers 10.0.0.10

# SMB / Windows
nmap -p 139,445 --script smb-os-discovery,smb-enum-shares,smb-enum-users,smb-protocols,smb2-security-mode 10.0.0.10

# DNS
nmap -p 53 --script dns-recursion,dns-zone-transfer --script-args dns-zone-transfer.domain=example.com 10.0.0.10

# Banco de dados e outros
nmap -p 3306 --script mysql-info,mysql-empty-password 10.0.0.10
nmap -p 27017 --script mongodb-info 10.0.0.10
nmap -p 6379 --script redis-info 10.0.0.10

# SNMP
nmap -sU -p 161 --script snmp-info,snmp-sysdescr 10.0.0.10
```

> **CUIDADO:** Categorias `intrusive`, `brute`, `dos` e `exploit` podem causar bloqueios, lockout de contas ou indisponibilidade. Use apenas com autorização explícita e janela de manutenção combinada.

## 6. Evasão / firewall (somente em escopo de teste de detecção)

```bash
# Fragmentar pacotes (-f) e MTU custom
sudo nmap -f --mtu 16 10.0.0.10

# Decoys (mascara origem entre IPs falsos)
sudo nmap -D RND:5 10.0.0.10

# Source port spoof (ex.: parecer DNS/HTTP)
sudo nmap --source-port 53 10.0.0.10

# Scans nulos/FIN/Xmas (para mapear regras de stateless firewall)
sudo nmap -sN 10.0.0.10
sudo nmap -sF 10.0.0.10
sudo nmap -sX 10.0.0.10
```

## 7. Saída e relatório

```bash
# Todos os formatos de uma vez (-oA gera .nmap, .gnmap, .xml)
nmap -sV -oA scan_resultado 10.0.0.10

# Formatos individuais: normal (-oN), grepável (-oG), XML (-oX)
nmap -sV -oX scan.xml 10.0.0.10

# Aumentar verbosidade e debug
nmap -v -v -d 10.0.0.10

# Retomar scan interrompido a partir do log normal
nmap --resume scan_resultado.nmap

# Converter XML para HTML legível
xsltproc scan.xml -o scan.html
```

## 8. Fluxo recomendado de engajamento
1. **Descoberta:** `nmap -sn -iL targets.txt -oA disco` para listar hosts vivos.
2. **Mapeamento amplo:** `sudo nmap -sS -p- --min-rate 500 -T3 -oA full <hosts>`.
3. **Aprofundamento:** `-sV -sC` (e `--script vuln`) só nas portas abertas encontradas.
4. **UDP seletivo:** `-sU --top-ports 50` nos hosts relevantes.
5. **Documente:** salve `-oA` de cada fase para evidência e correlação.

## 9. Remediação (valor defensivo)
- **Reduzir superfície de ataque:** feche/filtre portas não essenciais; aplique allowlists no firewall por origem.
- **Esconder versões:** desabilite banners verbosos (`ServerTokens Prod`, remover headers `Server`/`X-Powered-By`).
- **Hardening de serviços:** desative protocolos legados (SMBv1, SSLv3/TLS 1.0/1.1), exija autenticação forte.
- **Detecção:** habilite IDS/IPS (Suricata/Snort) com regras de port scan; monitore conexões SYN sem ACK e bursts de UDP.
- **Rate limiting / shunning:** aplique throttling no perímetro para mitigar varredura em massa.
- **Segmentação:** isole serviços de gestão (SSH/RDP/SMB) em VLANs/management network com acesso via bastion/VPN.
