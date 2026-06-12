# MITRE ATT&CK Enterprise — Referência das 14 Táticas

> Material de referência para engajamentos **autorizados**. Use IDs ATT&CK (TAxxxx para táticas, Txxxx[.xxx] para técnicas) ao documentar findings: isso dá rastreabilidade ao Blue Team e alimenta detecção/threat hunting. Sempre opere dentro do escopo, Rules of Engagement (RoE) e janela acordada. Versão de referência: ATT&CK Enterprise v15+.

## Como usar este documento

- Cada tática lista o **objetivo do adversário**, **técnicas representativas** (com ID), **ideias de detecção** (telemetria/fonte de log) e **mitigação** (controle correspondente, série Mxxxx).
- Em relatórios Suricatoos, mapeie cada finding a `Tactic → Technique → Sub-technique`. Ex.: `TA0006 Credential Access → T1003.001 LSASS Memory`.
- A matriz NÃO é linear: um operador transita livremente entre táticas. Trate-a como vocabulário comum, não como playbook obrigatório.

---

## TA0043 — Reconnaissance
**Objetivo:** coletar informação sobre o alvo antes do acesso (frequentemente fora da rede-alvo).

| Técnica | ID | Exemplo |
|---|---|---|
| Active Scanning | T1595 | varredura de portas/banners, scanning de blocos IP |
| Gather Victim Identity Info | T1589 | e-mails, credenciais vazadas, funcionários |
| Search Open Technical Databases | T1596 | Shodan, Censys, registros DNS/WHOIS, certificados |
| Phishing for Information | T1598 | pretexting para extrair info (sem payload) |

**Detecção:** logs de WAF/CDN com user-agents de scanners; alertas em honeypots/honeytokens externos; monitoramento de menções à marca e credenciais em vazamentos.

**Mitigação:** reduzir superfície exposta (M1056 Pre-compromise tem cobertura limitada — foco em minimizar metadados públicos: cabeçalhos, banners, DNS zone transfer, repositórios `.git` expostos).

---

## TA0042 — Resource Development
**Objetivo:** estabelecer recursos de suporte ao ataque (infra, contas, capacidades).

| Técnica | ID | Exemplo |
|---|---|---|
| Acquire Infrastructure | T1583 | domínios typosquatting, VPS, redirectors |
| Establish Accounts | T1585 | contas sociais/e-mail para engenharia social |
| Develop/Obtain Capabilities | T1587 / T1588 | malware, certificados de code-signing, exploits |

**Detecção:** monitoramento de registro de domínios similares (dnstwist), Certificate Transparency logs (crt.sh) para certificados emitidos para domínios parecidos.

**Mitigação:** registro defensivo de domínios; alertas de CT logs.

---

## TA0001 — Initial Access
**Objetivo:** obter o primeiro ponto de apoio na rede.

| Técnica | ID | Exemplo |
|---|---|---|
| Phishing | T1566 | anexo (.001), link (.002), via serviço (.003) |
| Exploit Public-Facing Application | T1190 | RCE/SQLi/deserialização em app exposto |
| Valid Accounts | T1078 | credenciais válidas (default, vazadas, comprada) |
| External Remote Services | T1133 | VPN/RDP/Citrix expostos |
| Supply Chain Compromise | T1195 | dependência/atualização maliciosa |

**Detecção:** correlação de e-mail gateway + EDR (anexo → processo filho); logins anômalos (geo/impossible travel) em VPN/SSO; IPS/WAF em apps de borda; baseline de processos de servidores web.

**Mitigação:** MFA resistente a phishing (M1032), patch de borda (M1051), segmentação de serviços remotos (M1030), bloqueio de macros (M1042), treinamento (M1017).

---

## TA0002 — Execution
**Objetivo:** executar código controlado pelo adversário.

| Técnica | ID | Exemplo |
|---|---|---|
| Command and Scripting Interpreter | T1059 | PowerShell (.001), cmd, bash, JScript |
| Windows Management Instrumentation | T1047 | `wmic`, `Invoke-WmiMethod` |
| Scheduled Task/Job | T1053 | execução via tarefa agendada |
| User Execution | T1204 | usuário abre arquivo/link malicioso |
| Native API / Service Execution | T1106 / T1569 | chamadas diretas de API, serviços |

**Detecção:** PowerShell Script Block Logging (Event ID 4104), `Process Creation` (Sysmon ID 1 / 4688) com command-line; relações pai-filho suspeitas (ex.: `winword.exe → powershell.exe`); AMSI.

**Mitigação:** Application Control / WDAC (M1038), PowerShell Constrained Language Mode (M1045), execução com privilégio mínimo (M1026).

---

## TA0003 — Persistence
**Objetivo:** manter acesso através de reinícios e troca de credenciais.

| Técnica | ID | Exemplo |
|---|---|---|
| Boot/Logon Autostart Execution | T1547 | Run keys, startup folder |
| Scheduled Task/Job | T1053 | tarefa recorrente |
| Create Account | T1136 | conta local/domínio nova |
| Server Software Component | T1505 | web shell (.003), IIS module |
| Account Manipulation | T1098 | adicionar chave SSH, MFA registration |

**Detecção:** auditoria de criação de conta (Event ID 4720); mudanças em Run keys (Sysmon ID 12/13); criação de tarefas (Event ID 4698); arquivos novos em diretórios web (FIM).

**Mitigação:** revisão periódica de contas/tarefas (M1018), FIM em webroots, restrição de modificação de registro/autostart.

---

## TA0004 — Privilege Escalation
**Objetivo:** obter permissões mais altas (admin local, SYSTEM, Domain Admin).

| Técnica | ID | Exemplo |
|---|---|---|
| Exploitation for Priv Esc | T1068 | kernel/driver exploit |
| Abuse Elevation Control Mechanism | T1548 | UAC bypass, sudo, setuid (.003) |
| Access Token Manipulation | T1134 | token theft/impersonation |
| Boot/Logon Autostart (elevado) | T1547 | serviço SYSTEM |
| Valid Accounts (privilegiados) | T1078 | uso de conta admin existente |

**Detecção:** Sysmon ID 1 com integridade elevada inesperada; eventos de criação de processo SYSTEM a partir de processos de usuário; uso anômalo de SeDebugPrivilege.

**Mitigação:** patch de kernel/drivers (M1051), least privilege (M1026), LAPS para senha de admin local (M1027), tiered admin model.

---

## TA0005 — Defense Evasion
**Objetivo:** evitar detecção e contornar controles.

| Técnica | ID | Exemplo |
|---|---|---|
| Impair Defenses | T1562 | desabilitar EDR/AV/logging (.001/.002) |
| Obfuscated Files or Information | T1027 | encoding, packing |
| Indicator Removal | T1070 | limpar logs (.001), timestomp (.006) |
| Masquerading | T1036 | renomear binário, extensão falsa |
| Process Injection | T1055 | injetar em processo legítimo |
| Valid Accounts | T1078 | uso de conta legítima para se misturar |

**Detecção:** alertas de tamper protection do EDR; `wevtutil cl` / `Clear-EventLog` (Event ID 1102); paridade de hash de binários do sistema; Sysmon ID 8 (CreateRemoteThread) para injeção.

**Mitigação:** tamper protection habilitado e bloqueado (M1024), encaminhamento de logs em tempo real para SIEM (impede limpeza local ser efetiva), Application Control (M1038).

---

## TA0006 — Credential Access
**Objetivo:** roubar credenciais (senhas, hashes, tickets, tokens).

| Técnica | ID | Exemplo |
|---|---|---|
| OS Credential Dumping | T1003 | LSASS (.001), SAM (.002), NTDS.dit (.003) |
| Brute Force | T1110 | password spraying (.003), stuffing (.004) |
| Steal/Forge Kerberos Tickets | T1558 | Kerberoasting (.003), Golden Ticket (.001) |
| Unsecured Credentials | T1552 | senhas em arquivos/registro/GPP |
| Credentials from Password Stores | T1555 | browsers, keychains, gerenciadores |

**Detecção:** acesso a LSASS por processo não-padrão (Sysmon ID 10); 4625 em volume (spraying); 4769 com encryption type RC4 e muitos serviços (Kerberoasting); leitura de NTDS.dit / shadow copy de DC.

**Mitigação:** Credential Guard (M1043), LSA Protection (RunAsPPL), MFA (M1032), políticas de senha forte + lockout (M1027/M1036), gMSA para contas de serviço (mitiga Kerberoasting).

---

## TA0007 — Discovery
**Objetivo:** mapear o ambiente interno (hosts, contas, rede, AD).

| Técnica | ID | Exemplo |
|---|---|---|
| Account Discovery | T1087 | `net user`, enum de AD |
| System/Network Discovery | T1082 / T1018 / T1016 | `systeminfo`, `arp -a`, `ipconfig` |
| Domain Trust Discovery | T1482 | `nltest`, trusts |
| Permission Groups Discovery | T1069 | `net group "Domain Admins"` |
| Remote System Discovery | T1018 | varredura SMB/LDAP interna |

**Detecção:** baseline de uso de utilitários (`net.exe`, `nltest`, `dsquery`) por estações de usuário; queries LDAP volumosas atípicas (BloodHound/SharpHound geram leitura massiva de objetos AD).

**Mitigação:** difícil bloquear sem quebrar operação; foco em **detecção** e em limitar enumeração anônima (restringir null sessions, `RestrictAnonymous`), Network Segmentation (M1030).

---

## TA0008 — Lateral Movement
**Objetivo:** mover-se entre sistemas na rede.

| Técnica | ID | Exemplo |
|---|---|---|
| Remote Services | T1021 | RDP (.001), SMB/Admin$ (.002), WinRM (.006), SSH (.004) |
| Use Alternate Auth Material | T1550 | Pass-the-Hash (.002), Pass-the-Ticket (.003) |
| Exploitation of Remote Services | T1210 | exploit em serviço interno |
| Lateral Tool Transfer | T1570 | copiar binário entre hosts |

**Detecção:** logons tipo 3/10 anômalos (Event ID 4624); criação de serviço remoto (7045) via PsExec; NTLM auth com hash sem login interativo prévio (PtH); WinRM/5985 fora do baseline.

**Mitigação:** segmentação e firewall host-based (M1030), restrição de admin local com LAPS, bloqueio de NTLM onde possível, MFA para acesso administrativo, Protected Users group.

---

## TA0009 — Collection
**Objetivo:** reunir dados de interesse antes da exfiltração.

| Técnica | ID | Exemplo |
|---|---|---|
| Data from Local System | T1005 | varredura de arquivos sensíveis |
| Data from Network Shared Drive | T1039 | shares de arquivos |
| Data from Information Repositories | T1213 | SharePoint, Confluence, wikis |
| Email Collection | T1114 | caixas de e-mail |
| Archive Collected Data | T1560 | `7z`, `rar`, zip com senha |
| Screen/Keylogging | T1113 / T1056 | captura de tela, teclas |

**Detecção:** acesso massivo a shares (auditoria de objeto 4663); criação de arquivos de arquivo grandes; staging em diretórios temporários.

**Mitigação:** DLP (M1057), classificação e controle de acesso a dados, least privilege em repositórios.

---

## TA0011 — Command and Control
**Objetivo:** comunicar com sistemas comprometidos.

| Técnica | ID | Exemplo |
|---|---|---|
| Application Layer Protocol | T1071 | HTTPS (.001), DNS (.004) |
| Encrypted Channel | T1573 | TLS/criptografia simétrica |
| Ingress Tool Transfer | T1105 | download de ferramentas |
| Proxy | T1090 | domain fronting, redirectors |
| Web Service | T1102 | C2 via serviço legítimo (cloud, paste) |

**Detecção:** beaconing (intervalos regulares, jitter) em proxy/NetFlow; JA3/JA3S incomuns; volume alto de DNS TXT/queries longas; conexões a domínios recém-registrados.

**Mitigação:** inspeção/proxy de saída com allowlist (M1037 Filter Network Traffic), bloqueio de domínios recém-registrados/categorias, SSL inspection onde permitido.

---

## TA0010 — Exfiltration
**Objetivo:** extrair dados do ambiente.

| Técnica | ID | Exemplo |
|---|---|---|
| Exfiltration Over C2 Channel | T1041 | dados pelo canal de C2 |
| Exfiltration Over Web Service | T1567 | cloud storage (.002) |
| Exfiltration Over Alternative Protocol | T1048 | DNS/ICMP/SMTP |
| Scheduled Transfer | T1029 | exfil em horários definidos |
| Transfer Data to Cloud Account | T1537 | conta cloud do atacante |

**Detecção:** picos de tráfego de saída (bytes-out vs baseline); uploads para domínios de cloud não-corporativos; tunneling DNS (volume/entropia).

**Mitigação:** DLP (M1057), egress filtering, limites de upload, CASB para cloud não-sancionada.

---

## TA0040 — Impact
**Objetivo:** manipular, interromper ou destruir sistemas/dados.

| Técnica | ID | Exemplo |
|---|---|---|
| Data Encrypted for Impact | T1486 | ransomware |
| Inhibit System Recovery | T1490 | `vssadmin delete shadows` |
| Data Destruction | T1485 | wiping |
| Account Access Removal | T1531 | bloqueio de contas legítimas |
| Service/Endpoint DoS | T1499 / T1498 | indisponibilidade |

**Detecção:** `vssadmin`/`wbadmin delete`, `bcdedit` modificando recovery; renomeação/criptografia em massa de arquivos; uso de `cipher /w`.

**Mitigação:** backups offline/imutáveis testados (M1053), proteção de shadow copies, segmentação para conter blast radius, plano de IR/recovery.

> **Nota red team:** em testes autorizados, técnicas de Impact destrutivas (T1485/T1486/T1490) NÃO devem ser executadas de forma real. Demonstre a *capacidade* (ex.: acesso de escrita a backups, permissão para deletar shadow copies) sem detonar payload destrutivo. Documente o caminho e o impacto potencial no relatório.

---

## Tabela-resumo (ID das táticas)

| Tática | ID | Foco defensivo prioritário |
|---|---|---|
| Reconnaissance | TA0043 | reduzir metadados expostos |
| Resource Development | TA0042 | monitorar domínios/CT logs |
| Initial Access | TA0001 | MFA + patch de borda |
| Execution | TA0002 | logging de script + App Control |
| Persistence | TA0003 | auditoria de contas/tarefas |
| Privilege Escalation | TA0004 | least privilege + LAPS |
| Defense Evasion | TA0005 | tamper protection + log forwarding |
| Credential Access | TA0006 | Credential Guard + MFA |
| Discovery | TA0007 | detecção (difícil bloquear) |
| Lateral Movement | TA0008 | segmentação + LAPS + bloqueio NTLM |
| Collection | TA0009 | DLP + ACL de dados |
| Command and Control | TA0011 | egress proxy + allowlist |
| Exfiltration | TA0010 | DLP + egress filtering |
| Impact | TA0040 | backups imutáveis + IR |

## Referências
- MITRE ATT&CK Enterprise Matrix: https://attack.mitre.org/matrices/enterprise/
- ATT&CK Mitigations (Mxxxx): https://attack.mitre.org/mitigations/enterprise/
- ATT&CK Data Sources / Detections: https://attack.mitre.org/datasources/
