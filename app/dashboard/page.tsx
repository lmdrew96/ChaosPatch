import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NewProjectButton } from '@/app/new-project-button';
import { HomeContent } from '@/app/home-content';
import { getAllPatches, getProjects } from '@/lib/queries';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  const [projects, patches] = await Promise.all([
    getProjects(userId),
    getAllPatches(userId),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24">
      <div className="z-10 flex w-full max-w-5xl justify-end">
        <NewProjectButton />
      </div>
      <div className="w-full max-w-5xl">
        <HomeContent projects={projects} patches={patches} />
      </div>
    </main>
  );
}