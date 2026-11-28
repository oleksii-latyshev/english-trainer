//! One-shot Gemini call that answers with JSON in a given schema, on a model the caller picks.
//! It shares the conversation adapter's client, key, error mapping and usage recording.

use super::{resolve_key, wire::error_for_status, BASE_URL};
use crate::{
    api_usage::{self, UsageSource},
    providers::{ProviderError, ProviderErrorCode},
};
use serde_json::{json, Value};
use std::io::Read;

const MAX_RESPONSE_BYTES: u64 = 16_000;

pub struct StructuredRequest<'a> {
    pub model: &'a str,
    pub instruction: &'a str,
    pub input: &'a str,
    pub schema: Value,
    pub max_output_tokens: u16,
}

pub fn generate_structured(request: &StructuredRequest<'_>) -> Result<Value, ProviderError> {
    let api_key = resolve_key()?;
    let result = generate_from(BASE_URL, &api_key, request);
    if matches!(&result, Err(error) if error.code == ProviderErrorCode::Unauthorized) {
        crate::gemini_key::forget_cached_key();
    }
    result
}

fn generate_from(
    base_url: &str,
    api_key: &str,
    request: &StructuredRequest<'_>,
) -> Result<Value, ProviderError> {
    let client = super::client()?;
    api_usage::record_request(UsageSource::Gemini, request.model);
    let response = client
        .post(format!(
            "{base_url}/v1beta/models/{}:generateContent",
            request.model
        ))
        .header("x-goog-api-key", api_key)
        .json(&request_body(request))
        .send()
        .map_err(|error| super::network_error(error.is_timeout()))?;
    let status = response.status().as_u16();
    let body = read_bounded(response)?;
    if status != 200 {
        if status == 429 {
            api_usage::record_limit(
                UsageSource::Gemini,
                request.model,
                api_usage::gemini_error_message(&String::from_utf8_lossy(&body)),
                None,
            );
        }
        return Err(error_for_status(status, &String::from_utf8_lossy(&body)));
    }
    parse_response(&body)
}

fn request_body(request: &StructuredRequest<'_>) -> Value {
    json!({
        "systemInstruction": { "parts": [{ "text": request.instruction }] },
        "contents": [{ "role": "user", "parts": [{ "text": request.input }] }],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseJsonSchema": request.schema,
            "maxOutputTokens": request.max_output_tokens,
            "temperature": 0.2,
            "thinkingConfig": { "thinkingLevel": "minimal" }
        }
    })
}

fn read_bounded(response: reqwest::blocking::Response) -> Result<Vec<u8>, ProviderError> {
    let mut bytes = Vec::new();
    response
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| super::network_error(false))?;
    if bytes.len() > MAX_RESPONSE_BYTES as usize {
        return Err(invalid_response());
    }
    Ok(bytes)
}

fn parse_response(body: &[u8]) -> Result<Value, ProviderError> {
    let envelope: Value = serde_json::from_slice(body).map_err(|_| invalid_response())?;
    let text: String = envelope["candidates"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|candidate| candidate["content"]["parts"].as_array())
        .flatten()
        .filter(|part| part["thought"].as_bool() != Some(true))
        .filter_map(|part| part["text"].as_str())
        .collect();
    serde_json::from_str(&text).map_err(|_| invalid_response())
}

fn invalid_response() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "Gemini returned an answer the app could not read. Please retry.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::Write, net::TcpListener, thread};

    fn serve(status: &str, body: &'static str) -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let status = status.to_string();
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0u8; 8192];
            let read = stream.read(&mut buffer).unwrap();
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
            String::from_utf8_lossy(&buffer[..read]).to_string()
        });
        (format!("http://{address}"), handle)
    }

    fn request() -> StructuredRequest<'static> {
        StructuredRequest {
            model: "test-model",
            instruction: "Translate.",
            input: "grant",
            schema: json!({ "type": "object" }),
            max_output_tokens: 100,
        }
    }

    #[test]
    fn a_success_returns_the_json_the_model_wrote_and_skips_thoughts() {
        let (url, server) = serve(
            "200 OK",
            r#"{"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"{\"translation\":\"грант\"}"}]}}]}"#,
        );
        let value = generate_from(&url, "key", &request()).unwrap();
        assert_eq!(value["translation"], "грант");
        let sent = server.join().unwrap();
        assert!(sent.contains("/v1beta/models/test-model:generateContent"));
        assert!(sent.to_ascii_lowercase().contains("x-goog-api-key: key"));
    }

    #[test]
    fn a_429_is_a_rate_limit_error() {
        let (url, server) = serve(
            "429 Too Many Requests",
            r#"{"error":{"status":"RESOURCE_EXHAUSTED"}}"#,
        );
        let error = generate_from(&url, "key", &request()).unwrap_err();
        assert_eq!(error.code, ProviderErrorCode::RateLimited);
        server.join().unwrap();
    }

    #[test]
    fn text_that_is_not_json_is_invalid_output() {
        let (url, server) = serve(
            "200 OK",
            r#"{"candidates":[{"content":{"parts":[{"text":"sorry"}]}}]}"#,
        );
        let error = generate_from(&url, "key", &request()).unwrap_err();
        assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
        server.join().unwrap();
    }
}
