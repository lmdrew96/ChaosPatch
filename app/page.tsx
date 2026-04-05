import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-blue-400 to-purple-600 text-transparent bg-clip-text">
          ChaosPatch
        </h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-8">
          The ultimate platform for managing your server patches and maintaining system integrity.
          Deploy, track, and revert patches with confidence.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild className="h-11 px-8 text-lg">
            <Link href="/sign-up">
              Get Started
            </Link>
          </Button>
          <Button asChild className="h-11 border border-input bg-background px-8 text-lg hover:bg-accent hover:text-accent-foreground">
            <Link href="/sign-in">
              Sign In
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}