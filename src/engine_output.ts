import { TrainingPhase, TrainingDecision, IntensityTier, ProgramConfig, Session } from "./models";

/**
 * CANONICAL ENGINE OUTPUT CONTRACT
 * 
 * This is the single source of truth for what the engine produces each week.
 * All UI components should consume this interface.
 * 
 * Design principles:
 * - Immutable snapshots (no references to mutable state)
 * - JSON-serializable (no Date objects, no functions)
 * - Self-contained (each week stands alone)
 * - Explicit totals (raw vs planned always visible)
 */

export interface WeeklyEngineOutput {
  // Week identification
  week_number: number;
  week_start_iso: string; // ISO date string: "2026-01-06"
  
  // Phase context
  phase: TrainingPhase;
  phase_week: number; // 1-based week within current phase
  
  // State snapshot (before any mutations)
  state: {
    fatigue_score: number;           // 0-10 scale
    energy_context: "depleted" | "low" | "normal" | "high";
    adherence_rate_2week: number;    // 0.0-1.0 (clamped)
    days_since_last_session: number;
    pain_flags: string[];            // Recent pain reports
    has_active_injury: boolean;
  };
  
  // Program for THIS week (post-mutation, what was actually used)
  program: {
    sessions_per_week: number;
    intensity_tier: IntensityTier;
    session_duration_minutes: number;
    volume_multiplier: number;
  };
  
  // Generated sessions for this week
  sessions: Session[];
  minimum_viable_sessions: Session[];
  
  // Completion tracking
  completion: {
    raw_sessions_completed: number;      // What actually happened
    planned_sessions_completed: number;  // Capped to target
    extra_sessions: number;              // raw - planned (if positive)
    adherence_this_week: number;         // 0.0-1.0 (planned / target)
  };
  
  // Decision & reasoning
  decision: {
    type: TrainingDecision;
    reason: string;
    coaching_message: string;
    coach_tone: "encouraging" | "steady" | "gentle" | "celebratory";
  };
  
  // Program changes (if any)
  program_change: {
    occurred: boolean;
    description?: string;
    cause?: "scale_back" | "progression_duration" | "progression_volume" | "progression_intensity" | "phase_transition";
  };
  
  // Safety & warnings
  safety_notes: string[];
  
  // Next week preview
  next_week_program: {
    sessions_per_week: number;
    intensity_tier: IntensityTier;
    session_duration_minutes: number;
    volume_multiplier: number;
  };
}

/**
 * SIMULATION SUMMARY OUTPUT
 * 
 * High-level summary of an entire simulation run.
 * Used for testing, debugging, and archival.
 */
export interface SimulationOutput {
  scenario_name: string;
  scenario_description: string;
  
  // All weekly outputs
  weeks: WeeklyEngineOutput[];
  
  // Final state summary
  final_state: {
    phase: TrainingPhase;
    phase_week: number;
    total_sessions_raw: number;
    total_sessions_planned: number;
    current_program: ProgramConfig;
    weeks_since_scale_back: number | null;
    consecutive_stable_weeks: number;
    consecutive_pain_free_weeks: number;
  };
  
  // Metadata
  simulation_metadata: {
    total_weeks: number;
    decisions_breakdown: {
      progress: number;
      maintain: number;
      scale_back: number;
    };
    phase_transitions: Array<{
      week: number;
      from_phase: TrainingPhase;
      to_phase: TrainingPhase;
    }>;
  };
}

/**
 * Convert internal WeeklyResult to canonical WeeklyEngineOutput
 */
export function toWeeklyEngineOutput(
  week_number: number,
  week_start: Date,
  result: any // WeeklyResult from simulator
): WeeklyEngineOutput {
  return {
    week_number,
    week_start_iso: week_start.toISOString().split('T')[0],
    
    phase: result.plan.phase,
    phase_week: result.plan.phase_week,
    
    state: {
      fatigue_score: result.state_snapshot.accumulated_fatigue_score,
      energy_context: result.state_snapshot.energy_context,
      adherence_rate_2week: result.state_snapshot.adherence_rate_2week,
      days_since_last_session: 0, // Would come from state
      pain_flags: [], // Would come from state
      has_active_injury: false, // Would come from state
    },
    
    program: {
      sessions_per_week: result.program_this_week.sessions_per_week,
      intensity_tier: result.program_this_week.intensity_tier,
      session_duration_minutes: result.program_this_week.session_duration_minutes,
      volume_multiplier: result.program_this_week.volume_multiplier,
    },
    
    sessions: result.plan.sessions,
    minimum_viable_sessions: result.plan.minimum_viable_sessions,
    
    completion: {
      raw_sessions_completed: result.sessions_completed_raw,
      planned_sessions_completed: result.sessions_completed_capped,
      extra_sessions: result.extra_sessions,
      adherence_this_week: Math.min(1.0, result.sessions_completed_capped / result.program_this_week.sessions_per_week),
    },
    
    decision: {
      type: result.plan.decision,
      reason: result.plan.reason,
      coaching_message: result.plan.coaching_message,
      coach_tone: result.plan.coach_tone,
    },
    
    program_change: {
      occurred: !!result.plan.program_change_description,
      description: result.plan.program_change_description,
      cause: result.program_change_cause,
    },
    
    safety_notes: result.plan.safety_notes,
    
    next_week_program: {
      sessions_per_week: result.program_next_week.sessions_per_week,
      intensity_tier: result.program_next_week.intensity_tier,
      session_duration_minutes: result.program_next_week.session_duration_minutes,
      volume_multiplier: result.program_next_week.volume_multiplier,
    },
  };
}