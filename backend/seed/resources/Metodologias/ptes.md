# PTES — Penetration Testing Execution Standard

> **Uso autorizado.** Todo o conteúdo abaixo pressupõe um engajamento com **escopo formal, autorização por escrito (Rules of Engagement / contrato) e janela de testes acordada**. Não execute nenhuma técnica fora do escopo aprovado. Os agentes da Suricatoos devem validar a existência de escopo ativo antes de qualquer ação intrusiva.

O **PTES** define 7 fases para conduzir um pentest de ponta a ponta, de forma repetível e auditável. É a espinha dorsal para organizar o engajamento; o detalhe técnico de aplicação web complementa-se com o **OWASP WSTG**.

## As 7 fases (visão geral)

1. **Pre-engagement Interactions** — escopo, contrato, RoE, janelas, contatos.
2. **Intelligence Gathering** — OSINT e reconhecimento (passivo → ativo).
3. **Threat Modeling** — modelar ativos, agentes de ameaça e vetores.
4. **Vulnerability Analysis** — identificar e validar vulnerabilidades.
5. **Exploitation** — comprometer alvos de forma controlada.
6. **Post-Exploitation** — pivot, persistência (autorizada), valor de negócio.
7. **Reporting** — evidências, impacto, remediação, executivo + técnico.

---

## Fase 1 — Pre-engagement Interactions

Objetivo: alinhar expectativas e blindar legalmente o engajamento **antes** de tocar em qualquer sistema.

- [ ] Escopo definido (IPs, domínios, faixas CIDR, apps, contas, mobile, wireless, físico).
- [ ] **Autorização por escrito** assinada por quem tem autoridade sobre os ativos.
- [ ] Rules of Engagement (RoE): técnicas permitidas/proibidas (ex.: DoS, social engineering, phishing).
- [ ] Janela de testes e fuso horário; horários sensíveis (ex.: fechamento financeiro).
- [ ] Contatos de emergência (24x7) e processo de **"stop test"**.
- [ ] Tratamento de dados sensíveis/PII coletados; criptografia e descarte ao fim.
- [ ] Tipo de teste: black / grey / white box; com ou sem credenciais.
- [ ] Alvos terceirizados (cloud/SaaS) com autorização do provedor quando exigido (ex.: AWS/Azure têm políticas próprias).
- [ ] Definição de "sucesso" e objetivos (flags, dados-alvo, demonstrar impacto).

**Entrega da fase:** documento de escopo + RoE assinados, arquivados no projeto.

---

## Fase 2 — Intelligence Gathering (Recon / OSINT)

Comece **passivo** (sem tocar no alvo) e evolua para **ativo**.

### Passivo (OSINT)
```bash
# DNS / WHOIS / infraestrutura
whois exemplo-alvo.com
dig exemplo-alvo.com ANY +noall +answer
dig +short txt exemplo-alvo.com         # SPF/DMARC, verificação de domínio

# Subdomínios passivos
subfinder -d exemplo-alvo.com -silent
amass enum -passive -d exemplo-alvo.com

# Certificados (crt.sh) e histórico
curl -s 'https://crt.sh/?q=%25.exemplo-alvo.com&output=json' | jq -r '.[].name_value' | sort -u

# Metadados em documentos públicos / e-mails / pessoas
theHarvester -d exemplo-alvo.com -b all
```
- [ ] Footprint de DNS, ASN/faixas IP, tecnologias, CDNs.
- [ ] Exposição em buscadores (Google dorks), repositórios públicos (segredos, .git).
- [ ] Vazamentos de credenciais (apenas verificação, nunca uso fora do escopo).
- [ ] Pessoas-chave, e-mails e nomenclatura de contas (para validação de auth).

### Ativo
```bash
# Resolução e varredura de portas
naabu -host exemplo-alvo.com -top-ports 1000
nmap -sV -sC -p- --min-rate 2000 -oA recon/alvo 10.0.0.0/24

# Fingerprint web
httpx -l hosts.txt -title -tech-detect -status-code -o web_live.txt
whatweb https://exemplo-alvo.com
```
- [ ] Hosts vivos, portas, serviços e versões.
- [ ] Mapa de superfície de ataque (web, APIs, VPN, RDP, e-mail, etc.).

---

## Fase 3 — Threat Modeling

- [ ] Inventariar **ativos** (dados, sistemas, processos de negócio) e valor.
- [ ] Identificar **agentes de ameaça** relevantes (insider, externo, ransomware, etc.).
- [ ] Mapear **vetores** prováveis para cada ativo (ex.: STRIDE).
- [ ] Priorizar alvos por impacto x facilidade (foca o esforço da Fase 4/5).
- [ ] Documentar suposições e "crown jewels" do cliente.

---

## Fase 4 — Vulnerability Analysis

Identificar e **validar** — reduzir falsos positivos é parte do trabalho.

```bash
# Scan de rede / serviços
nmap --script vuln -p 80,443,445,3389 alvo

# Scan web automatizado
nuclei -u https://exemplo-alvo.com -severity medium,high,critical
nikto -h https://exemplo-alvo.com

# TLS / configuração
sslscan exemplo-alvo.com:443
testssl.sh https://exemplo-alvo.com
```
- [ ] Correlacionar versões de serviço com CVEs (validar aplicabilidade real).
- [ ] Diferenciar **vulnerabilidade** de **exposição** e de **misconfiguration**.
- [ ] Validar manualmente os achados de scanners (PoC mínima, sem exploit destrutivo).
- [ ] Classificar severidade (CVSS + contexto de negócio).

---

## Fase 5 — Exploitation

> Execute apenas o necessário para **provar** o impacto. Evite negação de serviço, corrupção de dados ou exploits instáveis sem aprovação explícita no RoE.

- [ ] Selecionar exploit confiável e compatível com a versão/contexto.
- [ ] Validar em ambiente controlado quando possível antes do alvo real.
- [ ] Capturar evidências (comando, output, timestamp, screenshot).
- [ ] Respeitar limites do RoE (sem pivot fora do escopo).
```bash
# Validação de credenciais (apenas com autorização e listas acordadas)
crackmapexec smb 10.0.0.0/24 -u user -p 'Senha123' --shares
# Exemplo de framework de exploração
msfconsole -q -x "use exploit/...; set RHOSTS alvo; set LHOST <ip-equipe>; run"
```
**Sinais de PoC suficiente:** acesso obtido + evidência mínima (ex.: `id`, hostname, arquivo de prova). Não exfiltre dados reais; demonstre que **seria** possível.

---

## Fase 6 — Post-Exploitation

Mostrar o **valor de negócio** do comprometimento, de forma controlada.

- [ ] Enumerar privilégios, contexto e dados acessíveis (sem exfiltração real).
- [ ] Identificar caminhos de **escalonamento** (local/AD) e **lateral movement**.
- [ ] Persistência **somente** se autorizada — e sempre documentada para remoção.
- [ ] Avaliar alcance: chegou às "crown jewels"? Domínio comprometido?
- [ ] **Cleanup:** registrar e remover artefatos, contas, payloads, persistência.
```bash
# Pós-exploração / privesc (exemplos de enumeração)
linpeas.sh            # Linux
winpeas.exe           # Windows
bloodhound-python -d dominio.local -u user -p pass -c All   # mapa AD
```

---

## Fase 7 — Reporting

- [ ] **Sumário executivo** (linguagem de negócio, risco, postura geral).
- [ ] **Relatório técnico**: por achado → descrição, evidência, passos de reprodução, severidade (CVSS), impacto.
- [ ] **Remediação** acionável e priorizada por achado.
- [ ] Apêndices: escopo, metodologia, ferramentas, timeline, lista completa de achados.
- [ ] Recomendações estratégicas (processo, arquitetura, detecção).
- [ ] Retest / verificação de correções (quando contratado).

### Estrutura de achado (modelo)
```
Título:        SQL Injection em /api/login (parâmetro user)
Severidade:    Alta (CVSS 8.1 / AV:N/AC:L/PR:N/UI:N/...)
Ativo:         https://app.exemplo-alvo.com
Descrição:     ...
Reprodução:    1) ... 2) ... 3) ...
Evidência:     <screenshot/log/request-response>
Impacto:       Acesso não autorizado a dados de autenticação ...
Remediação:    Prepared statements/parametrização, validação ...
Referências:   OWASP WSTG-INPV-05, CWE-89
```

---

## Remediação transversal (boas práticas)
- Gestão de patches e baseline de configuração segura (hardening).
- Princípio do menor privilégio e segmentação de rede.
- MFA em todos os acessos externos/privilegiados.
- Gestão de segredos (rotacionar credenciais expostas no recon).
- Logging/monitoração e detecção dos TTPs usados no teste (validar o blue team).

## Referências
- PTES — Technical Guidelines (pentest-standard.org)
- OWASP WSTG v4.2 (complemento web) · NIST SP 800-115
