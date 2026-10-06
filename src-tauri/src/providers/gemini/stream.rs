//! One Gemini streaming request, run as a leg of the reply race.

use super::{client, network_error, wire};
use crate::providers::race::{Event, Leg};
use std::io::{BufRead, BufReader};

pub(super) struct Request {
    pub base_url: String,
    pub api_key: String,
    pub model: &'static str,
    pub body: serde_json::Value,
}

pub(super) fn leg(request: Request) -> Leg {
    Box::new(move |emit| {
        if let Err(failure) = stream(&request, emit) {
            emit(failure);
        }
    })
}

fn stream(request: &Request, emit: &dyn Fn(Event) -> bool) -> Result<(), Event> {
    let failed = |error| Event::Failed {
        error,
        is_retryable: false,
    };
    let response = client()
        .map_err(failed)?
        .post(format!(
            "{}/v1beta/models/{}:streamGenerateContent?alt=sse",
            request.base_url, request.model
        ))
        .header("x-goog-api-key", &request.api_key)
        .json(&request.body)
        .send()
        .map_err(|error| Event::Failed {
            error: network_error(error.is_timeout()),
            is_retryable: true,
        })?;
    let status = response.status().as_u16();
    if status != 200 {
        let text = response.text().unwrap_or_default();
        return Err(Event::Failed {
            error: wire::error_for_status(status, &text),
            is_retryable: wire::is_retryable(status),
        });
    }
    let mut reader = BufReader::new(response);
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader.read_line(&mut line).map_err(|error| Event::Failed {
            error: network_error(error.kind() == std::io::ErrorKind::TimedOut),
            is_retryable: true,
        })?;
        if read == 0 {
            emit(Event::Done);
            return Ok(());
        }
        if let Some(text) = wire::text_from_sse_line(&line).map_err(failed)? {
            if !emit(Event::Delta(text)) {
                return Ok(());
            }
        }
    }
}
