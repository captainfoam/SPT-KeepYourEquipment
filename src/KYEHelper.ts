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
            questHelper,
            paymentHelper,
            localisationService,
            profileFixerService,
            configServer
        );

        let lostOnDeathOverrides = KYEConfig.equipmentToKeep;
        for (let toKeep in lostOnDeathOverrides)
        {
            lostOnDeathOverrides[toKeep] = !lostOnDeathOverrides[toKeep];
        }
        const lostOnDeathDefaults = this.configServer.getConfig(ConfigTypes.LOST_ON_DEATH);

        this.lostOnDeathConfig = KYEConfig.enableFoundInRaid ? { ...lostOnDeathDefaults, ...lostOnDeathOverrides } : lostOnDeathDefaults;
        this.inRaidConfig = this.configServer.getConfig(ConfigTypes.IN_RAID);
    }

    /**
     * Some maps have one-time-use keys (e.g. Labs)
     * Remove the relevant key from an inventory based on the post-raid request data passed in
     * @param offraidData post-raid data
     * @param sessionID Session id
     */
    protected removeMapAccessKey(offraidData: ISaveProgressRequestData, sessionID: string): void
    {
        const locationName = this.saveServer.getProfile(sessionID).inraid.location.toLowerCase();
        const mapKey = this.databaseServer.getTables().locations[locationName].base.AccessKeys[0];

        if (!mapKey || KYEConfig.keepMapKeys)
        {
            return;
        }

        for (const item of offraidData.profile.Inventory.items)
        {
            if (item._tpl === mapKey && item.slotId.toLowerCase() !== "hideout")
            {
                this.inventoryHelper.removeItem(offraidData.profile, item._id, sessionID);
                break;
            }
        }
    }
}