import { EnergyCheck, EnergyContext } from "./models";

/**
 * Determines energy context from recent energy checks
 */
export function determineEnergyContext(
  recent_energy_checks: EnergyCheck[]
): EnergyContext {
  if (recent_energy_checks.length === 0) return "normal";
  
  // Look at last 2 weeks of checks
  const recent = recent_energy_checks.slice(-4);  // ~2 checks per week
  
  const low_count = recent.filter(c => c.energy_level === "low").length;
  const high_count = recent.filter(c => c.energy_level === "high").length;
  
  // Check for underfueling pattern
  const underfed = recent.filter(c => 
    c.energy_level === "low" && 
    (c.eating_enough === "not_sure" || c.eating_enough === "probably")
  ).length;
  
  if (underfed >= 2) return "depleted";
  if (low_count >= 3) return "low";
  if (high_count >= 3) return "high";
  
  return "normal";
}