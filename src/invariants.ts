import { WeeklyEngineOutput, SimulationOutput } from "./engine_output";

/**
 * INVARIANT CHECKS
 * 
 * These are production guardrails that catch logic errors.
 * They should NEVER fail in correct implementations.
 * 
 * When to use:
 * - After generating any WeeklyEngineOutput
 * - After completing any simulation
 * - In tests
 * 
 * When NOT to use:
 * - For user input validation (use separate validators)
 * - For expected edge cases (handle gracefully instead)
 */

export class InvariantViolation extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = "InvariantViolation";
  }
}

/**
 * Check a single week's output for correctness
 */
export function validateWeeklyOutput(output: WeeklyEngineOutput): void {
  const week = output.week_number;
  
  // INVARIANT: Done never exceeds Target
  if (output.completion.planned_sessions_completed > output.program.sessions_per_week) {
    throw new InvariantViolation(
      `Week ${week}: Planned sessions (${output.completion.planned_sessions_completed}) > Target (${output.program.sessions_per_week})`,
      { week, output }
    );
  }
  
  // INVARIANT: Generated sessions match target
  if (output.sessions.length !== output.program.sessions_per_week) {
    throw new InvariantViolation(
      `Week ${week}: Generated ${output.sessions.length} sessions but target is ${output.program.sessions_per_week}`,
      { week, output }
    );
  }
  
  // INVARIANT: Minimum viable sessions match target
  if (output.minimum_viable_sessions.length !== output.program.sessions_per_week) {
    throw new InvariantViolation(
      `Week ${week}: Generated ${output.minimum_viable_sessions.length} MV sessions but target is ${output.program.sessions_per_week}`,
      { week, output }
    );
  }
  
  // INVARIANT: Extra sessions computed correctly
  const expected_extra = Math.max(0, output.completion.raw_sessions_completed - output.program.sessions_per_week);
  if (output.completion.extra_sessions !== expected_extra) {
    throw new InvariantViolation(
      `Week ${week}: Extra sessions mismatch. Expected ${expected_extra}, got ${output.completion.extra_sessions}`,
      { week, output }
    );
  }
  
  // INVARIANT: Planned = min(raw, target)
  const expected_planned = Math.min(output.completion.raw_sessions_completed, output.program.sessions_per_week);
  if (output.completion.planned_sessions_completed !== expected_planned) {
    throw new InvariantViolation(
      `Week ${week}: Planned sessions should be ${expected_planned}, got ${output.completion.planned_sessions_completed}`,
      { week, output }
    );
  }
  
  // INVARIANT: Adherence is clamped 0-1
  if (output.completion.adherence_this_week < 0 || output.completion.adherence_this_week > 1.0) {
    throw new InvariantViolation(
      `Week ${week}: Adherence must be 0-1, got ${output.completion.adherence_this_week}`,
      { week, output }
    );
  }
  
  // INVARIANT: Fatigue is 0-10
  if (output.state.fatigue_score < 0 || output.state.fatigue_score > 10) {
    throw new InvariantViolation(
      `Week ${week}: Fatigue must be 0-10, got ${output.state.fatigue_score}`,
      { week, output }
    );
  }
  
  // INVARIANT: Energy context is valid
  const valid_energy = ["depleted", "low", "normal", "high"];
  if (!valid_energy.includes(output.state.energy_context)) {
    throw new InvariantViolation(
      `Week ${week}: Invalid energy context "${output.state.energy_context}"`,
      { week, output }
    );
  }
  
  // INVARIANT: Intensity is valid
  const valid_intensity = ["light", "moderate", "challenging"];
  if (!valid_intensity.includes(output.program.intensity_tier)) {
    throw new InvariantViolation(
      `Week ${week}: Invalid intensity "${output.program.intensity_tier}"`,
      { week, output }
    );
  }
  
  // INVARIANT: Sessions per week is 2-4
  if (output.program.sessions_per_week < 2 || output.program.sessions_per_week > 4) {
    throw new InvariantViolation(
      `Week ${week}: Sessions per week must be 2-4, got ${output.program.sessions_per_week}`,
      { week, output }
    );
  }
  
  // INVARIANT: Volume multiplier is positive and reasonable
  if (output.program.volume_multiplier < 0.5 || output.program.volume_multiplier > 2.0) {
    throw new InvariantViolation(
      `Week ${week}: Volume multiplier out of range: ${output.program.volume_multiplier}`,
      { week, output }
    );
  }
  
  // INVARIANT: Duration is reasonable (15-60 minutes)
  if (output.program.session_duration_minutes < 15 || output.program.session_duration_minutes > 60) {
    throw new InvariantViolation(
      `Week ${week}: Duration out of range: ${output.program.session_duration_minutes}`,
      { week, output }
    );
  }
}

/**
 * Check an entire simulation for correctness
 */
export function validateSimulation(simulation: SimulationOutput): void {
  // Validate each week
  for (const week of simulation.weeks) {
    validateWeeklyOutput(week);
  }
  
  // INVARIANT: Total weeks matches array length
  if (simulation.simulation_metadata.total_weeks !== simulation.weeks.length) {
    throw new InvariantViolation(
      `Total weeks mismatch: metadata says ${simulation.simulation_metadata.total_weeks}, array has ${simulation.weeks.length}`
    );
  }
  
  // INVARIANT: Week numbers are sequential
  for (let i = 0; i < simulation.weeks.length; i++) {
    if (simulation.weeks[i].week_number !== i + 1) {
      throw new InvariantViolation(
        `Week number mismatch at index ${i}: expected ${i + 1}, got ${simulation.weeks[i].week_number}`
      );
    }
  }
  
  // INVARIANT: Raw total equals sum of weekly raw completions
  const computed_raw = simulation.weeks.reduce((sum, w) => sum + w.completion.raw_sessions_completed, 0);
  if (simulation.final_state.total_sessions_raw !== computed_raw) {
    throw new InvariantViolation(
      `Raw total mismatch: final state says ${simulation.final_state.total_sessions_raw}, sum is ${computed_raw}`
    );
  }
  
  // INVARIANT: Planned total equals sum of weekly planned completions
  const computed_planned = simulation.weeks.reduce((sum, w) => sum + w.completion.planned_sessions_completed, 0);
  if (simulation.final_state.total_sessions_planned !== computed_planned) {
    throw new InvariantViolation(
      `Planned total mismatch: final state says ${simulation.final_state.total_sessions_planned}, sum is ${computed_planned}`
    );
  }
  
  // INVARIANT: If raw > planned, at least one week has extra sessions
  if (simulation.final_state.total_sessions_raw > simulation.final_state.total_sessions_planned) {
    const weeks_with_extra = simulation.weeks.filter(w => w.completion.extra_sessions > 0).length;
    if (weeks_with_extra === 0) {
      throw new InvariantViolation(
        `Raw (${simulation.final_state.total_sessions_raw}) > Planned (${simulation.final_state.total_sessions_planned}), but no weeks have extra sessions`
      );
    }
  }
  
  // INVARIANT: Decision breakdown sums to total weeks
  const decision_sum = 
    simulation.simulation_metadata.decisions_breakdown.progress +
    simulation.simulation_metadata.decisions_breakdown.maintain +
    simulation.simulation_metadata.decisions_breakdown.scale_back;
  
  if (decision_sum !== simulation.simulation_metadata.total_weeks) {
    throw new InvariantViolation(
      `Decision breakdown sum (${decision_sum}) doesn't match total weeks (${simulation.simulation_metadata.total_weeks})`
    );
  }
}

/**
 * Development-only warning (non-fatal)
 */
export function warnIfSuspicious(output: WeeklyEngineOutput): void {
  // WARN: Very high fatigue without scale-back
  if (output.state.fatigue_score >= 8 && output.decision.type !== "scale_back") {
    console.warn(`⚠️  Week ${output.week_number}: High fatigue (${output.state.fatigue_score.toFixed(1)}) but no scale-back`);
  }
  
  // WARN: Depleted energy without scale-back
  if (output.state.energy_context === "depleted" && output.decision.type !== "scale_back") {
    console.warn(`⚠️  Week ${output.week_number}: Depleted energy but no scale-back`);
  }
  
  // WARN: Very low adherence without scale-back
  if (output.completion.adherence_this_week < 0.3 && output.decision.type !== "scale_back") {
    console.warn(`⚠️  Week ${output.week_number}: Very low adherence (${(output.completion.adherence_this_week * 100).toFixed(0)}%) but no scale-back`);
  }
  
  // WARN: Progress with active injury
  if (output.state.has_active_injury && output.decision.type === "progress") {
    console.warn(`⚠️  Week ${output.week_number}: Progressing despite active injury`);
  }
}