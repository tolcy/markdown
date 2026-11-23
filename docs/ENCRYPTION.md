# 文稿加密 / Document encryption

Tolcy encrypts document text at rest. It does not provide DRM, application-exclusive access, or protection against other programs running as the same Windows user. Anyone who has the correct original key and implements this format can decrypt a document.

Tolcy 加密磁盘中的文稿正文。它不是 DRM，无法限制只有某个软件可以解密，也不能防止同一 Windows 用户下的其他程序访问内存或调用系统保护 API。

## Use / 使用

1. Open **Settings → Encryption & keys** / “设置 → 加密与密钥”。
2. Add a named key with at least 12 characters. Multiple keys are supported / 添加名称和至少 12 个字符的密钥，可添加多个。
3. Select a key for the current document and **Apply and save** / 为当前文稿选择密钥，点击“应用并保存”。
4. Later opens recognize and decrypt the document automatically / 后续打开会自动识别并解密。

Keep your original keys backed up separately. Re-add the same original key after changing computers, Windows accounts, or reinstalling Windows. A key can have a different name on the new computer; successful authentication identifies the matching secret.

请独立备份原始密钥。换电脑、换 Windows 账户或重装系统后，需重新添加相同密钥。名称可以不同，软件会通过认证解密识别正确密钥。删除记住的密钥不会解密文件，之后必须重新添加原始密钥才能打开。

## Version 1 format / 第一版格式

UTF-8 bytes begin with `SPRINGM-ENC-V1` followed by LF and one JSON object:

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM+Argon2id",
  "keyId": "32 lowercase hexadecimal characters",
  "salt": "base64",
  "nonce": "base64",
  "ciphertext": "base64 ciphertext followed by the 16-byte authentication tag"
}
```

- KDF: Argon2id v0x13, 19,456 KiB memory, 2 iterations, parallelism 1, 32 output bytes.
- Password bytes: exact UTF-8 bytes of the original key, without trimming or normalization.
- Salt: 16 random bytes generated for each save.
- Cipher: AES-256-GCM, 12-byte random nonce generated for each save.
- Authenticated associated data: the exact bytes `SPRINGM-ENC-V1\n` followed by the UTF-8 keyId string.
- Format constants `SPRINGM-ENC-V1` (documents) and `SPRINGM-KEYS-V1` (key vault) are historical identifiers kept unchanged after the Tolcy rename, so existing encrypted files still decrypt. / 格式标识 `SPRINGM-ENC-V1`（文稿）与 `SPRINGM-KEYS-V1`（密钥库）是历史常量，改名后保持不变，旧文件仍可解密。
- Salt, nonce, and ciphertext use standard padded Base64.
- Unknown versions, algorithms, malformed lengths, authentication failures, and missing keys produce errors. There is no fallback from encryption errors to a plaintext save.
- Ordinary saves, Save As, recovery saves, and workspace replacement preserve encryption unless the user explicitly chooses plain Markdown.

## Remembered keys / 密钥记忆

The local vault is `encryption-keys.dpapi` under the application's data directory. It contains a versioned JSON key list protected with Windows DPAPI `CryptProtectData` for the current user, without `CRYPTPROTECT_LOCAL_MACHINE`. No plaintext vault is written. The frontend receives only key ids and labels when listing keys. Encryption key material uses zeroizing buffers where practical; document plaintext necessarily exists in editor memory while open.

密钥库使用当前 Windows 用户的 DPAPI 保护；不得通过复制密钥库文件来代替备份原始密钥。密钥库损坏或无法解锁时不会被自动重置。平台不支持安全保护时，加密功能会报错，不会退回明文保存密钥。

Saves write to a temporary file in the destination directory, synchronize it, and replace the target only after encryption and writing succeed. Temporary files for encrypted documents contain ciphertext.

## Scope / 保护范围

Encryption covers document text. Filenames, folder structure, image attachments, exported files, clipboard content, and requests for remote resources are outside its scope. Export commands, including the copy commands in the export menu, ask for confirmation for encrypted documents; ordinary keyboard copying does not. This first implementation has regression tests but has not received an independent security audit.

加密保护正文，不保护文件名、文件夹结构、图片附件、导出文件、剪贴板或远程资源请求。导出菜单中的导出／复制操作会提醒内容不再受文稿加密保护；普通键盘复制不弹出提醒。本实现有回归测试，尚未接受独立安全审计。
