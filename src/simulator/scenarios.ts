import { SleepQuality, StressLevel, ReadinessLevel, PerceivedEffort } from "../models";

export interface SimulationScenario {
  name: string;
  description: string;
  weeks: SimulationWeek[];
}

export interface SimulationWeek {
  week_number: number;
  
  // Sessions completed this week (out of target)
  sessions_completed: number;
  
  // Perceived effort for sessions (if completed)
  avg_perceived_effort?: PerceivedEffort;
  
  // Weekly check-in data (Mind layer)
  sleep_quality?: SleepQuality;
  stress_level?: StressLevel;
  readiness_level?: ReadinessLevel;
  
  // Energy checks (Fuel layer)
  energy_level?: "low" | "normal" | "high";
  eating_enough?: "not_sure" | "probably" | "yes";
  
  // Pain/injury flag
  pain_flag?: string;
  active_injury?: boolean;
}

export const scenarios: SimulationScenario[] = [
  
  // Scenario 1: Ideal adherence (should progress smoothly)
  {
    name: "Perfect Adherence",
    description: "User completes target sessions consistently with good recovery",
    weeks: [
      // Onboarding weeks
      { week_number: 1, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 2, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
      { week_number: 3, sessions_completed: 3, sleep_quality: "great", stress_level: "low", readiness_level: "strong" },
      // Building phase
      { week_number: 4, sessions_completed: 3, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
      { week_number: 5, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 6, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
      { week_number: 7, sessions_completed: 3, sleep_quality: "great", stress_level: "low", readiness_level: "strong" },
      { week_number: 8, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
    ],
  },
  
  // Scenario 2: Moderate adherence (should maintain, not progress)
  {
    name: "Moderate Adherence",
    description: "User completes 50-70% of sessions",
    weeks: [
      { week_number: 1, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 2, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 3, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
      { week_number: 4, sessions_completed: 2, sleep_quality: "fair", stress_level: "high", readiness_level: "okay" },
      { week_number: 5, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 6, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
    ],
  },
  
  // Scenario 3: High fatigue (should scale back)
  {
    name: "High Fatigue Episode",
    description: "User trains hard but accumulates fatigue",
    weeks: [
      { week_number: 1, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
      { week_number: 2, sessions_completed: 3, sleep_quality: "fair", stress_level: "moderate", readiness_level: "good" },
      { week_number: 3, sessions_completed: 3, sleep_quality: "poor", stress_level: "high", readiness_level: "drag" },
      { week_number: 4, sessions_completed: 3, sleep_quality: "poor", stress_level: "overwhelming", readiness_level: "drag" },
      { week_number: 5, sessions_completed: 2, sleep_quality: "fair", stress_level: "high", readiness_level: "okay" },
      { week_number: 6, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
    ],
  },
  
  // Scenario 4: Three-week gap (should scale back gently)
  {
    name: "Three-Week Gap",
    description: "User stops training for 3 weeks then returns",
    weeks: [
      { week_number: 1, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 2, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 3, sessions_completed: 0, sleep_quality: "poor", stress_level: "overwhelming", readiness_level: "drag" },
      { week_number: 4, sessions_completed: 0, sleep_quality: "fair", stress_level: "high", readiness_level: "drag" },
      { week_number: 5, sessions_completed: 0, sleep_quality: "fair", stress_level: "high", readiness_level: "okay" },
      { week_number: 6, sessions_completed: 1, sleep_quality: "good", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 7, sessions_completed: 2, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 8, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
    ],
  },
  
  // Scenario 5: Underfueling pattern (should detect and scale back)
  {
    name: "Underfueling Pattern",
    description: "User trains but reports low energy + not eating enough",
    weeks: [
      { week_number: 1, sessions_completed: 3, energy_level: "normal", eating_enough: "yes", sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 2, sessions_completed: 3, energy_level: "low", eating_enough: "not_sure", sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 3, sessions_completed: 3, energy_level: "low", eating_enough: "probably", sleep_quality: "poor", stress_level: "moderate", readiness_level: "drag" },
      { week_number: 4, sessions_completed: 2, energy_level: "low", eating_enough: "not_sure", sleep_quality: "fair", stress_level: "high", readiness_level: "drag" },
      { week_number: 5, sessions_completed: 2, energy_level: "normal", eating_enough: "yes", sleep_quality: "good", stress_level: "moderate", readiness_level: "okay" },
    ],
  },
  
  // Scenario 6: Consistent low adherence (should scale back after 2 weeks)
  {
    name: "Persistent Low Adherence",
    description: "User consistently misses majority of sessions",
    weeks: [
      { week_number: 1, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 2, sessions_completed: 1, sleep_quality: "fair", stress_level: "high", readiness_level: "okay" },
      { week_number: 3, sessions_completed: 1, sleep_quality: "fair", stress_level: "overwhelming", readiness_level: "drag" },
      { week_number: 4, sessions_completed: 1, sleep_quality: "poor", stress_level: "high", readiness_level: "drag" },
      { week_number: 5, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 6, sessions_completed: 2, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
    ],
  },
  
  // Scenario 7: Gradual improvement after recovery
  {
    name: "Recovery to Building",
    description: "User scales back, recovers, then gradually progresses",
    weeks: [
      { week_number: 1, sessions_completed: 1, sleep_quality: "poor", stress_level: "overwhelming", readiness_level: "drag" },
      { week_number: 2, sessions_completed: 2, sleep_quality: "fair", stress_level: "high", readiness_level: "okay" },
      { week_number: 3, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 4, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
      { week_number: 5, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 6, sessions_completed: 3, sleep_quality: "great", stress_level: "low", readiness_level: "strong" },
      { week_number: 7, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
      { week_number: 8, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
    ],
  },
  
  // Scenario 8: Inconsistent but never terrible (should stay in maintaining)
  {
    name: "Inconsistent Maintainer",
    description: "User fluctuates between 40-70% adherence indefinitely",
    weeks: [
      { week_number: 1, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 2, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 3, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 4, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 5, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 6, sessions_completed: 2, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay" },
      { week_number: 7, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "good" },
      { week_number: 8, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
    ],
  },
  
  // Scenario 9: Pain/Injury (should prevent progression and scale back)
  {
    name: "Pain/Injury Episode",
    description: "User reports knee pain, blocks progression, then recovers",
    weeks: [
      { week_number: 1, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 2, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "strong" },
      { week_number: 3, sessions_completed: 2, sleep_quality: "good", stress_level: "low", readiness_level: "good", pain_flag: "Knee discomfort during squats" },
      { week_number: 4, sessions_completed: 2, sleep_quality: "good", stress_level: "moderate", readiness_level: "okay", pain_flag: "Knee still bothering me" },
      { week_number: 5, sessions_completed: 1, sleep_quality: "fair", stress_level: "moderate", readiness_level: "okay", active_injury: true },
      { week_number: 6, sessions_completed: 2, sleep_quality: "good", stress_level: "low", readiness_level: "okay" },
      { week_number: 7, sessions_completed: 2, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
      { week_number: 8, sessions_completed: 3, sleep_quality: "good", stress_level: "low", readiness_level: "good" },
    ],
  },
];