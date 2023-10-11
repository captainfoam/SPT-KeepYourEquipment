"use strict";
exports.__esModule = true;
var KeepYourEquipment_1 = require("./KeepYourEquipment");
var Mod = /** @class */ (function () {
    function Mod() {
    }
    Mod.prototype.preAkiLoad = function (container) {
        container.register("KeepYourEquipment", KeepYourEquipment_1.KeepYourEquipment);
        container.register("InraidController", { useClass: KeepYourEquipment_1.KeepYourEquipment });
    };
    return Mod;
}());
module.exports = { mod: new Mod() };
