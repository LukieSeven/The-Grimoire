import { BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";

export function HowToPlayDialog() {
  return <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" className="home-action home-action-featured">
        <BookOpen aria-hidden="true"/>
        <span><span className="block font-serif font-bold">How to Play</span><span className="home-action-caption">Coming Soon</span></span>
      </Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl text-primary">How to Play</DialogTitle>
        <DialogDescription className="py-8 text-center text-lg">Coming Soon</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>;
}
