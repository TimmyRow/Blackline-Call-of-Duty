# BLACKLINE — frontier expansion

Halo-inspired military sci-fi with No Man's Sky-inspired exploration. The numbered upgrades below now have playable implementations in this procedural prototype. Physical-device certification remains outstanding; this is not an AAA-quality claim.

1. **Tracked-objective pins:** Matching map/compass diamonds, target names, distance, elevation and turn arrows; saved distant target coordinates; own-ship beacon hidden while aboard.
2. **Landing guidance:** Compact speed, ground-clearance and deck guidance with friendly/hostile destination labels.
3. **Varied encounters:** Supply runs, colonial survey patrols, wrecks, distress signals, pirate patrols and alien discoveries.
4. **Halo-inspired presentation:** Distinct enemy silhouettes, energy weapon effects, shield feedback, alien biomes and station spaces.
5. **Stability verification:** Windows Edge travel, repeated settlement streaming, bounded GPU allocations and forced recovery tests; iPhone/iPad emulation plus WebKit. Physical Apple hardware tests remain pending because no devices are connected.
6. **Denser settlements:** Batched street furniture, signs, courtyards, service buildings and accessible interior routes.
7. **Alien biomes:** Forest, dunes, volcanic terrain, salt basins, caves and ruins with discoverable sites.
8. **Station interiors:** Meridian hangar, transit spine and glazed observation room; optional contracts and refits through the journal once the base is secured.
9. **Pirate boarding:** Use ship cannons on the Corsair's orange stern engine, land and clear its guards, free the prisoner at the cyan beacon, then claim cargo. Rewards pay once.
10. **Enemy roles:** Scouts, shielded infantry, snipers with charge warnings, hovering drones and heavy units have different ranges, damage, health and movement.
11. **Weapons and shields:** BR-7 ballistic rifle and rechargeable ARC-9 energy weapon; energy strips shields faster, and the player's shield recharges after avoiding damage.
12. **Restrained companions:** Explicit focus fire, supply requests and requested medical aid with cooldowns. Following companions do not automatically clear nearby camps.
13. **Ship refits and damage:** Engine, hull, cannon and reactor upgrades; reactor improves recharge and transit cooldown. Hull damage reaches the compact HUD without restoring the obstructive cockpit dashboard.
14. **Ocean expeditions:** Breakwater island redoubt, coastal patrol combat, pilotable launch, carrier resupply and boarding deck routes.
15. **Regional conflict:** Camp alarms spread awareness and call bounded reinforcements. Secured nearby bases and intercepted supply convoys reduce pirate garrisons.
16. **Exploration tools/rewards:** Scanner reveals signals and grants first-scan salvage; ancient caches unlock refit blueprints; survey/rescue contracts provide optional goals.
17. **Atmosphere and sound:** Distinct ballistic/energy sounds, positional gunfire, bounded engine/boost audio, shield-break and scan feedback, gradual day/night/weather and a dry, warm Vesper atmosphere.
18. **Second planet:** Travel between Orison and Vesper through the journal while piloting. Vesper has an expedition port, extraction site, vault, salt-basin survey and distinct terrain. This uses two coordinate sectors and a transit transition, not spherical orbital simulation or an infinite universe.

## New controls

- **V:** Scan signals (18-second cooldown).
- **X:** Switch ballistic/energy weapon.
- **K:** Request medic; **J:** supplies; **Q:** focus a target.
- **I:** Journal, contracts, refits and planet destinations.
- **Touch:** The More drawer includes scan, weapon switch and medic. Journal contains travel and refits.
- **Planet travel:** Board Kestrel, climb above 250 m ground clearance, slow below 80 m/s and keep at least 30 hull and 30 energy. The journal explains unavailable destinations. Land at Sunfall to explore or refit.

## Verification and limits

See `qa/expansion-results.json`, `qa/expansion-mobile-results.json` and `qa/stability-results.json`, plus the navigation and world browser scripts in `tests/`. Existing saves migrate; destination, equipment and tracked pins survive a fresh page reload.

Procedural visuals and simplified AI remain prototype-scale. No multiplayer, moving capital ships, destructive building simulation or physical iPhone/iPad certification is included. The original spontaneous Edge tab exit was not reproduced; resource limits and graphics recovery are tested, not a guarantee against every crash.


## Missions and Xbox controller update

- I / controller View / touch Missions opens all 12 contracts. Start & Track accepts a mission and marks its next destination; survey goals advance their markers. Equipment/travel and squad orders have separate tabs.
- Operation Safe Harbour: distress transmission, ship cannons or deck sabotage, aft sea boarding stairs, crew rescue, a two-pirate counterattack, command-code recovery, friendly resupply base, and one free engine refit (160 salvage if already fully upgraded). Existing completed saves stay completed.
- Standard Xbox controller mapping: sticks move/look, RT fire, LT aim, A jump/rise, B crouch/descend, X reload, Y switch, LB grenade, RB hold interaction, L3 hold sprint/boost, R3 board/exit, View missions, Menu pause, D-pad up scan/down atlas/left squad/right ship. Menus use D-pad or left stick, A select, B back, LB/RB missions/equipment.
- Analog movement works on foot, aboard Kestrel and at the launch helm. Controller look speed and invert-Y settings are in Controls & Settings. Disconnect/API failure pauses and releases input. Held triggers cannot fire through pause/resume.
- Validation uses simulated standard gamepads in Windows Edge and mobile Chromium/WebKit emulation. Physical Xbox controller and iPhone/iPad hardware remain unverified.
