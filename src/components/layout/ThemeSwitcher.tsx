import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react";

import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Option {
  value: Theme;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: readonly Option[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "system", label: "Match system", icon: MonitorIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/**
 * Light / system / dark switcher.
 *
 * Built from real radio inputs rather than buttons with click handlers: native
 * radios bring arrow-key navigation, correct "2 of 3" announcements and a
 * roving tabindex for free. The inputs are visually hidden and styled through
 * `peer-checked`, so there is no JavaScript managing keyboard state.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className={cn("m-0 flex items-center border-0 p-0", className)}>
      <legend className="sr-only">Colour theme</legend>
      <div className="bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const checked = theme === option.value;
          return (
            <label
              key={option.value}
              title={option.label}
              className={cn(
                "relative inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors",
                "peer-focus-visible:outline-none",
                checked
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="runway-theme"
                value={option.value}
                checked={checked}
                onChange={() => setTheme(option.value)}
                className="peer sr-only"
              />
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">{option.label}</span>
              {/* Focus ring sits on the label, since the input itself is hidden. */}
              <span className="peer-focus-visible:ring-ring pointer-events-none absolute inset-0 rounded-md peer-focus-visible:ring-2" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
