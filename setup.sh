#!/usr/bin/env bash
#
# Suricatoos — setup de um clone novo (rode uma vez).
# Cria .env a partir de .env.example, gera um COOKIE_SIGNING_SALT e uma senha de
# banco aleatórios, e expõe o app em todas as interfaces. NUNCA sobrescreve um .env existente.
#
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo "✓ .env já existe — não vou sobrescrever. (Apague-o se quiser regenerar.)"
  exit 0
fi

[ -f .env.example ] || { echo "✗ .env.example não encontrado — rode na raiz do repo." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "✗ openssl é necessário para gerar os segredos." >&2; exit 1; }

SALT="$(openssl rand -hex 32)"   # 64 hex chars — seguro para sed
DBPW="$(openssl rand -hex 24)"   # 48 hex chars

tmp="$(mktemp)"
sed -e "s|^COOKIE_SIGNING_SALT=.*|COOKIE_SIGNING_SALT=${SALT}|" \
    -e "s|^SURICATOOS_POSTGRES_PASSWORD=.*|SURICATOOS_POSTGRES_PASSWORD=${DBPW}|" \
    -e "s|^SURICATOOS_LISTEN_IP=.*|SURICATOOS_LISTEN_IP=0.0.0.0|" \
    .env.example > "$tmp"
mv "$tmp" .env
chmod 600 .env

cat <<'DONE'
✓ .env criado:
    • COOKIE_SIGNING_SALT          → aleatório (NÃO mude depois: cifra as chaves de provider + assina o cookie)
    • SURICATOOS_POSTGRES_PASSWORD → aleatório
    • SURICATOOS_LISTEN_IP         → 0.0.0.0 (acessível externamente)

Próximos passos:
    1. (opcional) edite .env e adicione ANTHROPIC_API_KEY / OPEN_AI_KEY — ou cadastre depois pela UI
    2. docker compose up -d --build
    3. abra https://<este-host>   (login inicial: admin@suricatoos.com / admin — TROQUE a senha)
DONE
