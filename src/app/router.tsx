import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { FirstRunRoute } from '@/app/routes/first-run';
import { GrowthRoute } from '@/app/routes/growth';
import { MemoryRoute } from '@/app/routes/memory';
import { MemoryReviewRoute } from '@/app/routes/memory/review';
import { SettingsEvaRoute, SettingsRoute } from '@/app/routes/settings';
import { TalkRoute } from '@/app/routes/talk';
import { TalkStartRoute } from '@/app/routes/talk-start';
import { WrapUpRoute } from '@/app/routes/wrap-up';
import { FIRST_RUN_PATH } from '@/core/first-run';
import { GROWTH_PATH } from '@/screens/growth';
import { AppShell } from './shell/app-shell';

const rootRoute = createRootRoute({
  component: AppShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: TalkStartRoute,
});

const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversation',
  component: TalkRoute,
});

const memoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory',
  component: MemoryRoute,
});

const memoryReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory/review',
  component: MemoryReviewRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsRoute,
});

const settingsEvaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/eva',
  component: SettingsEvaRoute,
});

const growthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: GROWTH_PATH,
  component: GrowthRoute,
});

const firstRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: FIRST_RUN_PATH,
  component: FirstRunRoute,
});

const summaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/summary',
  component: WrapUpRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  conversationRoute,
  memoryRoute,
  memoryReviewRoute,
  settingsRoute,
  settingsEvaRoute,
  growthRoute,
  firstRunRoute,
  summaryRoute,
]);

const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

export const router = createRouter({
  routeTree,
  history: memoryHistory,
});

void router.load();

type AppRouter = typeof router;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: module augmentation merges only interfaces
  interface Register {
    router: AppRouter;
  }
}
