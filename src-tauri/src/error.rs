use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Invalid API key")]
    InvalidApiKey,

    #[error("Rate limit exceeded (429). Please wait a moment and try again.")]
    RateLimited,

    /// The provider completed the request without producing any text. The
    /// payload is an optional reason, already phrased for display.
    #[error("No response received{0}")]
    EmptyResponse(String),

    #[error("File error: {0}")]
    File(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Configuration error: {0}")]
    Config(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            return AppError::Network("Request timed out".to_string());
        }
        if err.is_connect() {
            return AppError::Network("Could not connect to the provider".to_string());
        }
        AppError::Network(err.to_string())
    }
}

impl AppError {
    /// Map a provider HTTP status to a specific error variant so the UI can
    /// react (rate-limit vs auth vs generic). `context` is a human label like
    /// "OpenAI".
    pub fn for_status(status: u16, context: &str, body: &str) -> AppError {
        match status {
            401 | 403 => AppError::InvalidApiKey,
            429 => AppError::RateLimited,
            _ => AppError::Api(format!("{} error {}: {}", context, status, body)),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::File(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Config(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_mapping() {
        assert!(matches!(AppError::for_status(401, "OpenAI", ""), AppError::InvalidApiKey));
        assert!(matches!(AppError::for_status(429, "OpenAI", ""), AppError::RateLimited));
        assert_eq!(
            AppError::for_status(500, "OpenAI", "boom").to_string(),
            "API error: OpenAI error 500: boom"
        );
    }

    #[test]
    fn empty_response_message() {
        assert_eq!(AppError::EmptyResponse(String::new()).to_string(), "No response received");
        assert_eq!(
            AppError::EmptyResponse(": the prompt was blocked (SAFETY)".to_string()).to_string(),
            "No response received: the prompt was blocked (SAFETY)"
        );
    }
}
