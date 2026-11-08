import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NewProjectButton } from '@/app/new-project-button';
import { HomeContent } from '@/app/home-content';
import { ActivityStrip, ReviewQueue } from '@/components/dashboard/dashboard-summary';
import { StaleCard } from '@/components/dashboard/stale-card';
import { SPECS_UI_ENABLED } from '@/lib/flags';
import {
  getAllPatches,
  getDashboardSummary,
  getProjects,
  getStalePatches,
  STALE_DAYS,
} from '@/lib/queries';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ stale?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  // The stale list is no longer a dashboard section; the header ⌛ chip
  // opens it here with ?stale=1.
  const showStale = (await searchParams).stale === '1';

  const [projects, patches, dashboardSummary, stale] = await Promise.all([
    // Archived projects come along for the collapsed "Archived" section.
    getProjects(userId, true),
    getAllPatches(userId),
    getDashboardSummary(userId),
    showStale ? getStalePatches(userId) : Promise.resolve([]),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24">
      <div className="z-10 flex w-full max-w-5xl flex-wrap justify-end gap-2">
        {SPECS_UI_ENABLED && (
          <Link
            href="/specs/new"
            className="rounded-md border border-border bg-card hover:bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors"
          >
            + New spec
          </Link>
        )}
        <Link
          href="/add"
          title="New patch (⌘N)"
          className="rounded-md bg-success hover:bg-success/90 px-3 py-1.5 text-sm font-medium text-success-foreground transition-colors"
        >
          + New patch
        </Link>
        <NewProjectButton />
      </div>
      <div className="w-full max-w-5xl space-y-6">
        {showStale && <StaleCard patches={stale} staleDays={STALE_DAYS} defaultOpen />}
        <ReviewQueue patches={dashboardSummary.needsReview} />
        <div>
          <HomeContent projects={projects} patches={patches} />
        </div>
        <ActivityStrip data={dashboardSummary} />
      </div>
    </main>
  );
}
