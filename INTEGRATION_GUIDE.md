# UI Integration Guide

## Getting Started

### Install Dependencies
```bash
npm install
```

### Run Simulations
```bash
npm run sim
```

This generates JSON files in `./simulation_outputs/` that you can use as test data.

## Output Contract

### Core Interface
```typescript
import { WeeklyEngineOutput } from "./engine_output";

interface WeeklyEngineOutput {
  week_number: number;
  week_start_iso: string;  // "2026-01-06"
  
  phase: "onboarding" | "building" | "maintaining" | "recovering";
  phase_week: number;
  
  state: {
    fatigue_score: number;
    energy_context: "depleted" | "low" | "normal" | "high";
    adherence_rate_2week: number;
    pain_flags: string[];
    has_active_injury: boolean;
  };
  
  program: {
    sessions_per_week: number;
    intensity_tier: "light" | "moderate" | "challenging";
    session_duration_minutes: number;
    volume_multiplier: number;
  };
  
  sessions: Session[];
  minimum_viable_sessions: Session[];
  
  completion: {
    raw_sessions_completed: number;
    planned_sessions_completed: number;
    extra_sessions: number;
    adherence_this_week: number;
  };
  
  decision: {
    type: "progress" | "maintain" | "scale_back";
    reason: string;
    coaching_message: string;
    coach_tone: "encouraging" | "steady" | "gentle" | "celebratory";
  };
  
  program_change: {
    occurred: boolean;
    description?: string;
    cause?: string;
  };
  
  safety_notes: string[];
  next_week_program: ProgramConfig;
}
```

## UI Components (Recommended)

### 1. Weekly Plan View
```typescript
function WeeklyPlanView({ week }: { week: WeeklyEngineOutput }) {
  return (
    <div>
      <h2>Week {week.week_number}</h2>
      <PhaseIndicator phase={week.phase} week={week.phase_week} />
      
      <ProgramSummary program={week.program} />
      
      <SessionList sessions={week.sessions} />
      
      {week.completion.extra_sessions > 0 && (
        <ExtraSessionsNote count={week.completion.extra_sessions} />
      )}
      
      <CoachingMessage 
        message={week.decision.coaching_message}
        tone={week.decision.coach_tone}
      />
      
      {week.safety_notes.length > 0 && (
        <SafetyAlert notes={week.safety_notes} />
      )}
    </div>
  );
}
```

### 2. Session Card
```typescript
function SessionCard({ session }: { session: Session }) {
  return (
    <div className="session-card">
      <h3>Session {session.session_type}</h3>
      <p>{session.target_duration_minutes} minutes</p>
      <p>Intensity: {session.intensity_tier}</p>
      
      <ExerciseList exercises={session.exercises} />
      
      {!session.completed && (
        <button onClick={() => markComplete(session.id)}>
          Complete Session
        </button>
      )}
    </div>
  );
}
```

### 3. Progress Indicator
```typescript
function ProgressIndicator({ week }: { week: WeeklyEngineOutput }) {
  const color = {
    progress: "green",
    maintain: "blue",
    scale_back: "orange"
  }[week.decision.type];
  
  return (
    <div style={{ backgroundColor: color }}>
      <h4>{week.decision.type.toUpperCase()}</h4>
      <p>{week.decision.reason}</p>
      
      {week.program_change.occurred && (
        <ProgramChangeNotice change={week.program_change} />
      )}
    </div>
  );
}
```

### 4. Adherence Tracker
```typescript
function AdherenceTracker({ week }: { week: WeeklyEngineOutput }) {
  const percentage = week.completion.adherence_this_week * 100;
  
  return (
    <div>
      <h4>This Week</h4>
      <ProgressBar value={percentage} max={100} />
      <p>
        {week.completion.planned_sessions_completed} / {week.program.sessions_per_week} sessions
      </p>
      
      <h4>2-Week Rolling</h4>
      <ProgressBar value={week.state.adherence_rate_2week * 100} max={100} />
    </div>
  );
}
```

### 5. Minimum Viable Toggle
```typescript
function SessionSelector({ week }: { week: WeeklyEngineOutput }) {
  const [useMinimumViable, setUseMinimumViable] = useState(false);
  
  const sessions = useMinimumViable 
    ? week.minimum_viable_sessions 
    : week.sessions;
  
  return (
    <div>
      <Toggle 
        label="Show shorter alternatives"
        checked={useMinimumViable}
        onChange={setUseMinimumViable}
      />
      
      <SessionList sessions={sessions} />
    </div>
  );
}
```

## Data Flow

### 1. Load Engine Output
```typescript
import { WeeklyEngineOutput } from "./engine_output";

// From simulation file
const simulation = require("./simulation_outputs/perfect_adherence_*.json");
const weeks: WeeklyEngineOutput[] = simulation.weeks;

// Or from API (future)
const week = await fetch("/api/week/current").then(r => r.json());
```

### 2. Validate Output
```typescript
import { validateWeeklyOutput } from "./invariants";

try {
  validateWeeklyOutput(week);
  // Safe to render
} catch (error) {
  console.error("Invalid engine output:", error);
  // Show error state
}
```

### 3. Update State
```typescript
// When user completes a session
async function handleSessionComplete(sessionId: string) {
  await markSessionComplete(sessionId);
  
  // Re-fetch current week
  const updatedWeek = await fetchCurrentWeek();
  
  // Validate
  validateWeeklyOutput(updatedWeek);
  
  // Update UI
  setCurrentWeek(updatedWeek);
}
```

### 4. Submit Weekly Data
```typescript
// When week ends
async function submitWeeklyData() {
  const data = {
    sessions_completed: getCompletedSessionCount(),
    sleep_quality: getSleepRating(),
    stress_level: getStressRating(),
    readiness_level: getReadinessRating(),
    energy_level: getEnergyRating(),
    eating_enough: getEatingEnoughAnswer(),
    pain_flags: getPainReports(),
    has_active_injury: getActiveInjuryFlag()
  };
  
  // Send to engine
  const nextWeek = await fetch("/api/week/evaluate", {
    method: "POST",
    body: JSON.stringify(data)
  }).then(r => r.json());
  
  // Validate and render
  validateWeeklyOutput(nextWeek);
  setCurrentWeek(nextWeek);
}
```

## Styling Guidelines

### Coaching Tone Colors
```css
.coaching-encouraging { color: #4CAF50; }
.coaching-steady { color: #2196F3; }
.coaching-gentle { color: #FF9800; }
.coaching-celebratory { color: #9C27B0; }
```

### Decision Type Colors
```css
.decision-progress { background: #E8F5E9; border-left: 4px solid #4CAF50; }
.decision-maintain { background: #E3F2FD; border-left: 4px solid #2196F3; }
.decision-scale-back { background: #FFF3E0; border-left: 4px solid #FF9800; }
```

### Phase Colors
```css
.phase-onboarding { color: #9E9E9E; }
.phase-building { color: #4CAF50; }
.phase-maintaining { color: #2196F3; }
.phase-recovering { color: #FF9800; }
```

## Best Practices

### DO
✅ Validate all engine outputs before rendering
✅ Handle missing/null fields gracefully
✅ Show minimum viable alternatives prominently
✅ Display safety notes clearly
✅ Use coaching tone to color messages
✅ Show program changes explicitly
✅ Track both raw and planned sessions
✅ Celebrate small wins (adherence, consistency)

### DON'T
❌ Mutate engine output objects
❌ Ignore safety notes
❌ Hide minimum viable options
❌ Punish users for gaps
❌ Show guilt-inducing streaks
❌ Display raw session counts as "performance"
❌ Auto-advance weeks without user confirmation
❌ Skip invariant validation

## Testing with Simulations

### Load Test Data
```typescript
// Use saved simulations as test fixtures
const testCases = [
  require("./simulation_outputs/perfect_adherence_*.json"),
  require("./simulation_outputs/moderate_adherence_*.json"),
  require("./simulation_outputs/high_fatigue_episode_*.json"),
  // ... etc
];

testCases.forEach(sim => {
  test(`Render ${sim.scenario_name}`, () => {
    sim.weeks.forEach(week => {
      const { container } = render(<WeeklyPlanView week={week} />);
      expect(container).toMatchSnapshot();
    });
  });
});
```

### Edge Cases
- Week with extra sessions
- Week with safety notes
- Week with program change
- Week with scale-back decision
- Week with minimum viable sessions
- Week with pain flags
- Week with active injury

## Accessibility

### Screen Reader Support
```typescript
<div role="region" aria-label="Weekly Training Plan">
  <h2 id="week-title">Week {week.week_number}</h2>
  
  <div role="status" aria-live="polite">
    {week.decision.coaching_message}
  </div>
  
  {week.safety_notes.length > 0 && (
    <div role="alert" aria-live="assertive">
      {week.safety_notes.join(". ")}
    </div>
  )}
</div>
```

### Keyboard Navigation
- Sessions should be tabbable
- Complete/skip buttons should be keyboard accessible
- Minimum viable toggle should work with Enter/Space

## Performance

### Optimization Tips
- Memoize session cards
- Lazy load exercise details
- Cache coaching messages
- Use virtual scrolling for long lists

### Bundle Size
Engine output types are minimal:
- `engine_output.ts`: ~5KB
- `invariants.ts`: ~8KB (optional, dev-only)
- Total overhead: <20KB

## Migration from Simulation

When moving from simulation JSON to live engine:

1. Keep using `WeeklyEngineOutput` interface
2. Replace file loading with API calls
3. Keep validation in place
4. Add loading states
5. Add error handling
6. Add offline support (local cache)

## Support

Questions? Check:
- `README.md` - High-level overview
- `ARCHITECTURE.md` - Technical details
- `src/engine_output.ts` - Type definitions
- `src/invariants.ts` - Validation rules
- Saved simulations - Real examples

## Next Steps

1. Set up React Native project
2. Install SQLite/Realm
3. Create UI components from above templates
4. Wire up session completion flow
5. Add weekly check-in forms
6. Test with saved simulations
7. Integrate live engine (Phase 2)