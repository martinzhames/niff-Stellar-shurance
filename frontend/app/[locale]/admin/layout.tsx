import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Admin area access control.
 *
 * SECURITY NOTE: Client-side hiding is NOT security. The role check below
 * (and the sidebar filtering it drives) only controls what the UI renders.
 * Every admin API call is still authorized by the backend, which is the
 * single source of truth for authorization. Never rely on this layout to
 * protect data — it is a UX convenience, not a security boundary.
 */

// Roles permitted to access the /admin/* area.
const ADMIN_ROLES = ['admin', 'operator', 'support'] as const;

type AdminRole = (typeof ADMIN_ROLES)[number];

// Shape of the current wallet/session as exposed to the frontend.
// Adjust the import to the project's existing session helper if one exists.
type Session = {
  role?: string | null;
} | null;

async function getSession(): Promise<Session> {
  // Replace with the project's real session/auth lookup.
  // Kept local so this layout stays self-contained.
  return null;
}

function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role);
}

function getEnvironment(): 'TESTNET' | 'MAINNET' {
  const env =
    process.env.NEXT_PUBLIC_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_NETWORK ??
    process.env.NODE_ENV;
  return env === 'mainnet' || env === 'production' ? 'MAINNET' : 'TESTNET';
}

// Sidebar navigation, each entry tagged with the roles allowed to see it.
const NAV_ITEMS: { href: string; label: string; roles: AdminRole[] }[] = [
  { href: '/admin', label: 'Overview', roles: ['admin', 'operator', 'support'] },
  { href: '/admin/wallets', label: 'Wallets', roles: ['admin', 'operator', 'support'] },
  { href: '/admin/transactions', label: 'Transactions', roles: ['admin', 'operator'] },
  { href: '/admin/operators', label: 'Operators', roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', roles: ['admin'] },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const role = session?.role ?? null;

  // Server-side gate: unauthorized wallets are redirected away from /admin/*.
  if (!isAdminRole(role)) {
    redirect('/');
  }

  const environment = getEnvironment();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-screen flex-col">
      {/* Large, colored environment banner. */}
      <div
        className={
          environment === 'MAINNET'
            ? 'w-full bg-red-600 px-4 py-3 text-center text-lg font-bold tracking-widest text-white'
            : 'w-full bg-amber-500 px-4 py-3 text-center text-lg font-bold tracking-widest text-black'
        }
        role="status"
      >
        {environment}
      </div>

      <div className="flex flex-1">
        {/* Sidebar, filtered by the current user's role. */}
        <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
          <div className="mb-6 flex items-center justify-between">
            <span className="text-sm font-semibold uppercase text-gray-500">
              Admin
            </span>
            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium uppercase text-white">
              {role}
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
