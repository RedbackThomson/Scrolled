# Server Profile & Rules Engine PRD

## Overview

The application currently exposes canonical Mushroom Game data extracted from WZ files. However, Mushroom Game private servers frequently alter gameplay systems such as EXP rates, drop behavior, and stat roll calculations.

This feature introduces a modular Server Profile & Rules Engine that allows the application to adapt displayed calculations and gameplay metadata to a specific private server without requiring users to manually configure formulas or write custom code.

The initial release will support:

1. EXP rate overrides
2. Dropped equipment stat range calculations

The system must be designed for long-term extensibility so future forks and contributors can easily add:

- additional configurable systems
- new server profiles
- new calculation logic
- custom rule packs

---

## Goals

### Primary Goals

- Allow users to tailor the wiki experience to their private server
- Minimize onboarding complexity
- Automatically detect common servers where possible
- Avoid arbitrary user scripting
- Make server-specific logic modular and testable
- Support future extension without architectural rewrites

### Non-Goals

- Full emulation of server-side game logic
- Runtime execution of arbitrary JavaScript plugins
- Perfect automatic server detection
- Supporting every private server in the initial release

---

## User Experience

### First-Time Setup Flow

#### Step 1 — Import WZ Files

User imports their game files.

#### Step 2 — Server Detection

Application scans imported files for known server fingerprints.

Example sources:

- `String.wz`
- EULA text
- custom URLs
- branding strings
- launcher metadata

Example detection:

```
Detected: MushroomRoyals
Confidence: High
Matched "MushroomRoyals" in String.wz/EULA
```

#### Step 3 — Confirmation

User chooses:

- Use detected profile
- Choose another profile
- Customize manually

Most users should finish onboarding here.

---

## Core Concepts

### Server Profile

A server profile represents a collection of gameplay rule overrides.

Example:

```ts
interface ServerProfile {
  id: string;
  name: string;
  description?: string;
  inherits?: string;
  rates: {
    exp?: number;
  };
  systems: {
    equipStatCalculation?: string;
  };
  fingerprints?: ServerFingerprint[];
}
```

### Rules Systems

Rules systems are modular calculators responsible for server-specific logic.

Initial systems:

| System                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| EXP Rates              | Multiplies displayed EXP values               |
| Equip Stat Calculation | Calculates possible dropped equip stat ranges |

Future examples:

- scroll behavior
- monster HP formulas
- leveling curves
- crafting systems
- boss timers
- damage formulas
- spawn logic

### Calculator Registry

All calculators are registered centrally.

Example:

```ts
registerEquipStatCalculator({
  id: 'vanilla-v83',
  calculate() {},
});

registerEquipStatCalculator({
  id: 'mapleroyals-v1',
  calculate() {},
});
```

Profiles reference calculators by ID. This avoids embedding logic directly into profiles.

---

## Initial Feature Specifications

### 1. EXP Rate Overrides

**Requirements**

- Allow profiles to specify EXP multipliers
- Apply multipliers consistently across:
  - mob EXP displays
  - quest reward EXP
  - leveling calculators
  - training guides

**Example**

```json
{
  "rates": {
    "exp": 3
  }
}
```

### 2. Equip Stat Range Calculations

**Requirements**

- Allow servers to define custom stat roll formulas
- Support server-specific "godly" item behavior
- Allow formulas to vary independently from base game data
- Display stat ranges in item UI

**Example Output**

```
STR: 15 (13 ~ 17 or 22)
```

**Initial Built-In Calculators**

| ID               | Description                    |
| ---------------- | ------------------------------ |
| `vanilla-v83`    | Default GMS-like variance      |
| `mapleroyals-v1` | MapleRoyals custom godly logic |

---

## Server Fingerprinting

### Purpose

Reduce onboarding complexity by detecting likely server profiles automatically.

### Fingerprint Model

```ts
interface ServerFingerprint {
  file: string;
  path?: string;
  contains: string;
  weight: number;
}
```

### Detection Process

1. Scan known files
2. Aggregate weighted matches
3. Select highest confidence profile
4. Prompt user for confirmation

### Example

```json
{
  "id": "mapleroyals",
  "fingerprints": [
    {
      "file": "String.wz",
      "contains": "MapleRoyals",
      "weight": 100
    }
  ]
}
```

---

## Extensibility Requirements

The system must support easy future expansion.

### Adding New Profiles

A new profile should require only:

- a JSON profile definition
- optional fingerprint metadata
- references to existing calculators

No core application modification should be required.

### Profile provisioning (built-in vs per-deployment)

A profile reaches the app one of two ways:

- **Built-in** — the app ships the baseline `vanilla-v83` plus a curated set of
  profiles (currently `mapleroyals-compatible`) so the generic
  bring-your-own-files site can detect/select them and persist the choice as
  local user state. This set is deliberately small — the app does **not** bake in
  one profile per hosted deployment.
- **Per-deployment (fixed-dataset sites)** — the deployment owns a
  `server-profile.json` and the headless build (`dataset:build --profile-file`)
  **bakes the full profile config into the dataset's own game DB**. It travels
  *as* the dataset; nothing is applied as local install state, and the app does
  not need to ship that profile. The only hard app dependency is the
  `equipStatCalculation` **calculator** the profile names — that's code, keyed by
  id, so the pinned app must register it. A profile id the app has never seen is
  fine; an unknown calculator is an "update the app" error.

This is why the calculator and the profile are split: a fork can host a server
the app's authors never heard of just by supplying a profile file, but a genuinely
new stat algorithm still requires shipping calculator code.

### Adding New Systems

Future systems must be pluggable.

Example:

```ts
systems: {
  equipStatCalculation: "mapleroyals-v1",
  scrollBehavior: "custom-scroll-v2"
}
```

The architecture must not assume only the initial two systems exist.

### Adding New Calculators

New calculators should:

- self-register
- expose typed interfaces
- remain independently testable

### Inheritance Support

Profiles may inherit from base profiles.

Example:

```json
{
  "id": "my-custom-server",
  "inherits": "vanilla-v83",
  "rates": {
    "exp": 8
  }
}
```

This prevents duplication.

---

## Persistence

Selected profiles must persist:

- alongside generated databases
- within exported/imported application data
- across browser sessions

---

## Import / Export

Users should be able to export/import profiles.

Example:

```json
{
  "profile": {
    "id": "custom-server",
    "inherits": "vanilla-v83",
    "rates": {
      "exp": 6
    }
  }
}
```

---

## Security Requirements

### Must Not

- Execute arbitrary JavaScript from imported profiles
- Dynamically evaluate code strings
- Permit unrestricted plugin execution

### Allowed

- Declarative configuration
- Registered trusted calculators
- Open-source forks adding native calculators

---

## Technical Architecture

### Recommended Structure

```
/src/serverProfiles/
/src/serverProfiles/profiles/
/src/serverProfiles/fingerprints/
/src/serverProfiles/calculators/
```

### Example Registry Structure

```
calculators/
  equipStats/
    vanillaV83.ts
    mapleRoyals.ts            # calculator is code → ships in the app, keyed by id
profiles/
  mapleroyals-compatible.json # generic-site profiles ship as drop-in JSON
```

The baseline `vanilla-v83` profile lives in code (`registry.ts`); curated
generic-site profiles ship as drop-in JSON in `profiles/`. A profile is config
(rates, fingerprints, name, and the id of a calculator the app provides), so a
fixed deployment can instead supply its own without the app shipping it — see
"Profile provisioning" below.

### Public APIs

**Profile Resolution**

```ts
resolveServerProfile(profileId);
```

**Equip Stat Calculation**

```ts
calculateEquipRanges(profile, equip);
```

**EXP Transformation**

```ts
applyExpRate(profile, exp);
```

---

## Acceptance Criteria

### MVP Acceptance

- User can select a server profile
- EXP values update correctly
- Equip stat ranges update correctly
- Baseline `vanilla-v83` profile included
- MapleRoyals-compatible profile included for the generic site
- Custom equip-stat calculators registered by id (e.g. `mapleroyals-v1`)
- Fingerprinting detects a server from WZ data given a profile's fingerprints
- A per-deployment profile (`--profile-file`) bakes into the dataset and renders
  under its own rates/calculator without the app having to ship it
- Profiles persist across sessions (generic site) / travel in the dataset (fixed)
- Architecture supports future rule systems

---

## Future Enhancements

### Possible Future Systems

- drop rates
- meso rates
- scroll success rates
- custom item data
- rebirth systems
- monster HP scaling
- quest modifications
- custom NPC shops
- event systems
- skill balance overrides

### Possible Future Features

- community profile repository
- profile sharing URLs
- live profile updates
- profile versioning
- compatibility validation
- visual profile editor
- server comparison mode
