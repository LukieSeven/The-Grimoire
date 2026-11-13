import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import { equipmentDraftFormat, equipmentDraftVersion, readCompleteEquipmentDraft } from "../src/components/ability-editor-prototype/equipment-draft-format.ts";

test("equipment draft file preserves shared fields, nested actions, and reference mechanics", () => {
  const ability = { ...blankAbilityInput(), name: "Binding strike", targets: ["Enemy"], manaCost: 3 };
  ability.results = [{ ...blankResult("Enemy"), effectAction: "Damage", purpose: "Damage", formula: "WILr + 1D6", rollBonusKind: "attack" }];
  ability.subAbilities = [{ ...blankAbilityInput(), name: "Follow-up" }];
  const reference = { equipment_set: { weapons: [{ name: "Left blade", abilities: [{ name: ability.name, opposed_check: { caster_stats: ["WIL"], caster_win: "Apply binding" } }] }] } };
  const saved = JSON.parse(JSON.stringify({ format: equipmentDraftFormat, version: equipmentDraftVersion, reference, definitions: { weapons: [[ability]], paired: null } }));
  const restored = readCompleteEquipmentDraft(saved);
  assert.deepEqual(restored.reference, reference);
  assert.deepEqual(restored.definitions.weapons[0][0], ability);
  saved.definitions.weapons[0][0].results[0].rollBonusKind = "not a roll kind";
  assert.throws(() => readCompleteEquipmentDraft(saved), /rollBonusKind/);
});
