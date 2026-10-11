import { useState } from "react";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { useUpdateCharacter } from "../../hooks/useStorage";
import type { Character } from "../../lib/storage";
import { toast } from "sonner";

export function PortraitDialog({ character }: { character: Character }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const update = useUpdateCharacter();
  const save = async () => {
    try {
      const image = new Image(); image.src = source; await image.decode();
      const side = Math.min(image.naturalWidth, image.naturalHeight) / zoom;
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = Math.min(1200, Math.round(side));
      const context = canvas.getContext("2d"); if (!context) throw new Error("Image editing is unavailable.");
      context.drawImage(image, (image.naturalWidth - side) * x / 100, (image.naturalHeight - side) * y / 100, side, side, 0, 0, canvas.width, canvas.height);
      update.mutate({ id: character.id, data: { avatar: canvas.toDataURL("image/webp", .9) } }, { onSuccess: () => { setOpen(false); toast.success("Portrait saved."); }, onError: error => toast.error(error.message) });
    } catch { toast.error("This image could not be saved. Try uploading a local image."); }
  };
  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) { setSource(character.avatar ?? ""); setZoom(1); setX(50); setY(50); } }}><DialogTrigger asChild><Button variant="ghost" size="sm" className="portrait-edit" aria-label={`Edit ${character.name}'s portrait`} title="Edit portrait"><Pencil className="w-4 h-4" aria-hidden="true"/></Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Character portrait</DialogTitle><DialogDescription>Upload an image, then adjust its square crop. Your current portrait stays unchanged until you save.</DialogDescription></DialogHeader>
      <label className="text-sm">Upload portrait<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="block w-full mt-2 text-sm" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 20 * 1024 * 1024) { toast.error("Choose an image smaller than 20 MB."); return; } const reader = new FileReader(); reader.onload = () => { setSource(String(reader.result)); setZoom(1); setX(50); setY(50); }; reader.onerror = () => toast.error("Unable to read this image."); reader.readAsDataURL(file); }}/></label>
      <div className="aspect-square overflow-hidden rounded-lg border border-border bg-background relative">{source ? <img src={source} alt="Portrait crop preview" className="w-full h-full object-cover" style={{ objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` }}/> : <div className="h-full grid place-items-center text-muted-foreground">Choose an image</div>}</div>
      {([ ["Zoom", zoom, setZoom, 1, 3, .05], ["Horizontal position", x, setX, 0, 100, 1], ["Vertical position", y, setY, 0, 100, 1] ] as const).map(([label, value, setter, min, max, step]) => <label key={label} className="text-sm">{label}<input type="range" className="block w-full mt-1 accent-primary" min={min} max={max} step={step} value={value} onChange={event => setter(Number(event.target.value))}/></label>)}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!source || update.isPending} onClick={save}>{update.isPending ? "Saving…" : "Save portrait"}</Button></div>
    </DialogContent></Dialog>;
}
