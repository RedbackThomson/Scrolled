import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { Button } from '@scrolled/ui';
import { cn } from '@scrolled/ui';

/**
 * The account control in the top bar. Mounted only when the deployment enables
 * accounts; reads the generic session, never the auth provider. Signed out: a
 * "Sign in" button. Signed in: an avatar that opens a small menu.
 */
export function AccountMenu() {
  const user = useCurrentUser();
  const navigate = useNavigate();

  if (!user.isAuthenticated) {
    return (
      <Button variant="ghost" size="sm" onClick={() => navigate('/sign-in')}>
        Sign in
      </Button>
    );
  }

  return <SignedInMenu />;
}

function SignedInMenu() {
  const user = useCurrentUser();
  const { logout } = useIdentity();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const name = user.displayName ?? user.email ?? 'Account';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="focus-visible:ring-ring focus-visible:ring-offset-background flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-input transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-card text-card-foreground absolute right-0 z-20 mt-2 w-56 rounded-md border p-1 shadow-md"
        >
          <div className="px-2 py-1.5">
            <div className="truncate text-sm font-medium">{name}</div>
            {user.email && (
              <div className="text-muted-foreground truncate text-xs">{user.email}</div>
            )}
          </div>
          <div className="bg-border my-1 h-px" />
          <MenuItem
            icon={Settings}
            label="Account"
            onSelect={() => {
              setOpen(false);
              navigate('/settings#account');
            }}
          />
          <MenuItem
            icon={LogOut}
            label="Sign out"
            onSelect={() => {
              setOpen(false);
              void logout();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: typeof User;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon className="text-muted-foreground h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
