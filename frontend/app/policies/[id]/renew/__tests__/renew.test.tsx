import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RenewPolicyPage from '../page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'policy-1' }),
}));

const basePolicy = {
  id: 'policy-1',
  policyNumber: 'POL-0001',
  status: 'active',
  premium: 1200,
  currency: 'USD',
  coverageStart: '2024-01-01',
  coverageEnd: '2024-12-31',
  hasOpenClaim: false,
  eligibleForRenewal: true,
};

const baseQuote = {
  premium: 1320,
  currency: 'USD',
  coverageStart: '2025-01-01',
  coverageEnd: '2025-12-31',
  priceChangeReason: 'Rate table update effective 2025',
  gracePeriodDays: 0,
};

function mockFetch(policy: any, quote: any) {
  global.fetch = jest.fn((url: string) => {
    if (String(url).includes('/renewal-quote')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(quote) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(policy) });
  }) as any;
}

describe('Policy renewal page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the fresh renewal quote and explains the premium change for an eligible policy', async () => {
    mockFetch(basePolicy, baseQuote);
    render(<RenewPolicyPage />);

    expect(await screen.findByText(/renewal quote/i)).toBeInTheDocument();
    expect(screen.getByText(/1,200/)).toBeInTheDocument();
    expect(screen.getByText(/1,320/)).toBeInTheDocument();
    expect(screen.getByText(/Rate table update effective 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/2025-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/2025-12-31/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign and pay/i })).toBeEnabled();
  });

  it('blocks renewal when the policy has an open claim', async () => {
    mockFetch({ ...basePolicy, hasOpenClaim: true }, baseQuote);
    render(<RenewPolicyPage />);

    expect(await screen.findByText(/open claim/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign and pay/i })).toBeDisabled();
  });

  it('blocks renewal when the policy is not eligible', async () => {
    mockFetch({ ...basePolicy, eligibleForRenewal: false }, baseQuote);
    render(<RenewPolicyPage />);

    expect(await screen.findByText(/not eligible for renewal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign and pay/i })).toBeDisabled();
  });

  it('shows a grace period warning when applicable', async () => {
    mockFetch(basePolicy, { ...baseQuote, gracePeriodDays: 30 });
    render(<RenewPolicyPage />);

    expect(await screen.findByText(/grace period/i)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('shows a success state linking back to the policy after sign and pay', async () => {
    mockFetch(basePolicy, baseQuote);
    render(<RenewPolicyPage />);

    const payButton = await screen.findByRole('button', { name: /sign and pay/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(screen.getByText(/renewal complete/i)).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /back to policy/i });
    expect(link).toHaveAttribute('href', '/policies/policy-1');
  });
});
