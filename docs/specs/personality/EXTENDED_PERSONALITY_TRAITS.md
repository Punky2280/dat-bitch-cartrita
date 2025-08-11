# Extended Personality Trait System (Draft)

Goal: Support >40 stable personality combinations through weighted trait axes with versioned profiles and preview capability.

## Trait Axes (Initial Set)
| Axis | Key | Description | Range | Notes |
|------|-----|-------------|-------|-------|
| Analytical vs. Intuitive | analytical | Preference for structured reasoning vs. associative leaps | 0-5 | 0 intuitive, 5 analytical |
| Empathy | empathy | Depth of emotional mirroring | 0-5 | Higher -> more supportive language |
| Humor | humor | Playfulness & light metaphor usage | 0-5 | Guard rails for context appropriateness |
| Formality | formality | Professional tone vs. casual | 0-5 | Mid range = hybrid |
| Verbosity | verbosity | Response length tendency | 0-5 | 0 terse, 5 expansive |
| Creativity | creativity | Divergence & novelty in suggestions | 0-5 | Impacts temperature/tool exploration |
| Proactivity | proactivity | Initiative in offering next steps | 0-5 | Higher suggests follow-ups |
| Supportiveness | support | Encouragement & motivational framing | 0-5 | Pairs with empathy |
| Caution | caution | Risk-avoidance / disclaimers | 0-5 | Higher -> more safety language |
| Exploratory Depth | exploratory | Multi-angle analysis depth | 0-5 | Drives chain-of-thought breadth |

Minimum needed for >40 combos: choose any 3 axis triads for preset matrix; but we keep full 10-axis vector internally.

## Data Model Proposal
Table: user_personality_profiles
```
id SERIAL PK
user_id FK users(id)
profile_name text
traits jsonb  -- { analytical:3, empathy:4, ... }
is_active boolean default false
version int default 1
created_at timestamptz default now()
updated_at timestamptz default now()
source text  -- 'user','system','import'
```

Add index on (user_id,is_active) partial.

## API Endpoints (Draft)
GET /api/personality/profiles -> list (id, name, active, summary vector)
POST /api/personality/profiles -> create { profile_name, traits }
PUT /api/personality/profiles/:id -> update traits/name
POST /api/personality/profiles/:id/activate -> set active & deactivate others
POST /api/personality/profiles/preview -> returns synthetic sample response for provided traits

## Validation Rules
- Each trait 0–5 integer (later allow decimal precision 0.5)
- Sum-of-extremes guard: max 5 simultaneous traits at level 5 to avoid over-amplification.
- Caution + Creativity both >4 triggers soft warning (conflicting styles).

## Combination Generation
Preset library produced by selecting representative vectors (k-means over historical chosen vectors) then labeling.
Stored with metadata: { id:'innovator_supportive', traits:{...}, label, description }.

## Runtime Application
Active profile injected into agent supervisor context as personality_traits.
Downstream agents adjust prompt templates (temperature, style adjectives, length budgets).

## Observability
Add counter personality_profile_activations_total (labels: profile_id, source).

## Security & Privacy
Profiles contain no PII. Changes audited with before/after snapshot hashed.

## Open Questions
- Adaptive learning feedback pipeline definition.
- Versioning strategy for evolving trait axes.

---
Draft v0.1
