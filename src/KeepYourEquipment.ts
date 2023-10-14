import { InraidController } from "@spt-aki/controllers/InraidController";
import { PlayerScavGenerator } from "@spt-aki/generators/PlayerScavGenerator";
import { HealthHelper } from "@spt-aki/helpers/HealthHelper";
import { InRaidHelper } from "@spt-aki/helpers/InRaidHelper";
import { ItemHelper } from "@spt-aki/helpers/ItemHelper";
import { ProfileHelper } from "@spt-aki/helpers/ProfileHelper";
import { QuestHelper } from "@spt-aki/helpers/QuestHelper";
import { TraderHelper } from "@spt-aki/helpers/TraderHelper";
import { ILocationBase } from "@spt-aki/models/eft/common/ILocationBase";
import { IPmcData, IPostRaidPmcData } from "@spt-aki/models/eft/common/IPmcData";
import { ISaveProgressRequestData } from "@spt-aki/models/eft/inRaid/ISaveProgressRequestData";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { PlayerRaidEndState } from "@spt-aki/models/enums/PlayerRaidEndState";
import { QuestStatus } from "@spt-aki/models/enums/QuestStatus";
import { IAirdropConfig } from "@spt-aki/models/spt/config/IAirdropConfig";
import { IInRaidConfig } from "@spt-aki/models/spt/config/IInRaidConfig";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { InsuranceService } from "@spt-aki/services/InsuranceService";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { TimeUtil } from "@spt-aki/utils/TimeUtil";
import { inject, injectable } from "tsyringe";

// local import
import { ApplicationContext } from "@spt-aki/context/ApplicationContext";
import { InventoryHelper } from "@spt-aki/helpers/InventoryHelper";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import { MatchBotDetailsCacheService } from "@spt-aki/services/MatchBotDetailsCacheService";
import { PmcChatResponseService } from "@spt-aki/services/PmcChatResponseService";
import * as config from "../config/config.json";

import { VFS } from "@spt-aki/utils/VFS";

@injectable()
export class KeepYourEquipment extends InraidController
{
    protected airdropConfig: IAirdropConfig;
    protected inraidConfig: IInRaidConfig;

    // We need to make sure we use the constructor and pass the dependencies to the parent class!
    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("SaveServer") protected saveServer: SaveServer,
        @inject("JsonUtil") protected jsonUtil: JsonUtil,
        @inject("TimeUtil") protected timeUtil: TimeUtil,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("PmcChatResponseService") protected pmcChatResponseService: PmcChatResponseService,
        @inject("MatchBotDetailsCacheService") protected matchBotDetailsCacheService: MatchBotDetailsCacheService,
        @inject("QuestHelper") protected questHelper: QuestHelper,
        @inject("ItemHelper") protected itemHelper: ItemHelper,
        @inject("ProfileHelper") protected profileHelper: ProfileHelper,
        @inject("PlayerScavGenerator") protected playerScavGenerator: PlayerScavGenerator,
        @inject("HealthHelper") protected healthHelper: HealthHelper,
        @inject("TraderHelper") protected traderHelper: TraderHelper,
        @inject("InsuranceService") protected insuranceService: InsuranceService,
        @inject("InRaidHelper") protected inRaidHelper: InRaidHelper,
        @inject("ApplicationContext") protected applicationContext: ApplicationContext,
        @inject("ConfigServer") protected configServer: ConfigServer,
        @inject("InventoryHelper") protected inventoryHelper: InventoryHelper,
        @inject("VFS") protected vfs: VFS
    )
    {
        super(logger,
            saveServer,
            jsonUtil,
            timeUtil,
            databaseServer,
            pmcChatResponseService, matchBotDetailsCacheService, questHelper, itemHelper,
            profileHelper, playerScavGenerator, healthHelper,
            traderHelper, insuranceService, inRaidHelper, applicationContext, configServer);
        this.airdropConfig = this.configServer.getConfig(ConfigTypes.AIRDROP);
        this.inraidConfig = this.configServer.getConfig(ConfigTypes.IN_RAID);
    }

    /**
     * Handle updating the profile post-pmc raid
     * @param sessionID session id
     * @param offraidData post-raid data of raid
     */
    protected savePmcProgress(sessionID: string, offraidData: ISaveProgressRequestData): void
    {
        const preRaidProfile = this.saveServer.getProfile(sessionID);
        const locationName = preRaidProfile.inraid.location.toLowerCase();

        const map: ILocationBase = this.databaseServer.getTables().locations[locationName].base;
        let mapHasInsuranceEnabled = map.Insurance;
        let preRaidPmcData = preRaidProfile.characters.pmc;
        const isDead = this.isPlayerDead(offraidData.exit);
        const preRaidGear = this.inRaidHelper.getPlayerGear(preRaidPmcData.Inventory.items);

        preRaidProfile.inraid.character = "pmc";

        preRaidPmcData = this.inRaidHelper.updateProfileBaseStats(preRaidPmcData, offraidData, sessionID);

        // Check for exit status
        this.markOrRemoveFoundInRaidItems(offraidData, preRaidPmcData, false);

        offraidData.profile.Inventory.items = this.itemHelper.replaceIDs(offraidData.profile, offraidData.profile.Inventory.items, preRaidPmcData.InsuredItems, offraidData.profile.Inventory.fastPanel);
        this.inRaidHelper.addUpdToMoneyFromRaid(offraidData.profile.Inventory.items);

        // skips overwriting the new inventory if restoreInitialKit is enabled and player is dead
        // if true disables Insurance
        if (config.restoreInitialKit && isDead) {
            this.logger.log("Keep Your Equipment: Player died, restoring original equipment", "red", "white");
            mapHasInsuranceEnabled = false;
        } else {
            preRaidPmcData = this.inRaidHelper.setInventory(sessionID, preRaidPmcData, offraidData.profile);
        }

        this.healthHelper.saveVitality(preRaidPmcData, offraidData.health, sessionID);

        // Remove inventory if player died and send insurance items
        if (mapHasInsuranceEnabled)
        {
            this.insuranceService.storeLostGear(preRaidPmcData, offraidData, preRaidGear, sessionID, isDead);
        }
        else
        {
            this.insuranceService.sendLostInsuranceMessage(sessionID, locationName);
        }

        // Edge case - Handle usec players leaving lighthouse with Rogues angry at them
        if (locationName === "lighthouse" && offraidData.profile.Info.Side.toLowerCase() === "usec")
        {
            // Decrement counter if it exists, don't go below 0
            const remainingCounter = preRaidPmcData?.Stats.Eft.OverallCounters.Items.find(x => x.Key.includes("UsecRaidRemainKills"));
            if (remainingCounter?.Value > 0)
            {
                remainingCounter.Value --;
            }
        }

        if (isDead)
        {
            this.pmcChatResponseService.sendKillerResponse(sessionID, preRaidPmcData, offraidData.profile.Stats.Eft.Aggressor);
            this.matchBotDetailsCacheService.clearCache();

            preRaidPmcData = this.performPostRaidActionsWhenDead(offraidData, preRaidPmcData, mapHasInsuranceEnabled, preRaidGear, sessionID);
        }

        const victims = offraidData.profile.Stats.Eft.Victims.filter(x => x.Role === "sptBear" || x.Role === "sptUsec");
        if (victims?.length > 0)
        {
            this.pmcChatResponseService.sendVictimResponse(sessionID, victims, preRaidPmcData);
        }

        if (mapHasInsuranceEnabled)
        {
            this.insuranceService.sendInsuredItems(preRaidPmcData, sessionID, map.Id);
        }
    }

    protected markOrRemoveFoundInRaidItems(offraidData: ISaveProgressRequestData, pmcData: IPmcData, isPlayerScav: boolean = true): void
    {
        if (offraidData.exit === PlayerRaidEndState.SURVIVED || config.enableFoundInRaid)
        {
            // Mark found items and replace item ID's if the player survived
            offraidData.profile = this.addSpawnedInSessionPropertyToItems(pmcData, offraidData.profile, isPlayerScav);
        }
        else if (offraidData.exit !== PlayerRaidEndState.SURVIVED)
        {
            // Remove FIR status if the player didn't survive
            offraidData.profile = this.inRaidHelper.removeSpawnedInSessionPropertyFromItems(offraidData.profile);
        }
    }

    protected performPostRaidActionsWhenDead(postRaidSaveRequest: ISaveProgressRequestData, pmcData: IPmcData, insuranceEnabled: boolean, preRaidGear: Item[], sessionID: string): IPmcData
    {
        this.updatePmcHealthPostRaid(postRaidSaveRequest, pmcData);

        if (config.restoreInitialKit && config.keepSecuredContainer) {
            this.logger.log("Keep Your Equipment: Keeping secured container", "red", "white");
            this.keepSecuredContainer(postRaidSaveRequest.profile.Inventory.items, pmcData, sessionID);
        }

        if (this.inRaidHelper.removeQuestItemsOnDeath())
        {
            // Find and remove the completed condition from profile if player died, otherwise quest is stuck in limbo and quest items cannot be picked up again
            const allQuests = this.questHelper.getQuestsFromDb();
            const activeQuestIdsInProfile = pmcData.Quests.filter(x => ![QuestStatus.AvailableForStart, QuestStatus.Success, QuestStatus.Expired].includes(x.status)).map(x => x.qid);
            for (const questItem of postRaidSaveRequest.profile.Stats.Eft.CarriedQuestItems)
            {
                // Get quest/find condition for carried quest item
                const questAndFindItemConditionId = this.questHelper.getFindItemConditionByQuestItem(questItem, activeQuestIdsInProfile, allQuests);
                if (questAndFindItemConditionId)
                {
                    this.profileHelper.removeCompletedQuestConditionFromProfile(pmcData, questAndFindItemConditionId);
                }
            }

            // Empty out stored quest items from player inventory
            pmcData.Stats.Eft.CarriedQuestItems = [];
        }

        return pmcData;
    }

    /**
     * Keeps the secured Container from the raid and replaces initial one
     * @param offRaidItems The items from the raid
     * @param pmcData The player's data after the raid
     * @param sessionID The session ID
     */
    private keepSecuredContainer(offRaidItems: Item[], pmcData: IPmcData, sessionID: string): void {

        const raidSecuredContainer = offRaidItems.find(item => item.slotId === "SecuredContainer");
        const initialSecuredContainer = pmcData.Inventory.items.find(item => item.slotId === "SecuredContainer");

        const raidSecuredItems = this.filterItemsByParentId(offRaidItems, raidSecuredContainer._id);
        const initialSecuredItems = this.filterItemsByParentId(pmcData.Inventory.items, initialSecuredContainer._id);

        // removes the old items in the secured Container
        for (const item of initialSecuredItems) {
            this.inventoryHelper.removeItem(pmcData, item._id, sessionID);
        }

        // Replace the old parentId with the new ParentId with the inital ParentId of the Secure Container
        const res = this.replaceParentId(raidSecuredItems, raidSecuredContainer._id, initialSecuredContainer._id);

        // Add secured items from raid to current inventory
        pmcData.Inventory.items = [...pmcData.Inventory.items, ...res];
    }

    protected filterItemsByParentId(items: Item[], parentId: string): Item[] {
        const filteredItems: Item[] = [];

        function recursiveFilter(currentParentId: string) {
            for (const item of items) {
                if (item.parentId === currentParentId) {
                    filteredItems.push(item);
                    recursiveFilter(item._id);
                }
            }
        }

        recursiveFilter(parentId);
        return filteredItems;
    }

    /**
     * Replaces the parent ID of each item in the array with the new parent ID.
     * @param items The array of items to update.
     * @param oldParentId The ID of the old parent.
     * @param newParentId The ID of the new parent.
     * @returns The updated array of items.
     */
    private replaceParentId(items: Item[], oldParentId: string, newParentId: string): Item[] {
        items.forEach(item => {
            if (item.parentId === oldParentId) {
                item.parentId = newParentId;
            }
        });
        return items;
    }

    /**
     * Adds SpawnedInSession property to items found in a raid
     * Removes SpawnedInSession for non-scav players if item was taken into raid with SpawnedInSession = true
     * @param preRaidProfile profile to update
     * @param postRaidProfile profile to update inventory contents of
     * @param isPlayerScav Was this a p scav raid
     * @returns profile with FiR items properly tagged
     */
    private addSpawnedInSessionPropertyToItems(preRaidProfile: IPmcData, postRaidProfile: IPostRaidPmcData, isPlayerScav: boolean): IPostRaidPmcData
    {
        for (const item of postRaidProfile.Inventory.items)
        {
            if (!isPlayerScav)
            {
                const itemExistsInProfile = preRaidProfile.Inventory.items.find((itemData) => item._id === itemData._id);
                if (itemExistsInProfile)
                {
                    // if the item exists and is taken inside the raid, remove the taken in raid status
                    delete item.upd?.SpawnedInSession;

                    continue;
                }
            }

            item.upd = item.upd ?? {};
            item.upd.SpawnedInSession = true;
        }

        return postRaidProfile;
    }
}