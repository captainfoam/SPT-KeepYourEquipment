import { DependencyContainer } from "tsyringe";
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod"
import { KeepYourEquipment } from "./KeepYourEquipment";

class Mod implements IPreAkiLoadMod
{
    public preAkiLoad(container: DependencyContainer): void {
        container.register<KeepYourEquipment>("KeepYourEquipment", KeepYourEquipment);
        container.register<KeepYourEquipment>("InraidController", { useClass: KeepYourEquipment });
    }
}

module.exports = { mod: new Mod() }