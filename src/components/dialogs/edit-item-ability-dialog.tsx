import { AbilityBuilder } from "./ability-builder";
import { useAddAbility, useUpdateAbility } from "@/hooks/useStorage";
import type { Ability } from "@/lib/storage";
import { toast } from "sonner";
interface Props { isOpen: boolean; onOpenChange: (open: boolean) => void; characterId: number; equipmentId: number | null; inventoryItemId: number | null; initialData: Ability | null }
export function EditItemAbilityDialog({ isOpen, onOpenChange, characterId, equipmentId, inventoryItemId, initialData }: Props) {
  const add = useAddAbility(); const update = useUpdateAbility();
  return <AbilityBuilder characterId={characterId} abilities={[]} open={isOpen} onOpenChange={onOpenChange} external={{
    initial: initialData, source: "Item", pending: add.isPending || update.isPending, onSave: draft => {
      const payload = { ...draft, characterId, equipmentId, inventoryItemId, essenceId: null, isInnatePassive: false };
      const callbacks = { onSuccess: () => { toast.success("Item ability saved."); onOpenChange(false); }, onError: (error: Error) => toast.error(error.message) };
      if (initialData) update.mutate({ id: initialData.id, data: payload }, callbacks); else add.mutate(payload, callbacks);
    }
  }}/>;
}
