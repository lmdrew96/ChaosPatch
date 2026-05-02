import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NewProjectButton } from '@/app/new-project-button';
import { HomeContent } from '@/app/home-content';
import { DashboardSummary } from '@/components/dashboard/dashboard-summary';
import {
  getAllPatches,
  getDashboardSummary,
  getProjects,
  getProjectSummary,
} from '@/lib/queries';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const [projects, patches, summary, dashboardSummary] = await Promise.all([
    getProjects(userId),
    getAllPatches(userId),
    getProjectSummary(userId),
    getDashboardSummary(userId),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24">
      <div className="z-10 flex w-full max-w-5xl justify-end">
        <NewProjectButton />
      </div>
      <div className="w-full max-w-5xl space-y-8">
        <DashboardSummary data={dashboardSummary} />
        <HomeContent projects={projects} patches={patches} summary={summary} />
      </div>
    </main>
  );
}