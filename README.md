# RNK™ Reserves

Premium D&D 2024 hero point management for Foundry VTT with GM controls, synchronized player spending, and activity logging.

## Module details

- Version: `1.3.9`
- Compatibility: Foundry VTT `13+` (verified `14`)
- Game System: D&D 5e / D&D 2024
- Distribution: Premium Patreon-gated module
- License: RNK Proprietary License

## Features

- GM management window for awarding hero points to a targeted actor
- Actor sheet controls for awarding, subtracting, resetting, or zeroing points
- Player-facing chat actions for eligible d20 rolls and death saves
- Socket-based synchronization across connected clients
- Activity log viewer with export, actor filtering, log clearing, and point reduction
- NPC support through explicit enable/disable actions

## Installation

This is a premium Patreon-gated module.

Manifest URL:

```text
https://github.com/RNK-Enterprise/rnk-reserves/releases/latest/download/module.json
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

## Support

- Patreon: https://www.patreon.com/RagNaroks
- Issues: https://github.com/RNK-Enterprise/rnk-reserves/issues

## Notes

- Premium modules are Patreon-gated but not marked as protected in the manifest.
- This repository is maintained as a standalone module.
