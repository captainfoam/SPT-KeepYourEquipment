# Keep Your Equipment

## Description

Originally forked from [Never Lose Equipments](https://hub.sp-tarkov.com/files/file/262-never-lose-equipments/) by Revingly and bluwatch, code adapted for SPT 3.7.0 and refactored.

- Retain all equipment you loaded in with post-death. (Default Behavior)
   - Opt to recover only starting gear post-death without keeping raid-found items by enabling `keepOriginalEquipment`.
   - Configuration for secured container contents during this process is available via `keepSecuredContainer`.
- Items acquired during a raid (in pockets, rig, backpack, or container) can be kept post-death but lose the FIR status if `enableFoundInRaid` is set to `true`.
- Keep map keys like Labs keycards upon successful raid exit.
- Insure and drop items during a raid for insurance fraud purposes.

## Installation instructions

Download the archive from the [releases page](https://github.com/captainfoam/SPT-KeepYourEquipment/releases) and extract into the `user/mods` folder.

## Upgrade instructions

Replace the `KeepYourEquipment` folder in the `user/mods` folder. Since version `1.3.0`, the folder will be named the same.

## Work in progress

- Configuration to retain/not retain items found during a raid.
    - Currently supports backpack. Tactical vest and pockets are underway.
- Introduce a feature to reclaim items from a scav post-death.

## Configurable values

- **keepOriginalEquipment**: true/false (Default: `true`)
    - Regain all original gear if you die during a raid.
- **keepSecuredContainer**: true/false (Default: `true`, `keepOriginalEquipment` must also be set to `true`)
    - Decides if the secured container contents are reset post-death. Note: potential for item duplication exists if raid items are moved to the secured container.
- **enableFoundInRaid**: true/false (Default: `false`)
    - Set to true to retain FIR status for raid-acquired items post-death.
- **keepMapKeys**: true/false (Default: `true`)
    - Normally, the game will consume your Labs keycard on a successful raid. By default, this mod will keep your keycard, because you're already using this mod to keep your original equipment, so why not? ;)

## Encountered a bug or want a feature?
Please [create an issue](https://github.com/captainfoam/SPT-KeepYourEquipment/issues) in the project page and I'll take a look!