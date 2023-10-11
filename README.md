# Keep Your Equipment

## Description:

Originally forked from [Never Lose Equipments](https://hub.sp-tarkov.com/files/file/262-never-lose-equipments/) by Revingly and bluwatch, code adapted for SPT 3.7.0 and refactored.

- Retain all equipment you loaded in with post-death. (Default Behavior)
   - Opt to recover only starting gear post-death without keeping raid-found items by enabling "restoreInitialKit".
   - Configuration for secured container contents during this process is available via "keepSecuredContainer".
- Items acquired during a raid (in pockets, rig, backpack, or container) can be kept post-death but lose the FIR status if "enableFoundInRaid" is set to true.
- Insure and drop items during a raid for insurance fraud purposes.

## Installation instructions

Download the archive from the [releases page](https://github.com/captainfoam/SPT-KeepYourEquipment/releases) and extract into the `user/mods` folder.

## Work in progress:

- Configuration to retain/not retain items found during a raid.
    - Currently supports backpack. Tactical vest and pockets are underway.
- Introduce a feature to reclaim items from a scav post-death.

## Configurable values:

- **restoreInitialKit**: true/false
    - Regain all initial gear post-death.
- **keepSecuredContainer**: true/false (Relevant only with "restoreInitialKit" enabled)
    - Decides if the secured container contents are reset post-death. Note: potential for item duplication exists if raid items are moved to the secured container.
- **enableFoundInRaid**: true/false
    - Set to true to retain FIR status for raid-acquired items post-death. Inactive when "restoreInitialKit" is true.
