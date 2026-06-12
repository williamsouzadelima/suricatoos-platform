package pconfig

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

// secretPrefix marks a value that was encrypted by EncryptSecret. It lets us
// tell an encrypted blob apart from a plaintext value (e.g. a key pasted by the
// user) and version the scheme for future migrations.
const secretPrefix = "enc:v1:"

// IsEncryptedSecret reports whether value was produced by EncryptSecret.
func IsEncryptedSecret(value string) bool {
	return strings.HasPrefix(value, secretPrefix)
}

// deriveKey turns an arbitrary passphrase (e.g. COOKIE_SIGNING_SALT) into a
// 32-byte AES-256 key.
func deriveKey(passphrase string) []byte {
	sum := sha256.Sum256([]byte(passphrase))
	return sum[:]
}

// EncryptSecret encrypts plaintext with AES-256-GCM using a key derived from
// passphrase, returning an "enc:v1:<base64>" string. An empty plaintext is
// returned unchanged so callers can store "no secret" transparently. A value
// that is already encrypted is returned as-is (idempotent).
func EncryptSecret(plaintext, passphrase string) (string, error) {
	if plaintext == "" || IsEncryptedSecret(plaintext) {
		return plaintext, nil
	}

	block, err := aes.NewCipher(deriveKey(passphrase))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return secretPrefix + base64.StdEncoding.EncodeToString(sealed), nil
}

// DecryptSecret reverses EncryptSecret. A value without the encryption marker is
// returned unchanged (treated as already-plaintext, e.g. legacy/manual config).
func DecryptSecret(value, passphrase string) (string, error) {
	if !IsEncryptedSecret(value) {
		return value, nil
	}

	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, secretPrefix))
	if err != nil {
		return "", fmt.Errorf("failed to decode secret: %w", err)
	}

	block, err := aes.NewCipher(deriveKey(passphrase))
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create gcm: %w", err)
	}

	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt secret: %w", err)
	}

	return string(plaintext), nil
}
