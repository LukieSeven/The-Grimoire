import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen } from "lucide-react";

export function RollGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-primary/40 text-primary hover:bg-primary/10 rounded-md cursor-pointer text-xs font-serif">
          <HelpCircle className="w-3.5 h-3.5 mr-1" /> Roll Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
        <DialogHeader className="border-b border-border/20 pb-2">
          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> AEtherborne Roll Guide
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 text-xs text-muted-foreground leading-relaxed font-sans">
          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">1. Basic Dice Notation</h4>
            <p>Use standard dice values like <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">d20</code>, <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">2d6</code>, or <code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">d8+3</code>.</p>
          </div>
          
          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">2. Stat Scores, Rolls & Modifiers</h4>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              <li><code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">WIL</code> uses the roller’s current effective Willpower score.</li>
              <li><code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">WILr</code> rolls their Willpower dice and adds the rank modifier once.</li>
              <li><code className="text-primary font-mono font-bold bg-background px-1 py-0.5 rounded">WILm</code> uses just that rank modifier. For example, <code className="text-foreground font-mono">2d6 + WILm</code> adds it to two six-sided dice.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">3. Attribute Prefixes</h4>
            <p>Use one of these prefixes (case-insensitive), with <code className="text-foreground font-mono">r</code> or <code className="text-foreground font-mono">m</code> when needed:</p>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center font-bold text-foreground mt-1.5">
              <span className="bg-background/50 border border-border/30 p-1 rounded">POW</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">VIT</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">AGI</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">END</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">SPI</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">PRE</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">WIL</span>
              <span className="bg-background/50 border border-border/30 p-1 rounded">CHA</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">4. Linked Stat Shorthand</h4>
            <p><code className="text-primary font-mono font-bold">STAT</code>, <code className="text-primary font-mono font-bold">STATr</code>, and <code className="text-primary font-mono font-bold">STATm</code> require a linked attribute. They use the chosen linked stat for its effective score, roll with rank modifier, or rank modifier only. Choosing POW makes <code className="text-foreground font-mono">2d6 + STATm</code> behave like <code className="text-foreground font-mono">2d6 + POWm</code>.</p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">5. Opposed Checks</h4>
            <p>A formula rolls for its owner only. In the ability editor preview, use Advanced rules to record each side’s stats and outcomes. Roll the other side separately and compare the totals manually; the tool does not resolve opposed outcomes automatically.</p>
            <p className="mt-1">Static fields such as resource caps and bonuses don’t roll. Use <code>WIL</code> for the score or <code>WILm</code> for the rank modifier. Older static formulas using <code>WILr</code> still read the score to preserve saved behavior.</p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">6. DM-Style Formulas</h4>
            <p>You can write formulas starting with names (e.g., <code className="text-foreground font-mono bg-background px-1 py-0.5 rounded">Health Pool = (VIT * 5) + (END * 2)</code>). The parser automatically strips everything before the <code className="text-foreground font-mono font-bold">=</code>. It also translates the DM's multiplication symbols <code className="text-foreground font-mono font-bold">×</code> and <code className="text-foreground font-mono font-bold">x</code> to standard asterisks <code className="text-foreground font-mono font-bold">*</code>.</p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-1 uppercase tracking-wider text-[10px]">7. Basic Math Operators</h4>
            <p>All standard math operators <code className="text-foreground font-mono font-bold">+</code>, <code className="text-foreground font-mono font-bold">-</code>, <code className="text-foreground font-mono font-bold">*</code>, <code className="text-foreground font-mono font-bold">/</code>, and parentheses <code className="text-foreground font-mono font-bold">()</code> are supported inside formulas.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
