'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Debounced free-text search for the admin orders list.
 * Matches order number, customer name/email/phone, or PostEx tracking.
 */
export function OrdersSearch() {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, start] = useTransition();

  const q = search.get('q') ?? '';
  const [term, setTerm] = useState(q);
  useEffect(() => setTerm(q), [q]);

  const setQuery = useCallback(
    (value: string) => {
      const params = new URLSearchParams(search.toString());
      if (value) params.set('q', value);
      else params.delete('q');
      start(() => {
        router.push(`?${params.toString()}`, { scroll: false });
      });
    },
    [router, search],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = useCallback(
    (value: string) => {
      setTerm(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setQuery(value.trim()), 300);
    },
    [setQuery],
  );
  useEffect(() => () => void (debounceRef.current && clearTimeout(debounceRef.current)), []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={term}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search order #, name, phone, email, tracking…"
          className="pl-9"
          aria-label="Search orders"
        />
      </div>
      {q ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setTerm('');
            setQuery('');
          }}
        >
          <X className="size-4" /> Clear
        </Button>
      ) : null}
      {pending ? <span className="text-xs text-muted-foreground">Searching…</span> : null}
    </div>
  );
}
