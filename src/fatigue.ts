import { WeeklyCheckIn } from "./models";

/**
 * Converts weekly check-in data into accumulated fatigue score (0-10)
 * Higher score = more fatigued
 */
export function calculateFatigueScore(
  recent_checkins: WeeklyCheckIn[]
): number {
  if (recent_checkins.length === 0) return 0;
  
  // Use most recent 2 check-ins (last 2 weeks)
  const relevant = recent_checkins.slice(-2);
  
  let total_score = 0;
  let count = 0;
  
  for (const checkin of relevant) {
    let week_score = 0;
    
    // Sleep contribution (0-4 points)
    if (checkin.sleep_quality) {
      const sleep_map: Record<string, number> = { 
        poor: 4, 
        fair: 2, 
        good: 1, 
        great: 0 
      };
      week_score += sleep_map[checkin.sleep_quality];
    }
    
    // Stress contribution (0-4 points)
    if (checkin.stress_level) {
      const stress_map: Record<string, number> = { 
        low: 0, 
        moderate: 1, 
        high: 3, 
        overwhelming: 4 
      };
      week_score += stress_map[checkin.stress_level];
    }
    
    // Readiness contribution (0-2 points, inverted)
    if (checkin.readiness_level) {
      const readiness_map: Record<string, number> = { 
        strong: 0, 
        good: 0, 
        okay: 1, 
        drag: 2 
      };
      week_score += readiness_map[checkin.readiness_level];
    }
    
    total_score += week_score;
    count++;
  }
  
  // Average and scale to 0-10
  const avg = total_score / count;
  return Math.min(10, avg);
}