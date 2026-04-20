'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, FileText, BarChart3, Wallet } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/add', label: 'Add', icon: PlusCircle },
  { href: '/statements', label: 'Statements', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop top bar ────────────────────────────────────────── */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-14 bg-background/80 backdrop-blur-lg border-b items-center px-6 gap-1">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight">BankScan</span>
        </Link>

        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile bottom bar ──────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
