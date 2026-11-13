import { LiveAbilityEditor } from "./ability-builder";
import { useAddAbility, useUpdateAbility } from "@/hooks/useStorage";
import type { Ability } from "@/lib/storage";
import { toast } from "sonner";
interface Props { onClose: () => void; characterId: number; characterName?: string; ownerName: string; equipmentId: number | null; inventoryItemId: number | null; initialData: Ability | null; onPendingChange: (pending: boolean) => void }
export function OwnedItemAbilityEditor({ onClose, characterId, characterName, ownerName, equipmentId, inventoryItemId, initialData, onPendingChange }: Props) {
  const add = useAddAbility(); const update = useUpdateAbility();
  const equipment = equipmentId !== null;
  return <LiveAbilityEditor characterId={characterId} initial={initialData} owner={{ kind: "item", name: ownerName, wielderName: characterName, equipment }} source={equipment ? "Equipment" : "Item"} pending={add.isPending || update.isPending} onClose={onClose} onSave={draft => {
      const payload = { ...draft, characterId, equipmentId, inventoryItemId, essenceId: null, isInnatePassive: false };
      onPendingChange(true);
      const callbacks = { onSuccess: () => { onPendingChange(false); toast.success("Ability saved."); onClose(); }, onError: (error: Error) => { onPendingChange(false); toast.error(error.message); } };
      if (initialData) update.mutate({ id: initialData.id, data: payload }, callbacks); else add.mutate(payload, callbacks);
    }} />;
}
