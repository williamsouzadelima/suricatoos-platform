# Checklist de Operação Red Team mapeado ao MITRE ATT&CK

> Checklist operacional para engajamentos **autorizados** (red team / adversary emulation). Cada item referencia as táticas/técnicas ATT&CK correspondentes para garantir cobertura, rastreabilidade e mapeamento direto ao relatório Suricatoos. Marque `[x]` ao concluir e registre evidência + ID ATT&CK em cada finding.

## USO AUTORIZADO E RESPONSÁVEL (ler antes de começar)
- [ ] Contrato/SoW assinado e **Rules of Engagement (RoE)** acordadas (escopo, janela, alvos in/out-of-scope, tipos de teste permitidos).
- [ ] Autorização por escrito ("get-out-of-jail letter") em posse da equipe durante toda a operação.
- [ ] Pontos de contato (POC) técnico e de emergência definidos; canal de comunicação fora-de-banda combinado.
- [ ] Técnicas destrutivas (T1485/T1486/T1490) e DoS (T1498/T1499) **proibidas** salvo autorização explícita e janela dedicada.
- [ ] Manuseio de dados sensíveis definido (não exfiltrar dados reais de clientes; usar canários/amostras; criptografar coleta; destruir ao final).
- [ ] Plano de deconfliction com o Blue Team / SOC (purple team) e procedimento de abort.

---

## Fase 0 — Planejamento e Threat Modeling
- [ ] Definir adversário a emular (TTPs de um grupo real via ATT&CK Groups, se aplicável).
- [ ] Mapear objetivos do engajamento (crown jewels / flags) e critérios de sucesso.
- [ ] Preparar infraestrutura de C2 e logging próprio de ações (timeline de operador para relatório).

## Fase 1 — Reconnaissance (TA0043) e Resource Development (TA0042)
- [ ] **T1595/T1596** OSINT passivo: DNS, WHOIS, Certificate Transparency (crt.sh), Shodan/Censys.
- [ ] **T1589/T1591** Enumerar funcionários, e-mails, tecnologia, presença em vazamentos.
- [ ] **T1583/T1585** Provisionar infra (domínios, redirectors) e contas de pretexto, se autorizado.
- [ ] **T1595.001/.002** Scanning ativo de superfície externa (somente IPs in-scope).
- [ ] Documentar superfície de ataque e pontos de entrada candidatos.

## Fase 2 — Initial Access (TA0001)
- [ ] **T1190** Testar apps públicos (validar vulnerabilidades; PoC mínima, sem dano).
- [ ] **T1566** Phishing autorizado (anexo/link/serviço) — registrar taxa de clique/credencial.
- [ ] **T1078** Testar credenciais válidas (default, vazadas) contra serviços expostos.
- [ ] **T1133** Avaliar serviços remotos externos (VPN/RDP/Citrix) — MFA presente?
- [ ] Confirmar foothold e estabelecer C2 estável (TA0011).

## Fase 3 — Execution (TA0002) e Persistence (TA0003)
- [ ] **T1059** Execução de comandos/scripts no host — observar se EDR/AMSI alerta.
- [ ] **T1053/T1547/T1136** Estabelecer persistência (tarefa, autostart, conta) — documentar e **reverter ao final**.
- [ ] **T1505.003** Verificar viabilidade de web shell em apps comprometidos (remover após validar).
- [ ] Registrar quais mecanismos de persistência foram detectados vs. silenciosos.

## Fase 4 — Privilege Escalation (TA0004) e Defense Evasion (TA0005)
- [ ] **T1068/T1548/T1134** Escalar privilégios (admin local → SYSTEM) — citar vetor exato.
- [ ] **T1562** Avaliar (sem desabilitar de forma destrutiva) controles: tamper protection do EDR resiste?
- [ ] **T1027/T1036/T1055** Testar evasão (obfuscation, masquerading, injection) e medir cobertura de detecção.
- [ ] **T1070** NÃO limpar logs reais do cliente; em vez disso, validar se a remoção SERIA possível e reportar.

## Fase 5 — Credential Access (TA0006) e Discovery (TA0007)
- [ ] **T1003.001** LSASS dump (se autorizado) — usar com cuidado; preferir validar proteção (Credential Guard/RunAsPPL).
- [ ] **T1558.003** Kerberoasting — solicitar TGS de contas de serviço com SPN; testar crackeabilidade offline.
- [ ] **T1110.003** Password spraying com lockout-awareness (respeitar limiar para não bloquear usuários reais).
- [ ] **T1087/T1018/T1482/T1069** Discovery de AD (ex.: SharpHound/BloodHound) — mapear caminhos de ataque.
- [ ] **T1552** Buscar credenciais não seguras (GPP, scripts, shares, repositórios).

## Fase 6 — Lateral Movement (TA0008)
- [ ] **T1021.001/.002/.006** RDP/SMB/WinRM para hosts in-scope.
- [ ] **T1550.002/.003** Pass-the-Hash / Pass-the-Ticket a partir de material coletado.
- [ ] **T1570** Transferência de ferramentas entre hosts — verificar detecção por EDR/NGFW.
- [ ] Documentar cada salto (origem → destino, técnica, credencial usada) na timeline.

## Fase 7 — Collection (TA0009) e Exfiltration (TA0010)
- [ ] **T1005/T1039/T1213** Localizar crown jewels — **provar acesso sem exfiltrar dados reais** (usar canário/amostra dummy).
- [ ] **T1560** Demonstrar staging/arquivamento com dados sintéticos.
- [ ] **T1041/T1567/T1048** Testar canais de exfil (HTTPS, cloud, DNS) — medir se DLP/egress bloqueia.
- [ ] Confirmar com POC quais canais de saída são detectados vs. permitidos.

## Fase 8 — Impact (TA0040) — somente demonstração
- [ ] **T1486/T1490/T1485** NÃO executar. Demonstrar *capacidade* (ex.: permissão de escrita em backups, acesso para deletar shadow copies) sem detonar.
- [ ] Documentar blast radius potencial e dependências de recuperação.

## Fase 9 — Cleanup e Encerramento
- [ ] Remover **toda** persistência, contas, web shells, tarefas, binários e artefatos plantados.
- [ ] Reverter mudanças de configuração feitas durante o teste.
- [ ] Destruir/entregar com segurança qualquer dado coletado, conforme RoE.
- [ ] Fornecer ao Blue Team a timeline completa (IOCs, IDs ATT&CK, horários) para purple teaming.

## Fase 10 — Reporting
- [ ] Cada finding mapeado a `Tactic → Technique → Sub-technique` (IDs ATT&CK).
- [ ] Para cada técnica detectada/não-detectada, indicar fonte de log esperada e recomendação de detecção.
- [ ] Recomendações de mitigação referenciando controles ATT&CK (Mxxxx) — ver doc complementar.
- [ ] Matriz de cobertura: quais táticas foram alcançadas e onde a defesa interrompeu a kill chain.

---

## Matriz de cobertura (preencher por engajamento)

| Tática | ID | Tentado | Bem-sucedido | Detectado | Evidência (ref.) |
|---|---|:---:|:---:|:---:|---|
| Initial Access | TA0001 | [ ] | [ ] | [ ] | |
| Execution | TA0002 | [ ] | [ ] | [ ] | |
| Persistence | TA0003 | [ ] | [ ] | [ ] | |
| Privilege Escalation | TA0004 | [ ] | [ ] | [ ] | |
| Defense Evasion | TA0005 | [ ] | [ ] | [ ] | |
| Credential Access | TA0006 | [ ] | [ ] | [ ] | |
| Discovery | TA0007 | [ ] | [ ] | [ ] | |
| Lateral Movement | TA0008 | [ ] | [ ] | [ ] | |
| Collection | TA0009 | [ ] | [ ] | [ ] | |
| Command and Control | TA0011 | [ ] | [ ] | [ ] | |
| Exfiltration | TA0010 | [ ] | [ ] | [ ] | |
| Impact (demo) | TA0040 | [ ] | [ ] | [ ] | |

## Ferramentas de mapeamento e validação
- **ATT&CK Navigator** — visualizar cobertura: https://mitre-attack.github.io/attack-navigator/
- **MITRE Caldera** — adversary emulation automatizada (autorizado).
- **Atomic Red Team** — testes atômicos por técnica para validar detecção: https://github.com/redcanaryco/atomic-red-team
- **VECTR / DeTT&CT** — tracking de purple team e maturidade de detecção.

## Referências
- MITRE ATT&CK: https://attack.mitre.org/
- ATT&CK Groups (para emulação): https://attack.mitre.org/groups/
- PTES Technical Guidelines (complementar ao mapeamento ATT&CK).
