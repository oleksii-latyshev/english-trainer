use super::*;
use crate::providers::{ContextTurn, LearningPromptTarget};
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::mpsc,
    thread,
};

const SECRET: &str = "test-secret-key-0123456789";

fn context() -> ConversationContext {
    ConversationContext {
        opening_question: "How was your day?".into(),
        recent_turns: vec![ContextTurn {
            learner: "Good.".into(),
            assistant_reply: "Nice.".into(),
            assistant_question: "What did you do?".into(),
        }],
        latest_transcript: "I wrote some code.".into(),
        learning_targets: vec![LearningPromptTarget {
            kind: "phrase".into(),
            cue: "work".into(),
            target: "I work on".into(),
        }],
        ..Default::default()
    }
}

fn sse(text: &str) -> String {
    format!(
        "data: {}\n\n",
        serde_json::json!({"candidates": [{"content": {"parts": [{"text": text}]}}]})
    )
}

/// Serves one canned HTTP response per connection and reports each request head.
fn fake_server(responses: Vec<(u16, String)>) -> (String, mpsc::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        for (status, body) in responses {
            let (mut stream, _) = listener.accept().unwrap();
            let mut head = Vec::new();
            let mut byte = [0u8; 1];
            while !head.ends_with(b"\r\n\r\n") {
                if stream.read(&mut byte).unwrap() == 0 {
                    break;
                }
                head.push(byte[0]);
            }
            let head = String::from_utf8_lossy(&head).into_owned();
            let length = head
                .lines()
                .find_map(|line| {
                    line.to_ascii_lowercase()
                        .strip_prefix("content-length:")
                        .map(str::to_owned)
                })
                .and_then(|value| value.trim().parse::<usize>().ok())
                .unwrap_or(0);
            let mut request_body = vec![0u8; length];
            stream.read_exact(&mut request_body).unwrap();
            let _ = sender.send(format!("{head}{}", String::from_utf8_lossy(&request_body)));
            let response = format!(
                "HTTP/1.1 {status} X\r\nContent-Type: text/event-stream\r\nConnection: close\r\nContent-Length: {}\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
        }
    });
    (base_url, receiver)
}

#[test]
fn request_uses_dialogue_contents_and_targets_as_instruction_data() {
    let body = wire::request_body(&context());
    let roles: Vec<&str> = body["contents"]
        .as_array()
        .unwrap()
        .iter()
        .map(|content| content["role"].as_str().unwrap())
        .collect();
    assert_eq!(roles, ["model", "user", "model", "user"]);
    assert_eq!(
        body["contents"][3]["parts"][0]["text"],
        "I wrote some code."
    );
    let instruction = body["systemInstruction"]["parts"][0]["text"]
        .as_str()
        .unwrap();
    assert!(instruction.contains("I work on"));
    assert_eq!(body["generationConfig"]["maxOutputTokens"], 150);
    assert_eq!(
        body["generationConfig"]["thinkingConfig"]["thinkingLevel"],
        "minimal"
    );
}

#[test]
fn sse_lines_yield_text_and_skip_thoughts_and_noise() {
    assert_eq!(
        wire::text_from_sse_line(sse("Hi").trim_end())
            .unwrap()
            .as_deref(),
        Some("Hi")
    );
    assert_eq!(wire::text_from_sse_line("").unwrap(), None);
    assert_eq!(wire::text_from_sse_line(": keep-alive").unwrap(), None);
    let thought = r#"data: {"candidates":[{"content":{"parts":[{"text":"hmm","thought":true},{"text":"Hello"}]}}]}"#;
    assert_eq!(
        wire::text_from_sse_line(thought).unwrap().as_deref(),
        Some("Hello")
    );
    let finish = r#"data: {"candidates":[{"finishReason":"STOP"}],"usageMetadata":{}}"#;
    assert_eq!(wire::text_from_sse_line(finish).unwrap(), None);
    assert_eq!(
        wire::text_from_sse_line("data: {oops").unwrap_err().code,
        ProviderErrorCode::InvalidOutput
    );
    let blocked = r#"data: {"promptFeedback":{"blockReason":"SAFETY"}}"#;
    assert_eq!(
        wire::text_from_sse_line(blocked).unwrap_err().code,
        ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn http_statuses_map_to_typed_errors_without_echoing_the_body() {
    let cases = [
        (401, "", ProviderErrorCode::Unauthorized),
        (403, "", ProviderErrorCode::Unauthorized),
        (400, "API_KEY_INVALID", ProviderErrorCode::Unauthorized),
        (400, "bad field", ProviderErrorCode::ProcessFailed),
        (429, "", ProviderErrorCode::RateLimited),
        (500, "", ProviderErrorCode::Unavailable),
        (503, "", ProviderErrorCode::Unavailable),
    ];
    for (status, body, code) in cases {
        let error = wire::error_for_status(status, body);
        assert_eq!(error.code, code, "status {status}");
        assert!(!error.message.contains("API_KEY_INVALID"));
    }
    assert!(wire::is_retryable(429) && wire::is_retryable(503) && !wire::is_retryable(401));
}

#[test]
fn streams_deltas_and_returns_the_shaped_turn() {
    let body = format!(
        "{}{}{}",
        sse("That sounds fun. "),
        sse("Where do you"),
        sse(" work?")
    );
    let (base_url, requests) = fake_server(vec![(200, body)]);
    let mut deltas = Vec::new();
    let turn = generate_from(&base_url, SECRET, &context(), None, &mut |text| {
        deltas.push(text.to_string())
    })
    .unwrap();
    assert_eq!(deltas, ["That sounds fun. ", "Where do you", " work?"]);
    assert_eq!(turn.spoken_reply, "That sounds fun.");
    assert_eq!(turn.question.as_deref(), Some("Where do you work?"));
    assert_eq!(turn.answered_by, Some(AnsweredBy::gemini()));
    let request = requests.recv().unwrap();
    let request_line = request.lines().next().unwrap();
    assert!(request_line.contains("gemini-3.5-flash-lite:streamGenerateContent?alt=sse"));
    assert!(!request_line.contains(SECRET));
    assert!(request
        .to_ascii_lowercase()
        .contains(&format!("x-goog-api-key: {SECRET}")));
}

fn backup(reply: &'static str, after_ms: u64) -> Option<Backup> {
    Some(Backup {
        leg: Box::new(move |emit| {
            emit(race::Event::Delta(reply.into()));
            emit(race::Event::Done);
        }),
        after: std::time::Duration::from_millis(after_ms),
        label: crate::providers::AnsweredBy::apple(true),
    })
}

#[test]
fn overload_hands_the_turn_to_the_backup_at_once() {
    let (base_url, _) = fake_server(vec![(503, "{}".into())]);
    let started = std::time::Instant::now();
    let turn = generate_from(
        &base_url,
        SECRET,
        &context(),
        backup("Nice. Why?", 10_000),
        &mut |_| {},
    )
    .unwrap();
    assert_eq!(turn.question.as_deref(), Some("Why?"));
    assert_eq!(turn.answered_by, Some(AnsweredBy::apple(true)));
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
}

#[test]
fn persistent_failures_surface_typed_errors() {
    let (base_url, _) = fake_server(vec![(429, "{}".into())]);
    let error = generate_from(&base_url, SECRET, &context(), None, &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);

    let (base_url, _) = fake_server(vec![(
        400,
        r#"{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}"#.into(),
    )]);
    let error = generate_from(&base_url, SECRET, &context(), None, &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Unauthorized);
    assert!(!error.message.contains(SECRET));
}

#[test]
fn empty_stream_is_invalid_output_and_dead_server_is_unavailable() {
    let (base_url, _) = fake_server(vec![(200, String::new())]);
    let error = generate_from(&base_url, SECRET, &context(), None, &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    let error = generate_from(&base_url, SECRET, &context(), None, &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Unavailable);
}

#[test]
#[ignore = "calls the live Gemini API with the stored or ENG_TRAINER_GEMINI_API_KEY key"]
fn live_gemini_streams_a_reply() {
    let mut first_delta_ms = None;
    let started = std::time::Instant::now();
    let mut context = context();
    context.learning_targets.clear();
    generate_turn(&context, None, &mut |_| {}).unwrap();
    println!(
        "first call (includes key lookup): {} ms",
        started.elapsed().as_millis()
    );
    let started = std::time::Instant::now();
    let turn = generate_turn(&context, None, &mut |_| {
        first_delta_ms.get_or_insert(started.elapsed().as_millis());
    })
    .unwrap();
    println!(
        "first token: {:?} ms, total: {} ms, reply: {} | {:?}",
        first_delta_ms,
        started.elapsed().as_millis(),
        turn.spoken_reply,
        turn.question
    );
    assert!(!turn.spoken_reply.is_empty());
}

/// Accepts one request, sends the response head, then stalls before the first text.
fn stalling_server(stall: std::time::Duration) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}", listener.local_addr().unwrap());
    thread::spawn(move || {
        let Ok((mut stream, _)) = listener.accept() else {
            return;
        };
        let mut head = Vec::new();
        let mut byte = [0u8; 1];
        while !head.ends_with(b"\r\n\r\n") {
            if stream.read(&mut byte).unwrap_or(0) == 0 {
                return;
            }
            head.push(byte[0]);
        }
        let head = String::from_utf8_lossy(&head).into_owned();
        let length = head
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length:")
                    .and_then(|value| value.trim().parse::<usize>().ok())
            })
            .unwrap_or(0);
        let mut request_body = vec![0u8; length];
        if stream.read_exact(&mut request_body).is_err() {
            return;
        }
        let _ = write!(
            stream,
            "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\nconnection: close\r\n\r\n"
        );
        let _ = stream.flush();
        thread::sleep(stall);
        let _ = stream.write_all(sse("Slow Gemini. Why?").as_bytes());
    });
    base_url
}

#[test]
fn a_stalled_gemini_stream_is_overtaken_by_the_backup() {
    let base_url = stalling_server(std::time::Duration::from_secs(3));
    let started = std::time::Instant::now();
    let mut deltas = Vec::new();
    let turn = generate_from(
        &base_url,
        SECRET,
        &context(),
        backup("Fast backup. How?", 200),
        &mut |text| deltas.push(text.to_string()),
    )
    .unwrap();
    assert_eq!(turn.question.as_deref(), Some("How?"));
    assert_eq!(deltas, ["Fast backup. How?"]);
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
}

#[test]
fn a_gemini_stream_that_starts_in_time_keeps_the_turn() {
    let base_url = stalling_server(std::time::Duration::ZERO);
    let turn = generate_from(
        &base_url,
        SECRET,
        &context(),
        backup("Fast backup. How?", 2_000),
        &mut |_| {},
    )
    .unwrap();
    assert_eq!(turn.question.as_deref(), Some("Why?"));
}
