import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  PRESETS, type PresetKey, type Granularity, type DateRange,
} from "@/hooks/useDateFilter";

const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "hour", label: "Heure" },
  { key: "day", label: "Jour" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Année" },
];

interface DateRangeFilterProps {
  preset: PresetKey;
  range: DateRange;
  granularity: Granularity;
  compareEnabled: boolean;
  compareRange: DateRange | null;
  rangeLabel: string;
  setPreset: (key: PresetKey) => void;
  setCustomRange: (range: DateRange) => void;
  setCompareEnabled: (enabled: boolean) => void;
  setGranularity: (g: Granularity | null) => void;
  className?: string;
}

export function DateRangeFilter({
  preset, range, granularity, compareEnabled, compareRange, rangeLabel,
  setPreset, setCustomRange, setCompareEnabled, setGranularity, className,
}: DateRangeFilterProps) {
  const [calOpen, setCalOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(range.from);
  const [tempTo, setTempTo] = useState<Date | undefined>(range.to);

  const handleApplyCustom = () => {
    if (tempFrom && tempTo) {
      setCustomRange({ from: tempFrom, to: tempTo });
      setCalOpen(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Presets as wrapped chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter(p => p.key !== "custom").map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
              preset === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={preset === "custom" ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === "custom" ? rangeLabel : "Personnalisé"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="p-3 border-b sm:border-b-0 sm:border-r">
              <p className="text-xs font-medium text-muted-foreground mb-2">Date début</p>
              <Calendar
                mode="single"
                selected={tempFrom}
                onSelect={setTempFrom}
                className="p-0 pointer-events-auto"
              />
            </div>
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Date fin</p>
              <Calendar
                mode="single"
                selected={tempTo}
                onSelect={setTempTo}
                disabled={(date) => tempFrom ? date < tempFrom : false}
                className="p-0 pointer-events-auto"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-3 border-t">
            <Button variant="ghost" size="sm" onClick={() => setCalOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleApplyCustom} disabled={!tempFrom || !tempTo}>Appliquer</Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Granularity selector */}
      <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
        <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GRANULARITY_OPTIONS.map((g) => (
            <SelectItem key={g.key} value={g.key} className="text-xs">{g.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Compare toggle */}
      <div className="flex items-center gap-1.5 ml-1">
        <Switch
          id="compare"
          checked={compareEnabled}
          onCheckedChange={setCompareEnabled}
          className="scale-75"
        />
        <Label htmlFor="compare" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
          <GitCompareArrows className="h-3 w-3" />
          Comparer
        </Label>
      </div>

      {/* Compare badge */}
      {compareEnabled && compareRange && (
        <Badge variant="outline" className="text-[10px] font-normal">
          vs {format(compareRange.from, "dd/MM")} – {format(compareRange.to, "dd/MM")}
        </Badge>
      )}
    </div>
  );
}
