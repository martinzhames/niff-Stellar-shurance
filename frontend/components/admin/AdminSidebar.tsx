'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin roles allowed into the admin area.
 *
 * SECURITY NOTE: Hiding sidebar entries on the client is a UX affordance only —
 * it is NOT a security boundary. Every admin API call is still authorized by the
 * backend, which independently verifies the caller's role. Never rely on this
 * filtering to protect data or actions.
 */
export type AdminRole = 'admin' | 'operator' | 'support';

const ADMIN_ROLES: readonly AdminRole[] = ['admin', 'operator', 'support'];

interface AdminNavItem {
  href: string;
  label: string;
  /** Roles permitted to see this entry. Omitted means all admin roles. */
  roles?: readonly AdminRole[];
}

const NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/wallets', label: 'Wallets' },
  { href: '/admin/transactions', label: 'Transactions' },
  { href: '/admin/operators', label: 'Operators', roles: ['admin'] },
  { href: '/admin/settings', label: 'Settings', roles: ['admin'] },
  { href: '/admin/support', label: 'Support', roles: ['admin', 'support'] },
];

interface AdminSidebarProps {
  role: AdminRole;
}

/**
 * Filters the admin navigation by the current wallet's role.
 *
 * This is presentation-only: the server-side layout performs the authoritative
 * role check and redirect, and the backend authorizes every admin API call.
 */
export function filterNavItemsByRole(role: AdminRole): AdminNavItem[] {
  if (!ADMIN_ROLES.includes(role)) {
    return [];
  }
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export default function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname();
  const items = filterNavItemsByRole(role);

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-sm font-semibold text-gray-900">Admin</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-gray-700">
          {role}
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-3">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
