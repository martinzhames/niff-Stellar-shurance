'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  href: string;
  cta: string;
}

const STEPS: OnboardingStep[] = [
  {
    id: 'connect-wallet',
    label: 'Connect your wallet',
    description: 'Link a Stellar wallet to sign transactions and manage policies.',
    href: '/connect',
    cta: 'Connect wallet',
  },
  {
    id: 'get-quote',
    label: 'Get a quote',
    description: 'Compare coverage options and get a premium quote.',
    href: '/quote',
    cta: 'Get a quote',
  },
  {
    id: 'buy-policy',
    label: 'Buy a policy',
    description: 'Purchase coverage and activate your first policy.',
    href: '/policies/new',
    cta: 'Buy a policy',
  },
];

const STORAGE_KEY = 'handsoff:onboarding:completed';

function readCompleted(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeCompleted(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage failures (private mode, quota) — checklist still works in-memory.
  }
}

export default function OnboardingChecklist() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCompleted(readCompleted());
    setHydrated(true);
  }, []);

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = prev.includes(id) ? prev.filter((stepId) => stepId !== id) : [...prev, id];
      writeCompleted(next);
      return next;
    });
  };

  const doneCount = STEPS.filter((step) => completed.includes(step.id)).length;
  const allDone = doneCount === STEPS.length;

  if (allDone) {
    return (
      <section
        aria-label="Onboarding checklist"
        className="rounded-lg border border-green-200 bg-green-50 p-4"
      >
        <h2 className="text-sm font-semibold text-green-800">You&apos;re all set</h2>
        <p className="mt-1 text-sm text-green-700">
          You&apos;ve completed every onboarding step. Welcome aboard!
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Onboarding checklist"
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Get started</h2>
        <span className="text-xs text-gray-500">
          {doneCount}/{STEPS.length} complete
        </span>
      </header>

      <ol className="mt-3 space-y-3">
        {STEPS.map((step) => {
          const isDone = completed.includes(step.id);
          return (
            <li key={step.id} className="flex items-start gap-3">
              <input
                id={`onboarding-${step.id}`}
                type="checkbox"
                checked={isDone}
                disabled={!hydrated}
                onChange={() => toggle(step.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <div className="flex-1">
                <label
                  htmlFor={`onboarding-${step.id}`}
                  className={`block text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                >
                  {step.label}
                </label>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {!isDone && (
                <Link
                  href={step.href}
                  className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
