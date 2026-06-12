# Hashcat — Cheatsheet de Cracking Offline

> **USO AUTORIZADO.** Quebra de hashes deve ocorrer em material obtido dentro do escopo do engajamento, em infraestrutura própria/aprovada. Não exfiltre hashes de clientes para serviços de terceiros sem autorização explícita.

## Sintaxe base

```bash
hashcat -m <modo> -a <ataque> <arquivo_hash> [wordlist|mask] [opções]
```

| `-a` | Tipo de ataque |
|---|---|
| `0` | Straight (wordlist) |
| `1` | Combinator (duas wordlists) |
| `3` | Brute-force / mask |
| `6` | Wordlist + mask (append) |
| `7` | Mask + wordlist (prepend) |

## Modos `-m` mais usados em AD/pentest

| Modo | Tipo de hash | Origem típica |
|---|---|---|
| `1000` | NTLM | secretsdump, SAM/NTDS |
| `1100` | Domain Cached Credentials (DCC/MSCash) | hosts offline |
| `2100` | DCC2 / MSCash2 | hosts modernos |
| `13100` | Kerberos 5 TGS-REP (RC4, etype 23) | Kerberoasting |
| `19600` | Kerberos 5 TGS-REP (AES128, etype 17) | Kerberoasting AES |
| `19700` | Kerberos 5 TGS-REP (AES256, etype 18) | Kerberoasting AES |
| `18200` | Kerberos 5 AS-REP (etype 23) | AS-REP Roasting |
| `19900` | Kerberos 5 AS-REP (AES256) | AS-REP Roasting AES |
| `5500` | NetNTLMv1 | Responder/relay |
| `5600` | NetNTLMv2 | Responder/relay |
| `1800` | sha512crypt ($6$) | /etc/shadow Linux |
| `500` | md5crypt ($1$) | shadow legado |
| `22000` | WPA-PBKDF2 / WPA3 (PMKID+EAPOL) | hcxdumptool |
| `0` | MD5 / `100` SHA1 / `1400` SHA256 | apps web |

> Em dúvida sobre o modo, use `hashcat --identify hash.txt` ou consulte `hashcat --help | grep -i <termo>`.

## Exemplos práticos

```bash
# NTLM com wordlist
hashcat -m 1000 ntlm.txt rockyou.txt

# NTLM com regras (best64) — ótimo custo/benefício
hashcat -m 1000 ntlm.txt rockyou.txt -r rules/best64.rule

# Kerberoasting (RC4)
hashcat -m 13100 spns.hash rockyou.txt -r rules/OneRuleToRuleThemAll.rule

# AS-REP Roasting
hashcat -m 18200 asrep.hash rockyou.txt

# NetNTLMv2 capturado pelo Responder
hashcat -m 5600 netntlmv2.txt rockyou.txt -r rules/best64.rule

# Brute force por mask: 8 chars, Maiúscula+4 minúsc+2 dígitos+símbolo
hashcat -m 1000 ntlm.txt -a 3 '?u?l?l?l?l?d?d?s'

# Wordlist + mask: 'Empresa' + 4 dígitos (ex.: Empresa2025)
hashcat -m 1000 ntlm.txt -a 6 base.txt '?d?d?d?d'

# Combinator (junta duas listas)
hashcat -m 1000 ntlm.txt -a 1 left.txt right.txt
```

## Charsets para mask (`-a 3`)

```
?l = a-z      ?u = A-Z      ?d = 0-9
?s = símbolos ?a = todos    ?b = 0x00-0xff
```

Charset customizado: `-1 ?l?u?d` define `?1`; ex.: `-a 3 -1 ?l?d '?1?1?1?1?1?1'`.

## Opções operacionais úteis

```bash
--username            # Hashes no formato user:hash (NTDS) — ignora a coluna user
--show                # Mostra hashes já quebrados do potfile
--left                # Lista os que faltam quebrar
-o cracked.txt        # Arquivo de saída
--outfile-format 2    # 1=hash, 2=plain, 3=hash:plain (combinar: 3)
-w 3                  # Workload (1=baixo ... 4=insano); 3 é bom padrão
--status --status-timer 10   # Status periódico
-O                    # Optimized kernels (mais rápido, limita tamanho da senha)
--session nome        # Nomeia a sessão (permite --restore)
--restore --session nome     # Retoma sessão interrompida
hashcat -b -m 1000    # Benchmark de um modo
```

## Fluxo recomendado (eficiência antes de força bruta)

1. **Quick wins:** wordlist comum (`rockyou`) sem regras.
2. **Regras:** `best64.rule` → `OneRuleToRuleThemAll.rule`.
3. **Wordlists temáticas:** nome da empresa, estação, ano, padrões locais (gere com `hashcat-utils`/`maskprocessor`/`cewl`).
4. **Mask dirigida:** quando souber a política de senha (comprimento/composição).
5. **Brute force incremental:** apenas curto (≤8) — acima disso é inviável.

Use `--show -o results.txt --outfile-format 3` ao final para consolidar `hash:plain` para o relatório (sem expor as senhas além do necessário — trate como dado sensível).

## Hashes de aplicação web comuns

```bash
hashcat -m 3200 bcrypt.txt rockyou.txt   # bcrypt $2a$/$2b$ (lento por design)
hashcat -m 7400 sha256crypt.txt wl.txt   # $5$
hashcat -m 1800 sha512crypt.txt wl.txt   # $6$
```

## Notas de remediação (o que reportar ao cliente)

- **Senhas quebradas rapidamente** indicam política fraca: recomendar mínimo de 14+ caracteres, banir senhas comuns/compromissadas (ex.: filtros baseados em listas como a do NIST/HIBP), e desencorajar composição complexa em favor de comprimento (passphrases).
- **NTLM/RC4 crackeáveis:** migrar para Kerberos AES, gMSA para serviços, e considerar autenticação resistente a phishing (FIDO2) para contas privilegiadas.
- **NetNTLMv1 presente (`-m 5500`):** desabilitar LM/NTLMv1 via GPO — é trivialmente quebrável.
- **DCC2 (`-m 2100`):** limitar quantidade de credenciais em cache em endpoints (`CachedLogonsCount`).
- **bcrypt/sha512crypt resistindo** é o comportamento esperado — destacar como controle positivo no relatório.
- Após o teste, **destrua com segurança** as wordlists de saída e hashes do cliente conforme as regras de engajamento.
