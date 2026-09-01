'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';

import { cn } from '@/lib/cn';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const triggerClass =
  'flex h-11 w-full items-center gap-2.5 rounded-md border border-input bg-transparent px-3.5 text-left text-sm transition-colors duration-200 ease-swift hover:border-foreground/30 focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50';

type PostExCityComboboxProps = {
  cities: string[];
  value: string;
  onChange: (city: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
};

export function PostExCityCombobox({
  cities,
  value,
  onChange,
  disabled,
  id,
  placeholder = 'Select your city',
}: PostExCityComboboxProps) {
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    if (!value) return '';
    const match = cities.find((c) => c.toLowerCase() === value.toLowerCase());
    return match ?? value;
  }, [cities, value]);

  if (cities.length === 0) {
    return (
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder="City"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(triggerClass, open && 'border-foreground/35')}
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground/80" aria-hidden />
          <span className={cn('min-w-0 flex-1 truncate', !label && 'text-muted-foreground/70')}>
            {label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 ease-swift',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="outline-none focus:outline-none">
        <Command>
          <CommandInput placeholder="Search cities…" />
          <CommandList>
            <CommandEmpty>No matching city.</CommandEmpty>
            <CommandGroup>
              {cities.map((city) => {
                const selected = label.toLowerCase() === city.toLowerCase();
                return (
                  <CommandItem
                    key={city}
                    value={city}
                    onSelect={() => {
                      onChange(city);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{city}</span>
                    <Check
                      className={cn(
                        'ml-auto size-4 shrink-0 text-accent',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
