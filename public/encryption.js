// Only key ids and labels enter frontend state. Secrets are sent once to the
// native vault and never saved to localStorage, the document, or a JS key cache.
Object.assign(I18N.zh, {
  encryptionToggle: "文稿加密（切换后保存生效）", encryptionToggleLabel: "加密", encryptionChooseKey: "选择密钥", encryptionAddFirst: "先添加密钥",
  encryption: "加密与密钥", encryptionHint: "为不同文稿选择不同密钥。软件会在这台电脑的当前 Windows 账户中安全记住密钥，下次打开时自动解密。",
  encryptionBackupHint: "请另行保存原始密钥。换电脑或重装系统后，需要重新添加相同密钥。加密只保护文稿正文，不隐藏文件名，也不加密图片附件或导出文件。",
  encryptionDesktopOnly: "请使用 Windows 桌面版管理密钥和加密文稿。", encryptionCurrent: "当前文稿", encryptionUseKey: "保存时使用",
  encryptionNone: "不加密（普通 Markdown）", encryptionApply: "应用并保存", encryptionKeys: "已记住的密钥", encryptionAdd: "添加密钥",
  encryptionKeyName: "密钥名称", encryptionSecret: "密钥（至少 12 个字符）", encryptionConfirm: "再次输入密钥", encryptionRemember: "安全记住密钥",
  encryptionNoDocument: "先打开或新建一份文稿。", encryptionEmpty: "还没有密钥。可以添加多个密钥，分别用于不同文稿。",
  encryptionDelete: "删除", encryptionDeleteWarning: "删除“{name}”后，使用它的加密文稿将无法打开，除非重新添加相同的原始密钥。确定删除？",
  encryptionMismatch: "两次输入的密钥不一致。", encryptionPending: "加密方式已更改，保存后生效。", encryptionSaved: "已加密：{name}",
  encryptionPlain: "当前文稿未加密。", encryptionMissing: "此文稿的密钥已不在列表中，请重新添加原始密钥。",
  encryptionRemoveWarning: "将以普通 Markdown 保存当前文稿，其他软件可直接读取正文。继续？",
  encryptionExportWarning: "导出或复制会产生可直接读取的内容，不保留文稿加密。继续？",
  SM_KEY_MISSING: "缺少密钥。请在“设置 → 加密与密钥”中添加这份文稿使用的原始密钥，然后重新打开。",
  SM_DECRYPT_FAILED: "无法解密：已记住的密钥均不匹配，或文件已损坏。原文件没有被修改。",
  SM_INVALID_ENCRYPTED_FILE: "加密文件格式不受支持或文件已损坏。原文件没有被修改。",
  SM_VAULT_UNAVAILABLE: "无法读取或保护密钥库。请使用原来的 Windows 账户；不要删除密钥库，必要时重新添加备份的原始密钥。",
  SM_INVALID_KEY_NAME: "请填写 1–64 个字符的密钥名称。", SM_KEY_TOO_SHORT: "密钥需至少 12 个字符，且不超过 1024 字节。",
  SM_DUPLICATE_KEY_NAME: "已有同名密钥，请换一个名称。", SM_TOO_MANY_KEYS: "最多可记住 32 个密钥。", SM_ENCRYPT_FAILED: "加密失败，原文件没有被修改。",
});
Object.assign(I18N.en, {
  encryptionToggle: "Document encryption (save to apply)", encryptionToggleLabel: "Encrypt", encryptionChooseKey: "Choose key", encryptionAddFirst: "Add a key first",
  encryption: "Encryption & keys", encryptionHint: "Choose a key for each document. Keys are safely remembered for your current Windows account on this computer, so documents decrypt automatically next time.",
  encryptionBackupHint: "Keep a separate copy of your original keys. On another computer or after reinstalling Windows, add the same keys again. Encryption protects document text, not filenames, image attachments, or exported files.",
  encryptionDesktopOnly: "Use the Windows desktop app to manage keys and encrypt documents.", encryptionCurrent: "Current document", encryptionUseKey: "Use when saving",
  encryptionNone: "No encryption (plain Markdown)", encryptionApply: "Apply and save", encryptionKeys: "Remembered keys", encryptionAdd: "Add a key",
  encryptionKeyName: "Key name", encryptionSecret: "Key (at least 12 characters)", encryptionConfirm: "Enter the key again", encryptionRemember: "Remember key securely",
  encryptionNoDocument: "Open or create a document first.", encryptionEmpty: "No keys yet. Add multiple keys for different documents.",
  encryptionDelete: "Delete", encryptionDeleteWarning: "Deleting “{name}” makes its encrypted documents unreadable until you add the same original key again. Delete this key?",
  encryptionMismatch: "The two keys do not match.", encryptionPending: "Encryption selection changed. Save to apply it.", encryptionSaved: "Encrypted: {name}",
  encryptionPlain: "This document is not encrypted.", encryptionMissing: "The key for this document is missing. Add its original key again.",
  encryptionRemoveWarning: "Save this document as plain Markdown? Other apps will be able to read its text.",
  encryptionExportWarning: "Exporting or copying produces readable content without document encryption. Continue?",
  SM_KEY_MISSING: "Key missing. Add this document's original key in Settings → Encryption & keys, then open it again.",
  SM_DECRYPT_FAILED: "Unable to decrypt: no remembered key matches, or the file is damaged. The original file was not changed.",
  SM_INVALID_ENCRYPTED_FILE: "Unsupported or damaged encrypted document. The original file was not changed.",
  SM_VAULT_UNAVAILABLE: "The protected key vault could not be read or updated. Use the original Windows account. Do not delete the vault; keep your original keys backed up.",
  SM_INVALID_KEY_NAME: "Enter a key name of 1–64 characters.", SM_KEY_TOO_SHORT: "A key must contain at least 12 characters and at most 1024 bytes.",
  SM_DUPLICATE_KEY_NAME: "A key with this name already exists.", SM_TOO_MANY_KEYS: "You can remember up to 32 keys.", SM_ENCRYPT_FAILED: "Encryption failed. The original file was not changed.",
});

let encryptionKeys = [];
let encryptionBusy = false;

function openEncryptionSettings() {
  showSettings();
  document.querySelectorAll("[data-settings-tab]").forEach(button => button.classList.toggle("is-current", button.dataset.settingsTab === "encryption"));
  document.querySelectorAll("[data-settings-panel]").forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== "encryption"; });
  document.getElementById("encryption-key-name").focus();
}

function setDocumentEncryptionKey(keyId) {
  const tab = state.tabs.find(item => item.key === state.activeKey);
  if (!tab || !isDesktop() || encryptionBusy) return;
  if (keyId && !encryptionKeys.some(key => key.id === keyId)) return;
  if (tab.encryptionKeyId) tab.preferredEncryptionKeyId = tab.encryptionKeyId;
  if (keyId) tab.preferredEncryptionKeyId = keyId;
  if ((tab.encryptionKeyId || "") === keyId) return;
  tab.encryptionKeyId = keyId;
  markDirty();
}

function renderQuickEncryption(tab) {
  const toggle = document.getElementById("quick-encryption-toggle");
  const select = document.getElementById("quick-encryption-key");
  const enabled = !!(tab && tab.encryptionKeyId);
  toggle.setAttribute("aria-checked", String(enabled));
  toggle.disabled = !isDesktop() || !tab || encryptionBusy;
  const selected = tab && (tab.encryptionKeyId || tab.preferredEncryptionKeyId) || "";
  const available = encryptionKeys.some(key => key.id === selected);
  const value = enabled ? selected : available ? selected : (encryptionKeys[0] && encryptionKeys[0].id) || "";
  select.replaceChildren();
  for (const key of encryptionKeys) {
    const option = document.createElement("option"); option.value = key.id; option.textContent = key.name; select.appendChild(option);
  }
  if (!value || (enabled && !available)) {
    const option = document.createElement("option"); option.value = value; option.textContent = enabled ? t("encryptionMissing") : t("encryptionAddFirst"); option.disabled = true; select.appendChild(option);
  }
  select.value = value;
  select.disabled = toggle.disabled || !encryptionKeys.length;
  const key = encryptionKeys.find(key => key.id === value);
  select.title = key ? key.name : t(enabled ? "encryptionMissing" : "encryptionAddFirst");
  document.getElementById("footer-encryption").title = !isDesktop() ? t("encryptionDesktopOnly") : !tab ? t("encryptionNoDocument") : encryptionChanged(tab) ? t("encryptionPending") : t("encryptionToggle");
}

function renderEncryptionSettings() {
  const select = document.getElementById("document-encryption-key");
  if (!select) return;
  const desktop = isDesktop();
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  renderQuickEncryption(tab);
  document.getElementById("encryption-desktop-hint").hidden = desktop;
  document.getElementById("encryption-document-name").textContent = tab ? tab.name : t("encryptionNoDocument");
  select.replaceChildren();
  const option = (value, label) => { const item = document.createElement("option"); item.value = value; item.textContent = label; select.appendChild(item); };
  option("", t("encryptionNone"));
  for (const key of encryptionKeys) option(key.id, key.name);
  const selected = tab && tab.encryptionKeyId || "";
  const key = encryptionKeys.find((key) => key.id === selected);
  if (selected && !key) option(selected, t("encryptionMissing"));
  select.value = selected;
  select.disabled = !desktop || !tab || encryptionBusy;
  document.getElementById("apply-document-encryption").disabled = select.disabled;
  document.getElementById("encryption-document-status").textContent = !tab ? "" : encryptionChanged(tab) ? t("encryptionPending") : selected ? (key ? t("encryptionSaved", { name: key.name }) : t("encryptionMissing")) : t("encryptionPlain");
  const list = document.getElementById("encryption-key-list");
  list.replaceChildren();
  if (!encryptionKeys.length) list.textContent = t("encryptionEmpty");
  for (const key of encryptionKeys) {
    const row = document.createElement("div"); row.className = "encryption-key-row";
    const label = document.createElement("span"); label.textContent = key.name;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = t("encryptionDelete"); remove.disabled = encryptionBusy;
    remove.addEventListener("click", async () => {
      if (encryptionBusy || !await askDialog({title: t("encryptionDelete"), message: t("encryptionDeleteWarning", {name: key.name}), focusCancel: true})) return;
      encryptionBusy = true; renderEncryptionSettings();
      try { await invoke("remove_encryption_key", {id: key.id}); await refreshEncryptionKeys(); }
      catch (error) { await notice(errorText(error)); }
      finally { encryptionBusy = false; renderEncryptionSettings(); }
    });
    row.append(label, remove); list.appendChild(row);
  }
  document.querySelectorAll("#encryption-key-form input, #encryption-key-form button").forEach((input) => { input.disabled = !desktop || encryptionBusy; });
}

async function refreshEncryptionKeys() {
  if (isDesktop()) encryptionKeys = await invoke("list_encryption_keys");
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  const oldId = tab && tab.encryptionKeyId;
  if (tab && tab.filePath && oldId && oldId === tab.savedEncryptionKeyId && !encryptionKeys.some(key => key.id === oldId)) {
    try {
      const document = await readDesktopDocument(tab.filePath);
      if (state.tabs.includes(tab) && tab.encryptionKeyId === oldId && tab.savedEncryptionKeyId === oldId && document.keyId && encryptionKeys.some(key => key.id === document.keyId)) {
        tab.encryptionKeyId = tab.savedEncryptionKeyId = document.keyId;
        if (tab.key === state.activeKey) markDirty();
      }
    } catch (error) { /* A missing or inaccessible original remains locked. */ }
  }
  renderEncryptionSettings();
}

document.getElementById("document-encryption-key").addEventListener("change", (event) => {
  setDocumentEncryptionKey(event.currentTarget.value);
});

document.getElementById("quick-encryption-toggle").addEventListener("click", () => {
  const tab = state.tabs.find(item => item.key === state.activeKey);
  if (!tab || !isDesktop() || encryptionBusy) return;
  if (tab.encryptionKeyId) { setDocumentEncryptionKey(""); return; }
  const preferred = encryptionKeys.find(key => key.id === tab.preferredEncryptionKeyId) || encryptionKeys[0];
  if (!preferred) { openEncryptionSettings(); return; }
  setDocumentEncryptionKey(preferred.id);
});

document.getElementById("quick-encryption-key").addEventListener("change", event => {
  const tab = state.tabs.find(item => item.key === state.activeKey);
  if (!tab || !isDesktop() || encryptionBusy || !encryptionKeys.some(key => key.id === event.currentTarget.value)) return;
  if (tab.encryptionKeyId) setDocumentEncryptionKey(event.currentTarget.value);
  else { tab.preferredEncryptionKeyId = event.currentTarget.value; renderEncryptionSettings(); }
});

document.getElementById("apply-document-encryption").addEventListener("click", async () => {
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  if (!tab || encryptionBusy || !isDesktop()) return;
  if (tab.savedEncryptionKeyId && !tab.encryptionKeyId && !await askDialog({title: t("encryption"), message: t("encryptionRemoveWarning"), focusCancel: true})) return;
  encryptionBusy = true; renderEncryptionSettings();
  try { await saveTabBeforeClose(tab, false); }
  catch (error) { await notice(errorText(error)); }
  finally { encryptionBusy = false; renderEncryptionSettings(); }
});

document.getElementById("encryption-key-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isDesktop() || encryptionBusy) return;
  const name = document.getElementById("encryption-key-name");
  const secret = document.getElementById("encryption-key-secret");
  const confirm = document.getElementById("encryption-key-confirm");
  if (secret.value !== confirm.value) { await notice(t("encryptionMismatch")); return; }
  encryptionBusy = true; renderEncryptionSettings();
  try {
    await invoke("add_encryption_key", {name: name.value.trim(), secret: secret.value});
    name.value = "";
    await refreshEncryptionKeys();
  } catch (error) { await notice(errorText(error)); }
  finally { secret.value = ""; confirm.value = ""; encryptionBusy = false; renderEncryptionSettings(); }
});

applyI18n();
refreshEncryptionKeys().catch((error) => { document.getElementById("encryption-key-list").textContent = errorText(error); });
