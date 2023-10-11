"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.KeepYourEquipment = void 0;
var InraidController_1 = require("@spt-aki/controllers/InraidController");
var ConfigTypes_1 = require("@spt-aki/models/enums/ConfigTypes");
var PlayerRaidEndState_1 = require("@spt-aki/models/enums/PlayerRaidEndState");
var QuestStatus_1 = require("@spt-aki/models/enums/QuestStatus");
var tsyringe_1 = require("tsyringe");
var config = require("../config/config.json");
var KeepYourEquipment = /** @class */ (function (_super) {
    __extends(KeepYourEquipment, _super);
    // We need to make sure we use the constructor and pass the dependencies to the parent class!
    function KeepYourEquipment(logger, saveServer, jsonUtil, timeUtil, databaseServer, pmcChatResponseService, matchBotDetailsCacheService, questHelper, itemHelper, profileHelper, playerScavGenerator, healthHelper, traderHelper, insuranceService, inRaidHelper, applicationContext, configServer, inventoryHelper, vfs) {
        var _this = _super.call(this, logger, saveServer, jsonUtil, timeUtil, databaseServer, pmcChatResponseService, matchBotDetailsCacheService, questHelper, itemHelper, profileHelper, playerScavGenerator, healthHelper, traderHelper, insuranceService, inRaidHelper, applicationContext, configServer) || this;
        _this.logger = logger;
        _this.saveServer = saveServer;
        _this.jsonUtil = jsonUtil;
        _this.timeUtil = timeUtil;
        _this.databaseServer = databaseServer;
        _this.pmcChatResponseService = pmcChatResponseService;
        _this.matchBotDetailsCacheService = matchBotDetailsCacheService;
        _this.questHelper = questHelper;
        _this.itemHelper = itemHelper;
        _this.profileHelper = profileHelper;
        _this.playerScavGenerator = playerScavGenerator;
        _this.healthHelper = healthHelper;
        _this.traderHelper = traderHelper;
        _this.insuranceService = insuranceService;
        _this.inRaidHelper = inRaidHelper;
        _this.applicationContext = applicationContext;
        _this.configServer = configServer;
        _this.inventoryHelper = inventoryHelper;
        _this.vfs = vfs;
        _this.airdropConfig = _this.configServer.getConfig(ConfigTypes_1.ConfigTypes.AIRDROP);
        _this.inraidConfig = _this.configServer.getConfig(ConfigTypes_1.ConfigTypes.IN_RAID);
        return _this;
    }
    /**
     * Handle updating the profile post-pmc raid
     * @param sessionID session id
     * @param offraidData post-raid data of raid
     */
    KeepYourEquipment.prototype.savePmcProgress = function (sessionID, offraidData) {
        var preRaidProfile = this.saveServer.getProfile(sessionID);
        var locationName = preRaidProfile.inraid.location.toLowerCase();
        var map = this.databaseServer.getTables().locations[locationName].base;
        var mapHasInsuranceEnabled = map.Insurance;
        var preRaidPmcData = preRaidProfile.characters.pmc;
        var isDead = this.isPlayerDead(offraidData.exit);
        var preRaidGear = this.inRaidHelper.getPlayerGear(preRaidPmcData.Inventory.items);
        preRaidProfile.inraid.character = "pmc";
        preRaidPmcData = this.inRaidHelper.updateProfileBaseStats(preRaidPmcData, offraidData, sessionID);
        // Check for exit status
        this.markOrRemoveFoundInRaidItems(offraidData);
        offraidData.profile.Inventory.items = this.itemHelper.replaceIDs(offraidData.profile, offraidData.profile.Inventory.items, preRaidPmcData.InsuredItems, offraidData.profile.Inventory.fastPanel);
        this.inRaidHelper.addUpdToMoneyFromRaid(offraidData.profile.Inventory.items);
        // skips overwriting the new inventory if restoreInitialKit is enabled and player is dead
        // if true disables Insurance
        if (config.restoreInitialKit && isDead) {
            this.logger.log("Keep Your Equipment: Player died, restoring original equipment", "red", "white");
            mapHasInsuranceEnabled = false;
        }
        else {
            preRaidPmcData = this.inRaidHelper.setInventory(sessionID, preRaidPmcData, offraidData.profile);
        }
        this.healthHelper.saveVitality(preRaidPmcData, offraidData.health, sessionID);
        // Remove inventory if player died and send insurance items
        if (mapHasInsuranceEnabled) {
            this.insuranceService.storeLostGear(preRaidPmcData, offraidData, preRaidGear, sessionID, isDead);
        }
        else {
            this.insuranceService.sendLostInsuranceMessage(sessionID, locationName);
        }
        // Edge case - Handle usec players leaving lighthouse with Rogues angry at them
        if (locationName === "lighthouse" && offraidData.profile.Info.Side.toLowerCase() === "usec") {
            // Decrement counter if it exists, don't go below 0
            var remainingCounter = preRaidPmcData === null || preRaidPmcData === void 0 ? void 0 : preRaidPmcData.Stats.Eft.OverallCounters.Items.find(function (x) { return x.Key.includes("UsecRaidRemainKills"); });
            if ((remainingCounter === null || remainingCounter === void 0 ? void 0 : remainingCounter.Value) > 0) {
                remainingCounter.Value--;
            }
        }
        if (isDead) {
            this.pmcChatResponseService.sendKillerResponse(sessionID, preRaidPmcData, offraidData.profile.Stats.Eft.Aggressor);
            this.matchBotDetailsCacheService.clearCache();
            preRaidPmcData = this.performPostRaidActionsWhenDead(offraidData, preRaidPmcData, mapHasInsuranceEnabled, preRaidGear, sessionID);
        }
        var victims = offraidData.profile.Stats.Eft.Victims.filter(function (x) { return x.Role === "sptBear" || x.Role === "sptUsec"; });
        if ((victims === null || victims === void 0 ? void 0 : victims.length) > 0) {
            this.pmcChatResponseService.sendVictimResponse(sessionID, victims, preRaidPmcData);
        }
        if (mapHasInsuranceEnabled) {
            this.insuranceService.sendInsuredItems(preRaidPmcData, sessionID, map.Id);
        }
    };
    KeepYourEquipment.prototype.filterItemsByParentId = function (items, parentId) {
        var filteredItems = [];
        function recursiveFilter(currentParentId) {
            for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
                var item = items_1[_i];
                if (item.parentId === currentParentId) {
                    filteredItems.push(item);
                    recursiveFilter(item._id);
                }
            }
        }
        recursiveFilter(parentId);
        return filteredItems;
    };
    KeepYourEquipment.prototype.markOrRemoveFoundInRaidItems = function (offraidData, pmcData, isPlayerScav) {
        if (offraidData.exit !== PlayerRaidEndState_1.PlayerRaidEndState.SURVIVED) {
            if (config.enableFoundInRaid) {
                // Mark found items and replace item ID's if the player survived
                offraidData.profile = this.addSpawnedInSessionPropertyToItems(pmcData, offraidData.profile, isPlayerScav);
            }
            else {
                // Remove FIR status if the player havn't survived
                offraidData.profile = this.inRaidHelper.removeSpawnedInSessionPropertyFromItems(offraidData.profile);
            }
        }
    };
    KeepYourEquipment.prototype.performPostRaidActionsWhenDead = function (postRaidSaveRequest, pmcData, insuranceEnabled, preRaidGear, sessionID) {
        this.updatePmcHealthPostRaid(postRaidSaveRequest, pmcData);
        if (config.restoreInitialKit && config.keepSecuredContainer) {
            this.logger.log("Keep Your Equipment: Keeping secured container", "red", "white");
            this.keepSecuredContainer(postRaidSaveRequest.profile.Inventory.items, pmcData, sessionID);
        }
        if (this.inRaidHelper.removeQuestItemsOnDeath()) {
            // Find and remove the completed condition from profile if player died, otherwise quest is stuck in limbo and quest items cannot be picked up again
            var allQuests = this.questHelper.getQuestsFromDb();
            var activeQuestIdsInProfile = pmcData.Quests.filter(function (x) { return ![QuestStatus_1.QuestStatus.AvailableForStart, QuestStatus_1.QuestStatus.Success, QuestStatus_1.QuestStatus.Expired].includes(x.status); }).map(function (x) { return x.qid; });
            for (var _i = 0, _a = postRaidSaveRequest.profile.Stats.Eft.CarriedQuestItems; _i < _a.length; _i++) {
                var questItem = _a[_i];
                // Get quest/find condition for carried quest item
                var questAndFindItemConditionId = this.questHelper.getFindItemConditionByQuestItem(questItem, activeQuestIdsInProfile, allQuests);
                if (questAndFindItemConditionId) {
                    this.profileHelper.removeCompletedQuestConditionFromProfile(pmcData, questAndFindItemConditionId);
                }
            }
            // Empty out stored quest items from player inventory
            pmcData.Stats.Eft.CarriedQuestItems = [];
        }
        return pmcData;
    };
    // Keeps the secured Container from the raid and replaces initial one
    KeepYourEquipment.prototype.keepSecuredContainer = function (offRaidItems, pmcData, sessionID) {
        var raidSecuredContainer = offRaidItems.find(function (item) { return item.slotId === "SecuredContainer"; });
        var initialSecuredContainer = pmcData.Inventory.items.find(function (item) { return item.slotId === "SecuredContainer"; });
        var raidSecuredItems = this.filterItemsByParentId(offRaidItems, raidSecuredContainer._id);
        var initialSecuredItems = this.filterItemsByParentId(pmcData.Inventory.items, initialSecuredContainer._id);
        // removes the old items in the secured Container
        for (var _i = 0, initialSecuredItems_1 = initialSecuredItems; _i < initialSecuredItems_1.length; _i++) {
            var item = initialSecuredItems_1[_i];
            this.inventoryHelper.removeItem(pmcData, item._id, sessionID);
        }
        // Replace the old parentId with the new ParentId with the inital ParentId of the Secure Container
        var res = this.replaceParentId(raidSecuredItems, raidSecuredContainer._id, initialSecuredContainer._id);
        // Add secured items from raid to current inventory
        pmcData.Inventory.items = __spreadArray(__spreadArray([], pmcData.Inventory.items, true), res, true);
    };
    KeepYourEquipment.prototype.replaceParentId = function (items, oldParentId, newParentId) {
        var stack = __spreadArray([], items, true);
        stack.forEach(function (item) {
            if (item.parentId === oldParentId) {
                item.parentId = newParentId;
            }
        });
        return stack;
    };
    /**
     * Adds SpawnedInSession property to items found in a raid
     * Removes SpawnedInSession for non-scav players if item was taken into raid with SpawnedInSession = true
     * @param preRaidProfile profile to update
     * @param postRaidProfile profile to update inventory contents of
     * @param isPlayerScav Was this a p scav raid
     * @returns profile with FiR items properly tagged
     */
    KeepYourEquipment.prototype.addSpawnedInSessionPropertyToItems = function (preRaidProfile, postRaidProfile, isPlayerScav) {
        var _a, _b;
        var _loop_1 = function (item) {
            if (!isPlayerScav) {
                var itemExistsInProfile = preRaidProfile.Inventory.items.find(function (itemData) { return item._id === itemData._id; });
                if (itemExistsInProfile) {
                    // if the item exists and is taken inside the raid, remove the taken in raid status
                    (_a = item.upd) === null || _a === void 0 ? true : delete _a.SpawnedInSession;
                    return "continue";
                }
            }
            item.upd = (_b = item.upd) !== null && _b !== void 0 ? _b : {};
            item.upd.SpawnedInSession = true;
        };
        for (var _i = 0, _c = postRaidProfile.Inventory.items; _i < _c.length; _i++) {
            var item = _c[_i];
            _loop_1(item);
        }
        return postRaidProfile;
    };
    KeepYourEquipment = __decorate([
        (0, tsyringe_1.injectable)(),
        __param(0, (0, tsyringe_1.inject)("WinstonLogger")),
        __param(1, (0, tsyringe_1.inject)("SaveServer")),
        __param(2, (0, tsyringe_1.inject)("JsonUtil")),
        __param(3, (0, tsyringe_1.inject)("TimeUtil")),
        __param(4, (0, tsyringe_1.inject)("DatabaseServer")),
        __param(5, (0, tsyringe_1.inject)("PmcChatResponseService")),
        __param(6, (0, tsyringe_1.inject)("MatchBotDetailsCacheService")),
        __param(7, (0, tsyringe_1.inject)("QuestHelper")),
        __param(8, (0, tsyringe_1.inject)("ItemHelper")),
        __param(9, (0, tsyringe_1.inject)("ProfileHelper")),
        __param(10, (0, tsyringe_1.inject)("PlayerScavGenerator")),
        __param(11, (0, tsyringe_1.inject)("HealthHelper")),
        __param(12, (0, tsyringe_1.inject)("TraderHelper")),
        __param(13, (0, tsyringe_1.inject)("InsuranceService")),
        __param(14, (0, tsyringe_1.inject)("InRaidHelper")),
        __param(15, (0, tsyringe_1.inject)("ApplicationContext")),
        __param(16, (0, tsyringe_1.inject)("ConfigServer")),
        __param(17, (0, tsyringe_1.inject)("InventoryHelper")),
        __param(18, (0, tsyringe_1.inject)("VFS"))
    ], KeepYourEquipment);
    return KeepYourEquipment;
}(InraidController_1.InraidController));
exports.KeepYourEquipment = KeepYourEquipment;
