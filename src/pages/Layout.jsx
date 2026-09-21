import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export const NAV = [
  { n: '01', label: 'Overview', to: '/' },
  { n: '02', label: 'Customers', to: '/customers' },
  { n: '03', label: 'Recovery', to: '/recovery' },
  { n: '04', label: 'Reminders', to: '/reminders' },
  { n: '05', label: 'Reports', to: '/reports' },
  { n: '06', label: 'Settings', to: '/settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background paper-texture">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-background/80 backdrop-blur-sm">
        <div className="px-7 pt-8 pb-6 border-b border-border">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vol. I · No. 01</div>
          <div className="mt-3 font-serif text-3xl leading-[1.05]">
            The Repeat<br /><em className="font-light">Booking Journal</em>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-0.5">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <span className="font-mono text-[10px] tracking-[0.18em] w-6">§ {item.n}</span>
                      <span className={cn('font-serif text-lg leading-none', isActive && 'italic')}>{item.label}</span>
                      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="px-7 py-6 border-t border-border">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{today}</div>
          {user && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted-foreground truncate">{user.email}</span>
              <button type="button" onClick={logout} className="text-muted-foreground hover:text-foreground" title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </footer>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 h-14">
        <div className="font-serif text-lg leading-none">The Repeat <em className="font-light">Journal</em></div>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn('font-mono text-[11px] px-2 py-1 rounded-sm', active ? 'bg-foreground text-background' : 'text-muted-foreground')}
                title={item.label}
              >
                {item.n}
              </NavLink>
            );
          })}
          <button type="button" onClick={logout} className="ml-1 text-muted-foreground" title="Sign out"><LogOut className="h-3.5 w-3.5" /></button>
        </nav>
      </header>

      <main className="md:ml-64 pt-20 md:pt-12 px-5 md:px-12 pb-24 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
