# Changelog

## 1.3.13

- Compliance and hardening release: sole Lisa's Dungeon authorship and contact fields (Discord MystryssLysa, email Lisasdungeon@gmail.com, Patreon LisasDungeon); lazy loading / trigger-based startup where needed; 500 LOC file cap; full source line coverage; no emoji or AI references in the shipped package.
- Compliance pass: sole author Lisa's Dungeon with Discord MystryssLysa / email Lisasdungeon@gmail.com / Patreon LisasDungeon; enforce 500 LOC file cap; remove non-compliant branding and symbols where present.
- Lazy-load management and log-viewer Application classes from settings menus (dynamic import on open); entry point no longer eagerly imports heavy UI.
- Full line coverage on all source files under `src/` (hooks, socket, logger, settings, main, apps).

## 1.3.12

- Fixed the GM Management window and Activity Log Viewer rendering completely unstyled: the CSS still carried a leftover "-reserves-" segment from the RNK Reserves rebrand (e.g. `.ld-hero-pointz-reserves-buttons` instead of `.ld-hero-pointz-buttons`), so none of the module's own selectors ever matched the real DOM.
- Actor sheet GM controls (award/subtract/reset/zero) now register against the modern dnd5e 2024-rules character/NPC sheet hooks, alongside the legacy hook name for older sheets, instead of only the legacy hook and jQuery API.
- Fixed a stale-read race where spending a hero point from chat could clobber a concurrent change made while the confirmation dialog was open.
- The GM controls panel no longer stacks duplicate copies of itself on repeated sheet renders.
- Socket-driven hero point updates now catch failures (e.g. a permission error on a client that doesn't own the actor) instead of throwing an unhandled rejection on every broadcast.
- The activity log's read-modify-write is now properly awaited everywhere it's called, instead of being fired and forgotten.
- `LdHeroPointz.enableNPC()` no longer persists `NaN` hero points when called with a non-numeric argument.
- Removed a dead, never-wired form submit handler.
- Fixed `build-release.mjs`, which shelled out to `powershell.exe` and never worked outside Windows.
- Added a real automated test suite (25 tests) covering the logging system, socket sync, and the hero point baseline calculation.

## 1.3.11

- Removed the hard hero point cap from GM awards and level-up refreshes.
- Updated the README and release metadata to reflect uncapped hero point handling.

## 1.3.10

- Verified compatibility against Foundry VTT v14 while maintaining support for v13+.
- Updated premium manifest and documentation to reflect verified v14 compatibility.

## 1.3.9

- fixed the hero-point reduction dialog callback to safely resolve the dialog root
- localized the management window, log viewer, chat actions, and GM notifications
- fixed log export summary totals
- added real local validation and release build tooling
- refreshed the premium Patreon-gated README and release metadata
