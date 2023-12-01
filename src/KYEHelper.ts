import { inject, injectable } from "tsyringe";

import { IPmcData  } from "@spt-aki/models/eft/common/IPmcData";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { ISaveProgressRequestData } from "@spt-aki/models/eft/inRaid/ISaveProgressRequestData";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { IInRaidConfig } from "@spt-aki/models/spt/config/IInRaidConfig";
import { ILostOnDeathConfig } from "@spt-aki/models/spt/config/ILostOnDeathConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { LocalisationService } from "@spt-aki/services/LocalisationService";
import { ProfileFixerService } from "@spt-aki/services/ProfileFixerService";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { InRaidHelper } from "@spt-aki/helpers/InRaidHelper";
import { InventoryHelper } from "@spt-aki/helpers/InventoryHelper";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { PaymentHelper } from "@spt-aki/helpers/PaymentHelper";
import { QuestHelper } from "@spt-aki/helpers/QuestHelper";
import * as KYEConfig from "../config/config.json";

@injectable()
export class KYEHelper extends InRaidHelper
{
    protected lostOnDeathConfig: ILostOnDeathConfig;
    protected inRaidConfig: IInRaidConfig;

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("SaveServer") protected saveServer: SaveServer,
        @inject("JsonUtil") protected jsonUtil: JsonUtil,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("InventoryHelper") protected inventoryHelper: InventoryHelper,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("QuestHelper") protected questHelper: QuestHelper,
        @inject("PaymentHelper") protected paymentHelper: PaymentHelper,
        @inject("LocalisationService") protected localisationService: LocalisationService,
        @inject("ProfileFixerService") protected profileFixerService: ProfileFixerService,
        @inject("ConfigServer") protected configServer: ConfigServer
    )
    {
        super(
            logger,
            saveServer,
            jsonUtil,
            itemHelper,
            databaseServer,
            inventoryHelper,
            profileHelper,
            questHelper,
            paymentHelper,
            localisationService,
            profileFixerService,
            configServer
        );

        const lostOnDeathOverrides = {
            "equipment": this.invert({ ...{
                "SecuredContainer": true
            }, ...KYEConfig.equipmentToKeep}),
            "questItems": true,
            "specialSlotItems": false
        };

        const lostOnDeathDefaults = this.configServer.getConfig(ConfigTypes.LOST_ON_DEATH);

        this.lostOnDeathConfig = KYEConfig.advancedMode ? lostOnDeathOverrides : lostOnDeathDefaults;
        this.inRaidConfig = this.configServer.getConfig(ConfigTypes.IN_RAID);
    }

    /**
     * Clear pmc inventory of all items except those that are exempt
     * Used post-raid to remove items after death
     * @param pmcData Player profile
     * @param sessionID Session id
     */
    public deleteInventory(pmcData: IPmcData, sessionID: string): void
    {
        // Get inventory item ids to remove from players profile
        const itemIdsToDeleteFromProfile = this.getInventoryItemsLostOnDeath(pmcData, sessionID).map((x) => x._id);
        itemIdsToDeleteFromProfile.forEach((x) =>
        {
            this.inventoryHelper.removeItem(pmcData, x, sessionID);
        });

        // Remove contents of fast panel
        pmcData.Inventory.fastPanel = {};
    }

    /**
     * Get an array of items from a profile that will be lost on death
     * @param pmcProfile Profile to get items from
     * @returns Array of items lost on death
     */
    protected getInventoryItemsLostOnDeath(pmcProfile: IPmcData, sessionID: string): Item[]
    {
        const inventoryItems = pmcProfile.Inventory.items ?? [];
        const equipment = pmcProfile?.Inventory?.equipment;
        const questRaidItems = pmcProfile?.Inventory?.questRaidItems;
            const locationName = this.saveServer.getProfile(sessionID).inraid.location.toLowerCase();
            const mapKey = this.databaseServer.getTables().locations[locationName].base.AccessKeys[0];

        return inventoryItems.filter((x) =>
        {
            if (x._tpl === mapKey && x.slotId.toLowerCase() !== "hideout")
            {
                return !KYEConfig.keepMapKeys;
            }

            // Pocket items are not lost on death
            if (x.slotId.startsWith("pocket"))
            {
                return this.lostOnDeathConfig.equipment.Pocket;
            }

            // Keep items flagged as kept after death
            if (this.isItemKeptAfterDeath(pmcProfile, x))
            {
                return false;
            }

            // Remove normal items or quest raid items
            if (x.parentId === equipment || x.parentId === questRaidItems)
            {
                return true;
            }
            return false;
        });
    }


     /**
     * Does the provided items slotId mean its kept on the player after death
     * @pmcData Player profile
     * @itemToCheck Item to check should be kept
     * @returns true if item is kept after death
     */
     protected isItemKeptAfterDeath(pmcData: IPmcData, itemToCheck: Item): boolean
     {
         // No parentid means its a base inventory item, always keep
         if (!itemToCheck.parentId)
         {
             return true;
         }

         if (itemToCheck.parentId) {
            console.log(itemToCheck, itemToCheck.parentId, itemToCheck?.slotId);
         }

         // Is item equipped on player
         if (itemToCheck.parentId === pmcData.Inventory.equipment)
         {
             // Check slot id against config, true = delete, false = keep, undefined = delete
             const discard = this.lostOnDeathConfig.equipment[itemToCheck.slotId];
             if (discard === undefined)
             {
                 return false;
             }

             return !discard;
         }

         // Is quest item + quest item not lost on death
         if (!this.lostOnDeathConfig.questItems && itemToCheck.parentId === pmcData.Inventory.questRaidItems)
         {
             return true;
         }

         // special slots are always kept after death
         if (itemToCheck.slotId?.includes("SpecialSlot") && this.lostOnDeathConfig.specialSlotItems)
         {
             return true;
         }

         return false;
     }

    private invert(equipment: object) {
        // invert booleans as SPT expects `false` to mean keep and `true` to mean remove
        for (let toKeep in equipment)
        {
            equipment[toKeep] = !equipment[toKeep];
        }

        return equipment;
    }
}