# Cloud (AWS/Azure/GCP) — Checklist de IAM, Storage Público, Metadata/IMDS e Segredos

> **USO AUTORIZADO**: Execute somente em contas/assinaturas/projetos com autorização explícita por escrito (escopo, janela, contas-alvo). Enumeração de IAM e buckets gera grande volume de eventos em CloudTrail/Activity Log/Cloud Audit Logs — combine antecipadamente com o cliente. Use credenciais somente-leitura quando o objetivo for avaliação de postura.

Referência de bolso para auditoria ofensiva de identidade, acesso, exposição de dados e segredos nos três principais provedores. Foco em descoberta, validação e remediação (valor defensivo).

---

## 0. Ferramentas multi-cloud (postura)

### ScoutSuite (read-only, gera relatório HTML)
```bash
pip install scoutsuite

# AWS (perfil nomeado)
scout aws --profile audit-ro --report-dir ./scout-aws

# Azure (CLI já autenticada)
scout azure --cli --report-dir ./scout-azure

# GCP (projeto único / organização)
scout gcp --user-account --project-id meu-projeto --report-dir ./scout-gcp
scout gcp --service-account key.json --all-projects
```

### Prowler (centenas de checks CIS/NIST/PCI, multi-cloud)
```bash
pip install prowler

# AWS — todos os checks, saída CSV/JSON/HTML
prowler aws -p audit-ro
# Apenas severidade alta/crítica
prowler aws --severity high critical
# Apenas checks de IAM e S3
prowler aws --service iam s3
# Benchmark específico
prowler aws --compliance cis_2.0_aws

# Azure / GCP
prowler azure --az-cli-auth
prowler gcp --project-ids meu-projeto
```

---

## 1. AWS

### 1.1 IAM — identidade e privilégios
- [ ] Conta root com MFA habilitado e sem access keys ativas.
- [ ] Usuários com console/keys e MFA; access keys com idade > 90 dias.
- [ ] Policies com `"Action": "*"` / `"Resource": "*"` (admin de fato).
- [ ] Caminhos de escalada de privilégio (iam:PassRole + ec2/lambda, CreatePolicyVersion, AttachUserPolicy, etc.).
- [ ] Roles assumíveis por princípios externos (`sts:AssumeRole` com `Principal: *` ou conta de terceiro sem ExternalId).

```bash
# Quem sou eu / qual conta
aws sts get-caller-identity

# Relatório de credenciais (idade de keys, MFA, último uso)
aws iam generate-credential-report
aws iam get-credential-report --query Content --output text | base64 -d

# Policies gerenciadas anexadas a um usuário e suas versões
aws iam list-attached-user-policies --user-name alvo
aws iam get-policy-version --policy-arn <arn> --version-id v1

# Trust policies de roles (assumíveis externamente?)
aws iam list-roles --query 'Roles[].{n:RoleName,t:AssumeRolePolicyDocument}'

# Enumeração de privilégios e escalada (read-only)
# enumerate-iam (analisa o que a credencial atual pode fazer)
python enumerate-iam.py --access-key AKIA... --secret-key ...
# Pacu (framework de exploração AWS) — módulos read-only primeiro
pacu  # > run iam__enum_permissions ; run iam__privesc_scan
```

**Remediação**: princípio do menor privilégio; substituir `*` por ARNs específicos; MFA obrigatório; rotação de keys < 90d; preferir roles/SSO a usuários IAM; `ExternalId` em trust de terceiros; Access Analyzer para detectar acesso externo.

### 1.2 Storage público (S3)
- [ ] Buckets com ACL/policy públicos ou `Block Public Access` desabilitado (conta e bucket).
- [ ] Buckets sem criptografia padrão ou sem versioning/logging.

```bash
# Listar buckets e checar bloqueio de acesso público
aws s3api list-buckets --query 'Buckets[].Name'
aws s3api get-public-access-block --bucket alvo-bucket
aws s3api get-bucket-policy-status --bucket alvo-bucket   # IsPublic: true?
aws s3api get-bucket-acl --bucket alvo-bucket

# Acesso anônimo (sem credenciais) — validação de exposição
aws s3 ls s3://alvo-bucket --no-sign-request
curl -s https://alvo-bucket.s3.amazonaws.com/   # lista XML se public-read
```

**Remediação**: ativar `Block Public Access` em nível de conta; remover ACLs públicas; SSE-KMS; versioning + logging; usar pre-signed URLs em vez de objetos públicos.

### 1.3 Metadata / IMDS (SSRF → credenciais)
Se houver SSRF/RCE em uma instância EC2, o endpoint de metadados pode vazar credenciais da role.
```bash
# IMDSv1 (vulnerável — sem token). EXECUTAR APENAS DENTRO DO ALVO AUTORIZADO.
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>

# IMDSv2 (requer token PUT — mitiga SSRF simples)
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

**Remediação**: **forçar IMDSv2** (`HttpTokens=required`), `HttpPutResponseHopLimit=1`, ou desabilitar IMDS onde não usado:
```bash
aws ec2 modify-instance-metadata-options --instance-id i-xxx \
  --http-tokens required --http-put-response-hop-limit 1 --http-endpoint enabled
```

### 1.4 Segredos
- [ ] Secrets/SSM Parameters sem rotação; segredos hardcoded em user-data, Lambda env, AMIs, repositórios.
```bash
aws secretsmanager list-secrets
aws ssm describe-parameters --query 'Parameters[?Type==`SecureString`==`false`]'
aws ec2 describe-instance-attribute --instance-id i-xxx --attribute userData \
  --query UserData.Value --output text | base64 -d   # credenciais em user-data?
# Scanner de segredos em código/IaC
trufflehog filesystem ./repo --only-verified
gitleaks detect --source ./repo
```
**Remediação**: Secrets Manager/SSM SecureString com rotação automática; nunca em env/user-data em texto; CI com gitleaks/trufflehog; revogar e rotacionar tudo que vazar.

---

## 2. Azure

### 2.1 IAM (Entra ID / RBAC)
- [ ] Atribuições `Owner`/`Contributor` em escopo amplo (subscription/management group).
- [ ] Service Principals com client secrets longevos; Custom Roles com `Actions: *`.
- [ ] Conditional Access ausente; MFA não obrigatório para admins.
```bash
az account show
az role assignment list --all -o table
az role assignment list --role Owner --all
az ad sp list --all --query '[].{n:displayName,id:appId}' -o table
# Enumeração ofensiva de Entra ID
# (ROADtools) extrai grafo completo de identidade
roadrecon auth -u user@tenant.onmicrosoft.com
roadrecon gather
roadrecon gui
```
**Remediação**: PIM (acesso just-in-time); menor privilégio com built-in roles; Conditional Access + MFA; certificados em vez de client secrets; revisar custom roles.

### 2.2 Storage público (Blob)
- [ ] Storage accounts com `allowBlobPublicAccess=true`; containers com nível `container`/`blob`.
```bash
az storage account list --query '[].{n:name,pub:allowBlobPublicAccess}' -o table
az storage container list --account-name alvo --auth-mode login -o table
# Acesso anônimo a container público
curl 'https://alvo.blob.core.windows.net/container?restype=container&comp=list'
```
**Remediação**: `allowBlobPublicAccess=false`; private endpoints; SAS de curta duração; firewall de rede na storage account.

### 2.3 Metadata (IMDS Azure)
```bash
# Dentro de VM autorizada — requer header Metadata:true
curl -s -H Metadata:true \
  'http://169.254.169.254/metadata/instance?api-version=2021-02-01'
# Token de Managed Identity (acesso a recursos)
curl -s -H Metadata:true \
  'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/'
```
**Remediação**: o header `Metadata:true` dificulta SSRF simples; restringir Managed Identity ao menor privilégio; WAF/validação de entrada contra SSRF.

### 2.4 Segredos (Key Vault)
```bash
az keyvault list -o table
az keyvault secret list --vault-name alvo
az keyvault show --name alvo --query 'properties.enableSoftDelete'
```
**Remediação**: RBAC no Key Vault, soft-delete + purge protection, rotação, private endpoint, logging de acesso.

---

## 3. GCP

### 3.1 IAM
- [ ] Bindings com `roles/owner`/`editor` em escopo de projeto/organização.
- [ ] Service Accounts com user-managed keys; `iam.serviceAccounts.actAs`/`getAccessToken` (escalada).
- [ ] Membros `allUsers`/`allAuthenticatedUsers` em qualquer policy.
```bash
gcloud auth list
gcloud projects get-iam-policy MEU_PROJETO --format=json
# Caça a allUsers/allAuthenticatedUsers
gcloud projects get-iam-policy MEU_PROJETO \
  --flatten=bindings --filter='bindings.members:allUsers'
gcloud iam service-accounts list
gcloud iam service-accounts keys list --iam-account sa@proj.iam.gserviceaccount.com
```
**Remediação**: remover roles primitivos (owner/editor); usar roles predefinidos/customizados granulares; desabilitar user-managed SA keys (Org Policy `disableServiceAccountKeyCreation`); Workload Identity Federation em vez de keys.

### 3.2 Storage público (GCS)
```bash
gsutil ls
gsutil iam get gs://alvo-bucket   # allUsers com objectViewer?
# Acesso anônimo
curl -s 'https://storage.googleapis.com/storage/v1/b/alvo-bucket/o'
```
**Remediação**: ativar **Public Access Prevention** (org/bucket); Uniform Bucket-Level Access; remover `allUsers`/`allAuthenticatedUsers`; signed URLs.

### 3.3 Metadata (SSRF → token de SA)
```bash
# Dentro da instância autorizada — requer header Metadata-Flavor:Google
curl -s -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
curl -s -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/project/attributes/?recursive=true'
```
**Remediação**: o header obrigatório mitiga SSRF simples; SA da VM com escopo mínimo; bloquear acesso à metadata legacy (`disable-legacy-endpoints=true`).

### 3.4 Segredos (Secret Manager)
```bash
gcloud secrets list
gcloud secrets versions access latest --secret=NOME
```
**Remediação**: Secret Manager com IAM granular por segredo, rotação, CMEK; nunca segredos em metadata/env de instância.

---

## 4. Checklist final de relatório
- [ ] Findings com severidade, evidência (output do comando), recurso afetado e ARN/ID.
- [ ] Caminho de exploração documentado (ex.: SSRF → IMDSv1 → creds da role → S3).
- [ ] Remediação priorizada por impacto e esforço.
- [ ] Relatórios ScoutSuite/Prowler anexados como baseline de postura.
- [ ] Credenciais/segredos descobertos comunicados ao cliente para rotação imediata.