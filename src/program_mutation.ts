import { TrainingState, TrainingDecision, ProgramConfig, ProgramConstraints, PROGRESSION_RULES, IntensityTier } from "./models";

export interface ProgramMutationResult {
  previous_program: ProgramConfig;
  new_program: ProgramConfig;
  change_description: string;
  change_cause: "scale_back" | "progression_duration" | "progression_volume" | "progression_intensity" | "none";
  is_intensity_reset: boolean;
  at_true_ceiling: boolean; // True if literally cannot progress further
}

function applyConstraints(
  program: ProgramConfig,
  constraints: ProgramConstraints
): ProgramConfig {
  
  const intensity_order: IntensityTier[] = ["light", "moderate", "challenging"];
  const max_intensity_index = intensity_order.indexOf(constraints.max_intensity_tier);
  const current_intensity_index = intensity_order.indexOf(program.intensity_tier);
  
  return {
    sessions_per_week: Math.min(program.sessions_per_week, constraints.max_sessions_per_week),
    intensity_tier: current_intensity_index <= max_intensity_index 
      ? program.intensity_tier 
      : constraints.max_intensity_tier,
    session_duration_minutes: Math.min(program.session_duration_minutes, constraints.max_duration_minutes),
    volume_multiplier: Math.min(program.volume_multiplier, constraints.max_volume_multiplier),
  };
}

export function applyDecisionToProgram(
  state: TrainingState,
  decision: TrainingDecision
): ProgramMutationResult {
  
  const previous = { ...state.program };
  
  if (decision === "maintain") {
    return {
      previous_program: previous,
      new_program: previous,
      change_description: "No program change",
      change_cause: "none",
      is_intensity_reset: false,
      at_true_ceiling: false,
    };
  }
  
  if (decision === "scale_back") {
    const result = applyScaleBack(state, previous);
    
    // Update constraints when scaling back
    state.program_constraints = {
      max_sessions_per_week: state.program.sessions_per_week,
      max_intensity_tier: state.program.intensity_tier,
      max_duration_minutes: state.program.session_duration_minutes,
      max_volume_multiplier: state.program.volume_multiplier,
    };
    
    return result;
  }
  
  if (decision === "progress") {
    const result = applyProgression(state, previous);
    
    // Relax constraints when progressing successfully
    if (programDidChange({ previous_program: previous, new_program: state.program, change_description: "", change_cause: "none", is_intensity_reset: false, at_true_ceiling: false })) {
      state.program_constraints = {
        max_sessions_per_week: Math.max(state.program_constraints.max_sessions_per_week, state.program.sessions_per_week),
        max_intensity_tier: state.program.intensity_tier,
        max_duration_minutes: Math.max(state.program_constraints.max_duration_minutes, state.program.session_duration_minutes),
        max_volume_multiplier: Math.max(state.program_constraints.max_volume_multiplier, state.program.volume_multiplier),
      };
    }
    
    return result;
  }
  
  return {
    previous_program: previous,
    new_program: previous,
    change_description: "Unknown decision",
    change_cause: "none",
    is_intensity_reset: false,
    at_true_ceiling: false,
  };
}

function applyScaleBack(
  state: TrainingState,
  previous: ProgramConfig
): ProgramMutationResult {
  
  const new_program: ProgramConfig = {
    sessions_per_week: 2,
    intensity_tier: "light",
    session_duration_minutes: PROGRESSION_RULES.DURATION_RECOVERING,
    volume_multiplier: PROGRESSION_RULES.VOLUME_START,
  };
  
  state.program = new_program;
  
  return {
    previous_program: previous,
    new_program,
    change_description: `Scaled back: ${previous.sessions_per_week}→2/week, ${previous.intensity_tier}→light, ${previous.session_duration_minutes}→${new_program.session_duration_minutes}min, ${previous.volume_multiplier.toFixed(1)}x→1.0x volume`,
    change_cause: "scale_back",
    is_intensity_reset: false,
    at_true_ceiling: false,
  };
}

function applyProgression(
  state: TrainingState,
  previous: ProgramConfig
): ProgramMutationResult {
  
  const current_duration = previous.session_duration_minutes;
  const current_intensity = previous.intensity_tier;
  const current_volume = previous.volume_multiplier;
  
  // Priority 0: Restore duration from recovery (20min → 25min)
  if (current_duration < 25 && current_duration < state.program_constraints.max_duration_minutes) {
    const new_duration = Math.min(25, state.program_constraints.max_duration_minutes);
    state.program.session_duration_minutes = new_duration;
    
    return {
      previous_program: previous,
      new_program: { ...state.program },
      change_description: `Duration increased: ${current_duration}min → ${new_duration}min (recovery progression)`,
      change_cause: "progression_duration",
      is_intensity_reset: false,
      at_true_ceiling: false,
    };
  }
  
  // Priority 1: Increase volume (safest)
  if (current_volume < PROGRESSION_RULES.VOLUME_CAP && current_volume < state.program_constraints.max_volume_multiplier) {
    const new_volume = Math.min(
      PROGRESSION_RULES.VOLUME_CAP,
      state.program_constraints.max_volume_multiplier,
      current_volume + PROGRESSION_RULES.VOLUME_INCREMENT
    );
    
    state.program.volume_multiplier = new_volume;
    
    return {
      previous_program: previous,
      new_program: { ...state.program },
      change_description: `Volume increased: ${current_volume.toFixed(1)}x → ${new_volume.toFixed(1)}x`,
      change_cause: "progression_volume",
      is_intensity_reset: false,
      at_true_ceiling: false,
    };
  }
  
  // Priority 2: Increase intensity (if allowed and at volume cap)
  const intensity_levels = PROGRESSION_RULES.INTENSITY_PROGRESSION;
  const current_index = intensity_levels.indexOf(current_intensity);
  const max_index = intensity_levels.indexOf(state.program_constraints.max_intensity_tier);
  
  if (current_index < intensity_levels.length - 1 && current_index < max_index) {
    const next_intensity = intensity_levels[current_index + 1];
    
    state.program.intensity_tier = next_intensity;
    
    if (PROGRESSION_RULES.VOLUME_RESET_ON_INTENSITY_CHANGE) {
      state.program.volume_multiplier = PROGRESSION_RULES.VOLUME_START;
      
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Intensity increased: ${current_intensity} → ${next_intensity}; volume reset to ${PROGRESSION_RULES.VOLUME_START.toFixed(1)}x for safety`,
        change_cause: "progression_intensity",
        is_intensity_reset: true,
        at_true_ceiling: false,
      };
    } else {
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Intensity increased: ${current_intensity} → ${next_intensity}`,
        change_cause: "progression_intensity",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }
  }
  
  // Check if at TRUE ceiling (challenging intensity + max volume + max duration)
  const at_true_ceiling = 
    current_intensity === "challenging" &&
    current_volume >= PROGRESSION_RULES.VOLUME_CAP &&
    current_duration >= 25;
  
  // At ceiling
  return {
    previous_program: previous,
    new_program: previous,
    change_description: at_true_ceiling 
      ? "At maximum training capacity (challenging intensity, max volume)"
      : "No progression available (blocked by constraints or phase limits)",
    change_cause: "none",
    is_intensity_reset: false,
    at_true_ceiling,
  };
}

export function programDidChange(result: ProgramMutationResult): boolean {
  const prev = result.previous_program;
  const next = result.new_program;
  
  return (
    prev.sessions_per_week !== next.sessions_per_week ||
    prev.intensity_tier !== next.intensity_tier ||
    prev.session_duration_minutes !== next.session_duration_minutes ||
    Math.abs(prev.volume_multiplier - next.volume_multiplier) > 0.01
  );
}

export function applyPhaseDurationTemplate(
  state: TrainingState,
  phase_duration: number
): void {
  const proposed = Math.min(phase_duration, state.program_constraints.max_duration_minutes);
  state.program.session_duration_minutes = proposed;
}