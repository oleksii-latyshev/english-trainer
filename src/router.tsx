import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { FIRST_RUN_PATH } from '@/core/first-run';
import { FirstRunRoute } from '@/routes/first-run';
import { MemoryRoute } from '@/routes/memory';
import { MemoryReviewRoute } from '@/routes/memory/review';
import { SettingsEvaRoute, SettingsRoute } from '@/routes/settings';
import { TalkRoute } from '@/routes/talk';
import { TalkStartRoute } from '@/routes/talk-start';
import { WrapUpRoute } from '@/routes/wrap-up';

export const rootRoute = createRootRoute({
  component: AppShell,
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TalkStartRoute,
});

export const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversation',
  component: TalkRoute,
});

export const memoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory',
  component: MemoryRoute,
});

export const memoryReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory/review',
  component: MemoryReviewRoute,
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
});

export const settingsEvaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/eva',
  component: SettingsEvaRoute,
});

export const firstRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: FIRST_RUN_PATH,
  component: FirstRunRoute,
});

export const summaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/summary',
  component: WrapUpRoute,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  conversationRoute,
  memoryRoute,
  memoryReviewRoute,
  settingsRoute,
  settingsEvaRoute,
  firstRunRoute,
  summaryRoute,
]);

export const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

export const router = createRouter({
  routeTree,
  history: memoryHistory,
});

void router.load();

export type AppRouter = typeof router;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
