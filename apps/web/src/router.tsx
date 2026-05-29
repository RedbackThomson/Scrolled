import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Vite injects BASE_URL from `vite.config.ts#base`. React Router prefers a
// basename without a trailing slash.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(
  [
    // The wizard is a sibling of AppShell so it can use its own full-page
    // layout — no sidebar, no top bar.
    {
      path: 'setup',
      lazy: () => import('@/routes/Setup').then((m) => ({ Component: m.default })),
    },
    {
      element: <AppShell />,
      children: [
        {
          index: true,
          lazy: () => import('@/routes/Home').then((m) => ({ Component: m.default })),
        },
        {
          path: 'items',
          lazy: () => import('@/routes/Items').then((m) => ({ Component: m.default })),
        },
        {
          path: 'items/:id',
          lazy: () => import('@/routes/ItemDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'equips',
          lazy: () => import('@/routes/Equips').then((m) => ({ Component: m.default })),
        },
        {
          path: 'equips/:id',
          lazy: () => import('@/routes/EquipDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'weapons',
          lazy: () => import('@/routes/Weapons').then((m) => ({ Component: m.default })),
        },
        {
          path: 'mobs',
          lazy: () => import('@/routes/Mobs').then((m) => ({ Component: m.default })),
        },
        {
          path: 'mobs/:id',
          lazy: () => import('@/routes/MobDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'npcs',
          lazy: () => import('@/routes/Npcs').then((m) => ({ Component: m.default })),
        },
        {
          path: 'npcs/:id',
          lazy: () => import('@/routes/NpcDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'maps',
          lazy: () => import('@/routes/Maps').then((m) => ({ Component: m.default })),
        },
        {
          path: 'maps/:id',
          lazy: () => import('@/routes/MapDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'quests',
          lazy: () => import('@/routes/Quests').then((m) => ({ Component: m.default })),
        },
        {
          path: 'quests/:id',
          lazy: () => import('@/routes/QuestDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'quest-chains',
          lazy: () => import('@/routes/QuestChains').then((m) => ({ Component: m.default })),
        },
        {
          path: 'quest-chains/:id',
          lazy: () =>
            import('@/routes/QuestChainDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'collections',
          lazy: () => import('@/routes/Collections').then((m) => ({ Component: m.default })),
        },
        {
          path: 'collections/:id',
          lazy: () => import('@/routes/CollectionDetail').then((m) => ({ Component: m.default })),
        },
        {
          path: 'settings',
          lazy: () => import('@/routes/Settings').then((m) => ({ Component: m.default })),
        },
        {
          path: 'debug',
          lazy: () => import('@/routes/Debug').then((m) => ({ Component: m.default })),
        },
        {
          path: '*',
          lazy: () => import('@/routes/NotFound').then((m) => ({ Component: m.default })),
        },
      ],
    },
  ],
  { basename },
);
