use crate::speaking_activity::rounded_minutes;
use serde::Serialize;
use std::collections::HashSet;
use ts_rs::TS;

pub const SUNSHINE_DROPS: u32 = 5;
const STAGE_FLOORS: [u32; 6] = [0, 10, 30, 60, 100, 150];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SpokenSession {
    pub session_id: u64,
    pub days_ago: i64,
    pub active_ms: u64,
    pub topic: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SunshineMoment {
    pub session_id: u64,
    pub phrase_id: u64,
    pub days_ago: i64,
    pub phrase: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct GrowthActivity {
    pub sessions: Vec<SpokenSession>,
    pub sunshine: Vec<SunshineMoment>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SpeakingGain {
    pub drops: u32,
    pub topic: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SunshineGain {
    pub drops: u32,
    pub phrase: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct TodayGains {
    pub speaking: Vec<SpeakingGain>,
    pub sunshine: Vec<SunshineGain>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct EvaGrowth {
    pub drops: u32,
    pub stage: u8,
    pub stage_floor: u32,
    pub next_threshold: Option<u32>,
    pub napping: bool,
    pub today: TodayGains,
}

fn session_drops(session: &SpokenSession) -> u32 {
    rounded_minutes(session.active_ms)
}

fn once_per_phrase_and_session(activity: &GrowthActivity) -> Vec<&SunshineMoment> {
    let mut seen = HashSet::new();
    let mut moments: Vec<&SunshineMoment> = activity
        .sunshine
        .iter()
        .filter(|moment| seen.insert((moment.session_id, moment.phrase_id)))
        .collect();
    moments.sort_by_key(|moment| (moment.session_id, moment.phrase_id));
    moments
}

fn stage_of(drops: u32) -> usize {
    STAGE_FLOORS
        .iter()
        .rposition(|floor| drops >= *floor)
        .unwrap_or(0)
}

pub fn grow(activity: &GrowthActivity) -> EvaGrowth {
    let moments = once_per_phrase_and_session(activity);
    let spoken: Vec<&SpokenSession> = activity
        .sessions
        .iter()
        .filter(|session| session_drops(session) > 0)
        .collect();
    let drops = spoken.iter().map(|s| session_drops(s)).sum::<u32>()
        + SUNSHINE_DROPS * u32::try_from(moments.len()).unwrap_or(u32::MAX);
    let stage = stage_of(drops);
    let recently_active =
        spoken.iter().any(|s| s.days_ago <= 1) || moments.iter().any(|moment| moment.days_ago <= 1);
    let mut spoken_today: Vec<&SpokenSession> =
        spoken.iter().copied().filter(|s| s.days_ago == 0).collect();
    spoken_today.sort_by_key(|session| session.session_id);

    EvaGrowth {
        drops,
        stage: stage as u8,
        stage_floor: STAGE_FLOORS[stage],
        next_threshold: STAGE_FLOORS.get(stage + 1).copied(),
        napping: drops > 0 && !recently_active,
        today: TodayGains {
            speaking: spoken_today
                .into_iter()
                .map(|session| SpeakingGain {
                    drops: session_drops(session),
                    topic: session.topic.clone(),
                })
                .collect(),
            sunshine: moments
                .into_iter()
                .filter(|moment| moment.days_ago == 0)
                .map(|moment| SunshineGain {
                    drops: SUNSHINE_DROPS,
                    phrase: moment.phrase.clone(),
                })
                .collect(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(id: u64, days_ago: i64, active_ms: u64) -> SpokenSession {
        SpokenSession {
            session_id: id,
            days_ago,
            active_ms,
            topic: format!("Topic {id}"),
        }
    }

    fn sunshine(session_id: u64, phrase_id: u64, days_ago: i64) -> SunshineMoment {
        SunshineMoment {
            session_id,
            phrase_id,
            days_ago,
            phrase: format!("phrase {phrase_id}"),
        }
    }

    fn minutes(count: u64) -> u64 {
        count * 60_000
    }

    fn with_drops(drops: u64) -> EvaGrowth {
        grow(&GrowthActivity {
            sessions: vec![session(1, 0, minutes(drops))],
            sunshine: Vec::new(),
        })
    }

    #[test]
    fn a_new_learner_is_a_sleeping_seed_that_is_not_napping() {
        let growth = grow(&GrowthActivity::default());
        assert_eq!((growth.drops, growth.stage), (0, 0));
        assert_eq!(growth.next_threshold, Some(10));
        assert!(!growth.napping);
    }

    #[test]
    fn stages_start_at_their_thresholds() {
        let stages: Vec<u8> = [9, 10, 29, 30, 59, 60, 99, 100, 149, 150]
            .into_iter()
            .map(|drops| with_drops(drops).stage)
            .collect();
        assert_eq!(stages, [0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    }

    #[test]
    fn the_stage_reports_its_floor_and_the_next_threshold() {
        let growth = with_drops(45);
        assert_eq!(growth.stage_floor, 30);
        assert_eq!(growth.next_threshold, Some(60));
    }

    #[test]
    fn full_bloom_has_no_next_threshold_and_stays_there() {
        let growth = with_drops(400);
        assert_eq!(growth.stage, 5);
        assert_eq!(growth.stage_floor, 150);
        assert_eq!(growth.next_threshold, None);
    }

    #[test]
    fn each_session_rounds_to_the_nearest_minute() {
        let growth = grow(&GrowthActivity {
            sessions: vec![session(1, 0, 89_999), session(2, 0, 90_000)],
            sunshine: Vec::new(),
        });
        assert_eq!(growth.drops, 3);
    }

    #[test]
    fn a_session_under_half_a_minute_gives_no_drops_and_no_row() {
        let growth = grow(&GrowthActivity {
            sessions: vec![session(1, 0, 29_999)],
            sunshine: Vec::new(),
        });
        assert_eq!(growth.drops, 0);
        assert!(growth.today.speaking.is_empty());
    }

    #[test]
    fn sunshine_is_five_drops_once_per_phrase_per_session() {
        let growth = grow(&GrowthActivity {
            sessions: Vec::new(),
            sunshine: vec![sunshine(1, 7, 0), sunshine(1, 7, 0), sunshine(2, 7, 0)],
        });
        assert_eq!(growth.drops, 10);
        assert_eq!(growth.today.sunshine.len(), 2);
        assert_eq!(growth.today.sunshine[0].drops, 5);
    }

    #[test]
    fn today_lists_one_row_per_session_spoken_today_only() {
        let growth = grow(&GrowthActivity {
            sessions: vec![
                session(2, 0, minutes(4)),
                session(1, 0, minutes(12)),
                session(3, 1, minutes(9)),
            ],
            sunshine: vec![sunshine(1, 7, 1)],
        });
        let rows: Vec<(u32, &str)> = growth
            .today
            .speaking
            .iter()
            .map(|gain| (gain.drops, gain.topic.as_str()))
            .collect();
        assert_eq!(rows, [(12, "Topic 1"), (4, "Topic 2")]);
        assert!(growth.today.sunshine.is_empty());
    }

    #[test]
    fn eva_naps_after_a_full_day_off() {
        let growth = grow(&GrowthActivity {
            sessions: vec![session(1, 2, minutes(20))],
            sunshine: Vec::new(),
        });
        assert!(growth.napping);
        assert_eq!(growth.drops, 20);
    }

    #[test]
    fn talking_yesterday_or_today_keeps_her_awake() {
        for days_ago in [0, 1] {
            let growth = grow(&GrowthActivity {
                sessions: vec![session(1, 5, minutes(20)), session(2, days_ago, minutes(1))],
                sunshine: Vec::new(),
            });
            assert!(!growth.napping);
        }
    }

    #[test]
    fn recent_sunshine_alone_keeps_her_awake() {
        let growth = grow(&GrowthActivity {
            sessions: vec![session(1, 5, minutes(20))],
            sunshine: vec![sunshine(1, 7, 1)],
        });
        assert!(!growth.napping);
    }

    #[test]
    fn nothing_is_lost_while_she_naps() {
        let napping = grow(&GrowthActivity {
            sessions: vec![session(1, 30, minutes(100))],
            sunshine: Vec::new(),
        });
        assert_eq!(napping.stage, 4);
    }
}
