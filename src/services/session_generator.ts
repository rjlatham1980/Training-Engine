import { ProgramConfig, IntensityTier, Exercise } from "../models";

export interface GeneratedSession {
  session_type: "A" | "B" | "C";
  target_duration_minutes: number;
  intensity_tier: IntensityTier;
  is_minimum_viable: boolean;
  exercises: Exercise[];
}

export interface WeeklyProgram {
  week_number: number;
  sessions: GeneratedSession[];
  minimum_viable_sessions: GeneratedSession[];
}

/**
 * Exercise database for bodyweight hybrid training
 */
export type Equipment =
  | "bodyweight"
  | "dumbbell"
  | "band"
  | "machine"
  | "barbell"
  | "kettlebell";

export type MovementPattern =
  | "squat"
  | "hinge"
  | "push"
  | "pull"
  | "core"
  | "unilateral"
  | "arms"
  | "conditioning";

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: "strength" | "cardio" | "mobility";
  movement_pattern: MovementPattern;
  equipment: Equipment[];
  intensity_tiers: IntensityTier[];
  constraints?: string[];
  sets_by_intensity?: Record<IntensityTier, number>;
  reps_by_intensity?: Record<IntensityTier, string>;
  rest_by_intensity?: Record<IntensityTier, number>;
  duration_by_intensity?: Record<IntensityTier, string>;
}

const STRENGTH_DEFINITIONS: ExerciseDefinition[] = [
  {
    id: "bw_squat",
    name: "Bodyweight Squat",
    category: "strength",
    movement_pattern: "squat",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10", moderate: "10-12", challenging: "8-10" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 90 },
  },
  {
    id: "incline_pushup",
    name: "Incline Push-up",
    category: "strength",
    movement_pattern: "push",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "6-8", moderate: "8-10", challenging: "10-12" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 75 },
  },
  {
    id: "pushup",
    name: "Push-up",
    category: "strength",
    movement_pattern: "push",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "6-8", moderate: "8-10", challenging: "10-12" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 75 },
  },
  {
    id: "pike_pushup",
    name: "Pike Push-up",
    category: "strength",
    movement_pattern: "push",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 2, challenging: 3 },
    reps_by_intensity: { light: "6-8", moderate: "6-8", challenging: "8-10" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 75 },
  },
  {
    id: "glute_bridge",
    name: "Glute Bridge",
    category: "strength",
    movement_pattern: "hinge",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "10-12", moderate: "8-10 each", challenging: "8-10 each" },
    rest_by_intensity: { light: 45, moderate: 45, challenging: 60 },
  },
  {
    id: "single_leg_deadlift",
    name: "Single-leg Deadlift",
    category: "strength",
    movement_pattern: "hinge",
    equipment: ["bodyweight", "dumbbell"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10 each", moderate: "8-10 each", challenging: "8-10 each" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 75 },
  },
  {
    id: "reverse_lunge",
    name: "Reverse Lunge",
    category: "strength",
    movement_pattern: "unilateral",
    equipment: ["bodyweight", "dumbbell"],
    intensity_tiers: ["light", "moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10 each leg", moderate: "8-10 each leg", challenging: "8-10 each leg" },
    rest_by_intensity: { light: 60, moderate: 60, challenging: 75 },
  },
  {
    id: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    category: "strength",
    movement_pattern: "unilateral",
    equipment: ["bodyweight", "dumbbell"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10 each leg", moderate: "8-10 each leg", challenging: "8-10 each leg" },
    rest_by_intensity: { light: 60, moderate: 75, challenging: 75 },
  },
  {
    id: "row_band",
    name: "Band Row",
    category: "strength",
    movement_pattern: "pull",
    equipment: ["band"],
    intensity_tiers: ["light", "moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "10-12", moderate: "10-12", challenging: "8-10" },
    rest_by_intensity: { light: 45, moderate: 60, challenging: 60 },
  },
  {
    id: "towel_row",
    name: "Towel Row",
    category: "strength",
    movement_pattern: "pull",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10", moderate: "8-10", challenging: "8-10" },
    rest_by_intensity: { light: 45, moderate: 60, challenging: 60 },
  },
  {
    id: "biceps_curl_band",
    name: "Band Biceps Curl",
    category: "strength",
    movement_pattern: "arms",
    equipment: ["band"],
    intensity_tiers: ["light", "moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "10-12", moderate: "10-12", challenging: "8-10" },
    rest_by_intensity: { light: 45, moderate: 45, challenging: 60 },
  },
  {
    id: "triceps_dip",
    name: "Triceps Dip (chair)",
    category: "strength",
    movement_pattern: "arms",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 3, challenging: 3 },
    reps_by_intensity: { light: "8-10", moderate: "8-10", challenging: "10-12" },
    rest_by_intensity: { light: 45, moderate: 60, challenging: 60 },
  },
  {
    id: "plank_hold",
    name: "Plank Hold",
    category: "strength",
    movement_pattern: "core",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 2, challenging: 2 },
    reps_by_intensity: { light: "15-20 seconds", moderate: "30-40 seconds", challenging: "45-60 seconds" },
    rest_by_intensity: { light: 45, moderate: 45, challenging: 45 },
  },
  {
    id: "side_plank",
    name: "Side Plank",
    category: "strength",
    movement_pattern: "core",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    sets_by_intensity: { light: 2, moderate: 2, challenging: 2 },
    reps_by_intensity: { light: "20 seconds", moderate: "30-40 seconds each", challenging: "45-60 seconds each" },
    rest_by_intensity: { light: 45, moderate: 45, challenging: 45 },
  },
];

const CARDIO_DEFINITIONS: ExerciseDefinition[] = [
  {
    id: "march_in_place",
    name: "Marching in Place",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["light"],
    duration_by_intensity: { light: "2-3 minutes", moderate: "2 minutes", challenging: "90 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 30 },
  },
  {
    id: "step_ups",
    name: "Step-ups (low step)",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate"],
    duration_by_intensity: { light: "2 minutes", moderate: "2 minutes", challenging: "90 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 30 },
  },
  {
    id: "easy_jumping_jacks",
    name: "Easy Jumping Jacks",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["light"],
    duration_by_intensity: { light: "1 minute", moderate: "1 minute", challenging: "45 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 30 },
  },
  {
    id: "jumping_jacks",
    name: "Jumping Jacks",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate"],
    duration_by_intensity: { light: "1 minute", moderate: "1 minute", challenging: "45 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 30 },
  },
  {
    id: "high_knees",
    name: "High Knees",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    duration_by_intensity: { light: "30 seconds", moderate: "30-45 seconds", challenging: "45 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 45 },
  },
  {
    id: "mountain_climbers",
    name: "Mountain Climbers",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["moderate", "challenging"],
    duration_by_intensity: { light: "30 seconds", moderate: "30-45 seconds", challenging: "45 seconds" },
    rest_by_intensity: { light: 30, moderate: 45, challenging: 45 },
  },
  {
    id: "burpees",
    name: "Burpees",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["challenging"],
    duration_by_intensity: { light: "30 seconds", moderate: "30-45 seconds", challenging: "30-45 seconds" },
    rest_by_intensity: { light: 45, moderate: 60, challenging: 60 },
  },
  {
    id: "jump_lunges",
    name: "Jump Lunges",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["challenging"],
    duration_by_intensity: { light: "30 seconds", moderate: "30-45 seconds", challenging: "30-45 seconds" },
    rest_by_intensity: { light: 45, moderate: 60, challenging: 60 },
  },
  {
    id: "shadow_boxing",
    name: "Shadow Boxing",
    category: "cardio",
    movement_pattern: "conditioning",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
    duration_by_intensity: { light: "2 minutes", moderate: "90 seconds", challenging: "60 seconds" },
    rest_by_intensity: { light: 30, moderate: 30, challenging: 45 },
  },
];

const MOBILITY_DEFINITIONS: ExerciseDefinition[] = [
  {
    id: "cat_cow",
    name: "Cat-Cow Stretch",
    category: "mobility",
    movement_pattern: "core",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
  },
  {
    id: "hip_circles",
    name: "Hip Circles",
    category: "mobility",
    movement_pattern: "hinge",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
  },
  {
    id: "arm_circles",
    name: "Arm Circles",
    category: "mobility",
    movement_pattern: "push",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
  },
  {
    id: "leg_swings",
    name: "Leg Swings",
    category: "mobility",
    movement_pattern: "unilateral",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
  },
  {
    id: "thoracic_rotations",
    name: "Thoracic Rotations",
    category: "mobility",
    movement_pattern: "core",
    equipment: ["bodyweight"],
    intensity_tiers: ["light", "moderate", "challenging"],
  },
];

export const EXERCISE_LIBRARY = {
  strength: {
    light: STRENGTH_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("light")),
    moderate: STRENGTH_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("moderate")),
    challenging: STRENGTH_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("challenging")),
  },
  cardio: {
    light: CARDIO_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("light")),
    moderate: CARDIO_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("moderate")),
    challenging: CARDIO_DEFINITIONS.filter((ex) => ex.intensity_tiers.includes("challenging")),
  },
  mobility: MOBILITY_DEFINITIONS,
};

export function buildStrengthPool(intensity: IntensityTier): Exercise[] {
  return EXERCISE_LIBRARY.strength[intensity].map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: "strength",
    sets: exercise.sets_by_intensity?.[intensity] ?? 2,
    reps: exercise.reps_by_intensity?.[intensity] ?? "8-10",
    rest_seconds: exercise.rest_by_intensity?.[intensity] ?? 60,
    movement_pattern: exercise.movement_pattern,
    equipment: exercise.equipment,
  }));
}

export function buildCardioPool(intensity: IntensityTier): Exercise[] {
  return EXERCISE_LIBRARY.cardio[intensity].map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: "cardio",
    sets: 1,
    reps: exercise.duration_by_intensity?.[intensity] ?? "1 minute",
    rest_seconds: exercise.rest_by_intensity?.[intensity] ?? 30,
    movement_pattern: exercise.movement_pattern,
    equipment: exercise.equipment,
  }));
}

export function getExerciseById(id: string, intensity: IntensityTier): Exercise | null {
  const all = [...STRENGTH_DEFINITIONS, ...CARDIO_DEFINITIONS, ...MOBILITY_DEFINITIONS];
  const match = all.find((exercise) => exercise.id === id);
  if (!match) return null;
  if (match.category === "strength") {
    return {
      id: match.id,
      name: match.name,
      category: "strength",
      sets: match.sets_by_intensity?.[intensity] ?? 2,
      reps: match.reps_by_intensity?.[intensity] ?? "8-10",
      rest_seconds: match.rest_by_intensity?.[intensity] ?? 60,
      movement_pattern: match.movement_pattern,
      equipment: match.equipment,
    };
  }
  if (match.category === "cardio") {
    return {
      id: match.id,
      name: match.name,
      category: "cardio",
      sets: 1,
      reps: match.duration_by_intensity?.[intensity] ?? "1 minute",
      rest_seconds: match.rest_by_intensity?.[intensity] ?? 30,
      movement_pattern: match.movement_pattern,
      equipment: match.equipment,
    };
  }
  return {
    id: match.id,
    name: match.name,
    category: "mobility",
    sets: 1,
    reps: "10 reps",
    movement_pattern: match.movement_pattern,
    equipment: match.equipment,
  };
}

/**
 * Scale exercise volume by multiplier
 */
function scaleExercise(
  base: { name: string; sets: number; reps: string | number; rest_seconds?: number },
  volume_mult: number,
  category: "strength" | "cardio"
): Exercise {
  if (category === "strength") {
    // Scale sets (round to nearest integer, min 1)
    const scaled_sets = Math.max(1, Math.round(base.sets * volume_mult));
    return {
      name: base.name,
      category: "strength",
      sets: scaled_sets,
      reps: base.reps,
      rest_seconds: base.rest_seconds ?? 0,
    };
  } else {
    // For cardio, scale duration
    return {
      name: base.name,
      category: "cardio",
      sets: 1,
      reps: base.reps,
      rest_seconds: base.rest_seconds ?? 0,
    };
  }
}

/**
 * Generate warmup exercises
 */
function generateWarmup(): Exercise[] {
  return [
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
}

/**
 * Generate Session A (Lower body focus + cardio)
 */
function generateSessionA(
  config: ProgramConfig,
  is_minimum: boolean = false
): GeneratedSession {
  const intensity = config.intensity_tier;
  const volume_mult = is_minimum ? 0.5 : config.volume_multiplier;
  
  const warmup = generateWarmup();
  
  // Select exercises based on intensity
  const strength_pool = buildStrengthPool(intensity);
  const cardio_pool = buildCardioPool(intensity);
  
  // Lower body exercises (2-3)
  const exercises: Exercise[] = [
    ...warmup,
    scaleExercise(strength_pool[0], volume_mult, "strength"), // Squat variant
    scaleExercise(strength_pool[2], volume_mult, "strength"), // Bridge/lunge variant
  ];
  
  if (!is_minimum) {
    exercises.push(scaleExercise(strength_pool[5], volume_mult, "strength")); // Core
  }
  
  // Cardio finisher
  exercises.push({
    name: cardio_pool[0].name,
    category: "cardio",
    sets: is_minimum ? 1 : 2,
    reps: cardio_pool[0].reps,
    rest_seconds: cardio_pool[0].rest_seconds,
  });
  
  return {
    session_type: "A",
    target_duration_minutes: is_minimum 
      ? Math.floor(config.session_duration_minutes * 0.6) 
      : config.session_duration_minutes,
    intensity_tier: intensity,
    is_minimum_viable: is_minimum,
    exercises,
  };
}

/**
 * Generate Session B (Upper body focus + cardio)
 */
function generateSessionB(
  config: ProgramConfig,
  is_minimum: boolean = false
): GeneratedSession {
  const intensity = config.intensity_tier;
  const volume_mult = is_minimum ? 0.5 : config.volume_multiplier;
  
  const warmup = generateWarmup();
  
  const strength_pool = buildStrengthPool(intensity);
  const cardio_pool = buildCardioPool(intensity);
  
  // Upper body exercises (2-3)
  const exercises: Exercise[] = [
    ...warmup,
    scaleExercise(strength_pool[1], volume_mult, "strength"), // Push-up variant
    scaleExercise(strength_pool[3], volume_mult, "strength"), // Secondary push/pike
  ];
  
  if (!is_minimum) {
    exercises.push(scaleExercise(strength_pool[5], volume_mult, "strength")); // Core
  }
  
  // Cardio finisher
  exercises.push({
    name: cardio_pool[1].name,
    category: "cardio",
    sets: is_minimum ? 1 : 2,
    reps: cardio_pool[1].reps,
    rest_seconds: cardio_pool[1].rest_seconds,
  });
  
  return {
    session_type: "B",
    target_duration_minutes: is_minimum 
      ? Math.floor(config.session_duration_minutes * 0.6) 
      : config.session_duration_minutes,
    intensity_tier: intensity,
    is_minimum_viable: is_minimum,
    exercises,
  };
}

/**
 * Generate Session C (Full body + conditioning)
 */
function generateSessionC(
  config: ProgramConfig,
  is_minimum: boolean = false
): GeneratedSession {
  const intensity = config.intensity_tier;
  const volume_mult = is_minimum ? 0.5 : config.volume_multiplier;
  
  const warmup = generateWarmup();
  
  const strength_pool = buildStrengthPool(intensity);
  const cardio_pool = buildCardioPool(intensity);
  
  // Full body circuit
  const exercises: Exercise[] = [
    ...warmup,
    scaleExercise(strength_pool[0], volume_mult, "strength"), // Lower
    scaleExercise(strength_pool[1], volume_mult, "strength"), // Upper
  ];
  
  if (!is_minimum) {
    exercises.push(scaleExercise(strength_pool[4], volume_mult, "strength")); // Accessory
  }
  
  // Conditioning finisher
  exercises.push({
    name: cardio_pool[2].name,
    category: "cardio",
    sets: is_minimum ? 1 : 2,
    reps: cardio_pool[2].reps,
    rest_seconds: cardio_pool[2].rest_seconds,
  });
  
  return {
    session_type: "C",
    target_duration_minutes: is_minimum 
      ? Math.floor(config.session_duration_minutes * 0.6) 
      : config.session_duration_minutes,
    intensity_tier: intensity,
    is_minimum_viable: is_minimum,
    exercises,
  };
}

/**
 * Generate a full week of training sessions
 */
export function generateWeeklyProgram(
  week_number: number,
  config: ProgramConfig
): WeeklyProgram {
  const sessions: GeneratedSession[] = [];
  const minimum_viable_sessions: GeneratedSession[] = [];
  
  // Generate sessions based on frequency
  const session_types: Array<"A" | "B" | "C"> = 
    config.sessions_per_week === 2 ? ["A", "B"] :
    config.sessions_per_week === 3 ? ["A", "B", "C"] :
    ["A", "B", "C", "A"]; // 4 sessions = A, B, C, A
  
  for (const type of session_types) {
    if (type === "A") {
      sessions.push(generateSessionA(config));
      minimum_viable_sessions.push(generateSessionA(config, true));
    } else if (type === "B") {
      sessions.push(generateSessionB(config));
      minimum_viable_sessions.push(generateSessionB(config, true));
    } else {
      sessions.push(generateSessionC(config));
      minimum_viable_sessions.push(generateSessionC(config, true));
    }
  }
  
  return {
    week_number,
    sessions,
    minimum_viable_sessions,
  };
}

/**
 * Pretty print a session
 */
export function printSession(session: GeneratedSession, index: number): void {
  const mv_label = session.is_minimum_viable ? " (MINIMUM VIABLE)" : "";
  console.log(`\n  Session ${index + 1} - ${session.session_type}${mv_label}`);
  console.log(`  Duration: ${session.target_duration_minutes} minutes | Intensity: ${session.intensity_tier}`);
  console.log(`  Exercises:`);
  
  for (const ex of session.exercises) {
    if (ex.category === "mobility") {
      console.log(`    • ${ex.name}: ${ex.reps}`);
    } else if (ex.category === "strength") {
      console.log(`    • ${ex.name}: ${ex.sets} sets × ${ex.reps} (${ex.rest_seconds}s rest)`);
    } else {
      console.log(`    • ${ex.name}: ${ex.sets} sets × ${ex.reps} (${ex.rest_seconds}s rest)`);
    }
  }
}
