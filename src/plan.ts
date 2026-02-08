import { TrainingState, TrainingDecision, TrainingPhase, ProgramConfig, Session, Exercise } from "./models";
import { evaluateTrainingDecision } from "./evaluator";
import { buildStrengthPool, buildCardioPool } from "./services/session_generator";

export interface WeeklyPlan {
  week_start_iso: string;
  phase: TrainingPhase;
  phase_week: number;

  decision: TrainingDecision;
  reason: string;
  coach_tone: "encouraging" | "steady" | "gentle" | "celebratory";
  coaching_message: string;

  program: ProgramConfig; // the *current* config to prescribe this week

  sessions: Session[]; // count must match program.sessions_per_week
  minimum_viable_sessions: Session[]; // same count, shorter duration or reduced volume

  safety_notes: string[]; // may be empty, used for injury/fatigue/underfueling flags
  program_change_description?: string; // Added for transparency
}

export type StrengthTemplateId =
  | "full_body"
  | "upper"
  | "lower"
  | "strength_conditioning";

type StrengthTag = "lower" | "hinge" | "push" | "pull" | "arms" | "core" | "unilateral";
export type SessionStyle =
  | "strength_focus"
  | "cardio_focus"
  | "balanced"
  | "recovery_mobility";

/**
 * Generate a complete weekly plan - single source of truth for UI
 * Uses state.program as-is (mutations happen AFTER this via applyDecisionToProgram)
 */
export function generateWeeklyPlan(
  state: TrainingState,
  weekStart: Date,
  options?: {
    strength_template?: StrengthTemplateId;
    session_style?: SessionStyle;
    recent_exercise_ids?: string[];
    equipment_filter?: string[];
    log_selection_fallbacks?: boolean;
  }
): WeeklyPlan {
  
  // Evaluate training decision (does NOT mutate program)
  const evaluation = evaluateTrainingDecision(state);
  
  // Collect safety notes
  const safety_notes: string[] = [];
  
  if (state.has_active_injury) {
    safety_notes.push("Active injury reported - training at reduced intensity");
  }
  
  if (state.recent_pain_flags.length > 0) {
    safety_notes.push(`Recent pain: ${state.recent_pain_flags.join("; ")}`);
  }
  
  if (state.accumulated_fatigue_score >= 5) {
    safety_notes.push(`Fatigue ${state.accumulated_fatigue_score.toFixed(1)}/10 - recovery priority`);
  }
  
  if (state.energy_context === "depleted" || state.energy_context === "low") {
    safety_notes.push(`Energy is ${state.energy_context} - fuel & rest needed`);
  }
  
  // Generate sessions based on CURRENT program (before mutation)
  const sessions = generateSessions(
    state,
    weekStart,
    false,
    options?.strength_template,
    options?.session_style,
    options?.recent_exercise_ids ?? [],
    options?.equipment_filter ?? [],
    options?.log_selection_fallbacks ?? false
  );
  const minimum_viable_sessions = generateSessions(
    state,
    weekStart,
    true,
    options?.strength_template,
    options?.session_style,
    options?.recent_exercise_ids ?? [],
    options?.equipment_filter ?? [],
    options?.log_selection_fallbacks ?? false
  );
  
  // Validate counts match program
  if (sessions.length !== state.program.sessions_per_week) {
    throw new Error(
      `Session count mismatch: generated ${sessions.length} but program requires ${state.program.sessions_per_week}`
    );
  }
  
  if (minimum_viable_sessions.length !== state.program.sessions_per_week) {
    throw new Error(
      `MV session count mismatch: generated ${minimum_viable_sessions.length} but program requires ${state.program.sessions_per_week}`
    );
  }
  
  return {
    week_start_iso: weekStart.toISOString().split('T')[0],
    phase: state.current_phase,
    phase_week: state.week_number,
    decision: evaluation.decision,
    reason: evaluation.reason,
    coach_tone: evaluation.coach_tone,
    coaching_message: evaluation.user_message,
    program: { ...state.program }, // Clone current program
    sessions,
    minimum_viable_sessions,
    safety_notes,
  };
}

/**
 * Generate sessions for the week based on program config
 */
function generateSessions(
  state: TrainingState,
  weekStart: Date,
  isMinimumViable: boolean,
  strengthTemplate?: StrengthTemplateId,
  sessionStyle?: SessionStyle,
  recentExerciseIds?: string[],
  equipmentFilter?: string[],
  logSelectionFallbacks?: boolean
): Session[] {
  
  const sessions: Session[] = [];
  const session_types: Array<"A" | "B" | "C"> = 
    state.program.sessions_per_week === 2 ? ["A", "B"] :
    state.program.sessions_per_week === 3 ? ["A", "B", "C"] :
    ["A", "B", "C", "A"]; // 4 sessions = A, B, C, A
  
  for (let i = 0; i < session_types.length; i++) {
    const session_type = session_types[i];
    const session_date = new Date(weekStart);
    session_date.setDate(session_date.getDate() + (i * 2)); // Space sessions 2 days apart
    
    const date_str = session_date.toISOString().split('T')[0];
    
    sessions.push({
      id: `${date_str}-${session_type}`,
      date: session_date,
      completed: false,
      framework: "hybrid_strength_conditioning",
      week_number: state.week_number,
      session_number: i + 1,
      session_type,
      perceived_effort: undefined,
      pain_or_injury_flag: undefined,
      target_duration_minutes: isMinimumViable 
        ? Math.floor(state.program.session_duration_minutes * 0.6)
        : state.program.session_duration_minutes,
      intensity_tier: state.program.intensity_tier,
      is_minimum_viable: isMinimumViable,
      exercises: generateExercisesForSession(
        session_type,
        state.program,
        isMinimumViable,
        strengthTemplate,
        sessionStyle,
        {
          recentExerciseIds: recentExerciseIds ?? [],
          equipmentFilter: equipmentFilter ?? [],
          seedBase: `${state.local_user_id}:${state.week_number}:${session_type}:${isMinimumViable ? "mv" : "full"}`,
          logSelectionFallbacks: logSelectionFallbacks ?? false,
        }
      ),
    });
  }
  
  return sessions;
}

export function generateExercisesForSession(
  session_type: "A" | "B" | "C",
  program: ProgramConfig,
  isMinimumViable: boolean,
  strengthTemplate: StrengthTemplateId = "full_body",
  sessionStyle: SessionStyle = "balanced",
  options?: {
    recentExerciseIds?: string[];
    equipmentFilter?: string[];
    seedBase?: string;
    logSelectionFallbacks?: boolean;
  }
): Exercise[] {
  
  const intensity = program.intensity_tier;
  const volume_mult = isMinimumViable ? 0.5 : program.volume_multiplier;
  
  // Warmup (always included)
  const warmup: Exercise[] = [
    {
      name: "Cat-Cow Stretch",
      category: "mobility",
      sets: 1,
      reps: "10 reps",
      notes: "Gentle spinal mobility",
    },
    {
      name: "Arm Circles",
      category: "mobility",
      sets: 1,
      reps: "10 forward, 10 back",
    },
    {
      name: "Leg Swings",
      category: "mobility",
      sets: 1,
      reps: "10 each leg",
    },
  ];
  
  const exercises: Exercise[] = [...warmup];
  
  const strength_pool = buildStrengthPool(intensity);
  const cardio_pool = buildCardioPool(intensity);
  const recentIds = new Set(options?.recentExerciseIds ?? []);
  const equipmentFilter = options?.equipmentFilter ?? [];

  const strengthSelection = buildStrengthTemplateExercises(
    strength_pool,
    strengthTemplate,
    sessionStyle,
    intensity,
    volume_mult,
    isMinimumViable,
    {
      recentIds,
      equipmentFilter,
      seedBase: options?.seedBase ?? `${session_type}:${intensity}`,
      sessionSlotPrefix: `${session_type}-${isMinimumViable ? "mv" : "full"}`,
      logSelectionFallbacks: options?.logSelectionFallbacks ?? false,
    }
  );
  exercises.push(...strengthSelection.exercises);

  const cardioIndex = session_type === "A" ? 0 : session_type === "B" ? 1 : 2;
  const cardioCount = sessionStyle === "cardio_focus" && !isMinimumViable ? 2 : 1;
  for (let i = 0; i < cardioCount; i++) {
    const cardio = pickCardioExercise(
      cardio_pool,
      recentIds,
      equipmentFilter,
      `${options?.seedBase ?? session_type}-cardio-${i}`
    );
    exercises.push({
      id: cardio.id,
      slot_id: `${session_type}-cardio-${i + 1}`,
      slot_tag: "cardio",
      name: cardio.name,
      category: "cardio",
      sets: isMinimumViable ? 1 : 2,
      reps: cardio.reps,
      rest_seconds: cardio.rest_seconds,
      movement_pattern: cardio.movement_pattern,
      equipment: cardio.equipment,
    });
  }
  
  return exercises;
}

function buildStrengthTemplateExercises(
  strength_pool: Exercise[],
  template: StrengthTemplateId,
  sessionStyle: SessionStyle,
  intensity: ProgramConfig["intensity_tier"],
  volume_mult: number,
  isMinimumViable: boolean,
  options: {
    recentIds: Set<string>;
    equipmentFilter: string[];
    seedBase: string;
    sessionSlotPrefix: string;
    logSelectionFallbacks: boolean;
  }
): { exercises: Exercise[]; fallbackCount: number } {
  const tags = getTemplateSlots(template, sessionStyle, intensity, isMinimumViable);
  const used = new Set<string>();
  const exercises: Exercise[] = [];
  let fallbackCount = 0;

  for (let index = 0; index < tags.length; index++) {
    const tag = tags[index];
    const seed = `${options.seedBase}:${options.sessionSlotPrefix}:${index + 1}:${tag}`;
    const selection = selectStrengthExercise(
      strength_pool,
      tag,
      used,
      options.recentIds,
      options.equipmentFilter,
      seed
    );
    if (selection.exercise) {
      const exercise = scaleStrengthExercise(selection.exercise, volume_mult);
      exercises.push({
        ...exercise,
        slot_id: `${options.sessionSlotPrefix}-slot-${index + 1}`,
        slot_tag: tag,
        id: selection.exercise.id,
        movement_pattern: selection.exercise.movement_pattern,
        equipment: selection.exercise.equipment,
      });
      used.add(selection.exercise.id ?? selection.exercise.name);
    }
    if (selection.selection_fallback) {
      fallbackCount += 1;
    }
  }

  if (fallbackCount > 0 && options.logSelectionFallbacks) {
    console.warn("Selection fallback used", {
      seedBase: options.seedBase,
      session: options.sessionSlotPrefix,
      fallbackCount,
    });
  }

  return { exercises, fallbackCount };
}

function getTemplateSlots(
  template: StrengthTemplateId,
  sessionStyle: SessionStyle,
  intensity: ProgramConfig["intensity_tier"],
  isMinimumViable: boolean
): StrengthTag[] {
  const addAccessory = !isMinimumViable && intensity !== "light";

  if (sessionStyle === "cardio_focus") {
    return isMinimumViable ? ["core"] : ["lower", "core"];
  }

  if (sessionStyle === "recovery_mobility") {
    return isMinimumViable ? ["core"] : ["core", "lower"];
  }

  if (template === "upper") {
    const base: StrengthTag[] = isMinimumViable
      ? ["push", "pull", "core"]
      : ["push", "pull", "push", "pull"];
    if (addAccessory || sessionStyle === "strength_focus") base.push("arms");
    return base;
  }

  if (template === "lower") {
    const base: StrengthTag[] = isMinimumViable
      ? ["lower", "hinge", "core"]
      : ["lower", "hinge", "unilateral", "core"];
    if (addAccessory || sessionStyle === "strength_focus") base.push("lower");
    return base;
  }

  if (template === "strength_conditioning") {
    return isMinimumViable
      ? ["lower", "core"]
      : ["lower", "push", "core"];
  }

  const base: StrengthTag[] = isMinimumViable
    ? ["lower", "push", "core"]
    : ["lower", "push", "pull", "core"];
  if (addAccessory || sessionStyle === "strength_focus") base.push("arms");
  return base;
}

function selectStrengthExercise(
  pool: Exercise[],
  tag: StrengthTag,
  used: Set<string>,
  recentIds: Set<string>,
  equipmentFilter: string[],
  seed: string
): { exercise?: Exercise; selection_fallback: boolean } {
  const rng = seededRandom(seed);
  const eligible = pool.filter((exercise) => {
    const id = exercise.id ?? exercise.name;
    if (used.has(id)) return false;
    if (!matchesTag(exercise, tag)) return false;
    if (equipmentFilter.length > 0 && !exercise.equipment?.some((eq) => equipmentFilter.includes(eq))) {
      return false;
    }
    return !recentIds.has(id);
  });

  if (eligible.length > 0) {
    return { exercise: pickFromPool(eligible, rng), selection_fallback: false };
  }

  const allowRepeats = pool.filter((exercise) => {
    const id = exercise.id ?? exercise.name;
    if (used.has(id)) return false;
    if (!matchesTag(exercise, tag)) return false;
    if (equipmentFilter.length > 0 && !exercise.equipment?.some((eq) => equipmentFilter.includes(eq))) {
      return false;
    }
    return true;
  });

  if (allowRepeats.length > 0) {
    return { exercise: pickFromPool(allowRepeats, rng), selection_fallback: true };
  }

  const relaxedTag = pool.filter((exercise) => {
    const id = exercise.id ?? exercise.name;
    if (used.has(id)) return false;
    if (equipmentFilter.length > 0 && !exercise.equipment?.some((eq) => equipmentFilter.includes(eq))) {
      return false;
    }
    return !recentIds.has(id);
  });

  if (relaxedTag.length > 0) {
    return { exercise: pickFromPool(relaxedTag, rng), selection_fallback: true };
  }

  const finalPool = pool.filter((exercise) => {
    const id = exercise.id ?? exercise.name;
    if (used.has(id)) return false;
    return true;
  });

  if (finalPool.length > 0) {
    return { exercise: pickFromPool(finalPool, rng), selection_fallback: true };
  }

  return { selection_fallback: true };
}

function pickCardioExercise(
  pool: Exercise[],
  recentIds: Set<string>,
  equipmentFilter: string[],
  seed: string
): Exercise {
  const rng = seededRandom(seed);
  const eligible = pool.filter((exercise) => {
    const id = exercise.id ?? exercise.name;
    if (equipmentFilter.length > 0 && !exercise.equipment?.some((eq) => equipmentFilter.includes(eq))) {
      return false;
    }
    return !recentIds.has(id);
  });
  if (eligible.length > 0) {
    return pickFromPool(eligible, rng);
  }
  return pickFromPool(pool, rng);
}

function matchesTag(exercise: Exercise, tag: StrengthTag): boolean {
  const pattern = exercise.movement_pattern ?? "";
  if (tag === "lower") return pattern === "squat" || pattern === "unilateral";
  if (tag === "hinge") return pattern === "hinge";
  if (tag === "push") return pattern === "push";
  if (tag === "pull") return pattern === "pull";
  if (tag === "arms") return pattern === "arms";
  if (tag === "core") return pattern === "core";
  if (tag === "unilateral") return pattern === "unilateral";
  return false;
}

function pickFromPool(pool: Exercise[], rng: () => number): Exercise {
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Scale a strength exercise by volume multiplier
 */
function scaleStrengthExercise(
  base: Exercise,
  volume_mult: number
): Exercise {
  const scaled_sets = Math.max(1, Math.round(base.sets * volume_mult));
  
  return {
    id: base.id,
    name: base.name,
    category: "strength",
    sets: scaled_sets,
    reps: base.reps,
    rest_seconds: base.rest_seconds,
    notes: volume_mult < 0.6 ? "Reduced volume for recovery" : undefined,
    movement_pattern: base.movement_pattern,
    equipment: base.equipment,
  };
}
