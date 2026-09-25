use super::*;
use crate::providers::FocusCategory;

#[test]
fn normalizes_phrases_consistently() {
    assert_eq!(normalize_phrase("I work in there."), "i work in there");
    assert_eq!(normalize_phrase("  I work in there  "), "i work in there");
    assert_eq!(normalize_phrase("I don't know!"), "i don't know");
    assert_eq!(
        normalize_phrase("The main trade-off was..."),
        "the main trade off was"
    );
}

#[test]
fn mistake_deduplication_keys_match_identical_corrections() {
    let key1 = mistake_normalized_key(&FocusCategory::Grammar, "I work there");
    let key2 = mistake_normalized_key(&FocusCategory::Grammar, "  I work there.  ");
    let key3 = mistake_normalized_key(&FocusCategory::Grammar, "i work there");
    assert_eq!(key1, "grammar:i work there");
    assert_eq!(key1, key2);
    assert_eq!(key2, key3);

    let different_category = mistake_normalized_key(&FocusCategory::Vocabulary, "I work there");
    assert_ne!(key1, different_category);

    let different_wording = mistake_normalized_key(&FocusCategory::Grammar, "I worked there");
    assert_ne!(key1, different_wording);
}

#[test]
fn scheduling_rule_advances_intervals_and_status_without_instant_mastery() {
    let now = 1_000_000;

    // Single Remembered review from New -> Learning, interval 2 days
    let review1 =
        calculate_next_review(LearningStatus::New, 1, 2.5, ReviewResponse::Remembered, now);
    assert_eq!(review1.status, LearningStatus::Learning);
    assert_eq!(review1.interval_days, 2);
    assert_eq!(review1.next_review_at, now + 2 * MS_PER_DAY);

    // Second Remembered review from Learning (interval 2) -> Improving, interval 4 days
    let review2 = calculate_next_review(
        review1.status,
        review1.interval_days,
        review1.ease_factor,
        ReviewResponse::Remembered,
        now,
    );
    assert_eq!(review2.status, LearningStatus::Improving);
    assert_eq!(review2.interval_days, 4);
    assert_eq!(review2.next_review_at, now + 4 * MS_PER_DAY);

    // Need practice drops interval back to 1 day and status back to Learning
    let review_fail = calculate_next_review(
        review2.status,
        review2.interval_days,
        review2.ease_factor,
        ReviewResponse::NeedPractice,
        now,
    );
    assert_eq!(review_fail.status, LearningStatus::Learning);
    assert_eq!(review_fail.interval_days, 1);
    assert_eq!(review_fail.next_review_at, now + 1 * MS_PER_DAY);
}

#[test]
fn single_self_report_never_marks_stable() {
    let now = 1_000_000;
    let review =
        calculate_next_review(LearningStatus::New, 1, 2.5, ReviewResponse::Remembered, now);
    assert_ne!(review.status, LearningStatus::Stable);

    let review_from_learning = calculate_next_review(
        LearningStatus::Learning,
        1,
        2.5,
        ReviewResponse::Remembered,
        now,
    );
    assert_ne!(review_from_learning.status, LearningStatus::Stable);

    let many_reviews = calculate_next_review(
        LearningStatus::Improving,
        180,
        2.8,
        ReviewResponse::Remembered,
        now,
    );
    assert_eq!(many_reviews.status, LearningStatus::Improving);
}
