# RNK™ Reserves

**Version**: 1.3.0  
**Status**: Production Ready  
**License**: RNK Proprietary  
**Foundry VTT Compatibility**: v12+, verified on v13  
**Game System**: D&D 5th Edition (2024 Rules)  
**Module Type**: Premium System Enhancement  

---

## Overview

RNK Reserves is a premium module that implements the D&D 2024 Hero Points system with GM controls and real-time player integration. Award points to your party, let players click buttons to spend them on rerolls, bonuses, and healing—all synchronized automatically across your table.

---

## Quick Start

1. Enable RNK Reserves in your world
2. Go to an actor sheet and award Hero Points via the control panel
3. Players will see Hero Point buttons on their roll results
4. Click to spend points on rerolls, bonuses, or healing
5. All changes sync in real-time to all players

---

## Features

**GM Controls**:
- Award Hero Points directly from actor sheets
- Set maximum points per character
- Configure session-start point awards
- Batch award points to entire party
- Reset points per character or globally
- Real-time synchronization across all clients

**Player Integration**:
- Hero Point buttons on all roll results in chat
- One-click spending for rerolls, bonuses, healing
- Confirmation dialogs prevent accidents
- Display current point total always visible
- Sound/visual feedback on spend actions
- Works with all D&D 5e roll types

**D&D 2024 Compliance**:
- Full Hero Points rules implementation
- Reroll mechanic (D&D 2024 style)
- Bonus actions with rerolls
- Healing on spends
- All official interactions supported
- Seamless system integration

**Advanced Features**:
- Configurable points per session
- Per-character point limits
- NPC Hero Points support
- Auto-award at session start
- Persistent point storage
- Modal spending confirmation
- Comprehensive logging system
- Per-player audit trails

**Technical**:
- Socket-based real-time synchronization
- Minimal performance impact
- Works with all character sheets
- No conflicts with other modules
- Full D&D 5e system compatibility

---

## Installation

This is a PREMIUM module for RNK Patreon supporters only.

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste this manifest URL:
   ```
   https://github.com/RNK-Enterprise/rnk-reserves/releases/latest/download/module.json
   ```
4. Click **Install**
5. Activate the module in your D&D 5e world
6. Done!

### Requirements

- Foundry VTT v12 or higher
- D&D 5th Edition System
- Active Patreon supporter (Copper tier or higher)

---

## Usage

### For Game Masters

**Awarding Hero Points**:

1. Open any character sheet
2. Look for the "RNK Reserves" control panel
3. Use the + button to award points
4. Configure the number of points
5. Click "Award" to apply immediately
6. All players see the update in real-time

**Batch Operations**:

1. Open the RNK Reserves panel
2. Click "Bulk Award"
3. Select multiple characters
4. Enter points to award
5. Click "Award to All"
6. Perfect for session start or level-ups

**Configuration**:

Access settings via **World Settings → Module Settings → RNK Reserves**:

| Setting | Default | Purpose |
|---------|---------|---------|
| **Enable Reserves** | On | Master toggle for the module |
| **Points Per Session** | 1 | Hero Points awarded at start (D&D 2024: 1-3) |
| **Maximum Points** | 5 | Highest point total per character |
| **Allow NPC Points** | On | Enable Hero Points for NPCs |
| **Auto-Award at Start** | On | Automatically give points when session starts |
| **Show in Sheet** | On | Display points prominently on character sheet |
| **Sound Effects** | On | Audio feedback for spend actions |
| **Require Confirmation** | On | Confirm before spending points |
| **Log Spending** | On | Track all point transactions |

### For Players

**Viewing Your Points**:

- Points display prominently on your character sheet
- Also shown in the character portrait area
- Updated instantly when GM awards points
- Always visible during gameplay

**Spending Hero Points**:

1. Make any roll (attack, skill, save, etc.)
2. Your roll result appears in chat
3. Below the roll, you'll see a Hero Point button
4. Click the button to spend a point
5. Confirm the action when prompted
6. The reroll or bonus applies instantly
7. You'll see updated results in chat

**Understanding Point Effects**:

- **Reroll**: Roll again and use the better result
- **Bonus**: Add a bonus to your roll
- **Healing**: Restore hit points during rest
- **Other**: Custom effects per your GM's rules

---

## Detailed Mechanics

### Hero Point Economy

Points work like this:

1. **Award**: GM gives you 1-3 points at session start
2. **Cap**: You can have maximum 5 points (configurable)
3. **Spend**: Click chat button to spend a point
4. **Effect**: Reroll, bonus, healing, or custom
5. **Gain**: Earn from story moments, leveling, etc.

### Reroll Mechanics

When you spend a point to reroll:

1. Your original roll result displays
2. A new roll is immediately made
3. You use whichever result is better
4. Both rolls show in the chat message
5. Your point total decreases by 1

### Synchronization

Changes happen instantly across your table:

1. GM awards 2 points to Fighter
2. Fighter's player sees +2 instantly
3. All party members see the change
4. No refresh needed - automatic update
5. Works on different devices/connections

---

## Troubleshooting

### Points Not Appearing on Sheets

**Problem**: Character sheet doesn't show point display

**Solutions**:
1. Verify "Show in Sheet" is enabled in settings
2. Close and reopen the character sheet
3. Refresh the browser (Ctrl+F5)
4. Check that the actor has points assigned
5. Try a different character sheet style
6. Verify the D&D 5e system is active

### Buttons Not Appearing on Rolls

**Problem**: Hero Point buttons don't show in chat

**Solutions**:
1. Verify "Enable Reserves" is On in settings
2. Check that the character has Hero Points available
3. Make sure you're using D&D 5e system rolls
4. Refresh the browser
5. Check if another module is conflicting
6. Try disabling other modules to test
7. Check browser console (F12) for errors

### Points Not Syncing

**Problem**: Point changes don't appear for other players

**Solutions**:
1. Verify socket module is enabled
2. Check network connection
3. Refresh the page if lag persists
4. Verify all clients are on same Foundry version
5. Check server logs for connection issues
6. Try reloading the scene

### Spending Confirmation Loop

**Problem**: Confirmation dialog keeps appearing

**Solutions**:
1. Check "Require Confirmation" in settings
2. Disable if you don't want confirmation
3. Try refreshing the browser
4. Check for conflicting modules
5. Clear browser cache and reload

---

## Advanced Configuration

### Custom Point Values

You can adjust point economy for house rules:

```javascript
// Via macro - set a character to specific points
game.rnkReserves.setPoints("tokενId", 5);

// Get current points
const points = game.rnkReserves.getPoints("tokenId");

// Award points
game.rnkReserves.awardPoints("tokenId", 2);
```

### Conditional Spending

Set up rules for when points can be spent:

```javascript
// Only allow spending on skill checks
game.rnkReserves.setSpendRule("skillOnly", (roll) => {
  return roll.type === "skill";
});
```

---

## Support RNK Enterprise

RNK Reserves is a premium module designed for Patreon supporters. Your support directly funds:

- Continued development and new features
- Bug fixes and compatibility updates
- Priority support and assistance
- Exclusive module access and early releases
- Innovation in game system automation

**Support RNK on Patreon**: https://www.patreon.com/RagNaroks

### Patreon Tier Benefits

**Copper Tier ($1/month)**:
- Access to RNK Reserves and all premium modules
- Monthly development updates
- Patreon-only Discord channel

**Silver Tier ($5/month)**:
- Copper tier benefits, plus:
- Priority support (24-48 hour response)
- Early access to new modules (1 week before public)
- Feature request consideration

**Gold Tier ($10/month)**:
- Silver tier benefits, plus:
- Exclusive development roadmap access
- Direct influence on what we build next
- Custom module consulting

**Platinum Tier ($25/month)**:
- Gold tier benefits, plus:
- Private Discord channel with developers
- Priority bug fixes
- New module naming rights

---

## Changelog

### v1.3.0 - Stable Release

**Features**:
- Full D&D 2024 Hero Points implementation
- GM controls with award/reset functionality
- Player spending buttons on all rolls
- Real-time socket synchronization
- Comprehensive settings panel
- Batch award and bulk operations
- Persistent point storage
- Modal confirmation dialogs
- Detailed logging system
- NPC support
- Full Foundry v12-13 compatibility

**Improvements**:
- Performance optimizations
- Enhanced UI/UX
- Better error handling
- Improved socket reliability

**Bug Fixes**: Various stability improvements

**Known Issues**: None reported

---

## Contact & Community

- **GitHub Issues**: Report bugs or request features  
  https://github.com/RNK-Enterprise/rnk-reserves/issues

- **Patreon**: Support development  
  https://www.patreon.com/RagNaroks

- **Discord**: Join our community  
  https://discord.com/invite/rnk

- **Email**: Asgardinnovations@protonmail.com

---

## License

RNK Reserves is released under the **RNK Proprietary License**.

This module and all associated assets are the intellectual property of RNK Enterprise. Unauthorized reproduction, modification, or distribution is prohibited.

This is a **premium module** designed for Patreon supporters. Access and use is restricted to active patrons at https://www.patreon.com/RagNaroks

For licensing inquiries, contact: Asgardinnovations@protonmail.com

---

## Credits

**Created by**: Odinn - RNK Enterprise  
**Special Thanks**: Ms. Lisa for endless support and encouragement  

**Inspiration**: The D&D 5e community and Foundry VTT developers

---

Made with dedication by a self-taught developer, retired truck driver, and stroke survivor.

Love and respect from RNK Enterprise — Odinn</content>
<parameter name="filePath">c:\Users\thugg\OneDrive\Desktop\a\Local Dev Enviorment\Complete\rnk ready for release\rnk-reserves\README.md