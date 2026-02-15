import { TrainingState, EvaluationResult, PROGRESSION_RULES } from "./models";

/**
 * Compute clamped adherence for rule evaluation
 * Prevents "superhuman" adherence from triggering progression too early
 */
function getAdherenceForRules(state: TrainingState): number {
  // Clamp: if user does MORE than target, treat as 100% (not 150%)
  const sessions_in_window = state.sessions_last_14_days;
  const target_in_window = state.program.sessions_per_week * 2;
  
  const clamped_sessions = Math.min(sessions_in_window, target_in_window);
  return clamped_sessions / target_in_window;
}

/**
 * Evaluates training state and returns decision + reasoning
 * DOES NOT mutate program - that's done by applyDecisionToProgram
 */
export function evaluateTrainingDecision(
  state: TrainingState
): EvaluationResult {
  
  // Use clamped adherence for all rule checks
  const adherence_for_rules = getAdherenceForRules(state);
  const inactive_days_since_last_session = state.days_since_last_session;
  const inactive_weeks_equivalent = Math.floor(inactive_days_since_last_session / 7);
  
  // ========================================================================
  // SCALE-BACK CHECKS (Priority: Safety first)
  // ========================================================================
  
  // Check 0: Active injury flag
  if (state.has_active_injury || state.recent_pain_flags.length >= 2) {
    return {
      decision: "scale_back",
      reason: state.has_active_injury 
        ? "Active injury flag present" 
        : "Multiple pain reports in recent weeks",
      user_message: "You’ve reported pain recently. This week is lighter so you can keep moving while things settle.",
      coach_tone: "gentle",
    };
  }
  
  // Check 1: High accumulated fatigue
  if (state.accumulated_fatigue_score >= 7) {
    return {
      decision: "scale_back",
      reason: "Fatigue score is high (≥7/10)",
      user_message: "Fatigue is running high. This week is lighter to help you recover and come back stronger.",
      coach_tone: "gentle",
    };
  }
  
  // Check 2: Energy depletion (underfueling pattern)
  if (state.energy_context === "depleted") {
    return {
      decision: "scale_back",
      reason: "Energy context is depleted (likely underfueling)",
      user_message: "Energy looks low right now. We’ll keep this week lighter so training stays sustainable while you refuel.",
      coach_tone: "gentle",
    };
  }
  
  // Check 3: Severe adherence drop (<40% for 2+ weeks)
  if (adherence_for_rules < 0.4 && state.low_adherence_weeks_in_row >= 2) {
    return {
      decision: "scale_back",
      reason: "Adherence below 40% for 2+ consecutive weeks",
      user_message: "Let’s make this more doable. This week is lighter so consistency is easier to protect.",
      coach_tone: "gentle",
    };
  }
  
  // Check 4: Extended absence (3+ weeks)
  if (inactive_weeks_equivalent >= 3) {
    return {
      decision: "scale_back",
      reason: "Inactive for 3+ weeks",
      user_message: "Welcome back. This week is an ease-in week — light, repeatable, and focused on rebuilding the habit.",
      coach_tone: "gentle",
    };
  }
  
  // ========================================================================
  // MAINTAIN CHECKS (Stability zone)
  // ========================================================================
  
  // Check 5: Recent inactivity (1-2 weeks)
  if (inactive_weeks_equivalent >= 1) {
    return {
      decision: "maintain",
      reason: `Recent inactivity (${inactive_weeks_equivalent} week${inactive_weeks_equivalent > 1 ? "s" : ""} since last session)`,
      user_message: "You’ve had a short break — after a week or two away, we’ll keep things steady to rebuild rhythm.",
      coach_tone: "steady",
    };
  }

  // Check 6: Still in onboarding (fixed length, 1-based)
  if (state.current_phase === "onboarding") {
    return {
      decision: "maintain",
      reason: `Onboarding phase (week ${state.week_number}/${PROGRESSION_RULES.ONBOARDING_WEEKS})`,
      user_message: "We’re keeping it easy while you learn the flow and build the habit. Show up — that’s the goal.",
      coach_tone: "encouraging",
    };
  }
  
  // Check 7: Pain-free gate after injury (SEPARATE from fatigue stabilization)
  if (state.recent_pain_flags.length > 0 && !state.has_active_injury) {
    return {
      decision: "maintain",
      reason: "Recent pain report - monitoring before progression",
      user_message: "We’ll keep things steady while we watch how you feel. No need to push this week.",
      coach_tone: "steady",
    };
  }
  
  // Pain gate: require 2 consecutive pain-free weeks before allowing progress
  if (state.consecutive_pain_free_weeks < 2 && (state.recent_pain_flags.length > 0 || state.has_active_injury)) {
    return {
      decision: "maintain",
      reason: `Waiting for 2 pain-free weeks before progression (${state.consecutive_pain_free_weeks}/2)`,
      user_message: "Let’s stay steady until you’ve had two pain-free weeks. Then we’ll progress.",
      coach_tone: "steady",
    };
  }
  
  // Check 8: Post-scale-back stabilization (SEPARATE from pain gate)
  if (state.weeks_since_last_scale_back !== null && state.weeks_since_last_scale_back < 2) {
    return {
      decision: "maintain",
      reason: `Stabilizing after scale-back (${state.weeks_since_last_scale_back}/2 weeks)`,
      user_message: "You’re rebuilding after a lighter week. Keep this steady and repeatable.",
      coach_tone: "steady",
    };
  }
  
  // Check 9: Moderate adherence (40-75%)
  if (
    adherence_for_rules >= 0.4 && 
    adherence_for_rules < 0.75
  ) {
    return {
      decision: "maintain",
      reason: "Adherence in 40-75% range (stability zone)",
      user_message: "You’re showing up. Keep the sessions steady — consistency is the win this week.",
      coach_tone: "steady",
    };
  }
  
  // Check 10: Moderate fatigue (5-7 range)
  if (state.accumulated_fatigue_score >= 5 && state.accumulated_fatigue_score < 7) {
    return {
      decision: "maintain",
      reason: "Fatigue in moderate range (5-7/10)",
      user_message: "Fatigue is moderate. Holding steady this week gives you room to recover.",
      coach_tone: "steady",
    };
  }
  
  // Check 11: Low energy (but not depleted)
  if (state.energy_context === "low") {
    return {
      decision: "maintain",
      reason: "Energy context is low",
      user_message: "Energy is lower than usual. Steady training beats pushing right now.",
      coach_tone: "steady",
    };
  }
  
  // Check 12: Recently progressed (wait at least 2 weeks in phase)
  if (state.week_number < 2) {
    return {
      decision: "maintain",
      reason: "Less than 2 weeks at current level",
      user_message: "Let’s hold this level for another week or two so it sticks.",
      coach_tone: "steady",
    };
  }
  
  // ========================================================================
  // PROGRESS CHECKS (Green light zone)
  // ========================================================================
  
  // Stability criteria: high adherence + low fatigue + good energy
  const is_stable_week = 
    adherence_for_rules >= 0.75 && 
    state.accumulated_fatigue_score < 5 &&
    ["normal", "high"].includes(state.energy_context);
  
  // Need 2 consecutive stable weeks before progression
  if (is_stable_week && state.consecutive_stable_weeks < 2) {
    return {
      decision: "maintain",
      reason: `Stable week ${state.consecutive_stable_weeks}/2 before progression`,
      user_message: "You’re doing well. One more steady week and we’ll look to progress.",
      coach_tone: "steady",
    };
  }
  
  // Check: All gates passed, ready to progress
  const can_progress = 
    adherence_for_rules >= 0.75 &&
    state.accumulated_fatigue_score < 5 &&
    ["normal", "high"].includes(state.energy_context) &&
    state.week_number >= 2 &&
    state.consecutive_stable_weeks >= 2 &&
    state.recent_pain_flags.length === 0 &&
    state.consecutive_pain_free_weeks >= 2;
  
  if (can_progress) {
    return {
      decision: "progress",
      reason: "High adherence (≥75%), low fatigue (<5), good energy, 2+ stable weeks, pain-free",
      user_message: "You've been consistent and recovering well. Let's build on that.",
      coach_tone: "celebratory",
    };
  }
  
  // ========================================================================
  // DEFAULT: Maintain
  // ========================================================================
  
  return {
    decision: "maintain",
    reason: "Default: no clear trigger for progress or scale-back",
    user_message: "No clear signal to progress or scale back this week. Holding steady.",
    coach_tone: "steady",
  };
}
