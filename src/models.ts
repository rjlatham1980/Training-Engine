// ============================================================================
// CORE DATA MODELS
// ============================================================================

/**
 * Training phase determines base expectations and messaging tone
 */
export type TrainingPhase = 
  | "onboarding"    // Weeks 1-3: habit building
  | "building"      // Progressive phase
  | "maintaining"   // Plateau/sustaining
  | "recovering";   // Active rest/rebuild

/**
 * Intensity determines exercise difficulty and volume
 */
export type IntensityTier = "light" | "moderate" | "challenging";

/**
 * Energy context from Fuel/Nutrition awareness
 */
export type EnergyContext = "depleted" | "low" | "normal" | "high";

/**
 * Decision output from evaluation
 */
export type TrainingDecision = "progress" | "maintain" | "scale_back";

/**
 * Sleep quality self-report (weekly check-in)
 */
export type SleepQuality = "poor" | "fair" | "good" | "great";

/**
 * Stress level self-report (weekly check-in)
 */
export type StressLevel = "low" | "moderate" | "high" | "overwhelming";

/**
 * Overall readiness self-report (weekly check-in)
 */
export type ReadinessLevel = "drag" | "okay" | "good" | "strong";

/**
 * Perceived effort after session
 */
export type PerceivedEffort = "too_easy" | "about_right" | "tough" | "too_hard";

// ============================================================================
// PROGRESSION RULES (MVP)
// ============================================================================

export const PROGRESSION_RULES = {
  ONBOARDING_WEEKS: 3,
  // Volume progression
  VOLUME_START: 1.0,
  VOLUME_INCREMENT: 0.1,  // +10% per progression (legacy)
  VOLUME_LADDER: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5],
  VOLUME_CAP: 1.5,
  VOLUME_CAP_LIGHT: 1.2,
  VOLUME_CAP_MODERATE: 1.3,
  VOLUME_RESET_ON_INTENSITY_CHANGE: true,  // Reset to 1.0 when intensity increases
  
  // Intensity progression (ordered)
  INTENSITY_PROGRESSION: ["light", "moderate", "challenging"] as const,
  
  // Duration (fixed for MVP)
  DURATION_ONBOARDING: 25,
  DURATION_BUILDING: 30,
  DURATION_MAINTAINING: 30,
  DURATION_RECOVERING: 20,
  DURATION_BASE_LIGHT: 25,
  DURATION_BASE_MODERATE: 30,
  DURATION_CHALLENGING_LADDER: [35, 40, 45, 50, 55, 60],
  
  // Session frequency (not auto-increased)
  FREQUENCY_MIN: 2,
  FREQUENCY_DEFAULT: 3,
  FREQUENCY_MAX: 4,  // Requires explicit opt-in
} as const;

// ============================================================================
// SESSION MODEL
// ============================================================================

export interface Session {
  id: string;
  date: Date;
  completed: boolean;
  
  // Session details
  framework: "hybrid_strength_conditioning";
  week_number: number;
  session_number: number;  // 1, 2, 3, etc. within week
  session_type: "A" | "B" | "C";  // Session variant
  
  // User feedback
  perceived_effort?: PerceivedEffort;
  pain_or_injury_flag?: string;  // Optional text note
  
  // Session config (what was prescribed)
  target_duration_minutes: number;
  intensity_tier: IntensityTier;
  is_minimum_viable: boolean;  // True if this is the fallback version
  exercises: Exercise[];
}

export interface Exercise {
  id?: string;
  name: string;
  category: "strength" | "cardio" | "mobility";
  sets: number;
  reps: number | string;  // e.g., "8-10" or "30 seconds"
  rest_seconds?: number;
  notes?: string;
  slot_id?: string;
  slot_tag?: string;
  movement_pattern?: string;
  equipment?: string[];
}

// ============================================================================
// WEEKLY CHECK-IN MODEL (Mind layer)
// ============================================================================

export interface WeeklyCheckIn {
  id: string;
  week_start_date: Date;
  
  sleep_quality?: SleepQuality;
  stress_level?: StressLevel;
  readiness_level?: ReadinessLevel;
  
  // Optional open text
  reflection_note?: string;
}

// ============================================================================
// ENERGY CHECK MODEL (Fuel layer)
// ============================================================================

export interface EnergyCheck {
  id: string;
  date: Date;
  
  energy_level: "low" | "normal" | "high";
  eating_enough: "not_sure" | "probably" | "yes" | "more_than_usual";
}

// ============================================================================
// PROGRAM CONFIG (what gets prescribed)
// ============================================================================

export interface ProgramConfig {
  sessions_per_week: number;
  intensity_tier: IntensityTier;
  session_duration_minutes: number;
  volume_multiplier: number;  // 1.0 = baseline, 1.1 = +10%, etc.
}

/**
 * Program constraints imposed by scale-backs or injury
 * These persist across phase transitions
 */
export interface ProgramConstraints {
  max_sessions_per_week: number;
  max_intensity_tier: IntensityTier;
  max_duration_minutes: number;
  max_volume_multiplier: number;
}

// ============================================================================
// TRAINING STATE MODEL
// ============================================================================

export interface TrainingState {
  // Identity (internal only, no user-facing account)
  local_user_id: string;  // UUID stored on device
  framework: "hybrid_strength_conditioning";
  
  // Current phase
  current_phase: TrainingPhase;
  week_number: number;  // Weeks in current phase (1-based)
  phase_start_date: Date;
  
  // Current program (persistent)
  program: ProgramConfig;
  
  // Program constraints (persistent, survive phase transitions)
  program_constraints: ProgramConstraints;
  
  // Rolling history (array of weekly session counts)
  weekly_session_history: number[];  // [week1_count, week2_count, ...]
  
  // Adherence tracking (computed from history)
  sessions_last_7_days: number;   // Last 1 week
  sessions_last_14_days: number;  // Last 2 weeks
  sessions_last_30_days: number;  // Last ~4 weeks
  
  // Calculated adherence rate (0.0 to 1.0, clamped)
  adherence_rate_2week: number;  // sessions_last_14_days / (target * 2)
  
  // Consecutive low adherence tracking
  low_adherence_weeks_in_row: number;  // Weeks with <50% adherence
  
  // Modulator inputs
  accumulated_fatigue_score: number;  // 0-10 scale (derived from check-ins)
  energy_context: EnergyContext;
  
  // Pain/injury tracking (SEPARATE from fatigue tracking)
  recent_pain_flags: string[];  // Last 2 weeks of pain reports
  has_active_injury: boolean;
  consecutive_pain_free_weeks: number;  // Tracks pain-free weeks for injury gate
  
  // State metadata
  last_session_date?: Date;
  days_since_last_session: number;

  // Split totals
  total_sessions_completed_raw: number;
  total_sessions_completed_planned: number;
  
  // Decision tracking
  last_decision: TrainingDecision;
  last_decision_reason: string;
  last_evaluation_date: Date;
  
  // Progression stability tracking (SEPARATE from pain tracking)
  weeks_since_last_scale_back: number | null;  // null if never scaled back
  consecutive_stable_weeks: number;  // Weeks with adherence>=75% AND fatigue<5
}

// ============================================================================
// EVALUATION OUTPUT
// ============================================================================

export interface EvaluationResult {
  decision: TrainingDecision;
  reason: string;
  
  // Recommended changes (if any)
  new_program_config?: Partial<ProgramConfig>;
  
  // Messaging
  user_message: string;
  coach_tone: "encouraging" | "steady" | "gentle" | "celebratory";
}
