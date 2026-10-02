//! API keys in the operating system's credential store (Windows Credential
//! Manager, macOS Keychain, Secret Service on Linux).

use std::collections::HashMap;

use keyring::Entry;

use crate::error::{AppError, Result};

const SERVICE: &str = "com.omnirecall.desktop";

fn entry(provider: &str) -> Result<Entry> {
    Entry::new(SERVICE, &format!("api-key:{provider}"))
        .map_err(|e| AppError::Config(format!("Credential store unavailable: {e}")))
}

fn store_error(err: keyring::Error) -> AppError {
    AppError::Config(format!("Credential store error: {err}"))
}

fn write_secret(entry: &Entry, value: &str) -> Result<()> {
    if value.is_empty() {
        return match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(store_error(err)),
        };
    }
    entry.set_password(value).map_err(store_error)
}

fn read_secret(entry: &Entry) -> Result<Option<String>> {
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(store_error(err)),
    }
}

/// Store (or, with an empty value, delete) a provider's API key.
#[tauri::command]
pub async fn set_api_key_secret(provider: String, value: String) -> Result<()> {
    write_secret(&entry(&provider)?, &value)
}

/// Load the stored API keys for the given providers. Providers without a
/// stored key are omitted.
#[tauri::command]
pub async fn get_api_key_secrets(providers: Vec<String>) -> Result<HashMap<String, String>> {
    let mut secrets = HashMap::new();
    for provider in providers {
        if let Some(value) = read_secret(&entry(&provider)?)? {
            secrets.insert(provider, value);
        }
    }
    Ok(secrets)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_with_mock_store() {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        // The mock backend keeps its credential per Entry instance, so the
        // whole sequence runs against a single entry.
        let entry = entry("test-provider").unwrap();
        assert_eq!(read_secret(&entry).unwrap(), None);
        write_secret(&entry, "secret").unwrap();
        assert_eq!(read_secret(&entry).unwrap().as_deref(), Some("secret"));
        write_secret(&entry, "").unwrap();
        assert_eq!(read_secret(&entry).unwrap(), None);
        // Deleting an absent key is not an error.
        write_secret(&entry, "").unwrap();
    }
}
