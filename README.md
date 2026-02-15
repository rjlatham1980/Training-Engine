# Fitness AI Training Engine - MVP

A retention-first, adaptive training system that intelligently scales workout programs based on adherence, recovery, and injury status.

## 🎯 Core Philosophy

**Retention over engagement. Consistency beats intensity.**

This engine is designed for busy adults (30-55) who struggle with consistency, not motivation. It assumes:
- Life happens (gaps are normal, not failures)
- Recovery matters more than pushing harder
- Trust compounds through honest, adaptive feedback
- Behavior change > short-term motivation spikes

## 🏗️ Architecture Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     WEEKLY EVALUATION CYCLE                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input State                                                 │
│  ├─ Completion data (sessions done this week)               │
│  ├─ Mind modulators (sleep, stress, readiness)              │
│  ├─ Fuel modulators (energy, hunger)                        │
│  └─ Pain/injury flags                                        │
│                                                               │
│  ↓                                                            │
│                                                               │
│  Evaluation (evaluator.ts)                                   │
│  ├─ Calculate fatigue score (0-10)                          │
│  ├─ Determine energy context (depleted/low/normal/high)     │
│  ├─ Check safety gates (pain-free, post-recovery)           │
│  └─ Decide: scale_back | maintain | progress                │
│                                                               │
│  ↓                                                            │
│                                                               │
│  Program Mutation (program_mutation.ts)                      │
│  ├─ Scale-back: 2/week, light, 20min, 1.0x volume          │
│  ├─ Progress: duration → volume → intensity                 │
│  └─ Constraints: enforce limits from scale-backs            │
│                                                               │
│  ↓                                                            │
│                                                               │
│  Session Generation (plan.ts)                                │
│  ├─ Generate sessions matching current program              │
│  ├─ Create minimum viable alternatives                      │
│  └─ Add coaching messages                                   │
│                                                               │
│  ↓                                                            │
│                                                               │
│  Output (engine_output.ts)                                   │
│  └─ WeeklyEngineOutput (JSON-serializable)                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Core Modules

### State Management
- **`models.ts`** - Core data types (TrainingState, ProgramConfig, Session)
- **`engine_output.ts`** - Canonical output contract for UI consumption

### Decision Engine
- **`evaluator.ts`** - Weekly decision logic (scale-back, maintain, progress)
- **`program_mutation.ts`** - Program changes with constraint enforcement
- **`phase.ts`** - Phase transitions (onboarding → building → maintaining → recovering)

### Modulators
- **`fatigue.ts`** - Sleep/stress/readiness → fatigue score (0-10)
- **`energy.ts`** - Hunger/energy → context (depleted/low/normal/high)

### Session Generation
- **`plan.ts`** - Weekly plan generator (sessions + coaching)
- **`session_generator.ts`** - Exercise selection by intensity tier

### Quality Assurance
- **`invariants.ts`** - Production guardrails (15+ validation rules)

## 🚦 Decision Tree
```
EVALUATE WEEKLY STATE
│
├─ HIGH PRIORITY: Safety Gates
│  ├─ Active injury? → SCALE BACK
│  ├─ Multiple pain reports? → SCALE BACK
│  ├─ Fatigue ≥7/10? → SCALE BACK
│  ├─ Energy depleted? → SCALE BACK
│  ├─ Adherence <40% for 2+ weeks? → SCALE BACK
│  └─ Inactive ≥3 weeks? → SCALE BACK
│
├─ MEDIUM PRIORITY: Stability Gates
│  ├─ In onboarding (week 1-3)? → MAINTAIN
│  ├─ Recent pain flag? → MAINTAIN
│  ├─ <2 pain-free weeks after injury? → MAINTAIN
│  ├─ <2 weeks since scale-back? → MAINTAIN
│  ├─ Adherence 40-75%? → MAINTAIN
│  ├─ Fatigue 5-7/10? → MAINTAIN
│  ├─ Energy low? → MAINTAIN
│  ├─ <2 weeks at current level? → MAINTAIN
│  └─ Inactive 1–2 weeks? → MAINTAIN
│
└─ LOW PRIORITY: Progression Gates
   ├─ Adherence ≥75%? ✓
   ├─ Fatigue <5/10? ✓
   ├─ Energy normal/high? ✓
   ├─ 2+ stable weeks? ✓
   ├─ 2+ pain-free weeks? ✓
   ├─ Not onboarding? ✓
   └─ Week ≥2 in phase? ✓
      │
      └─ All gates passed? → PROGRESS
         ├─ Duration <25min? → Increase to 25min
         ├─ Volume <1.3x? → Increase by 0.1x
         └─ Intensity <challenging? → Increase + reset volume
```

## 🔄 Progression Ladder
```
Recovery Path:
20min, light, 1.0x → 25min, light, 1.0x

Volume Path (at 25min, light):
1.0x → 1.1x → 1.2x → 1.3x

Intensity Path:
light@1.3x → moderate@1.0x (volume resets for safety)
moderate@1.3x → challenging@1.0x

Ceiling:
challenging@1.3x@25min = Maximum capacity
```

## 📊 Output Contract

### WeeklyEngineOutput
```typescript
interface WeeklyEngineOutput {
  // Identification
  week_number: number;
  week_start_iso: string;
  
  // Context
  phase: "onboarding" | "building" | "maintaining" | "recovering";
  phase_week: number;
  
  // State snapshot
  state: {
    fatigue_score: number;        // 0-10
    energy_context: string;        // depleted/low/normal/high
    adherence_rate_2week: number;  // 0.0-1.0
    pain_flags: string[];
    has_active_injury: boolean;
  };
  
  // Program (what was prescribed)
  program: {
    sessions_per_week: number;     // 2-4
    intensity_tier: string;        // light/moderate/challenging
    session_duration_minutes: number;
    volume_multiplier: number;     // 1.0-1.3
  };
  
  // Generated workouts
  sessions: Session[];
  minimum_viable_sessions: Session[];
  
  // Completion tracking
  completion: {
    raw_sessions_completed: number;
    planned_sessions_completed: number;  // capped to target
    extra_sessions: number;
    adherence_this_week: number;         // 0.0-1.0
  };
  
  // Decision & coaching
  decision: {
    type: "progress" | "maintain" | "scale_back";
    reason: string;
    coaching_message: string;
    coach_tone: "encouraging" | "steady" | "gentle" | "celebratory";
  };
  
  // Changes
  program_change: {
    occurred: boolean;
    description?: string;
    cause?: string;
  };
  
  // Safety
  safety_notes: string[];
  
  // Preview
  next_week_program: ProgramConfig;
}
```

## 🛡️ Invariants & Guarantees

The engine enforces these invariants on every output:

1. **Completion Honesty**: `planned_sessions ≤ target_sessions`
2. **Session Count**: `generated_sessions.length === target_sessions`
3. **Extra Sessions**: Always noted when `raw > target`
4. **Adherence Bounds**: Always `0.0 ≤ adherence ≤ 1.0`
5. **Fatigue Bounds**: Always `0 ≤ fatigue ≤ 10`
6. **Total Consistency**: `sum(weekly_planned) === final_total_planned`
7. **Energy Validity**: Only `depleted | low | normal | high`
8. **Intensity Validity**: Only `light | moderate | challenging`

Violations throw `InvariantViolation` immediately.

## 🚀 Quick Start

### Run Simulations
```bash
npm install
npm run sim
```

Outputs:
- Console: Human-readable tables
- Files: `./simulation_outputs/*.json`

### Integrate with UI
```typescript
import { WeeklyEngineOutput } from "./engine_output";
import { validateWeeklyOutput } from "./invariants";

// Load a saved simulation
const simulation = require("./simulation_outputs/perfect_adherence_*.json");

// Render each week
simulation.weeks.forEach((week: WeeklyEngineOutput) => {
  // Validate (throws on error)
  validateWeeklyOutput(week);
  
  // Render UI components
  renderWeeklyPlan(week.program, week.sessions);
  renderCoachingMessage(week.decision.coaching_message, week.decision.coach_tone);
  renderProgressBar(week.completion.adherence_this_week);
  
  if (week.safety_notes.length > 0) {
    renderSafetyAlert(week.safety_notes);
  }
});
```

## 📁 Project Structure
```
Engine/
├── src/
│   ├── models.ts              # Core data types
│   ├── evaluator.ts           # Decision logic
│   ├── program_mutation.ts    # Program changes
│   ├── phase.ts               # Phase transitions
│   ├── fatigue.ts             # Fatigue scoring
│   ├── energy.ts              # Energy context
│   ├── plan.ts                # Session generation
│   ├── engine_output.ts       # Output contract
│   ├── invariants.ts          # Validation rules
│   └── simulator/
│       ├── scenarios.ts       # Test scenarios
│       └── run.ts             # Simulation harness
├── simulation_outputs/        # Saved JSON files
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Testing

### Validation
Every simulation runs through:
- 15+ invariant checks per week
- Total consistency validation
- Suspicious pattern warnings

### Scenarios
9 test scenarios cover:
- Perfect adherence
- Moderate adherence
- High fatigue episodes
- Three-week gaps
- Underfueling patterns
- Persistent low adherence
- Recovery progressions
- Inconsistent maintainers
- Pain/injury episodes

### Regression
Saved JSON outputs serve as regression snapshots.

## 🎨 Design Decisions

### Why separate pain gates from fatigue gates?
Pain recovery requires different timelines than fatigue recovery. Mixing them creates whiplash.

### Why cap adherence at 100%?
Prevents "superhuman" adherence (150%) from triggering premature progression. Extra sessions are tracked separately.

### Why reset volume when intensity increases?
Safety. Challenging@1.0x is safer than moderate@1.3x when adapting to new movement complexity.

### Why constraints persist across phase transitions?
A scale-back sets safe limits. Phase changes shouldn't silently reset them.

### Why minimum viable sessions?
Life happens. Having a "good enough" option prevents all-or-nothing thinking.

## 🔮 Future Roadmap

### Phase 2: UI Integration
- React Native mobile app
- SQLite local-first storage
- Weekly check-in flows
- Session completion logging

### Phase 3: Advanced Features
- Equipment variations (dumbbells, barbell, gym)
- Multiple frameworks (strength, conditioning, movement)
- User preferences (tone, messaging style)
- Meal logging (optional, educational)

### Phase 4: Cloud Sync
- Optional cloud backup
- Cross-device sync
- Advanced analytics
- Monthly reflections

## 📝 License

[Your license here]

## 🤝 Contributing

This is an MVP. Contributions welcome after UI integration is complete.

## 📧 Contact

[Your contact info]
