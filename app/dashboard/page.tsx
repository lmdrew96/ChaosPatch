import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NewProjectButton } from '@/app/new-project-button';
import DashboardContent from '@/app/dashboard/dashboard-content';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <NewProjectButton />
      </div>
      <DashboardContent />
    </main>
  );
}