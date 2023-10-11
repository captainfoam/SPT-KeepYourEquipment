"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const KeepYourEquipment_1 = require("./KeepYourEquipment");
class Mod {
    preAkiLoad(container) {
        container.register("KeepYourEquipment", KeepYourEquipment_1.KeepYourEquipment);
        container.register("InraidController", { useClass: KeepYourEquipment_1.KeepYourEquipment });
    }
}
module.exports = { mod: new Mod() };
