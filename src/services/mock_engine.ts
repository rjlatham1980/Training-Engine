import { WeeklyEngineOutput, SimulationOutput } from "../engine_output";
import { TrainingState, Session } from "../models";
import { validateWeeklyOutput } from "../invariants";

/**
 * Mock Engine Service
 * 
 * Simulates the training engine using pre-generated simulation data.
 * This allows UI development without needing SQLite/backend yet.
 * 
 * Usage:
 *   const engine = new MockEngineService("Perfect Adherence");
 *   const currentWeek = engine.getCurrentWeek();
 *   engine.completeSession(sessionId);
 *   const nextWeek = engine.advanceWeek();
 */
export class MockEngineService {
  private simulation: SimulationOutput;
  private currentWeekIndex: number = 0;
  private completedSessions: Set<string> = new Set();
  
  constructor(scenarioName: string) {
    // Load simulation from pre-generated JSON
    // In real app, this would load from local storage or API
    this.simulation = this.loadSimulation(scenarioName);
    this.currentWeekIndex = 0;
  }
  
  /**
   * Get current week's plan
   */
  getCurrentWeek(): WeeklyEngineOutput {
    const week = this.simulation.weeks[this.currentWeekIndex];
    
    // Validate before returning
    validateWeeklyOutput(week);
    
    // Inject completion status from our mock state
    const weekWithCompletion = this.injectCompletionStatus(week);
    
    return weekWithCompletion;
  }
  
  /**
   * Get week by number
   */
  getWeek(weekNumber: number): WeeklyEngineOutput | null {
    const week = this.simulation.weeks.find(w => w.week_number === weekNumber);
    return week ? this.injectCompletionStatus(week) : null;
  }
  
  /**
   * Get all weeks (for history view)
   */
  getAllWeeks(): WeeklyEngineOutput[] {
    return this.simulation.weeks.map(w => this.injectCompletionStatus(w));
  }
  
  /**
   * Mark a session as completed
   */
  completeSession(sessionId: string): void {
    this.completedSessions.add(sessionId);
  }
  
  /**
   * Mark a session as incomplete
   */
  uncompleteSession(sessionId: string): void {
    this.completedSessions.delete(sessionId);
  }
  
  /**
   * Get completion status for current week
   */
  getWeekCompletion(): {
    completed: number;
    target: number;
    percentage: number;
  } {
    const week = this.getCurrentWeek();
    const completed = week.sessions.filter(s => s.completed).length;
    const target = week.program.sessions_per_week;
    
    return {
      completed,
      target,
      percentage: completed / target,
    };
  }
  
  /**
   * Check if can advance to next week
   */
  canAdvanceWeek(): boolean {
    return this.currentWeekIndex < this.simulation.weeks.length - 1;
  }
  
  /**
   * Advance to next week
   */
  advanceWeek(): WeeklyEngineOutput {
    if (!this.canAdvanceWeek()) {
      throw new Error("No more weeks in simulation");
    }
    
    this.currentWeekIndex++;
    this.completedSessions.clear(); // Reset for new week
    
    return this.getCurrentWeek();
  }
  
  /**
   * Go back to previous week (for testing)
   */
  previousWeek(): WeeklyEngineOutput {
    if (this.currentWeekIndex === 0) {
      throw new Error("Already at first week");
    }
    
    this.currentWeekIndex--;
    this.completedSessions.clear();
    
    return this.getCurrentWeek();
  }
  
  /**
   * Reset to week 1
   */
  reset(): void {
    this.currentWeekIndex = 0;
    this.completedSessions.clear();
  }
  
  /**
   * Get scenario metadata
   */
  getScenarioInfo(): {
    name: string;
    description: string;
    totalWeeks: number;
    currentWeek: number;
  } {
    return {
      name: this.simulation.scenario_name,
      description: this.simulation.scenario_description,
      totalWeeks: this.simulation.simulation_metadata.total_weeks,
      currentWeek: this.currentWeekIndex + 1,
    };
  }
  
  /**
   * Get final state summary
   */
  getFinalState() {
    return this.simulation.final_state;
  }
  
  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================
  
  /**
   * Load simulation from JSON file
   */
  private loadSimulation(scenarioName: string): SimulationOutput {
    // For now, we'll hardcode loading from the generated files
    // In real app, this would read from local storage or bundled assets
    
    try {
      // This is a placeholder - you'll need to adjust based on your build setup
      const sim = require(`../../simulation_outputs/${this.sanitizeScenarioName(scenarioName)}.json`);
      return sim;
    } catch (error) {
      throw new Error(`Failed to load scenario "${scenarioName}": ${error}`);
    }
  }
  
  /**
   * Sanitize scenario name for filename lookup
   */
  private sanitizeScenarioName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[\s\/\\]+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  }
  
  /**
   * Inject completion status into sessions
   */
  private injectCompletionStatus(week: WeeklyEngineOutput): WeeklyEngineOutput {
    const sessionsWithStatus = week.sessions.map(session => ({
      ...session,
      completed: this.completedSessions.has(session.id),
    }));
    
    const mvSessionsWithStatus = week.minimum_viable_sessions.map(session => ({
      ...session,
      completed: this.completedSessions.has(session.id),
    }));
    
    return {
      ...week,
      sessions: sessionsWithStatus,
      minimum_viable_sessions: mvSessionsWithStatus,
    };
  }
}

/**
 * Available scenarios for mock engine
 */
export const AVAILABLE_SCENARIOS = [
  "Perfect Adherence",
  "Moderate Adherence",
  "High Fatigue Episode",
  "Three-Week Gap",
  "Underfueling Pattern",
  "Persistent Low Adherence",
  "Recovery to Building",
  "Inconsistent Maintainer",
  "Pain/Injury Episode",
] as const;

export type ScenarioName = typeof AVAILABLE_SCENARIOS[number];

/**
 * Create a mock engine instance
 */
export function createMockEngine(scenario: ScenarioName = "Perfect Adherence"): MockEngineService {
  return new MockEngineService(scenario);
}