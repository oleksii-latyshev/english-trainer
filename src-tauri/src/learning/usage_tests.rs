use super::usage::*;
use crate::learning::models::{LearningItemType, LearningStatus};
use crate::learning::scheduling::MS_PER_DAY;

fn make_event(
    id: u64,
    session_id: u64,
    day_offset: i64,
    outcome: UsageOutcome,
    confidence: f64,
    origin: &str,
) -> UsageEventRecord {
    UsageEventRecord {
        id,
        item_type: LearningItemType::Mistake,
        item_id: 1,
        session_id,
        sequence: 1,
        origin: origin.to_string(),
        original_turn_time: day_offset * MS_PER_DAY,
        outcome,
        exact_excerpt: "sample excerpt".to_string(),
        confidence,
        created_at: day_offset * MS_PER_DAY,
    }
}

#[test]
fn pure_policy_advances_from_new_to_learning_on_first_success() {
    let events = vec![make_event(
        1,
        10,
        0,
        UsageOutcome::Correct,
        0.95,
        "assessment",
    )];
    let projected = project_mastery_state(LearningStatus::New, &events, 1, 1000);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 1);
    assert_eq!(projected.lifetime_distinct_sessions, 1);
}

#[test]
fn pure_policy_advances_from_learning_to_improving_after_two_distinct_sessions_on_separate_days() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.92, "assessment"),
        make_event(2, 11, 2, UsageOutcome::Correct, 0.95, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::Learning, &events, 2, 1000);
    assert_eq!(projected.status, LearningStatus::Improving);
    assert_eq!(projected.streak, 2);
    assert_eq!(projected.lifetime_distinct_sessions, 2);
}

#[test]
fn same_day_or_same_session_events_count_at_most_once_per_day_and_session() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 10, 0, UsageOutcome::Correct, 0.96, "assessment"),
        make_event(3, 12, 0, UsageOutcome::Correct, 0.98, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::New, &events, 1, 1000);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 1);
    assert_eq!(projected.lifetime_distinct_sessions, 2);
}

#[test]
fn collapses_session_before_assigning_daily_credit() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 10, 7, UsageOutcome::Correct, 0.96, "assessment"),
        make_event(3, 11, 7, UsageOutcome::Correct, 0.98, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::New, &events, 1, 1000);
    assert_eq!(projected.streak, 2);
    assert_eq!(projected.status, LearningStatus::Improving);
}

#[test]
fn positive_evidence_does_not_demote_existing_improving_state() {
    let events = vec![make_event(
        1,
        10,
        0,
        UsageOutcome::Correct,
        0.95,
        "assessment",
    )];
    let projected = project_mastery_state(LearningStatus::Improving, &events, 8, 9000);
    assert_eq!(projected.status, LearningStatus::Improving);
    assert_eq!(projected.interval_days, 8);
    assert_eq!(projected.next_review_at, 9000);
}

#[test]
fn late_relapse_reprojects_prior_stable_history_and_keeps_relapse_due_date() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(4, 13, 28, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(5, 14, 25, UsageOutcome::Incorrect, 0.95, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::Stable, &events, 21, 9999);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 1);
    assert_eq!(projected.interval_days, 1);
    assert_eq!(projected.next_review_at, 25 * MS_PER_DAY);
}

#[test]
fn stable_requires_three_sessions_three_weekly_buckets_and_twenty_one_full_days() {
    // Days 0, 7, 21 in distinct sessions => Stable
    let events_stable = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.95, "assessment"),
    ];
    let projected_stable =
        project_mastery_state(LearningStatus::Improving, &events_stable, 4, 1000);
    assert_eq!(projected_stable.status, LearningStatus::Stable);
    assert_eq!(projected_stable.streak, 3);

    // Days 0, 1, 21 => only 2 weekly buckets (bucket 0, 0, 3) => not Stable, stays Improving
    let events_two_buckets = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 1, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.95, "assessment"),
    ];
    let projected_two_buckets =
        project_mastery_state(LearningStatus::Improving, &events_two_buckets, 4, 1000);
    assert_eq!(projected_two_buckets.status, LearningStatus::Improving);

    // Days 0, 7, 14 => only 14 days (< 21 full days) => not Stable
    let events_fourteen_days = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 14, UsageOutcome::Correct, 0.95, "assessment"),
    ];
    let projected_fourteen =
        project_mastery_state(LearningStatus::Improving, &events_fourteen_days, 4, 1000);
    assert_eq!(projected_fourteen.status, LearningStatus::Improving);
}

#[test]
fn stable_week_buckets_use_elapsed_seven_day_periods_from_first_success() {
    let first = 23 * 60 * 60 * 1000;
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 0, UsageOutcome::Correct, 0.95, "assessment"),
    ];
    let mut events = events;
    events[0].original_turn_time = first;
    events[1].original_turn_time = first + 6 * MS_PER_DAY + 2 * 60 * 60 * 1000;
    events[2].original_turn_time = first + 21 * MS_PER_DAY;
    let projected = project_mastery_state(LearningStatus::Improving, &events, 4, 1000);
    assert_eq!(projected.status, LearningStatus::Improving);
}

#[test]
fn relapse_resets_stable_to_learning_and_clears_streak_while_keeping_cumulative_count() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(4, 13, 25, UsageOutcome::Incorrect, 0.92, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::Stable, &events, 21, 1000);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 0);
    assert_eq!(projected.lifetime_distinct_sessions, 3);
    assert_eq!(projected.interval_days, 1);
    assert_eq!(projected.next_review_at, 25 * MS_PER_DAY);
}

#[test]
fn feedback_relapse_also_demotes_stable() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(4, 13, 28, UsageOutcome::Incorrect, 1.0, "feedback"),
    ];
    let projected = project_mastery_state(LearningStatus::Stable, &events, 21, 1000);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 0);
}

#[test]
fn low_confidence_or_uncertain_does_not_affect_state() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.95, "assessment"),
        make_event(2, 11, 5, UsageOutcome::Correct, 0.85, "assessment"), // below 0.9
        make_event(3, 12, 10, UsageOutcome::Uncertain, 0.95, "assessment"),
        make_event(4, 13, 15, UsageOutcome::Incorrect, 0.80, "assessment"), // below 0.9
    ];
    let projected = project_mastery_state(LearningStatus::Learning, &events, 1, 1000);
    assert_eq!(projected.status, LearningStatus::Learning);
    assert_eq!(projected.streak, 1);
    assert_eq!(projected.lifetime_distinct_sessions, 1);
}

#[test]
fn archived_status_is_never_altered_by_success_or_relapse() {
    let events = vec![
        make_event(1, 10, 0, UsageOutcome::Correct, 0.99, "assessment"),
        make_event(2, 11, 7, UsageOutcome::Correct, 0.99, "assessment"),
        make_event(3, 12, 21, UsageOutcome::Correct, 0.99, "assessment"),
        make_event(4, 13, 25, UsageOutcome::Incorrect, 0.99, "assessment"),
    ];
    let projected = project_mastery_state(LearningStatus::Archived, &events, 60, 5000);
    assert_eq!(projected.status, LearningStatus::Archived);
    assert_eq!(projected.lifetime_distinct_sessions, 3);
    assert_eq!(
        (projected.interval_days, projected.next_review_at),
        (60, 5000)
    );
}

#[test]
fn target_length_and_source_rejection_rules() {
    assert!(!is_eligible_target_length("word"));
    assert!(is_eligible_target_length("two words"));
    assert!(!is_eligible_target_length(""));
    assert!(!is_eligible_target_length(". hello"));
    assert!(!is_eligible_target_length("hello !!!"));
    assert!(!is_eligible_target_length(&"a ".repeat(151)));

    let opening = "What was the main drawback?";
    assert!(contains_normalized_words(opening, "the main drawback"));
    assert!(!contains_normalized_words(opening, "an alternative"));

    let sources = ["The main drawback was speed", "Another reason is…"];
    assert!(is_rejected_by_sources("main drawback", &sources));
    assert!(is_rejected_by_sources("another reason", &sources));
    assert!(!is_rejected_by_sources("completely unrelated", &sources));
}
