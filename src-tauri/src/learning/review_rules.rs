use super::error::LearningError;
use super::memory_recall::{MemoryRecallResult, MAX_TRANSCRIPT_CHARS};
use super::models::{LearningItemType, LearningStatus, ReviewResponse};
use super::validation::MAX_ITEM_ID;
use crate::core::IpcErrorCode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewRejection {
    InvalidId,
    TranscriptLength,
    RunMissing,
    RunFinished,
    UnknownRunToFinish,
    NotInQueue,
    Skipped,
    OutOfOrder,
    ItemRemoved,
    ItemChanged,
    ItemNotDue,
    NotReviewable,
    PreparationBusy,
    InvalidPosition,
}

impl ReviewRejection {
    pub fn code(self) -> IpcErrorCode {
        match self {
            Self::RunMissing | Self::RunFinished => IpcErrorCode::InvalidSession,
            Self::PreparationBusy => IpcErrorCode::Busy,
            _ => IpcErrorCode::InvalidRequest,
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::InvalidId => "Invalid review ID.",
            Self::TranscriptLength => "Transcript must be between 1 and 4000 characters.",
            Self::RunMissing | Self::UnknownRunToFinish => "This review run no longer exists.",
            Self::RunFinished => "This review run is already finished.",
            Self::NotInQueue => "This item is not in the review queue.",
            Self::Skipped => "This item was skipped. Start a new review to answer it.",
            Self::OutOfOrder => "Items must be answered in order.",
            Self::ItemRemoved => "This item was removed and cannot be updated.",
            Self::ItemChanged => {
                "This item changed after the review started. End the review and start again."
            }
            Self::ItemNotDue => "This item is archived or no longer due and cannot be updated.",
            Self::NotReviewable => "This item is archived or cannot be reviewed right now.",
            Self::PreparationBusy => {
                "Review situations are still preparing. You can answer now or retry shortly."
            }
            Self::InvalidPosition => "Choose the current review item before showing its phrase.",
        }
    }
}

pub const MAX_REVIEW_POSITION: usize = 6;

pub fn validate_review_id(value: u64) -> Result<(), LearningError> {
    if value == 0 || value > MAX_ITEM_ID {
        return Err(LearningError::Review(ReviewRejection::InvalidId));
    }
    Ok(())
}

pub fn validate_review_position(position: usize) -> Result<(), LearningError> {
    if position == 0 || position > MAX_REVIEW_POSITION {
        return Err(LearningError::Review(ReviewRejection::InvalidPosition));
    }
    Ok(())
}

pub fn validate_transcript(raw: &str) -> Result<&str, LearningError> {
    let transcript = raw.trim();
    if transcript.is_empty() || transcript.chars().count() > MAX_TRANSCRIPT_CHARS {
        return Err(LearningError::Review(ReviewRejection::TranscriptLength));
    }
    Ok(transcript)
}

pub fn response_for(wording_observed: bool) -> ReviewResponse {
    if wording_observed {
        ReviewResponse::Remembered
    } else {
        ReviewResponse::NeedPractice
    }
}

#[derive(Debug, Clone)]
pub(crate) struct QueueItem {
    pub position: usize,
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub cue: String,
    pub target: String,
    pub transcript: Option<String>,
    pub wording_observed: Option<bool>,
    pub saved_response: Option<ReviewResponse>,
    pub next_review_at: Option<i64>,
    pub interval_days: Option<u32>,
    pub status: Option<LearningStatus>,
    pub saved_at: Option<i64>,
}

pub(crate) enum QueueSlot<'a> {
    Answered(&'a QueueItem),
    Skipped,
    Next(&'a QueueItem),
}

pub(crate) fn slot_of(
    queue: &[QueueItem],
    item_type: LearningItemType,
    item_id: u64,
) -> Result<QueueSlot<'_>, ReviewRejection> {
    let item = queue
        .iter()
        .find(|row| row.item_type == item_type && row.item_id == item_id)
        .ok_or(ReviewRejection::NotInQueue)?;
    if item.saved_at.is_some() {
        return Ok(if item.saved_response.is_some() {
            QueueSlot::Answered(item)
        } else {
            QueueSlot::Skipped
        });
    }
    let next_pending = queue
        .iter()
        .find(|row| row.saved_at.is_none())
        .map(|row| row.position);
    if next_pending != Some(item.position) {
        return Err(ReviewRejection::OutOfOrder);
    }
    Ok(QueueSlot::Next(item))
}

#[derive(Debug, Clone)]
pub(crate) struct CurrentItem {
    pub status: String,
    pub due_at: i64,
    pub cue: String,
    pub target: String,
}

pub(crate) fn check_still_answerable(
    item: &QueueItem,
    current: Option<&CurrentItem>,
    now: i64,
) -> Result<(), ReviewRejection> {
    let current = current.ok_or(ReviewRejection::ItemRemoved)?;
    if current.cue != item.cue || current.target != item.target {
        return Err(ReviewRejection::ItemChanged);
    }
    if current.status == "archived" || current.due_at > now {
        return Err(ReviewRejection::ItemNotDue);
    }
    Ok(())
}

pub(crate) fn result_from_saved(run_id: u64, row: &QueueItem) -> MemoryRecallResult {
    MemoryRecallResult {
        run_id,
        position: row.position,
        item_type: row.item_type,
        item_id: row.item_id,
        cue: row.cue.clone(),
        target: row.target.clone(),
        transcript: row.transcript.clone().unwrap_or_default(),
        wording_observed: row.wording_observed.unwrap_or(false),
        saved_response: row.saved_response.unwrap_or(ReviewResponse::NeedPractice),
        next_review_at: row.next_review_at.unwrap_or_default(),
        interval_days: row.interval_days.unwrap_or(1),
        status: row.status.unwrap_or(LearningStatus::Learning),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(position: usize, item_id: u64, saved: Option<ReviewResponse>) -> QueueItem {
        QueueItem {
            position,
            item_type: LearningItemType::Phrase,
            item_id,
            cue: "cue".into(),
            target: "target".into(),
            transcript: None,
            wording_observed: None,
            saved_response: saved,
            next_review_at: None,
            interval_days: None,
            status: None,
            saved_at: saved.map(|_| 1),
        }
    }

    fn current(status: &str, due_at: i64) -> CurrentItem {
        CurrentItem {
            status: status.into(),
            due_at,
            cue: "cue".into(),
            target: "target".into(),
        }
    }

    #[test]
    fn transcripts_are_trimmed_and_bounded() {
        assert_eq!(validate_transcript("  said it ").unwrap(), "said it");
        assert!(validate_transcript("   ").is_err());
        assert!(validate_transcript(&"x".repeat(MAX_TRANSCRIPT_CHARS + 1)).is_err());
    }

    #[test]
    fn only_the_first_unanswered_item_is_next() {
        let queue = vec![item(1, 10, None), item(2, 20, None)];
        assert!(matches!(
            slot_of(&queue, LearningItemType::Phrase, 10),
            Ok(QueueSlot::Next(_))
        ));
        assert_eq!(
            slot_of(&queue, LearningItemType::Phrase, 20).err(),
            Some(ReviewRejection::OutOfOrder)
        );
        assert_eq!(
            slot_of(&queue, LearningItemType::Phrase, 30).err(),
            Some(ReviewRejection::NotInQueue)
        );
    }

    #[test]
    fn settled_items_are_answered_or_skipped() {
        let queue = vec![
            item(1, 10, Some(ReviewResponse::Remembered)),
            QueueItem {
                saved_at: Some(1),
                ..item(2, 20, None)
            },
        ];
        assert!(matches!(
            slot_of(&queue, LearningItemType::Phrase, 10),
            Ok(QueueSlot::Answered(_))
        ));
        assert!(matches!(
            slot_of(&queue, LearningItemType::Phrase, 20),
            Ok(QueueSlot::Skipped)
        ));
    }

    #[test]
    fn an_item_must_still_be_the_same_and_due() {
        let queued = item(1, 10, None);
        assert!(check_still_answerable(&queued, Some(&current("learning", 5)), 10).is_ok());
        assert_eq!(
            check_still_answerable(&queued, None, 10),
            Err(ReviewRejection::ItemRemoved)
        );
        assert_eq!(
            check_still_answerable(&queued, Some(&current("archived", 5)), 10),
            Err(ReviewRejection::ItemNotDue)
        );
        assert_eq!(
            check_still_answerable(&queued, Some(&current("learning", 11)), 10),
            Err(ReviewRejection::ItemNotDue)
        );
        let changed = CurrentItem {
            target: "other".into(),
            ..current("learning", 5)
        };
        assert_eq!(
            check_still_answerable(&queued, Some(&changed), 10),
            Err(ReviewRejection::ItemChanged)
        );
    }

    #[test]
    fn spoken_wording_remembers_and_anything_else_needs_practice() {
        assert_eq!(response_for(true), ReviewResponse::Remembered);
        assert_eq!(response_for(false), ReviewResponse::NeedPractice);
    }
}
