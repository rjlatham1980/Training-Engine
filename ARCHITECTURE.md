# Architecture Deep Dive

## State Machine Flow

### Weekly Evaluation Cycle
```
┌─────────────────────────────────────────────────────────────────┐
│ WEEK START                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Collect Inputs                                              │
│    ├─ Sessions completed this week (raw count)                 │
│    ├─ Mind check-in (sleep, stress, readiness)                 │
│    ├─ Fuel check-in (energy, hunger)                           │
│    └─ Pain/injury flags                                         │
│                                                                  │
│ 2. Update State                                                 │
│    ├─ Add to session history (capped to target)                │
│    ├─ Calculate rolling windows (7d, 14d, 30d)                 │
│    ├─ Compute adherence (clamped 0-1)                          │
│    ├─ Calculate fatigue score (0-10)                           │
│    ├─ Determine energy context                                 │
│    └─ Track stability & pain-free weeks                        │
│                                                                  │
│ 3. Evaluate Decision                                            │
│    ├─ Check safety gates (scale-back triggers)                 │
│    ├─ Check stability gates (maintain triggers)                │
│    └─ Check progression gates (progress triggers)              │
│                                                                  │
│ 4. Mutate Program                                               │
│    ├─ Apply scale-back (if triggered)                          │
│    ├─ Apply progression (if gates passed)                      │
│    ├─ Enforce constraints                                       │
│    └─ Update tracking counters                                 │
│                                                                  │
│ 5. Generate Sessions                                            │
│    ├─ Select exercises by intensity tier                       │
│    ├─ Scale by volume multiplier                               │
│    ├─ Create standard sessions                                 │
│    └─ Create minimum viable alternatives                       │
│                                                                  │
│ 6. Check Phase Transition                                       │
│    ├─ Evaluate phase rules                                     │
│    ├─ Apply duration template (if transitioning)               │
│    └─ Reset phase week counter                                 │
│                                                                  │
│ 7. Output                                                        │
│    ├─ Create WeeklyEngineOutput                                │
│    ├─ Validate invariants                                       │
│    └─ Return to UI                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Decision Logic Priority

The evaluator checks triggers in strict priority order:

### Priority 1: Safety (Scale-back)
These always win. If any trigger, immediate scale-back.
```typescript
if (has_active_injury || pain_flags.length >= 2) → scale_back
if (fatigue >= 7) → scale_back
if (energy === "depleted") → scale_back
if (adherence < 0.4 for 2+ weeks) → scale_back
if (10+ days since last session) → scale_back
```

### Priority 2: Stability (Maintain)
Hold steady. Build trust, confirm sustainability.
```typescript
if (in_onboarding && week <= 3) → maintain
if (recent_pain_flag) → maintain
if (pain_free_weeks < 2 after injury) → maintain
if (weeks_since_scale_back < 2) → maintain
if (adherence in 40-75%) → maintain
if (fatigue in 5-7) → maintain
if (energy === "low") → maintain
if (week < 2 in phase) → maintain
```

### Priority 3: Progression (Progress)
All green lights. Ready to level up.
```typescript
if (
  adherence >= 0.75 &&
  fatigue < 5 &&
  energy in ["normal", "high"] &&
  stable_weeks >= 2 &&
  pain_free_weeks >= 2 &&
  not_onboarding &&
  week >= 2
) → progress
```

## Progression Logic

When `progress` decision triggers:

### Step 1: Recovery Duration
```typescript
if (duration < 25 && duration < constraints.max_duration) {
  duration = min(25, constraints.max_duration);
  return { cause: "progression_duration" };
}
```

### Step 2: Volume
```typescript
if (volume < 1.3 && volume < constraints.max_volume) {
  volume += 0.1;
  return { cause: "progression_volume" };
}
```

### Step 3: Intensity
```typescript
if (intensity < "challenging" && intensity < constraints.max_intensity) {
  intensity = next_tier;
  volume = 1.0;  // RESET for safety
  return { cause: "progression_intensity", is_reset: true };
}
```

### Step 4: Ceiling
```typescript
return { cause: "none", at_true_ceiling: true };
```

## Scale-back Logic

When `scale_back` triggers:
```typescript
program = {
  sessions_per_week: 2,
  intensity: "light",
  duration: 20,
  volume: 1.0
};

constraints = {
  max_sessions: 2,
  max_intensity: "light",
  max_duration: 20,
  max_volume: 1.0
};

weeks_since_scale_back = 0;
consecutive_stable_weeks = 0;
```

Constraints persist across phase transitions to prevent immediate re-escalation.

## Constraint Management

### Setting Constraints
- **Scale-back**: Tighten all constraints to current scaled-back values
- **Progression**: Relax constraints to new achieved values

### Enforcing Constraints
- **Phase transitions**: Apply template, then clamp by constraints
- **Progression**: Check against constraints before applying

Example:
```typescript
// Phase transition to "maintaining" wants 25min
// But constraints say max_duration = 20 (from recovery)
proposed_duration = 25;
actual_duration = min(25, constraints.max_duration);  // = 20
```

## Completion Tracking

### Raw vs Planned
Every week tracks two totals:
```typescript
raw_done = scenario.sessions_completed;  // What actually happened
target = program.sessions_per_week;      // What was prescribed

planned_done = min(raw_done, target);    // Capped to target
extra = max(0, raw_done - target);       // Overflow
```

### Why Cap?
- Prevents "superhuman" adherence from skewing progression
- Allows tracking of overachievers without rewarding overtraining
- Keeps adherence calculations bounded (0-1)

### Adherence Calculation
```typescript
// For decision-making (clamped)
adherence_for_rules = min(done_capped, target) / target;

// For display (can show >100% if desired)
adherence_display = done_capped / target;
```

## Phase Transitions

### Onboarding → Building
```typescript
if (phase === "onboarding" && week === 3 && adherence >= 0.6) {
  transition_to("building");
}
```

### Building → Maintaining
```typescript
if (phase === "building" && adherence in [0.4, 0.75) for 4+ weeks) {
  transition_to("maintaining");
}
```

### Any → Recovering
```typescript
if (decision === "scale_back") {
  transition_to("recovering");
}
```

### Recovering → Maintaining
```typescript
if (phase === "recovering" && weeks >= 2 && adherence >= 0.5 && fatigue < 5) {
  transition_to("maintaining");
}
```

### Maintaining → Building
```typescript
if (phase === "maintaining" && weeks >= 4 && adherence >= 0.75 && fatigue < 5) {
  transition_to("building");
}
```

## Pain/Injury Handling

### Two Separate Counters

**consecutive_pain_free_weeks**
- Increments: When no pain/injury this week
- Resets: When pain/injury reported
- Used for: Blocking progression after injury

**weeks_since_scale_back**
- Increments: Each week after scale-back
- Resets: When scale-back triggers
- Used for: Post-fatigue stabilization

### Why Separate?
Pain recovery != fatigue recovery. Different timelines, different gates.

Example:
- Week 1: Scale back due to fatigue
- Week 2: `weeks_since_scale_back = 1`, still maintain
- Week 3: `weeks_since_scale_back = 2`, can progress IF other gates pass
- Week 4: Pain reported, `pain_free_weeks = 0`, progression blocked
- Week 5: No pain, `pain_free_weeks = 1`, still blocked
- Week 6: No pain, `pain_free_weeks = 2`, progression allowed

## Session Generation

### Exercise Selection
```typescript
session_types = {
  A: "Lower body + cardio",
  B: "Upper body + cardio",
  C: "Full body + conditioning"
};

pattern = {
  2_sessions: ["A", "B"],
  3_sessions: ["A", "B", "C"],
  4_sessions: ["A", "B", "C", "A"]
};
```

### Intensity Tiers
```typescript
light = {
  squat: "Bodyweight Squat, 2x8-10",
  push: "Knee Push-up, 2x6-8",
  cardio: "Marching in Place, 2-3 min"
};

moderate = {
  squat: "Bodyweight Squat, 3x10-12",
  push: "Push-up, 3x8-10",
  cardio: "Jumping Jacks, 1 min"
};

challenging = {
  squat: "Jump Squat, 3x8-10",
  push: "Decline Push-up, 3x10-12",
  cardio: "Burpees, 30-45 sec"
};
```

### Volume Scaling
```typescript
base_sets = exercise.base_sets;
scaled_sets = round(base_sets * volume_multiplier);
scaled_sets = max(1, scaled_sets);  // Never less than 1
```

### Minimum Viable
```typescript
duration = floor(standard_duration * 0.6);
volume = standard_volume * 0.5;
exercises = reduced_count;
```

## Invariant Enforcement

### Per-Week Checks
Runs after every `WeeklyEngineOutput` generation:
```typescript
validateWeeklyOutput(output) {
  assert(output.completion.planned <= output.program.target);
  assert(output.sessions.length === output.program.target);
  assert(output.completion.extra === max(0, raw - target));
  assert(0 <= output.completion.adherence <= 1);
  assert(0 <= output.state.fatigue <= 10);
  // ... 10 more checks
}
```

### Simulation Checks
Runs after full simulation:
```typescript
validateSimulation(sim) {
  assert(sum(weekly_planned) === final_total_planned);
  assert(sum(weekly_raw) === final_total_raw);
  assert(week_numbers are sequential);
  assert(decision_breakdown sums to total_weeks);
  // ... more checks
}
```

### Development Warnings
Non-fatal, for debugging:
```typescript
warnIfSuspicious(output) {
  if (fatigue >= 8 && decision !== "scale_back") warn();
  if (energy === "depleted" && decision !== "scale_back") warn();
  if (has_injury && decision === "progress") warn();
}
```

## Error Handling

### InvariantViolation
Fatal. Should never happen in production.
```typescript
throw new InvariantViolation(
  "Week 4: Done (3) > Target (2)",
  { week: 4, done: 3, target: 2 }
);
```

### Recovery
No automatic recovery. Fail fast, fix the bug.

## Data Flow
```
User Input (UI)
  ↓
Session Completion
  ↓
TrainingState (mutable)
  ↓
Evaluator (pure function)
  ↓
Program Mutation (mutates state)
  ↓
Session Generator (pure function)
  ↓
WeeklyEngineOutput (immutable)
  ↓
Validation (throws or passes)
  ↓
JSON Export
  ↓
UI Consumption
```

## Performance Considerations

### Efficiency
- Rolling windows: O(1) updates
- Decision evaluation: O(1) checks
- Session generation: O(sessions_per_week)
- Validation: O(invariant_count)

### Scalability
- State size: ~50 fields
- History size: Unbounded array (trim after 52 weeks)
- Output size: ~5KB JSON per week

### Optimization Opportunities
- Cache exercise library lookups
- Memoize fatigue calculations
- Batch validation checks

## Testing Strategy

### Unit Tests (TODO)
```typescript
test("adherence clamped to 1.0", () => {
  const state = createState({ done: 5, target: 3 });
  expect(state.adherence_rate_2week).toBeLessThanOrEqual(1.0);
});
```

### Integration Tests (Scenarios)
9 scenarios cover:
- Perfect adherence → Progressive volume increases
- Moderate adherence → Stable maintenance
- High fatigue → Scale-back and recovery
- Gaps → Return-to-training flow
- Underfueling → Energy-based scale-back
- Low adherence → Adherence-based scale-back
- Recovery → Phase transitions
- Inconsistency → Plateau detection
- Pain/injury → Safety gates

### Regression Tests
Saved JSON outputs serve as golden snapshots.

## Security & Privacy

### Data Storage
- Local-first (no cloud required)
- SQLite/Realm for mobile
- No mandatory accounts
- Optional cloud sync (Phase 4)

### Data Minimization
- No personally identifiable info required
- No calorie counting mandates
- No weight tracking required
- Optional meal logging (educational only)

### Privacy by Design
- All processing happens client-side
- No server-side ML inference
- No behavioral tracking beyond app
- No data sharing with third parties

## Extensibility Points

### New Frameworks
```typescript
interface Framework {
  name: string;
  progression_rules: ProgressionRules;
  exercise_library: ExerciseLibrary;
  session_templates: SessionTemplate[];
}
```

### New Equipment
```typescript
enum Equipment {
  Bodyweight,
  Dumbbells,
  Barbell,
  Gym
}

// Modify exercise library per equipment tier
```

### New Modalities
```typescript
enum Modality {
  Strength,
  Conditioning,
  Movement,
  Hybrid
}

// Adjust progression priorities per modality
```

## Known Limitations (MVP)

1. **No 20→25min progression** - Deferred until UI testing
2. **Bodyweight only** - Equipment variations Phase 3+
3. **Single framework** - Strength/conditioning split Phase 3+
4. **No meal logging** - Optional feature Phase 3+
5. **Fixed session types** - A/B/C pattern only
6. **No user preferences** - Tone/style customization Phase 2+

## FAQ

**Q: Why not auto-increase sessions per week?**
A: Busy adults (30-55) have limited time. Frequency increases require explicit opt-in.

**Q: Why reset volume when intensity increases?**
A: Safety. New movement complexity requires adaptation before volume loading.

**Q: Why separate pain and fatigue tracking?**
A: Different recovery timelines. Pain needs structural healing, fatigue needs rest.

**Q: Why cap adherence at 100%?**
A: Prevents "superhuman" adherence from triggering premature progression.

**Q: Why minimum viable sessions?**
A: Reduces all-or-nothing thinking. "Good enough" > skipping entirely.

**Q: Why no calorie counting?**
A: Fueling awareness, not restriction. Patterns matter more than numbers.

**Q: Why local-first?**
A: Privacy, reliability, no server dependencies.

**Q: Why JSON output contract?**
A: UI framework agnostic. Works with React, Vue, Swift, Kotlin, etc.