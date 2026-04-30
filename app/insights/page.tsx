import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAllPatches, getProjectSummary } from "@/lib/queries";
import { InsightsContent } from "./insights-content";

export default async function InsightsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [summary, patches] = await Promise.all([
    getProjectSummary(userId),
    getAllPatches(userId),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24">
      <div className="w-full max-w-5xl">
        <InsightsContent summary={summary} patches={patches} />
      </div>
    </main>
  );
}
