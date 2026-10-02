//! Line framing and per-provider payload parsing for streamed chat responses.

use serde_json::Value;

/// Accumulates raw bytes and yields complete lines.
///
/// Splitting on the newline byte *before* decoding keeps multi-byte UTF-8
/// sequences intact when a network chunk ends in the middle of a character,
/// and draining consumed bytes guarantees a line is never yielded twice.
#[derive(Default)]
pub struct LineBuffer {
    buf: Vec<u8>,
}

impl LineBuffer {
    pub fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.buf.extend_from_slice(chunk);
        let mut lines = Vec::new();
        while let Some(pos) = self.buf.iter().position(|b| *b == b'\n') {
            let raw: Vec<u8> = self.buf.drain(..=pos).collect();
            if let Some(line) = decode_line(&raw[..raw.len() - 1]) {
                lines.push(line);
            }
        }
        lines
    }

    /// The trailing line of a stream that did not end with a newline.
    pub fn finish(&mut self) -> Option<String> {
        let raw = std::mem::take(&mut self.buf);
        decode_line(&raw)
    }
}

fn decode_line(raw: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(raw);
    let text = text.trim_end_matches('\r').trim();
    if text.is_empty() {
        None
    } else {
        Some(text.to_string())
    }
}

/// What one framed line means for the conversation.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// Text to append to the assistant message.
    Text(String),
    /// Why the provider produced no (more) text, e.g. a safety block.
    Note(String),
    /// The provider reported an error inside the stream.
    Error(String),
    Skip,
}

pub type LineParser = fn(&str) -> Parsed;

fn sse_data(line: &str) -> Option<&str> {
    line.strip_prefix("data:").map(str::trim_start)
}

fn error_message(json: &Value) -> Option<String> {
    let error = json.get("error")?;
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| error.as_str())
        .unwrap_or("Unknown provider error");
    Some(message.to_string())
}

fn text_or_skip(text: &str) -> Parsed {
    if text.is_empty() {
        Parsed::Skip
    } else {
        Parsed::Text(text.to_string())
    }
}

/// Gemini `streamGenerateContent?alt=sse`.
pub fn parse_gemini(line: &str) -> Parsed {
    let Some(data) = sse_data(line) else { return Parsed::Skip };
    let Ok(json) = serde_json::from_str::<Value>(data) else { return Parsed::Skip };
    if let Some(message) = error_message(&json) {
        return Parsed::Error(message);
    }

    let candidate = &json["candidates"][0];
    let text: String = candidate["content"]["parts"]
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter(|part| part["thought"].as_bool() != Some(true))
                .filter_map(|part| part["text"].as_str())
                .collect::<String>()
        })
        .unwrap_or_default();
    if !text.is_empty() {
        return Parsed::Text(text);
    }

    if let Some(reason) = json["promptFeedback"]["blockReason"].as_str() {
        return Parsed::Note(format!("the prompt was blocked ({reason})"));
    }
    match candidate["finishReason"].as_str() {
        Some(reason) if reason != "STOP" => {
            Parsed::Note(format!("the model stopped early ({reason})"))
        }
        _ => Parsed::Skip,
    }
}

/// OpenAI-compatible chat completions (OpenAI, GLM).
pub fn parse_openai(line: &str) -> Parsed {
    let Some(data) = sse_data(line) else { return Parsed::Skip };
    if data == "[DONE]" {
        return Parsed::Skip;
    }
    let Ok(json) = serde_json::from_str::<Value>(data) else { return Parsed::Skip };
    if let Some(message) = error_message(&json) {
        return Parsed::Error(message);
    }
    let choice = &json["choices"][0];
    if let Some(text) = choice["delta"]["content"].as_str() {
        if !text.is_empty() {
            return Parsed::Text(text.to_string());
        }
    }
    match choice["finish_reason"].as_str() {
        Some("content_filter") => Parsed::Note("the response was filtered".to_string()),
        _ => Parsed::Skip,
    }
}

/// Anthropic Messages API event stream.
pub fn parse_anthropic(line: &str) -> Parsed {
    let Some(data) = sse_data(line) else { return Parsed::Skip };
    let Ok(json) = serde_json::from_str::<Value>(data) else { return Parsed::Skip };
    match json["type"].as_str() {
        Some("content_block_delta") => json["delta"]["text"]
            .as_str()
            .map(text_or_skip)
            .unwrap_or(Parsed::Skip),
        Some("error") => {
            Parsed::Error(error_message(&json).unwrap_or_else(|| "Unknown provider error".to_string()))
        }
        Some("message_delta") => match json["delta"]["stop_reason"].as_str() {
            Some("refusal") => Parsed::Note("the model declined to answer".to_string()),
            _ => Parsed::Skip,
        },
        _ => Parsed::Skip,
    }
}

/// Ollama `/api/chat` newline-delimited JSON.
pub fn parse_ollama(line: &str) -> Parsed {
    let Ok(json) = serde_json::from_str::<Value>(line) else { return Parsed::Skip };
    if let Some(message) = error_message(&json) {
        return Parsed::Error(message);
    }
    json["message"]["content"]
        .as_str()
        .map(text_or_skip)
        .unwrap_or(Parsed::Skip)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yields_each_line_once_across_chunk_boundaries() {
        let mut buf = LineBuffer::default();
        // A complete JSON payload whose terminating newline arrives later
        // must not be emitted until the newline is seen, and only once.
        assert!(buf.push(b"data: {\"a\":1}").is_empty());
        assert_eq!(buf.push(b"\n\ndata: {\"a\":2}\n"), vec!["data: {\"a\":1}", "data: {\"a\":2}"]);
        assert_eq!(buf.finish(), None);
    }

    #[test]
    fn keeps_multibyte_characters_split_across_chunks() {
        let text = "data: 日本語\n".as_bytes();
        let mut buf = LineBuffer::default();
        // Split in the middle of the first three-byte character.
        assert!(buf.push(&text[..7]).is_empty());
        assert_eq!(buf.push(&text[7..]), vec!["data: 日本語"]);
    }

    #[test]
    fn finish_returns_unterminated_tail() {
        let mut buf = LineBuffer::default();
        assert!(buf.push(b"{\"done\":true}").is_empty());
        assert_eq!(buf.finish(), Some("{\"done\":true}".to_string()));
    }

    #[test]
    fn handles_crlf() {
        let mut buf = LineBuffer::default();
        assert_eq!(buf.push(b"data: x\r\n\r\n"), vec!["data: x"]);
    }

    #[test]
    fn gemini_text_block_and_notes() {
        let ok = r#"data: {"candidates":[{"content":{"parts":[{"text":"Hel"},{"text":"lo"}]}}]}"#;
        assert_eq!(parse_gemini(ok), Parsed::Text("Hello".to_string()));

        let thought = r#"data: {"candidates":[{"content":{"parts":[{"text":"hmm","thought":true}]}}]}"#;
        assert_eq!(parse_gemini(thought), Parsed::Skip);

        let blocked = r#"data: {"promptFeedback":{"blockReason":"SAFETY"}}"#;
        assert_eq!(parse_gemini(blocked), Parsed::Note("the prompt was blocked (SAFETY)".to_string()));

        let truncated = r#"data: {"candidates":[{"finishReason":"MAX_TOKENS"}]}"#;
        assert_eq!(
            parse_gemini(truncated),
            Parsed::Note("the model stopped early (MAX_TOKENS)".to_string())
        );
    }

    #[test]
    fn openai_delta_done_and_error() {
        let delta = r#"data: {"choices":[{"delta":{"content":"Hi"}}]}"#;
        assert_eq!(parse_openai(delta), Parsed::Text("Hi".to_string()));
        assert_eq!(parse_openai("data: [DONE]"), Parsed::Skip);
        let error = r#"data: {"error":{"message":"overloaded"}}"#;
        assert_eq!(parse_openai(error), Parsed::Error("overloaded".to_string()));
    }

    #[test]
    fn anthropic_events() {
        assert_eq!(parse_anthropic("event: content_block_delta"), Parsed::Skip);
        let delta = r#"data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}"#;
        assert_eq!(parse_anthropic(delta), Parsed::Text("Hi".to_string()));
        let error = r#"data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#;
        assert_eq!(parse_anthropic(error), Parsed::Error("Overloaded".to_string()));
    }

    #[test]
    fn ollama_ndjson() {
        let line = r#"{"message":{"role":"assistant","content":"Hi"},"done":false}"#;
        assert_eq!(parse_ollama(line), Parsed::Text("Hi".to_string()));
        let done = r#"{"message":{"role":"assistant","content":""},"done":true}"#;
        assert_eq!(parse_ollama(done), Parsed::Skip);
        let error = r#"{"error":"model not found"}"#;
        assert_eq!(parse_ollama(error), Parsed::Error("model not found".to_string()));
    }
}
