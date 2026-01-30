import { TrainingState, WeeklyCheckIn, EnergyCheck, PROGRESSION_RULES, ProgramConfig } from "../models";
import { calculateFatigueScore } from "../fatigue";
import { determineEnergyContext } from "../energy";
import { evaluatePhaseTransition } from "../phase";
import { scenarios, SimulationScenario, SimulationWeek } from "./scenarios";
import { generateWeeklyPlan, WeeklyPlan } from "../plan";
import { applyDecisionToProgram, programDidChange, applyPhaseDurationTemplate } from "../program_mutation";
import { WeeklyEngineOutput, SimulationOutput, toWeeklyEngineOutput } from "../engine_output";
import { validateWeeklyOutput, validateSimulation, warnIfSuspicious, InvariantViolation } from "../invariants";
import * as fs from "fs";
import * as path from "path";

interface WeeklyResult {
  week_number: number;
  
  state_snapshot: {
    accumulated_fatigue_score: number;
    energy_context: string;
    adherence_rate_2week: number;
  };
  
  program_this_week: ProgramConfig;
  plan: WeeklyPlan;
  
  sessions_completed_raw: number;
  sessions_completed_capped: number;
  extra_sessions: number;
  
  program_next_week: ProgramConfig;
  program_change_cause?: string;
  
  // Additional state for output conversion
  days_since_last_session: number;
  pain_flags: string[];
  has_active_injury: boolean;
}

function computeRollingWindows(history: number[]): {
  last_7: number;
  last_14: number;
  last_30: number;
} {
  const len = history.length;
  return {
    last_7: len >= 1 ? history[len - 1] : 0,
    last_14: len >= 2 ? history[len - 1] + history[len - 2] : history.reduce((a, b) => a + b, 0),
    last_30: history.slice(-4).reduce((a, b) => a + b, 0),
  };
}

function runSimulation(scenario: SimulationScenario): SimulationOutput {
  
  let state: TrainingState = {
    local_user_id: "sim-user",
    framework: "hybrid_strength_conditioning",
    current_phase: "onboarding",
    week_number: 1,
    phase_start_date: new Date(),
    program: {
      sessions_per_week: PROGRESSION_RULES.FREQUENCY_DEFAULT,
      intensity_tier: "light",
      session_duration_minutes: PROGRESSION_RULES.DURATION_ONBOARDING,
      volume_multiplier: PROGRESSION_RULES.VOLUME_START,
    },
    program_constraints: {
      max_sessions_per_week: 4,
      max_intensity_tier: "challenging",
      max_duration_minutes: 60,
      max_volume_multiplier: PROGRESSION_RULES.VOLUME_CAP,
    },
    weekly_session_history: [],
    sessions_last_7_days: 0,
    sessions_last_14_days: 0,
    sessions_last_30_days: 0,
    adherence_rate_2week: 0,
    low_adherence_weeks_in_row: 0,
    accumulated_fatigue_score: 0,
    energy_context: "normal",
    recent_pain_flags: [],
    has_active_injury: false,
    consecutive_pain_free_weeks: 0,
    days_since_last_session: 0,
    total_sessions_completed_raw: 0,
    total_sessions_completed_planned: 0,
    last_decision: "maintain",
    last_decision_reason: "Initial state",
    last_evaluation_date: new Date(),
    weeks_since_last_scale_back: null,
    consecutive_stable_weeks: 0,
  };
  
  const weekly_results: WeeklyResult[] = [];
  const weekly_outputs: WeeklyEngineOutput[] = [];
  const checkins: WeeklyCheckIn[] = [];
  const energy_checks: EnergyCheck[] = [];
  const phase_transitions: Array<{week: number; from_phase: any; to_phase: any}> = [];
  
  for (const sim_week of scenario.weeks) {
    
    const sessions_raw = sim_week.sessions_completed;
    const week_start = new Date(2026, 0, (sim_week.week_number - 1) * 7 + 1);
    
    const target_before_mutation = state.program.sessions_per_week;
    const sessions_capped_for_adherence = Math.min(sessions_raw, target_before_mutation);
    
    state.weekly_session_history.push(sessions_capped_for_adherence);
    
    const windows = computeRollingWindows(state.weekly_session_history);
    state.sessions_last_7_days = windows.last_7;
    state.sessions_last_14_days = windows.last_14;
    state.sessions_last_30_days = windows.last_30;
    
    const raw_adherence = state.sessions_last_14_days / (target_before_mutation * 2);
    state.adherence_rate_2week = Math.min(1.0, raw_adherence);
    
    if (sessions_capped_for_adherence < target_before_mutation * 0.5) {
      state.low_adherence_weeks_in_row++;
    } else {
      state.low_adherence_weeks_in_row = 0;
    }
    
    state.total_sessions_completed_raw += sessions_raw;
    
    if (sessions_capped_for_adherence > 0) {
      state.days_since_last_session = 0;
    } else {
      state.days_since_last_session += 7;
    }
    
    // Pain tracking
    if (sim_week.pain_flag || sim_week.active_injury) {
      if (sim_week.pain_flag) {
        state.recent_pain_flags.push(sim_week.pain_flag);
        if (state.recent_pain_flags.length > 2) state.recent_pain_flags.shift();
      }
      state.has_active_injury = sim_week.active_injury || false;
      state.consecutive_pain_free_weeks = 0;
    } else {
      if (state.recent_pain_flags.length > 0) state.recent_pain_flags = [];
      state.has_active_injury = false;
      state.consecutive_pain_free_weeks++;
    }
    
    // Check-ins
    if (sim_week.sleep_quality || sim_week.stress_level || sim_week.readiness_level) {
      checkins.push({
        id: `checkin-${sim_week.week_number}`,
        week_start_date: new Date(),
        sleep_quality: sim_week.sleep_quality,
        stress_level: sim_week.stress_level,
        readiness_level: sim_week.readiness_level,
      });
    }
    
    if (sim_week.energy_level) {
      energy_checks.push({
        id: `energy-${sim_week.week_number}`,
        date: new Date(),
        energy_level: sim_week.energy_level,
        eating_enough: sim_week.eating_enough || "yes",
      });
    }
    
    state.accumulated_fatigue_score = calculateFatigueScore(checkins);
    state.energy_context = determineEnergyContext(energy_checks);
    
    const is_stable = 
      state.adherence_rate_2week >= 0.75 && 
      state.accumulated_fatigue_score < 5 &&
      ["normal", "high"].includes(state.energy_context);
    
    if (is_stable) {
      state.consecutive_stable_weeks++;
    } else {
      state.consecutive_stable_weeks = 0;
    }
    
    const state_snapshot = {
      accumulated_fatigue_score: state.accumulated_fatigue_score,
      energy_context: state.energy_context,
      adherence_rate_2week: state.adherence_rate_2week,
    };
    
    const program_before = { ...state.program };
    
    // Evaluate and apply
    const evaluation_plan = generateWeeklyPlan(state, week_start);
    const decision = evaluation_plan.decision;
    const reason = evaluation_plan.reason;
    const coaching_message = evaluation_plan.coaching_message;
    const coach_tone = evaluation_plan.coach_tone;
    
    const mutation = applyDecisionToProgram(state, decision);
    
    let final_decision = decision;
    let final_reason = reason;
    let final_message = coaching_message;
    
    if (decision === "progress" && !programDidChange(mutation)) {
      final_decision = "maintain";
      final_reason = mutation.change_description;
      
      if (mutation.at_true_ceiling) {
        final_message = "You're at maximum training capacity. Maintaining excellence.";
      } else {
        final_message = "Holding steady due to current constraints.";
      }
    }
    
    if (final_decision === "scale_back") {
      state.weeks_since_last_scale_back = 0;
      state.consecutive_stable_weeks = 0;
    } else if (state.weeks_since_last_scale_back !== null) {
      state.weeks_since_last_scale_back++;
    }
    
    const weekly_plan = generateWeeklyPlan(state, week_start);
    weekly_plan.decision = final_decision;
    weekly_plan.reason = final_reason;
    weekly_plan.coaching_message = final_message;
    weekly_plan.coach_tone = coach_tone;
    
    if (programDidChange(mutation)) {
      weekly_plan.program_change_description = mutation.change_description;
    }
    
    if (weekly_plan.sessions.length !== state.program.sessions_per_week) {
      throw new Error(
        `ASSERT FAILED Week ${sim_week.week_number}: Generated ${weekly_plan.sessions.length} sessions but target is ${state.program.sessions_per_week}`
      );
    }
    
    state.last_decision = weekly_plan.decision;
    state.last_decision_reason = weekly_plan.reason;
    
    const program_after_mutation = { ...state.program };
    
    const final_target = program_after_mutation.sessions_per_week;
    const sessions_capped = Math.min(sessions_raw, final_target);
    const extra_sessions = Math.max(0, sessions_raw - final_target);
    
    state.total_sessions_completed_planned += sessions_capped;
    
    // Phase transition
    const phase_before = state.current_phase;
    const new_phase = evaluatePhaseTransition(state, weekly_plan.decision);
    let phase_transition_occurred = false;
    
    if (new_phase && new_phase !== state.current_phase) {
      phase_transitions.push({
        week: sim_week.week_number,
        from_phase: phase_before,
        to_phase: new_phase,
      });
      
      state.current_phase = new_phase;
      state.week_number = 1;
      state.phase_start_date = new Date();
      phase_transition_occurred = true;
      
      if (new_phase === "onboarding") {
        applyPhaseDurationTemplate(state, PROGRESSION_RULES.DURATION_ONBOARDING);
      } else if (new_phase === "building") {
        applyPhaseDurationTemplate(state, PROGRESSION_RULES.DURATION_BUILDING);
      } else if (new_phase === "maintaining") {
        applyPhaseDurationTemplate(state, PROGRESSION_RULES.DURATION_MAINTAINING);
      } else if (new_phase === "recovering") {
        applyPhaseDurationTemplate(state, PROGRESSION_RULES.DURATION_RECOVERING);
      }
    } else {
      state.week_number++;
    }
    
    const program_after_transition = { ...state.program };
    
    let change_cause: string | undefined;
    if (programDidChange(mutation)) {
      change_cause = mutation.change_cause;
    } else if (phase_transition_occurred && 
               program_after_mutation.session_duration_minutes !== program_after_transition.session_duration_minutes) {
      change_cause = `phase_transition (${new_phase})`;
    }
    
    const weekly_result: WeeklyResult = {
      week_number: sim_week.week_number,
      state_snapshot,
      program_this_week: program_after_mutation,
      plan: weekly_plan,
      sessions_completed_raw: sessions_raw,
      sessions_completed_capped: sessions_capped,
      extra_sessions,
      program_next_week: program_after_transition,
      program_change_cause: change_cause,
      days_since_last_session: state.days_since_last_session,
      pain_flags: [...state.recent_pain_flags],
      has_active_injury: state.has_active_injury,
    };
    
    weekly_results.push(weekly_result);
    
    // Convert to canonical output
    const weekly_output: WeeklyEngineOutput = {
      week_number: sim_week.week_number,
      week_start_iso: week_start.toISOString().split('T')[0],
      
      phase: weekly_plan.phase,
      phase_week: weekly_plan.phase_week,
      
      state: {
        fatigue_score: state_snapshot.accumulated_fatigue_score,
        energy_context: state_snapshot.energy_context as any,
        adherence_rate_2week: state_snapshot.adherence_rate_2week,
        days_since_last_session: state.days_since_last_session,
        pain_flags: [...state.recent_pain_flags],
        has_active_injury: state.has_active_injury,
      },
      
      program: {
        sessions_per_week: program_after_mutation.sessions_per_week,
        intensity_tier: program_after_mutation.intensity_tier,
        session_duration_minutes: program_after_mutation.session_duration_minutes,
        volume_multiplier: program_after_mutation.volume_multiplier,
      },
      
      sessions: weekly_plan.sessions,
      minimum_viable_sessions: weekly_plan.minimum_viable_sessions,
      
      completion: {
        raw_sessions_completed: sessions_raw,
        planned_sessions_completed: sessions_capped,
        extra_sessions,
        adherence_this_week: Math.min(1.0, sessions_capped / program_after_mutation.sessions_per_week),
      },
      
      decision: {
        type: weekly_plan.decision,
        reason: weekly_plan.reason,
        coaching_message: weekly_plan.coaching_message,
        coach_tone: weekly_plan.coach_tone,
      },
      
      program_change: {
        occurred: !!weekly_plan.program_change_description,
        description: weekly_plan.program_change_description,
        cause: change_cause as any,
      },
      
      safety_notes: weekly_plan.safety_notes,
      
      next_week_program: {
        sessions_per_week: program_after_transition.sessions_per_week,
        intensity_tier: program_after_transition.intensity_tier,
        session_duration_minutes: program_after_transition.session_duration_minutes,
        volume_multiplier: program_after_transition.volume_multiplier,
      },
    };
    
    // VALIDATE WEEKLY OUTPUT
    try {
      validateWeeklyOutput(weekly_output);
      warnIfSuspicious(weekly_output);
    } catch (error) {
      if (error instanceof InvariantViolation) {
        console.error(`\n❌ INVARIANT VIOLATION in ${scenario.name}:`);
        console.error(`   ${error.message}`);
        throw error;
      }
      throw error;
    }
    
    weekly_outputs.push(weekly_output);
  }
  
  // Count decisions
  const decisions_breakdown = {
    progress: weekly_outputs.filter(w => w.decision.type === "progress").length,
    maintain: weekly_outputs.filter(w => w.decision.type === "maintain").length,
    scale_back: weekly_outputs.filter(w => w.decision.type === "scale_back").length,
  };
  
  // Build simulation output
  const simulation: SimulationOutput = {
    scenario_name: scenario.name,
    scenario_description: scenario.description || "",
    
    weeks: weekly_outputs,
    
    final_state: {
      phase: state.current_phase,
      phase_week: state.week_number,
      total_sessions_raw: state.total_sessions_completed_raw,
      total_sessions_planned: state.total_sessions_completed_planned,
      current_program: { ...state.program },
      weeks_since_scale_back: state.weeks_since_last_scale_back,
      consecutive_stable_weeks: state.consecutive_stable_weeks,
      consecutive_pain_free_weeks: state.consecutive_pain_free_weeks,
    },
    
    simulation_metadata: {
      total_weeks: weekly_outputs.length,
      decisions_breakdown,
      phase_transitions,
    },
  };
  
  // VALIDATE ENTIRE SIMULATION
  try {
    validateSimulation(simulation);
  } catch (error) {
    if (error instanceof InvariantViolation) {
      console.error(`\n❌ SIMULATION INVARIANT VIOLATION in ${scenario.name}:`);
      console.error(`   ${error.message}`);
      throw error;
    }
    throw error;
  }
  
  return simulation;
}

function printSimulationResults(simulation: SimulationOutput): void {
  console.log("\n" + "=".repeat(160));
  console.log(`SCENARIO: ${simulation.scenario_name}`);
  console.log("=".repeat(160));
  
  const header = 
    "Wk".padEnd(4) +
    "Phase".padEnd(12) +
    "P-Wk".padEnd(5) +
    "Tgt".padEnd(4) +
    "Done".padEnd(5) +
    "Adh".padEnd(5) +
    "Ftg".padEnd(5) +
    "Enrgy".padEnd(9) +
    "Intns".padEnd(11) +
    "Vol".padEnd(6) +
    "Dur".padEnd(5) +
    "Decision".padEnd(12) +
    "Reason";
  
  console.log("\n" + header);
  console.log("-".repeat(160));
  
  for (const week of simulation.weeks) {
    const adherence_pct = (week.completion.adherence_this_week * 100).toFixed(0) + "%";
    const fatigue_str = week.state.fatigue_score.toFixed(1);
    const energy_str = week.state.energy_context;
    const vol_str = week.program.volume_multiplier.toFixed(1) + "x";
    
    const row = 
      week.week_number.toString().padEnd(4) +
      week.phase.padEnd(12) +
      week.phase_week.toString().padEnd(5) +
      week.program.sessions_per_week.toString().padEnd(4) +
      week.completion.planned_sessions_completed.toString().padEnd(5) +
      adherence_pct.padEnd(5) +
      fatigue_str.padEnd(5) +
      energy_str.padEnd(9) +
      week.program.intensity_tier.padEnd(11) +
      vol_str.padEnd(6) +
      week.program.session_duration_minutes.toString().padEnd(5) +
      week.decision.type.padEnd(12) +
      week.decision.reason;
    
    console.log(row);
    
    if (week.program_change.occurred) {
      console.log(`    → ${week.program_change.description}`);
    }
    
    const prev_week = simulation.weeks[week.week_number - 2];
    const should_print_sessions = 
      week.week_number === 1 || 
      !prev_week ||
      week.decision.type !== prev_week.decision.type || 
      week.program_change.occurred;
    
    if (should_print_sessions) {
      console.log(`    Sessions: ${week.sessions.map(s => `${s.session_type}(${s.target_duration_minutes}m)`).join(", ")}`);
    }
    
    if (week.completion.extra_sessions > 0) {
      console.log(`    Note: +${week.completion.extra_sessions} extra session(s) beyond plan (not counted toward adherence)`);
    }
    
    if (should_print_sessions && week.safety_notes.length > 0) {
      console.log(`    Safety: ${week.safety_notes.join("; ")}`);
    }
  }
  
  console.log("\n" + "-".repeat(160));
  console.log("Key Coaching Messages:");
  console.log("-".repeat(160));
  
  const key_weeks: number[] = [0];
  for (let i = 1; i < simulation.weeks.length; i++) {
    if (simulation.weeks[i].decision.type !== simulation.weeks[i - 1].decision.type) {
      key_weeks.push(i);
    }
  }
  key_weeks.push(simulation.weeks.length - 1);
  
  const unique_weeks = [...new Set(key_weeks)];
  
  for (const idx of unique_weeks) {
    const week = simulation.weeks[idx];
    console.log(`Week ${week.week_number}: "${week.decision.coaching_message}"`);
  }
  
  console.log("\n" + "=".repeat(160));
  console.log("Final State:");
  console.log(`  Phase: ${simulation.final_state.phase} (week ${simulation.final_state.phase_week})`);
  console.log(`  Total sessions (planned): ${simulation.final_state.total_sessions_planned}`);
  console.log(`  Total sessions (raw): ${simulation.final_state.total_sessions_raw}`);
  
  const last_week = simulation.weeks[simulation.weeks.length - 1];
  console.log(`\n  Last Week Plan: ${last_week.program.sessions_per_week}/week, ${last_week.program.intensity_tier}, ${last_week.program.volume_multiplier.toFixed(1)}x volume, ${last_week.program.session_duration_minutes}min`);
  console.log(`  Next Week Program: ${simulation.final_state.current_program.sessions_per_week}/week, ${simulation.final_state.current_program.intensity_tier}, ${simulation.final_state.current_program.volume_multiplier.toFixed(1)}x volume, ${simulation.final_state.current_program.session_duration_minutes}min`);
  
  const programs_differ = 
    last_week.program.session_duration_minutes !== simulation.final_state.current_program.session_duration_minutes ||
    last_week.program.sessions_per_week !== simulation.final_state.current_program.sessions_per_week ||
    last_week.program.intensity_tier !== simulation.final_state.current_program.intensity_tier ||
    Math.abs(last_week.program.volume_multiplier - simulation.final_state.current_program.volume_multiplier) > 0.01;
  
  if (programs_differ && last_week.program_change.cause) {
    console.log(`  Note: Next Week Program differs from Last Week Plan.`);
    console.log(`  Cause: ${last_week.program_change.cause}`);
  }
  
  console.log(`\n  Simulation Metadata:`);
  console.log(`    Total weeks: ${simulation.simulation_metadata.total_weeks}`);
  console.log(`    Decisions: ${simulation.simulation_metadata.decisions_breakdown.progress} progress, ${simulation.simulation_metadata.decisions_breakdown.maintain} maintain, ${simulation.simulation_metadata.decisions_breakdown.scale_back} scale-back`);
  console.log(`    Phase transitions: ${simulation.simulation_metadata.phase_transitions.length}`);
  
  console.log(`\n  Weeks since scale-back: ${simulation.final_state.weeks_since_scale_back !== null ? simulation.final_state.weeks_since_scale_back : "never"}`);
  console.log(`  Consecutive stable weeks: ${simulation.final_state.consecutive_stable_weeks}`);
  console.log(`  Consecutive pain-free weeks: ${simulation.final_state.consecutive_pain_free_weeks}`);
  console.log("=".repeat(160) + "\n");
}

function saveSimulationToFile(simulation: SimulationOutput, outputDir: string = "./simulation_outputs"): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Sanitize filename: replace spaces and slashes with underscores
  const sanitized_name = simulation.scenario_name
    .toLowerCase()
    .replace(/[\s\/\\]+/g, '_')  // Replace spaces, forward slashes, and backslashes
    .replace(/[^a-z0-9_-]/g, ''); // Remove any other special characters
  
  const filename = `${sanitized_name}_${Date.now()}.json`;
  const filepath = path.join(outputDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(simulation, null, 2));
  console.log(`✅ Simulation saved to: ${filepath}`);
}

function runAllScenarios(): void {
  console.log("\n\n");
  console.log("█".repeat(160));
  console.log("  TRAINING STATE MACHINE SIMULATION");
  console.log("  With Output Contract Validation & Invariant Checks");
  console.log("█".repeat(160));
  
  const all_simulations: SimulationOutput[] = [];
  
  for (const scenario of scenarios) {
    try {
      const simulation = runSimulation(scenario);
      printSimulationResults(simulation);
      all_simulations.push(simulation);
      
      // Save to file
      saveSimulationToFile(simulation);
    } catch (error) {
      if (error instanceof InvariantViolation) {
        console.error(`\n💥 FATAL: Invariant violation in ${scenario.name}`);
        console.error(`   This should never happen in production.`);
        throw error;
      }
      throw error;
    }
  }
  
  console.log("█".repeat(160));
  console.log("  SIMULATION COMPLETE");
  console.log(`  ✅ All ${all_simulations.length} scenarios passed validation`);
  console.log("█".repeat(160));
  console.log("\n\n");
}

runAllScenarios();