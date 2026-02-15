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
      const intensity_order: IntensityTier[] = ["light", "moderate", "challenging"];
      const existing_index = intensity_order.indexOf(state.program_constraints.max_intensity_tier);
      const current_index = intensity_order.indexOf(state.program.intensity_tier);
      state.program_constraints = {
        max_sessions_per_week: Math.max(state.program_constraints.max_sessions_per_week, state.program.sessions_per_week),
        max_intensity_tier: intensity_order[Math.max(existing_index, current_index)],
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
  
  const volume_ladder = PROGRESSION_RULES.VOLUME_LADDER.map((value) => value) as number[];
  const normalizeVolume = (value: number): number => {
    const rounded = Number(value.toFixed(1));
    if (volume_ladder.includes(rounded)) return rounded;
    let closest: number = volume_ladder[0];
    let minDiff = Math.abs(rounded - closest);
    for (const v of volume_ladder) {
      const diff = Math.abs(rounded - v);
      if (diff < minDiff) {
        closest = v;
        minDiff = diff;
      }
    }
    return closest;
  };
  const getNextVolume = (current: number, cap: number): number | null => {
    const normalized = normalizeVolume(current);
    const startIndex = volume_ladder.indexOf(normalized);
    if (startIndex === -1) return null;
    for (let i = startIndex + 1; i < volume_ladder.length; i += 1) {
      if (volume_ladder[i] <= cap) return volume_ladder[i];
    }
    return null;
  };
  const getChallengingVolumeCap = (duration: number): number => {
    if (duration >= 60) return 1.0;
    if (duration >= 55) return 1.0;
    if (duration >= 50) return 1.5;
    if (duration >= 45) return 1.4;
    if (duration >= 40) return 1.3;
    return 1.2;
  };
  const getChallengingNextDuration = (duration: number): number | null => {
    const ladder = PROGRESSION_RULES.DURATION_CHALLENGING_LADDER.map((value) => value) as number[];
    const index = ladder.indexOf(duration);
    if (index === -1) {
      const next = ladder.find((value) => value > duration);
      return next ?? null;
    }
    return ladder[index + 1] ?? null;
  };

  const current_duration = previous.session_duration_minutes;
  const current_intensity = previous.intensity_tier;
  const current_volume = normalizeVolume(previous.volume_multiplier);

  if (current_intensity === "light") {
    const baseDuration = PROGRESSION_RULES.DURATION_BASE_LIGHT;
    if (current_duration < baseDuration && current_duration < state.program_constraints.max_duration_minutes) {
      const new_duration = Math.min(baseDuration, state.program_constraints.max_duration_minutes);
      state.program.session_duration_minutes = new_duration;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Duration increased: ${current_duration}min → ${new_duration}min`,
        change_cause: "progression_duration",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }

    const cap = Math.min(PROGRESSION_RULES.VOLUME_CAP_LIGHT, state.program_constraints.max_volume_multiplier);
    const nextVolume = getNextVolume(current_volume, cap);
    if (nextVolume) {
      state.program.volume_multiplier = nextVolume;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Volume increased: ${current_volume.toFixed(1)}x → ${nextVolume.toFixed(1)}x`,
        change_cause: "progression_volume",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }

    const intensity_levels = PROGRESSION_RULES.INTENSITY_PROGRESSION;
    const current_index = intensity_levels.indexOf(current_intensity);
    const max_index = intensity_levels.indexOf(state.program_constraints.max_intensity_tier);
    if (current_index < intensity_levels.length - 1 && current_index < max_index) {
      const next_intensity = intensity_levels[current_index + 1];
      state.program.intensity_tier = next_intensity;
      state.program.session_duration_minutes = PROGRESSION_RULES.DURATION_BASE_MODERATE;
      state.program.volume_multiplier = PROGRESSION_RULES.VOLUME_START;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Intensity increased: ${current_intensity} → ${next_intensity}; duration set to ${PROGRESSION_RULES.DURATION_BASE_MODERATE}min; volume reset to ${PROGRESSION_RULES.VOLUME_START.toFixed(1)}x`,
        change_cause: "progression_intensity",
        is_intensity_reset: true,
        at_true_ceiling: false,
      };
    }
  }

  if (current_intensity === "moderate") {
    const baseDuration = PROGRESSION_RULES.DURATION_BASE_MODERATE;
    if (current_duration < baseDuration && current_duration < state.program_constraints.max_duration_minutes) {
      const new_duration = Math.min(baseDuration, state.program_constraints.max_duration_minutes);
      state.program.session_duration_minutes = new_duration;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Duration increased: ${current_duration}min → ${new_duration}min`,
        change_cause: "progression_duration",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }

    const cap = Math.min(PROGRESSION_RULES.VOLUME_CAP_MODERATE, state.program_constraints.max_volume_multiplier);
    const nextVolume = getNextVolume(current_volume, cap);
    if (nextVolume) {
      state.program.volume_multiplier = nextVolume;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Volume increased: ${current_volume.toFixed(1)}x → ${nextVolume.toFixed(1)}x`,
        change_cause: "progression_volume",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }

    const intensity_levels = PROGRESSION_RULES.INTENSITY_PROGRESSION;
    const current_index = intensity_levels.indexOf(current_intensity);
    const max_index = intensity_levels.indexOf(state.program_constraints.max_intensity_tier);
    if (current_index < intensity_levels.length - 1 && current_index < max_index) {
      const next_intensity = intensity_levels[current_index + 1];
      state.program.intensity_tier = next_intensity;
      state.program.session_duration_minutes = PROGRESSION_RULES.DURATION_CHALLENGING_LADDER[0];
      state.program.volume_multiplier = PROGRESSION_RULES.VOLUME_START;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Intensity increased: ${current_intensity} → ${next_intensity}; duration set to ${PROGRESSION_RULES.DURATION_CHALLENGING_LADDER[0]}min; volume reset to ${PROGRESSION_RULES.VOLUME_START.toFixed(1)}x`,
        change_cause: "progression_intensity",
        is_intensity_reset: true,
        at_true_ceiling: false,
      };
    }
  }

  if (current_intensity === "challenging") {
    const duration = current_duration;
    const cap = Math.min(getChallengingVolumeCap(duration), state.program_constraints.max_volume_multiplier);
    const nextVolume = getNextVolume(current_volume, cap);
    if (nextVolume) {
      state.program.volume_multiplier = nextVolume;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Volume increased: ${current_volume.toFixed(1)}x → ${nextVolume.toFixed(1)}x`,
        change_cause: "progression_volume",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }

    const nextDuration = getChallengingNextDuration(duration);
    if (nextDuration && nextDuration <= state.program_constraints.max_duration_minutes) {
      state.program.session_duration_minutes = nextDuration;
      state.program.volume_multiplier = PROGRESSION_RULES.VOLUME_START;
      return {
        previous_program: previous,
        new_program: { ...state.program },
        change_description: `Duration increased: ${duration}min → ${nextDuration}min; volume reset to ${PROGRESSION_RULES.VOLUME_START.toFixed(1)}x`,
        change_cause: "progression_duration",
        is_intensity_reset: false,
        at_true_ceiling: false,
      };
    }
  }

  const at_true_ceiling =
    current_intensity === "challenging" &&
    current_duration >= 60 &&
    current_volume <= 1.0;
  
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
    prev.volume_multiplier !== next.volume_multiplier
  );
}

export function applyPhaseDurationTemplate(
  state: TrainingState,
  phase_duration: number
): void {
  const proposed = Math.min(phase_duration, state.program_constraints.max_duration_minutes);
  state.program.session_duration_minutes = proposed;
}
