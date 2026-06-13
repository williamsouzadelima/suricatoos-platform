#!/usr/bin/env bash
#
# Suricatoos — carrega o Conhecimento (70 docs) e os Recursos (refs) que vêm no seed
# para uma instância JÁ NO AR. Rode depois de `docker compose up` estar saudável.
#
# O Conhecimento exige um embedder configurado (ex.: Ollama com bge-m3, ou um provider
# de embeddings) — sem ele, o upload de Conhecimento falha; os Recursos sobem assim mesmo.
#
# Uso:   ./seed-content.sh
# Env:   BASE_URL (default https://localhost)  MAIL (default admin@suricatoos.com)  PASS (default admin)
#
set -euo pipefail
cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-https://localhost}"
MAIL="${MAIL:-admin@suricatoos.com}"
PASS="${PASS:-admin}"
KNOWLEDGE_JSON="backend/seed/knowledge/knowledge.json"
RESOURCES_DIR="backend/seed/resources"

command -v curl >/dev/null 2>&1 || { echo "✗ curl é necessário." >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "✗ jq é necessário." >&2; exit 1; }

CJ="$(mktemp)"; trap 'rm -f "$CJ"' EXIT
api() { curl -sk -b "$CJ" -c "$CJ" "$@"; }

echo "→ login em $BASE_URL como $MAIL"
code=$(api -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/auth/login" \
        -H 'Content-Type: application/json' \
        -d "$(jq -n --arg m "$MAIL" --arg p "$PASS" '{mail:$m,password:$p}')" || echo 000)
[ "$code" = "200" ] || { echo "✗ login falhou (http=$code)." >&2; exit 1; }
echo "  ✓ autenticado"

# ---- Conhecimento ----
if [ -f "$KNOWLEDGE_JSON" ]; then
  total=$(jq 'length' "$KNOWLEDGE_JSON")
  ok=0; fail=0
  echo "→ Conhecimento: $total documentos"
  if [ "$total" -gt 0 ]; then
    for i in $(seq 0 $((total - 1))); do
      doc=$(jq -c ".[$i]" "$KNOWLEDGE_JSON")
      c=$(api -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/knowledge/" \
            -H 'Content-Type: application/json' -d "$doc" || echo 000)
      if [ "$c" = "201" ] || [ "$c" = "200" ]; then
        ok=$((ok + 1))
      else
        fail=$((fail + 1))
        [ "$fail" -le 2 ] && echo "  ! doc $i http=$c (há embedder configurado?)"
      fi
    done
  fi
  echo "  ✓ Conhecimento: $ok ok, $fail falhas"
fi

# ---- Recursos ----
if [ -d "$RESOURCES_DIR" ]; then
  ok=0; fail=0
  echo "→ Recursos: enviando arquivos de $RESOURCES_DIR"
  while IFS= read -r f; do
    rel="${f#"$RESOURCES_DIR"/}"
    dir="$(dirname "$rel")"; [ "$dir" = "." ] && dir=""
    enc=$(jq -rn --arg d "$dir" '$d|@uri')
    c=$(api -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/v1/resources/?dir=$enc" \
          -F "files=@${f}" || echo 000)
    if [ "$c" = "201" ] || [ "$c" = "200" ]; then
      ok=$((ok + 1))
    else
      fail=$((fail + 1))
      [ "$fail" -le 2 ] && echo "  ! $rel http=$c"
    fi
  done < <(find "$RESOURCES_DIR" -type f ! -name '.DS_Store')
  echo "  ✓ Recursos: $ok ok, $fail falhas"
fi

echo "✓ concluído"
