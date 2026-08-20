# LD Hero Pointz

D&D 5e hero point management for Foundry VTT with GM controls, synchronized player spending, and activity logging.

## Module details

- Version: `1.3.14`
- Compatibility: Foundry VTT `13+` (verified `14`)
- Game System: D&D 5e / D&D 2024
- Distribution: Premium Patreon-gated module
- License: Lisa's Dungeon Proprietary License

## Features

- GM management window for awarding hero points to a targeted actor
- Actor sheet controls for awarding, subtracting, resetting, or zeroing points
- Player-facing chat actions for eligible d20 rolls and death saves
- Socket-based activity logging across connected clients
- Activity log viewer with export, actor filtering, log clearing, and point reduction
- NPC support through explicit enable/disable actions
- Uncapped hero point awards with level-up refreshes that never reduce an existing total

## Installation

This is a premium Patreon-gated module.

Manifest URL:

```text
https://github.com/lisasdungeon/ld-hero-pointz/releases/latest/download/module.json
```

## Usage

### GM workflow

1. Open **World Settings**.
2. Open **Hero Point Management**.
3. Select a token and pull its actor UUID into the form, or paste the UUID directly.
4. Set the number of points to add.
5. Award hero points.
6. Use the log viewer to audit spending or reduce points when needed.

### Player workflow

1. Make an eligible roll.
2. Use the hero point action shown in chat.
3. Confirm the spend.
4. The point total updates for everyone immediately.

Death save spends also update the actor's death success and failure counts. A natural 1 undoes both failures from that throw.

## Support

- Patreon: https://patreon.com/LisasDungeon
- Issues: https://github.com/lisasdungeon/ld-hero-pointz/issues
- Discord: MystryssLysa
- Email: Lisasdungeon@gmail.com

## Notes

- Premium modules are Patreon-gated but not marked as protected in the manifest.
- This repository is maintained as a standalone module.
- Hero points are intentionally uncapped so GMs can adjust totals without hitting a hard ceiling.
