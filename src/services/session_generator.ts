import { ProgramConfig, IntensityTier, Exercise, PROGRESSION_RULES } from "../models";

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
const EXERCISE_LIBRARY = {
  strength: {
    light: [
      { name: "Bodyweight Squat", sets: 2, reps: "8-10", rest: 60 },
      { name: "Knee Push-up", sets: 2, reps: "6-8", rest: 60 },
      { name: "Glute Bridge", sets: 2, reps: "10-12", rest: 45 },
      { name: "Wall Push-up", sets: 2, reps: "8-10", rest: 45 },
      { name: "Assisted Squat (chair)", sets: 2, reps: "8-10", rest: 60 },
      { name: "Plank Hold", sets: 2, reps: "15-20 seconds", rest: 45 },
    ],
    moderate: [
      { name: "Bodyweight Squat", sets: 3, reps: "10-12", rest: 60 },
      { name: "Push-up", sets: 3, reps: "8-10", rest: 60 },
      { name: "Reverse Lunge", sets: 3, reps: "8-10 each leg", rest: 60 },
      { name: "Pike Push-up", sets: 2, reps: "6-8", rest: 60 },
      { name: "Single-leg Glute Bridge", sets: 3, reps: "8-10 each", rest: 45 },
      { name: "Plank Hold", sets: 2, reps: "30-40 seconds", rest: 45 },
    ],
    challenging: [
      { name: "Jump Squat", sets: 3, reps: "8-10", rest: 90 },
      { name: "Decline Push-up", sets: 3, reps: "10-12", rest: 75 },
      { name: "Bulgarian Split Squat", sets: 3, reps: "8-10 each leg", rest: 75 },
      { name: "Diamond Push-up", sets: 3, reps: "8-10", rest: 75 },
      { name: "Single-leg Deadlift", sets: 3, reps: "8-10 each", rest: 60 },
      { name: "Side Plank", sets: 2, reps: "30-40 seconds each", rest: 45 },
    ],
  },
  cardio: {
    light: [
      { name: "Marching in Place", duration: "2-3 minutes", rest: 30 },
      { name: "Step-ups (low step)", duration: "2 minutes", rest: 30 },
      { name: "Easy Jumping Jacks", duration: "1 minute", rest: 30 },
    ],
    moderate: [
      { name: "Jumping Jacks", duration: "1 minute", rest: 30 },
      { name: "High Knees", duration: "30-45 seconds", rest: 30 },
      { name: "Mountain Climbers", duration: "30-45 seconds", rest: 45 },
    ],
    challenging: [
      { name: "Burpees", duration: "30-45 seconds", rest: 60 },
      { name: "High Knees (fast)", duration: "45 seconds", rest: 45 },
      { name: "Jump Lunges", duration: "30-45 seconds", rest: 60 },
    ],
  },
  mobility: [
    { name: "Cat-Cow Stretch", reps: "10 reps" },
    { name: "Hip Circles", reps: "8 each direction" },
    { name: "Arm Circles", reps: "10 forward, 10 back" },
    { name: "Leg Swings", reps: "10 each leg" },
    { name: "Torso Twists", reps: "10 each side" },
  ],
};

/**
 * Scale exercise volume by multiplier
 */
function scaleExercise(
  base: { name: string; sets: number; reps: string | number; rest: number },
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
      rest_seconds: base.rest,
    };
  } else {
    // For cardio, scale duration
    return {
      name: base.name,
      category: "cardio",
      sets: 1,
      reps: base.reps,
      rest_seconds: base.rest,
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
  const strength_pool = EXERCISE_LIBRARY.strength[intensity];
  const cardio_pool = EXERCISE_LIBRARY.cardio[intensity];
  
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
    reps: cardio_pool[0].duration,
    rest_seconds: cardio_pool[0].rest,
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
  
  const strength_pool = EXERCISE_LIBRARY.strength[intensity];
  const cardio_pool = EXERCISE_LIBRARY.cardio[intensity];
  
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
    reps: cardio_pool[1].duration,
    rest_seconds: cardio_pool[1].rest,
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
  
  const strength_pool = EXERCISE_LIBRARY.strength[intensity];
  const cardio_pool = EXERCISE_LIBRARY.cardio[intensity];
  
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
    reps: cardio_pool[2].duration,
    rest_seconds: cardio_pool[2].rest,
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