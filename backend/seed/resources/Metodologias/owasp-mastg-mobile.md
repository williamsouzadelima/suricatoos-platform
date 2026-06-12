# OWASP MASTG/MASVS — Referência de Teste de Apps Mobile (Android/iOS)

> Guia de bolso para testes AUTORIZADOS de aplicativos móveis, alinhado ao OWASP MASTG (Testing Guide) e MASVS (Verification Standard). Teste apenas apps/contas em escopo, em dispositivos/emuladores próprios. Não exfiltre dados reais de usuários. Documente cada achado com PoC reproduzível e remediação.

## MASVS — grupos de controle (mapa mental)

| Grupo | Foco |
|------|------|
| **MASVS-STORAGE** | Armazenamento e vazamento de dados sensíveis |
| **MASVS-CRYPTO** | Uso correto de criptografia e chaves |
| **MASVS-AUTH** | Autenticação e autorização |
| **MASVS-NETWORK** | Comunicação segura (TLS, pinning) |
| **MASVS-PLATFORM** | Interação com a plataforma (IPC, WebViews, deep links) |
| **MASVS-CODE** | Qualidade/integridade do código e dependências |
| **MASVS-RESILIENCE** | Resistência a engenharia reversa e adulteração |

MASTG-TEST-* são os procedimentos concretos por grupo. Os profiles **MAS-L1** (baseline) e **MAS-L2** (defesa em profundidade) + **MAS-R** (resiliência) definem o rigor.

---

## Toolkit

```bash
# Android
adb devices                      # listar dispositivos
adb install app.apk
adb shell pm list packages | grep alvo
adb shell pm path com.alvo.app   # localizar APK no device
adb pull /data/app/.../base.apk
apktool d app.apk -o out/        # decompilar recursos/smali
jadx-gui app.apk                 # decompilar para Java (UI)
d2j-dex2jar app.apk              # dex -> jar (com JD-GUI)
aapt dump badging app.apk        # metadados/permissões

# iOS
frida-ps -Uai                    # apps no device iOS via Frida
ipainstaller / ideviceinstaller -l
otool -L Binario                 # libs linkadas
class-dump Binario               # headers Obj-C
# .ipa é um zip:
unzip app.ipa -d ipa_out/

# Dinâmico (ambos)
frida -U -f com.alvo.app -l hook.js --no-pause
objection -g com.alvo.app explore   # runtime mobile exploration
mitmproxy / Burp                    # intercept (configurar proxy + CA)
```

Ferramentas-chave: `MobSF` (análise estática+dinâmica automatizada), `jadx`, `apktool`, `frida`/`objection`, `Burp`/`mitmproxy`, `drozer` (IPC Android), `nuclei`-like checks de config. Em iOS, dispositivo com jailbreak (ou Frida via app reempacotado) facilita o dinâmico.

---

## MASVS-STORAGE — Armazenamento de dados

**O que testar**
- Dados sensíveis (tokens, PII, senhas) em `SharedPreferences`, SQLite, arquivos, logs, caches, backups.
- Android: `/data/data/<pkg>/`, `android:allowBackup`, screenshots em background, clipboard.
- iOS: `NSUserDefaults`, plist, Keychain com classe de proteção fraca, `Documents/`.

```bash
# Android: inspecionar storage do app (device debug/emulador)
adb shell run-as com.alvo.app ls -R /data/data/com.alvo.app/
adb shell run-as com.alvo.app cat /data/data/com.alvo.app/shared_prefs/*.xml
# Verificar allowBackup
aapt dump xmltree app.apk AndroidManifest.xml | grep -i allowBackup
adb backup -f bak.ab com.alvo.app   # se backup permitido

# Logs vazando dados
adb logcat | grep -iE 'token|password|secret|authorization'

# iOS: dump do Keychain (device autorizado, Frida/objection)
objection -g com.alvo.app run ios keychain dump
objection -g com.alvo.app run ios nsuserdefaults get
```

**Remediação**
- Não armazenar segredos em texto claro; usar `EncryptedSharedPreferences`/Android Keystore e iOS Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
- `android:allowBackup="false"`; `FLAG_SECURE` em telas sensíveis; não logar dados sensíveis; limpar clipboard/cache.

---

## MASVS-CRYPTO — Criptografia

**O que testar**
- Algoritmos fracos/obsoletos (DES, RC4, MD5, SHA1), ECB, IV estático/hardcoded, chaves embutidas no código.
- Geração de aleatoriedade insegura (`java.util.Random` para chaves/nonces).

```bash
# Procurar primitivas fracas no código decompilado
grep -rniE 'DES|RC4|ECB|MD5|SHA1|Random\(' out/smali/ jadx_out/
grep -rniE 'SecretKeySpec|IvParameterSpec|"[A-Za-z0-9+/]{16,}="' jadx_out/  # chaves/IV hardcoded
```

**Remediação**
- AES-GCM/256, IV/nonce aleatório por operação, `SecureRandom`/`CSPRNG`; chaves no Keystore/Keychain (não no binário); HKDF para derivação; TLS para transporte (não cripto caseira).

---

## MASVS-AUTH — Autenticação e autorização

**O que testar**
- Autenticação local que pode ser bypassada (PIN/biometria validados só no cliente).
- Tokens de sessão mal gerenciados; ausência de logout/expiração; autorização decidida no app em vez do servidor.
- Biometria: usar `CryptoObject` (chave liberada pela biometria) vs. apenas callback booleano (bypassável via Frida).

```javascript
// Frida: bypass de checagem booleana de biometria/jailbreak (PoC para evidenciar fraqueza)
Java.perform(function () {
  var Auth = Java.use('com.alvo.app.BiometricHelper');
  Auth.isAuthenticated.implementation = function () { return true; };
});
```

**Remediação**
- Decisões de autorização sempre no servidor; biometria atrelada a chave do Keystore via `CryptoObject`; tokens curtos + revogação; nunca confiar em flags client-side.

---

## MASVS-NETWORK — Comunicação

**O que testar**
- TLS obrigatório (sem `http://`), validação de certificado, **certificate pinning** e sua resistência a bypass.
- Aceitação de cert inválido/auto-assinado; cleartext traffic permitido.

```bash
# Android: cleartext / network security config
aapt dump xmltree app.apk AndroidManifest.xml | grep -i usesCleartextTraffic
unzip -p app.apk res/xml/network_security_config.xml 2>/dev/null

# Interceptar TLS: instalar CA do proxy e testar
# Bypass de pinning para confirmar implementação:
objection -g com.alvo.app explore --startup-command 'android sslpinning disable'
frida -U -f com.alvo.app -l frida-multiple-unpinning.js --no-pause
```

**Remediação**
- TLS 1.2+ e `cleartextTrafficPermitted=false`; pinning (cert/SPKI) com plano de rotação; validar cadeia/hostname; usar `Network Security Config` (Android) / ATS (iOS) sem exceções amplas.

---

## MASVS-PLATFORM — Interação com a plataforma

**O que testar**
- **IPC Android**: `Activities`/`Services`/`BroadcastReceivers`/`ContentProviders` exportados; intents implícitas; deep links/App Links.
- **WebViews**: `setJavaScriptEnabled`, `addJavascriptInterface`, `file://` access, carregamento de URL não validada → XSS/RCE no contexto do app.
- iOS: URL schemes, Universal Links, pasteboard, `WKWebView` configs.

```bash
# Android: componentes exportados
aapt dump xmltree app.apk AndroidManifest.xml | grep -iE 'activity|provider|receiver|service|exported|scheme'
# Drozer: enumerar e atacar superfície IPC
drozer console connect
run app.package.attacksurface com.alvo.app
run app.provider.finduri com.alvo.app
run scanner.provider.injection -a com.alvo.app  # SQLi em ContentProvider

# Acionar deep link
adb shell am start -W -a android.intent.action.VIEW -d 'alvoapp://pay?to=attacker&amount=999'
```

**Remediação**
- `exported=false` por padrão; permissões em componentes; validar/whitelist de deep links e parâmetros; em WebView desabilitar JS quando possível, remover `addJavascriptInterface` legado, restringir file access e validar URLs.

---

## MASVS-CODE — Qualidade e dependências

**O que testar**
- SDKs/libs desatualizadas com CVEs; segredos/API keys hardcoded; debug habilitado (`android:debuggable`).
- Tratamento de erro/entrada (injeções via parâmetros locais, deep links, IPC).

```bash
# Segredos no binário
grep -rniE 'api[_-]?key|secret|password|AKIA[0-9A-Z]{16}|-----BEGIN' jadx_out/ ipa_out/
strings -n 8 base.apk | grep -iE 'https?://|key|token'
# debuggable
aapt dump xmltree app.apk AndroidManifest.xml | grep -i debuggable
# Dependências vulneráveis (relatório do MobSF cobre isso)
```

**Remediação**
- Atualizar dependências; remover segredos do cliente (usar backend/secret broker); desabilitar debug em release; validar todas as entradas (incl. IPC/deep link).

---

## MASVS-RESILIENCE — Anti-tampering / anti-reversing (perfil R)

> Controles de resiliência são defesa em profundidade, não substituem os anteriores. Testá-los significa avaliar se podem ser contornados — não são bug por si só.

**O que testar**
- Detecção de root/jailbreak, debugger, emulador, hooking (Frida), integridade do app/assinatura.
- Ofuscação e proteção de strings/segredos; resistência a repackaging.

```bash
# Verificar se detecções podem ser desativadas em runtime
objection -g com.alvo.app explore --startup-command 'android root disable'
frida-ps -U   # presença do frida-server costuma ser detectada por apps maduros
# Repackaging: assinatura
apksigner verify --print-certs app.apk
```

**Remediação**
- Múltiplas verificações de root/jailbreak/debug/hook server-side-aware; verificação de integridade de assinatura; ofuscação (R8/ProGuard, iXGuard); SafetyNet/Play Integrity API e DeviceCheck/App Attest (iOS) atestando no servidor.

---

## Fluxo de teste recomendado (MASTG)

1. **Recon/estático**: extrair APK/IPA → MobSF + jadx/apktool; mapear permissões, componentes, libs, segredos.
2. **Storage/Crypto**: inspecionar dados em repouso, logs, backups, primitivas cripto e chaves.
3. **Network**: interceptar tráfego (CA do proxy), avaliar TLS e pinning.
4. **Dinâmico/runtime**: Frida/objection para auth, lógica client-side, bypasses.
5. **Plataforma/IPC**: drozer + deep links + WebView.
6. **Resiliência**: avaliar anti-tampering (perfil R).
7. **Relatório**: por controle MASVS/MASTG, com PoC, evidência (logs/capturas), severidade e remediação.

## Referências
- OWASP MASTG: https://mas.owasp.org/MASTG/
- OWASP MASVS: https://mas.owasp.org/MASVS/
- OWASP MAS Checklist (mapeia MASVS↔MASTG-TEST e perfis L1/L2/R).