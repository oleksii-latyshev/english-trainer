use crate::mistakes::domain::check_prompt::{
    check_prompt, parse_verdict, CheckRequest, Verdict, SCHEMA,
};
use crate::mistakes::error::CheckError;
use crate::mistakes::ports::AnswerChecker;
use crate::providers::run_background_json;

pub struct AgyAnswerChecker;

impl AnswerChecker for AgyAnswerChecker {
    fn check(&self, request: &CheckRequest) -> Result<Verdict, CheckError> {
        let payload =
            run_background_json(&check_prompt(request), SCHEMA).map_err(|_| CheckError::Failed)?;
        parse_verdict(payload).ok_or(CheckError::Failed)
    }
}
