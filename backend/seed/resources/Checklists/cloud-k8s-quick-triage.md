# Cloud + Kubernetes — Triagem Rápida e Mapa de Ferramentas (Quick Wins)

> **USO AUTORIZADO**: Esta folha é de triagem rápida (primeiras 1-2 horas de um engajamento autorizado). Confirme escopo, contas/clusters-alvo e janela. Comandos de descoberta são read-only por padrão; qualquer passo marcado como ativo/exploração exige aprovação explícita.

Objetivo: identificar rapidamente os achados de maior impacto ("quick wins") em Cloud e Kubernetes, com o caminho mais curto entre descoberta e validação. Use os checklists detalhados (`cloud-iam-storage-secrets.md`, `kubernetes-pentest.md`) para aprofundar.

---

## 1. Onde estou? (orientação)
```bash
# AWS
aws sts get-caller-identity
# Azure
az account show -o table
# GCP
gcloud config list && gcloud auth list
# Kubernetes
kubectl config current-context && kubectl auth can-i --list
```

---

## 2. Top 10 Quick Wins (por ordem de impacto)

| # | Achado | Validação rápida | Impacto |
|---|--------|------------------|---------|
| 1 | IMDSv1 acessível via SSRF (AWS) | `curl 169.254.169.254/latest/meta-data/iam/security-credentials/` | Roubo de credenciais da role |
| 2 | Bucket/Blob/GCS público | `aws s3 ls s3://b --no-sign-request` | Vazamento de dados |
| 3 | IAM com `*:*` / Owner amplo | `aws iam` / `az role assignment list` / `gcloud ... get-iam-policy` | Comprometimento total |
| 4 | `allUsers`/`anonymous` em policy | grep nos bindings IAM/RBAC | Acesso público a recursos |
| 5 | API server K8s anônimo (6443) | `curl -sk https://API:6443/api/v1/.../pods` | Controle do cluster |
| 6 | Kubelet read-only (10255) | `curl http://NODE:10255/pods` | Info disclosure / RCE |
| 7 | Pod privilegiado / docker.sock | `kubectl get pods -A -o json \| jq ...privileged` | Escape para o nó |
| 8 | Segredos hardcoded (user-data/env/git) | `gitleaks`, user-data base64 | Credenciais válidas |
| 9 | etcd sem TLS (2379) | `etcdctl --endpoints=http://NODE:2379 get / --prefix` | Dump de todos os secrets |
| 10 | RBAC `create pods`/`get secrets` | `kubectl auth can-i create pods` | Escalada para admin |

---

## 3. Sequência de triagem Cloud
```bash
# 1) Postura completa em background (relatório HTML/CSV)
prowler aws --severity high critical &
scout aws --profile audit-ro --report-dir ./scout &

# 2) Quick wins manuais enquanto roda
# Storage público (AWS)
for b in $(aws s3api list-buckets --query 'Buckets[].Name' --output text); do
  echo "== $b"; aws s3api get-bucket-policy-status --bucket "$b" 2>/dev/null
done
# IAM admin de fato
aws iam list-policies --scope Local --only-attached \
  --query 'Policies[].PolicyName'
# Segredos em código
gitleaks detect --source ./repo --no-banner
```

## 4. Sequência de triagem Kubernetes
```bash
# Superfície externa
kube-hunter --remote <IP_OU_CIDR>

# De dentro (token atual)
kubectl auth can-i --list
kubectl get pods -A -o json | jq -r '
  .items[] | select(.spec.containers[]?.securityContext.privileged==true)
  | "PRIV: \(.metadata.namespace)/\(.metadata.name)"'
kubectl get clusterrolebindings -o json | jq -r '
  .items[] | select(.subjects[]?.name|test("anonymous|authenticated"))
  | .metadata.name'

# De um pod comprometido (autorizado)
./peirates   # rouba SA tokens, testa kubelet, tenta escape
```

---

## 5. Mapa de ferramentas

| Domínio | Postura/Audit (read-only) | Exploração/Pós-exploração |
|---------|---------------------------|---------------------------|
| Multi-cloud | ScoutSuite, Prowler | — |
| AWS | Prowler, ScoutSuite | Pacu, enumerate-iam |
| Azure | Prowler, ScoutSuite | ROADtools (roadrecon) |
| GCP | Prowler, ScoutSuite | — |
| Segredos | gitleaks, trufflehog | — |
| K8s superfície | kube-hunter, kube-bench | kube-hunter --active |
| K8s RBAC | kubeaudit, kubectl-who-can | — |
| K8s pós-exploração | — | Peirates |

---

## 6. Higiene do engajamento (sempre)
- [ ] Registrar timestamp e comando de cada ação relevante (evidência + rastreabilidade em logs do cliente).
- [ ] Remover artefatos criados (pods de teste, roles temporárias, objetos em buckets).
- [ ] Comunicar imediatamente credenciais/segredos válidos descobertos para rotação.
- [ ] Nunca exfiltrar dados reais de produção; capturar apenas evidência mínima (PoC).
- [ ] Entregar findings com severidade (CVSS/risco), evidência, recurso afetado e remediação priorizada.

---

## 7. Referências de remediação rápida
- AWS: forçar IMDSv2; Block Public Access (conta); Access Analyzer; rotação de keys; SSO + roles.
- Azure: PIM + Conditional Access + MFA; `allowBlobPublicAccess=false`; private endpoints; Key Vault RBAC.
- GCP: remover roles primitivos; Public Access Prevention; desabilitar SA keys; Workload Identity Federation.
- Kubernetes: Pod Security Admission `restricted`; RBAC menor privilégio; NetworkPolicy isolando 6443/10250/2379; `automountServiceAccountToken: false`; etcd/kubelet com TLS e authz.