//! Versioned authenticated document encryption and a Windows-account protected key vault.
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng, Payload, rand_core::RngCore},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{io::Write, path::{Path, PathBuf}, sync::{Mutex, OnceLock}};
use zeroize::{Zeroize, Zeroizing};

const MAGIC: &[u8] = b"SPRINGM-ENC-V1\n";
const VAULT_MAGIC: &[u8] = b"SPRINGM-KEYS-V1\n";
static VAULT_PATH: OnceLock<PathBuf> = OnceLock::new();
static VAULT_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize)]
struct StoredKey { id: String, name: String, secret: String }
impl Drop for StoredKey { fn drop(&mut self) { self.secret.zeroize(); } }

#[derive(Serialize, Deserialize)]
struct Vault { version: u8, keys: Vec<StoredKey> }
impl Default for Vault { fn default() -> Self { Self { version: 1, keys: vec![] } } }

#[derive(Serialize)]
pub struct KeySummary { pub id: String, pub name: String }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Envelope {
    version: u8,
    algorithm: String,
    key_id: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}

pub fn initialize(directory: PathBuf) -> Result<(), String> {
    VAULT_PATH.set(directory.join("encryption-keys.dpapi"))
        .map_err(|_| "SM_VAULT_UNAVAILABLE".to_string())
}

fn vault_path() -> Result<&'static Path, String> {
    VAULT_PATH.get().map(PathBuf::as_path).ok_or_else(|| "SM_VAULT_UNAVAILABLE".into())
}

// DPAPI binds remembered keys to the current Windows account. Never fall back to
// a plaintext file when protection fails or when running on another platform.
#[cfg(windows)]
fn protect(bytes: &[u8], encrypt: bool) -> Result<Zeroizing<Vec<u8>>, String> {
    use windows_sys::Win32::{Foundation::LocalFree, Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
    }};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len().try_into().map_err(|_| "SM_VAULT_UNAVAILABLE")?, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe {
        if encrypt {
            CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        } else {
            CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        }
    };
    if ok == 0 { return Err("SM_VAULT_UNAVAILABLE".into()); }
    let result = unsafe {
        let result = Zeroizing::new(std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec());
        std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        LocalFree(output.pbData.cast());
        result
    };
    Ok(result)
}

#[cfg(not(windows))]
fn protect(_: &[u8], _: bool) -> Result<Zeroizing<Vec<u8>>, String> { Err("SM_VAULT_UNAVAILABLE".into()) }

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::Builder::new().prefix(".tolcy-save-").tempfile_in(parent).map_err(|e| e.to_string())?;
    temporary.write_all(bytes).and_then(|_| temporary.as_file().sync_all()).map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.error.to_string())?;
    Ok(())
}

fn load_vault(path: &Path) -> Result<Vault, String> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vault::default()),
        Err(_) => return Err("SM_VAULT_UNAVAILABLE".into()),
    };
    let protected = bytes.strip_prefix(VAULT_MAGIC).filter(|b| b.len() <= 1_000_000).ok_or("SM_VAULT_UNAVAILABLE")?;
    let plaintext = protect(protected, false)?;
    let vault: Vault = serde_json::from_slice(&plaintext).map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    if vault.version != 1 || vault.keys.len() > 32 { return Err("SM_VAULT_UNAVAILABLE".into()); }
    Ok(vault)
}

fn save_vault(path: &Path, vault: &Vault) -> Result<(), String> {
    let plaintext = Zeroizing::new(serde_json::to_vec(vault).map_err(|_| "SM_VAULT_UNAVAILABLE")?);
    let protected = protect(&plaintext, true)?;
    let mut bytes = VAULT_MAGIC.to_vec(); bytes.extend_from_slice(&protected);
    atomic_write(path, &bytes)
}

pub fn list_keys() -> Result<Vec<KeySummary>, String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    Ok(load_vault(vault_path()?)?.keys.iter().map(|key| KeySummary { id: key.id.clone(), name: key.name.clone() }).collect())
}

pub fn add_key(name: String, secret: String) -> Result<KeySummary, String> {
    let secret = Zeroizing::new(secret);
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 64 { return Err("SM_INVALID_KEY_NAME".into()); }
    if secret.chars().count() < 12 || secret.len() > 1024 { return Err("SM_KEY_TOO_SHORT".into()); }
    let _guard = VAULT_LOCK.lock().map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    let path = vault_path()?;
    let mut vault = load_vault(path)?;
    if vault.keys.len() >= 32 { return Err("SM_TOO_MANY_KEYS".into()); }
    if vault.keys.iter().any(|key| key.name == name) { return Err("SM_DUPLICATE_KEY_NAME".into()); }
    let mut random = [0u8; 16]; OsRng.fill_bytes(&mut random);
    let id = random.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    vault.keys.push(StoredKey { id: id.clone(), name: name.into(), secret: secret.to_string() });
    save_vault(path, &vault)?;
    Ok(KeySummary { id, name: name.into() })
}

pub fn remove_key(id: &str) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    let path = vault_path()?; let mut vault = load_vault(path)?;
    vault.keys.retain(|key| key.id != id);
    save_vault(path, &vault)
}

fn cipher(secret: &str, salt: &[u8]) -> Result<Aes256Gcm, String> {
    // Fixed v1 cost prevents an untrusted file from requesting unbounded KDF work.
    let parameters = Params::new(19 * 1024, 2, 1, Some(32)).map_err(|_| "SM_ENCRYPT_FAILED")?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, parameters);
    let mut key = Zeroizing::new([0u8; 32]);
    argon.hash_password_into(secret.as_bytes(), salt, key.as_mut()).map_err(|_| "SM_ENCRYPT_FAILED")?;
    Aes256Gcm::new_from_slice(key.as_ref()).map_err(|_| "SM_ENCRYPT_FAILED".into())
}

fn associated_data(key_id: &str) -> Vec<u8> {
    let mut aad = MAGIC.to_vec(); aad.extend_from_slice(key_id.as_bytes()); aad
}

fn encrypt_document(text: &str, key: &StoredKey) -> Result<Vec<u8>, String> {
    let mut salt = [0u8; 16]; OsRng.fill_bytes(&mut salt);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher(&key.secret, &salt)?.encrypt(&nonce, Payload { msg: text.as_bytes(), aad: &associated_data(&key.id) }).map_err(|_| "SM_ENCRYPT_FAILED")?;
    let envelope = Envelope { version: 1, algorithm: "AES-256-GCM+Argon2id".into(), key_id: key.id.clone(), salt: STANDARD.encode(salt), nonce: STANDARD.encode(nonce), ciphertext: STANDARD.encode(ciphertext) };
    let mut bytes = MAGIC.to_vec(); bytes.extend(serde_json::to_vec(&envelope).map_err(|_| "SM_ENCRYPT_FAILED")?); bytes.push(b'\n');
    Ok(bytes)
}

fn parse_envelope(bytes: &[u8]) -> Result<Option<Envelope>, String> {
    if !bytes.starts_with(b"SPRINGM-ENC-") { return Ok(None); }
    let json = bytes.strip_prefix(MAGIC).ok_or("SM_INVALID_ENCRYPTED_FILE")?;
    let envelope: Envelope = serde_json::from_slice(json).map_err(|_| "SM_INVALID_ENCRYPTED_FILE")?;
    if envelope.version != 1 || envelope.algorithm != "AES-256-GCM+Argon2id" || envelope.key_id.len() != 32 {
        return Err("SM_INVALID_ENCRYPTED_FILE".into());
    }
    Ok(Some(envelope))
}

fn decrypt_document(envelope: &Envelope, vault: &Vault) -> Result<(String, String), String> {
    let salt = STANDARD.decode(&envelope.salt).map_err(|_| "SM_INVALID_ENCRYPTED_FILE")?;
    let nonce = STANDARD.decode(&envelope.nonce).map_err(|_| "SM_INVALID_ENCRYPTED_FILE")?;
    let ciphertext = STANDARD.decode(&envelope.ciphertext).map_err(|_| "SM_INVALID_ENCRYPTED_FILE")?;
    if salt.len() != 16 || nonce.len() != 12 || ciphertext.len() < 16 { return Err("SM_INVALID_ENCRYPTED_FILE".into()); }
    if vault.keys.is_empty() { return Err("SM_KEY_MISSING".into()); }
    // A user may re-add the same secret on a new computer under a different name/id.
    let preferred = vault.keys.iter().find(|key| key.id == envelope.key_id);
    for key in preferred.into_iter().chain(vault.keys.iter().filter(|key| key.id != envelope.key_id)) {
        let result = cipher(&key.secret, &salt)?.decrypt(Nonce::from_slice(&nonce), Payload { msg: &ciphertext, aad: &associated_data(&envelope.key_id) });
        if let Ok(plaintext) = result {
            let plaintext = Zeroizing::new(plaintext);
            let text = std::str::from_utf8(&plaintext).map_err(|_| "SM_INVALID_ENCRYPTED_FILE")?.to_string();
            return Ok((text, key.id.clone()));
        }
    }
    Err("SM_DECRYPT_FAILED".into())
}

pub fn decrypt_if_needed(bytes: &[u8]) -> Result<Option<(String, String)>, String> {
    let Some(envelope) = parse_envelope(bytes)? else { return Ok(None); };
    let _guard = VAULT_LOCK.lock().map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    decrypt_document(&envelope, &load_vault(vault_path()?)?).map(Some)
}

pub fn write_document(path: &Path, text: &str, key_id: Option<&str>) -> Result<(), String> {
    let chosen = if let Some(id) = key_id { id.to_string() } else {
        // Legacy callers (including workspace replace) preserve existing encryption.
        match std::fs::read(path) {
            Ok(bytes) => decrypt_if_needed(&bytes)?.map(|(_, id)| id).unwrap_or_default(),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(e) => return Err(e.to_string()),
        }
    };
    if chosen.is_empty() { return atomic_write(path, text.as_bytes()); }
    let _guard = VAULT_LOCK.lock().map_err(|_| "SM_VAULT_UNAVAILABLE")?;
    let vault = load_vault(vault_path()?)?;
    let key = vault.keys.iter().find(|key| key.id == chosen).ok_or("SM_KEY_MISSING")?;
    let ciphertext = encrypt_document(text, key)?;
    atomic_write(path, &ciphertext)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn key(id: char, secret: &str) -> StoredKey { StoredKey { id: id.to_string().repeat(32), name: "test".into(), secret: secret.into() } }
    #[test]
    fn authenticated_round_trip_uses_random_salt_and_nonce() {
        let key = key('a', "a long test key 123");
        let text = "# 私密笔记\n\n秘密内容 🔐\n";
        let first = encrypt_document(text, &key).unwrap();
        let second = encrypt_document(text, &key).unwrap();
        assert_ne!(first, second);
        assert!(!String::from_utf8_lossy(&first).contains("秘密内容"));
        let envelope = parse_envelope(&first).unwrap().unwrap();
        assert_eq!(decrypt_document(&envelope, &Vault {version:1, keys:vec![key]}).unwrap().0, text);
    }
    #[test]
    fn multiple_keys_and_reimported_secret_select_the_matching_key() {
        let encrypted = encrypt_document("private", &key('a', "correct secret 123")).unwrap();
        let vault = Vault {version:1, keys:vec![key('b', "wrong secret 456"),key('c', "correct secret 123")]};
        let (text,id) = decrypt_document(&parse_envelope(&encrypted).unwrap().unwrap(), &vault).unwrap();
        assert_eq!(text,"private");assert_eq!(id,"c".repeat(32));
    }
    #[test]
    fn wrong_key_tampering_and_invalid_lengths_never_return_garbage() {
        let encrypted = encrypt_document("private", &key('a', "correct secret 123")).unwrap();
        let mut envelope = parse_envelope(&encrypted).unwrap().unwrap();
        let vault = Vault {version:1, keys:vec![key('a', "wrong secret 456")]};
        assert!(decrypt_document(&envelope,&vault).is_err());
        let vault = Vault {version:1, keys:vec![key('a', "correct secret 123")]};
        let mut ciphertext=STANDARD.decode(&envelope.ciphertext).unwrap();ciphertext[0]^=1;envelope.ciphertext=STANDARD.encode(ciphertext);
        assert!(decrypt_document(&envelope,&vault).is_err());
        envelope.nonce=STANDARD.encode([0u8;2]);assert!(decrypt_document(&envelope,&vault).is_err());
        assert!(parse_envelope(b"SPRINGM-ENC-V2\n{}").is_err());
        assert!(parse_envelope(b"SPRINGM-ENC-V1\nnot-json").is_err());
        assert!(parse_envelope(b"# normal Markdown").unwrap().is_none());
    }
    #[cfg(windows)]
    #[test]
    fn remembered_keys_are_protected_and_survive_vault_reload() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("keys.dpapi");
        let vault=Vault {version:1, keys:vec![key('a',"a persistent secret 123")]};
        save_vault(&path,&vault).unwrap();
        let bytes=std::fs::read(&path).unwrap();assert!(!String::from_utf8_lossy(&bytes).contains("persistent secret"));
        let recovered=load_vault(&path).unwrap();assert_eq!(recovered.keys[0].secret,"a persistent secret 123");
        let encrypted=encrypt_document("after restart",&vault.keys[0]).unwrap();
        assert_eq!(decrypt_document(&parse_envelope(&encrypted).unwrap().unwrap(),&recovered).unwrap().0,"after restart");
        std::fs::write(&path,b"broken vault").unwrap();assert!(load_vault(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(),b"broken vault");
    }
    #[test]
    fn failed_encryption_does_not_replace_the_original_file() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("note.md");
        std::fs::write(&path,"original").unwrap();
        assert!(write_document(&path,"new",Some("missing-key")).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(),"original");
    }
    #[cfg(windows)]
    #[test]
    fn file_encryption_preserves_keys_across_saves_moves_and_vault_reloads() {
        let dir=tempfile::tempdir().unwrap();
        initialize(dir.path().join("settings")).unwrap();
        let first=add_key("personal".into(),"personal secret 12345".into()).unwrap();
        let second=add_key("work".into(),"work secret 12345678".into()).unwrap();
        assert_eq!(list_keys().unwrap().len(),2);
        let path=dir.path().join("private.md");
        write_document(&path,"# 私密内容",Some(&first.id)).unwrap();
        let bytes=std::fs::read(&path).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("私密内容"));
        assert_eq!(decrypt_if_needed(&bytes).unwrap().unwrap().0,"# 私密内容");
        // A caller that does not change encryption (workspace replace) retains it.
        write_document(&path,"updated",None).unwrap();
        assert_eq!(decrypt_if_needed(&std::fs::read(&path).unwrap()).unwrap().unwrap(),("updated".into(),first.id.clone()));
        let moved=dir.path().join("renamed.md");std::fs::rename(&path,&moved).unwrap();
        assert_eq!(decrypt_if_needed(&std::fs::read(&moved).unwrap()).unwrap().unwrap().0,"updated");
        write_document(&moved,"rotated",Some(&second.id)).unwrap();
        assert_eq!(decrypt_if_needed(&std::fs::read(&moved).unwrap()).unwrap().unwrap().1,second.id);
        remove_key(&second.id).unwrap();
        assert!(decrypt_if_needed(&std::fs::read(&moved).unwrap()).is_err());
        let restored=add_key("work restored".into(),"work secret 12345678".into()).unwrap();
        assert_eq!(decrypt_if_needed(&std::fs::read(&moved).unwrap()).unwrap().unwrap(),("rotated".into(),restored.id));
        write_document(&moved,"public again",Some("")).unwrap();
        assert_eq!(std::fs::read_to_string(&moved).unwrap(),"public again");
        assert!(decrypt_if_needed(&std::fs::read(&moved).unwrap()).unwrap().is_none());
    }
}
