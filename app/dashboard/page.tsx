import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NewProjectButton } from '@/app/new-project-button';
import { HomeContent } from '@/app/home-content';
import { DashboardSummary } from '@/components/dashboard/dashboard-summary';
import { ShippedWall } from '@/components/dashboard/shipped-wall';
import { StaleCard } from '@/components/dashboard/stale-card';
import {
  getAllPatches,
  getDashboardSummary,
  getProjects,
  getProjectSummary,
  getStalePatches,
  getVelocity,
  STALE_DAYS,
} from '@/lib/queries';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [projects, patches, summary, dashboardSummary, stale, shipped] = await Promise.all([
    // Archived projects come along for the collapsed "Archived" section.
    getProjects(userId, true),
    getAllPatches(userId),
    getProjectSummary(userId),
    getDashboardSummary(userId),
    getStalePatches(userId),
    // Wins count even if the patch or its project was archived since.
    getVelocity(userId, weekAgo, true),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24">
      <div className="z-10 flex w-full max-w-5xl justify-end">
        <NewProjectButton />
      </div>
      <div className="w-full max-w-5xl space-y-8">
        <ShippedWall patches={shipped.patches} />
        <StaleCard patches={stale} staleDays={STALE_DAYS} />
        <DashboardSummary data={dashboardSummary} />
        <HomeContent projects={projects} patches={patches} summary={summary} />
      </div>
    </main>
  );
}