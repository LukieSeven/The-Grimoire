import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useCreateRoll, useUpdateCurrency } from "../hooks/useStorage";
import { storage, type Currency } from "../lib/storage";
import { toast } from "sonner";

export function CurrencyAdjustments({ currency }: { currency: Currency }) {
  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState("");
  const update = useUpdateCurrency();
  const log = useCreateRoll();
  const adjust = () => {
    if (update.isPending) return;
    if (!!add.trim() === !!remove.trim()) { toast.error("Enter an amount in either Add or Remove, not both."); return; }
    const mode = add.trim() ? "add" : "remove";
    const entered = mode === "add" ? add : remove;
    const amount = Number(entered);
    if (!entered.trim() || !Number.isFinite(amount) || amount <= 0) { toast.error("Enter an amount greater than zero."); return; }
    const current = storage.getCurrencies(currency.characterId).find(entry => entry.id === currency.id);
    if (!current) { toast.error("This currency is no longer available."); return; }
    const next = current.amount + (mode === "add" ? amount : -amount);
    if (!Number.isFinite(next) || next < 0) { toast.error("You cannot remove more than the available balance."); return; }
    update.mutate({ id: currency.id, amount: next }, {
      onSuccess: () => {
        if (mode === "add") setAdd(""); else setRemove("");
        log.mutate({ id: currency.characterId, data: { diceType: "action-log", modifier: 0, label: `${currency.name}: ${mode === "add" ? "added" : "removed"} ${amount} · balance ${next}` } });
      },
      onError: error => toast.error(error.message),
    });
  };
  return <form onSubmit={event => { event.preventDefault(); adjust(); }} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 min-w-0 flex-1 sm:max-w-md">
    {(["add", "remove"] as const).map(mode =>
      <Input key={mode} type="number" min="0" step="any" aria-label={`${mode === "add" ? "Add" : "Remove"} ${currency.name}`} placeholder={mode === "add" ? "Add" : "Remove"} value={mode === "add" ? add : remove} onChange={event => mode === "add" ? setAdd(event.target.value) : setRemove(event.target.value)} className="h-8 min-w-0 text-xs text-center px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
    )}
    <Button type="submit" variant="outline" size="sm" disabled={update.isPending} className="shrink-0">Update</Button>
  </form>;
}
