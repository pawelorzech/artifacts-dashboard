# Automation Guide

## Strategies

### Combat
Automated monster fighting with healing and loot management.

**Config:**
- `monster_code` — target monster
- `auto_heal_threshold` — HP% to trigger healing (default: 50)
- `heal_method` — `rest` or `consumable`
- `consumable_code` — item to use for healing
- `min_inventory_slots` — minimum free slots before depositing (default: 3)
- `deposit_loot` — auto-deposit at bank (default: true)

### Gathering
Automated resource collection.

**Config:**
- `resource_code` — target resource
- `deposit_on_full` — deposit when inventory full (default: true)
- `max_loops` — stop after N loops (0 = infinite)

### Crafting
Automated crafting with optional material gathering.

**Config:**
- `item_code` — item to craft
- `quantity` — how many to craft
- `gather_materials` — auto-gather missing materials
- `recycle_excess` — recycle excess items

### Trading
Grand Exchange automation.

**Config:**
- `mode` — `sell` or `buy`
- `item_code` — item to trade
- `min_price` / `max_price` — price range
- `quantity` — trade quantity

### Task
NPC task automation.

**Config:**
- Auto-accept, complete requirements, deliver, exchange coins.

### Leveling
Composite strategy for optimal XP gain.
