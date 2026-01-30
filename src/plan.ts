import { TrainingState, TrainingDecision, TrainingPhase, ProgramConfig, Session, Exercise } from "./models";
import { evaluateTrainingDecision } from "./evaluator";

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

/**
 * Generate a complete weekly plan - single source of truth for UI
 * Uses state.program as-is (mutations happen AFTER this via applyDecisionToProgram)
 */
export function generateWeeklyPlan(
  state: TrainingState,
  weekStart: Date
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
  const sessions = generateSessions(state, weekStart, false);
  const minimum_viable_sessions = generateSessions(state, weekStart, true);
  
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
  isMinimumViable: boolean
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
        isMinimumViable
      ),
    });
  }
  
  return sessions;
}

function generateExercisesForSession(
  session_type: "A" | "B" | "C",
  program: ProgramConfig,
  isMinimumViable: boolean
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
  
  // Exercise library by intensity
  const strength_lib = {
    light: {
      squat: { name: "Bodyweight Squat", base_sets: 2, reps: "8-10", rest: 60 },
      push: { name: "Knee Push-up", base_sets: 2, reps: "6-8", rest: 60 },
      bridge: { name: "Glute Bridge", base_sets: 2, reps: "10-12", rest: 45 },
      pike: { name: "Wall Push-up", base_sets: 2, reps: "8-10", rest: 45 },
      lunge: { name: "Assisted Squat", base_sets: 2, reps: "8-10", rest: 60 },
      core: { name: "Plank Hold", base_sets: 2, reps: "15-20 seconds", rest: 45 },
    },
    moderate: {
      squat: { name: "Bodyweight Squat", base_sets: 3, reps: "10-12", rest: 60 },
      push: { name: "Push-up", base_sets: 3, reps: "8-10", rest: 60 },
      bridge: { name: "Single-leg Glute Bridge", base_sets: 3, reps: "8-10 each", rest: 45 },
      pike: { name: "Pike Push-up", base_sets: 2, reps: "6-8", rest: 60 },
      lunge: { name: "Reverse Lunge", base_sets: 3, reps: "8-10 each leg", rest: 60 },
      core: { name: "Plank Hold", base_sets: 2, reps: "30-40 seconds", rest: 45 },
    },
    challenging: {
      squat: { name: "Jump Squat", base_sets: 3, reps: "8-10", rest: 90 },
      push: { name: "Decline Push-up", base_sets: 3, reps: "10-12", rest: 75 },
      bridge: { name: "Single-leg Deadlift", base_sets: 3, reps: "8-10 each", rest: 60 },
      pike: { name: "Diamond Push-up", base_sets: 3, reps: "8-10", rest: 75 },
      lunge: { name: "Bulgarian Split Squat", base_sets: 3, reps: "8-10 each leg", rest: 75 },
      core: { name: "Side Plank", base_sets: 2, reps: "30-40 seconds each", rest: 45 },
    },
  };
  
  const cardio_lib = {
    light: [
      { name: "Marching in Place", duration: "2-3 minutes" },
      { name: "Step-ups (low)", duration: "2 minutes" },
      { name: "Easy Jumping Jacks", duration: "1 minute" },
    ],
    moderate: [
      { name: "Jumping Jacks", duration: "1 minute" },
      { name: "High Knees", duration: "30-45 seconds" },
      { name: "Mountain Climbers", duration: "30-45 seconds" },
    ],
    challenging: [
      { name: "Burpees", duration: "30-45 seconds" },
      { name: "High Knees (fast)", duration: "45 seconds" },
      { name: "Jump Lunges", duration: "30-45 seconds" },
    ],
  };
  
  const strength = strength_lib[intensity];
  const cardio = cardio_lib[intensity];
  
  // Session A: Lower body focus
  if (session_type === "A") {
    exercises.push(
      scaleStrengthExercise(strength.squat, volume_mult),
      scaleStrengthExercise(strength.bridge, volume_mult)
    );
    if (!isMinimumViable) {
      exercises.push(scaleStrengthExercise(strength.core, volume_mult));
    }
    exercises.push({
      name: cardio[0].name,
      category: "cardio",
      sets: isMinimumViable ? 1 : 2,
      reps: cardio[0].duration,
      rest_seconds: 30,
    });
  }
  
  // Session B: Upper body focus
  else if (session_type === "B") {
    exercises.push(
      scaleStrengthExercise(strength.push, volume_mult),
      scaleStrengthExercise(strength.pike, volume_mult)
    );
    if (!isMinimumViable) {
      exercises.push(scaleStrengthExercise(strength.core, volume_mult));
    }
    exercises.push({
      name: cardio[1].name,
      category: "cardio",
      sets: isMinimumViable ? 1 : 2,
      reps: cardio[1].duration,
      rest_seconds: 30,
    });
  }
  
  // Session C: Full body
  else {
    exercises.push(
      scaleStrengthExercise(strength.squat, volume_mult),
      scaleStrengthExercise(strength.push, volume_mult)
    );
    if (!isMinimumViable) {
      exercises.push(scaleStrengthExercise(strength.lunge, volume_mult));
    }
    exercises.push({
      name: cardio[2].name,
      category: "cardio",
      sets: isMinimumViable ? 1 : 2,
      reps: cardio[2].duration,
      rest_seconds: 30,
    });
  }
  
  return exercises;
}

/**
 * Scale a strength exercise by volume multiplier
 */
function scaleStrengthExercise(
  base: { name: string; base_sets: number; reps: string; rest: number },
  volume_mult: number
): Exercise {
  const scaled_sets = Math.max(1, Math.round(base.base_sets * volume_mult));
  
  return {
    name: base.name,
    category: "strength",
    sets: scaled_sets,
    reps: base.reps,
    rest_seconds: base.rest,
    notes: volume_mult < 0.6 ? "Reduced volume for recovery" : undefined,
  };
}