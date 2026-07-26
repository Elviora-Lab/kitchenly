'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { analytics } from '@/lib/analytics';

import { subscribeNewsletter } from '@/server/actions/newsletter.actions';

const WELCOME_CODE = 'WELCOME10';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await subscribeNewsletter({ email: email.trim() });
      if (res.success) {
        analytics.newsletterSignup({ email: email.trim() });
        setDone(true);
        setEmail('');
      } else {
        toast.error(res.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(WELCOME_CODE).then(
      () => toast.success('Code copied'),
      () => undefined,
    );
  }

  if (done) {
    return (
      <div className="mt-2 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm">
        <p className="font-medium">You&apos;re on the list 🎉</p>
        <p className="mt-0.5 text-muted-foreground">
          Use code{' '}
          <button
            type="button"
            onClick={copyCode}
            className="rounded bg-foreground px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-background"
          >
            {WELCOME_CODE}
          </button>{' '}
          for <span className="font-medium text-foreground">10% off</span> your first order.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">
        Subscribe for <span className="font-medium text-foreground">10% off your first order</span>.
      </p>
      <form onSubmit={onSubmit} className="mt-2 flex gap-2">
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          aria-label="Email address"
          className="h-11 flex-1 rounded-md border border-border bg-background/60 px-3.5 text-sm placeholder:text-muted-foreground focus-visible:border-foreground/50 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-md bg-foreground px-5 text-xs uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          {loading ? '…' : 'Subscribe'}
        </button>
      </form>
    </div>
  );
}
