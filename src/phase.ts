import { TrainingState, TrainingPhase, TrainingDecision } from "./models";

/**
 * Determines if phase should transition
 * Called after evaluation
 */
export function evaluatePhaseTransition(
  state: TrainingState,
  recent_decision: TrainingDecision
): TrainingPhase | null {
  
  // Onboarding → Building (after 3 weeks, 1-based)
  if (
    state.current_phase === "onboarding" &&
    state.week_number >= 3 &&
    state.adherence_rate_2week >= 0.6
  ) {
    return "building";
  }
  
  // Building → Maintaining (plateau by choice or moderate adherence)
  if (
    state.current_phase === "building" &&
    state.adherence_rate_2week >= 0.4 &&
    state.adherence_rate_2week < 0.75 &&
    state.week_number >= 4
  ) {
    return "maintaining";
  }
  
  // Any phase → Recovering (if scale_back triggered)
  if (recent_decision === "scale_back") {
    return "recovering";
  }
  
  // Recovering → Maintaining (after 2 weeks of decent adherence)
  if (
    state.current_phase === "recovering" &&
    state.week_number >= 2 &&
    state.adherence_rate_2week >= 0.5 &&
    state.accumulated_fatigue_score < 5
  ) {
    return "maintaining";
  }
  
  // Maintaining → Building (after 4+ weeks, if ready to progress)
  if (
    state.current_phase === "maintaining" &&
    state.week_number >= 4 &&
    state.adherence_rate_2week >= 0.75 &&
    state.accumulated_fatigue_score < 5
  ) {
    return "building";
  }
  
  // No transition
  return null;
}