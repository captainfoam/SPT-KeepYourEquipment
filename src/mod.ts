import { DependencyContainer } from "tsyringe";
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod"
import { KeepYourEquipment } from "./KeepYourEquipment";
import { KYEHelper } from "./KYEHelper";


class Mod implements IPreAkiLoadMod
{
    public preAkiLoad(container: DependencyContainer): void {
        container.register<KeepYourEquipment>("KeepYourEquipment", KeepYourEquipment);
        container.register<KeepYourEquipment>("InraidController", { useClass: KeepYourEquipment });
        container.register<KYEHelper>("KYEHelper", KYEHelper);
        container.register<KYEHelper>("InRaidHelper", { useClass: KYEHelper });
    }
}

module.exports = { mod: new Mod() }