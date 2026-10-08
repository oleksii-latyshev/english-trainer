//! Reading rate-limit and quota messages. Neither provider has a usage API, so the only
//! information about a limit is the text of the error it sent.

const MAX_EXCERPT_CHARS: usize = 200;

const QUOTA_MARKERS: [&str; 3] = ["resource_exhausted", "429", "quota"];

/// How long until the quota comes back, from text such as `Resets in 4h44m53s`; `None` when the
/// text names no time.
pub fn resets_in_secs(text: &str) -> Option<u64> {
    let lowered = text.to_ascii_lowercase();
    let at = lowered.find("resets in")? + "resets in".len();
    let mut total: u64 = 0;
    let mut found = false;
    let mut characters = lowered[at..].chars().peekable();
    loop {
        while characters
            .peek()
            .is_some_and(|c| c.is_whitespace() || *c == ',')
        {
            characters.next();
        }
        let mut digits = String::new();
        while let Some(digit) = characters.peek().filter(|c| c.is_ascii_digit()) {
            digits.push(*digit);
            characters.next();
        }
        let Ok(amount) = digits.parse::<u64>() else {
            break;
        };
        let unit: u64 = match characters.next() {
            Some('d') => 86_400,
            Some('h') => 3_600,
            Some('m') => 60,
            Some('s') => 1,
            _ => break,
        };
        total = total.saturating_add(amount.saturating_mul(unit));
        found = true;
    }
    found.then_some(total)
}

/// The first line that mentions a quota, bounded, so the app keeps the reason and not a whole
/// error dump.
pub fn quota_excerpt(text: &str) -> Option<String> {
    let line = text.lines().map(str::trim).find(|line| {
        let lowered = line.to_ascii_lowercase();
        QUOTA_MARKERS.iter().any(|marker| lowered.contains(marker))
    })?;
    Some(bounded(line))
}

/// The `error.message` of a Gemini error body, bounded; a generic line when the body has none.
/// Only that one field is kept: the rest of a body can echo request details.
pub fn gemini_error_message(body: &str) -> String {
    let message = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .and_then(|message| message.as_str().map(str::to_string))
        })
        .filter(|message| !message.trim().is_empty());
    message.map_or_else(
        || "The Gemini API answered 429 (rate limit reached).".to_string(),
        |message| bounded(&message),
    )
}

fn bounded(text: &str) -> String {
    let single_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if single_line.chars().count() <= MAX_EXCERPT_CHARS {
        return single_line;
    }
    let cut: String = single_line.chars().take(MAX_EXCERPT_CHARS).collect();
    format!("{}…", cut.trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_reset_time_agy_prints() {
        assert_eq!(
            resets_in_secs("Resets in 4h44m53s"),
            Some(4 * 3_600 + 44 * 60 + 53)
        );
        assert_eq!(
            resets_in_secs("Error 429: RESOURCE_EXHAUSTED. Resets in 4h44m53s."),
            Some(17_093)
        );
        assert_eq!(resets_in_secs("quota used up, resets in 53s"), Some(53));
        assert_eq!(resets_in_secs("Resets in 12m"), Some(720));
        assert_eq!(resets_in_secs("Resets in 1d2h"), Some(93_600));
        assert_eq!(resets_in_secs("Resets in 4h 44m 53s"), Some(17_093));
    }

    #[test]
    fn text_without_a_reset_time_gives_none() {
        assert_eq!(resets_in_secs("429 RESOURCE_EXHAUSTED"), None);
        assert_eq!(resets_in_secs("Resets in a while"), None);
        assert_eq!(resets_in_secs("Resets in 5 parsecs"), None);
        assert_eq!(resets_in_secs(""), None);
    }

    #[test]
    fn keeps_only_the_quota_line_and_bounds_it() {
        let stderr = "starting\nError: 429 RESOURCE_EXHAUSTED  quota used\n  Resets in 1h\nbye";
        assert_eq!(
            quota_excerpt(stderr).as_deref(),
            Some("Error: 429 RESOURCE_EXHAUSTED quota used")
        );
        assert_eq!(quota_excerpt("all fine"), None);
        let long = format!("quota {}", "x".repeat(500));
        let excerpt = quota_excerpt(&long).unwrap();
        assert_eq!(excerpt.chars().count(), MAX_EXCERPT_CHARS + 1);
        assert!(excerpt.ends_with('…'));
    }

    #[test]
    fn gemini_error_bodies_give_their_message_and_nothing_else() {
        let body = r#"{"error":{"code":429,"message":"You exceeded your current quota.","status":"RESOURCE_EXHAUSTED","details":[{"secret":"x"}]}}"#;
        assert_eq!(
            gemini_error_message(body),
            "You exceeded your current quota."
        );
        for body in ["", "not json", r#"{"error":{"message":"  "}}"#, "[]"] {
            assert_eq!(
                gemini_error_message(body),
                "The Gemini API answered 429 (rate limit reached)."
            );
        }
    }
}
