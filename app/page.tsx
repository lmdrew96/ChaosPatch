import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse animation-delay-2000" />
        <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-pulse animation-delay-4000" />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 py-32 min-h-[calc(100vh-64px)]">
        <div className="text-center max-w-3xl space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-fade-in">
              ChaosPatch
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full" />
          </div>

          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 leading-relaxed animate-fade-in animation-delay-200">
            A lightweight patch tracker for developers — log bug fixes and refactors across your projects.
            <span className="block text-lg mt-2 text-gray-500 dark:text-gray-400">
              Manage patches from your browser or directly from Claude Code.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in animation-delay-400">
            <Button
              asChild
              className="h-12 px-8 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Link href="/sign-up">Get Started Free</Link>
            </Button>
            <Button
              asChild
              className="h-12 px-8 text-lg text-gray-700 font-semibold border-2 border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-slate-900/80 backdrop-blur hover:bg-gray-50 dark:hover:bg-slate-800 transition-all duration-300 hover:scale-105"
            >
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 py-16 max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-center mb-16 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Why ChaosPatch?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🗂️', title: 'Organized by Project', desc: 'Group patches under projects and track their status from open to complete.' },
            { icon: '🤖', title: 'MCP Integration', desc: 'Manage patches without leaving your editor via the MCP server.' },
            { icon: '📱', title: 'Works Anywhere', desc: 'Installable PWA — access your patch log from desktop or mobile.' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 hover:shadow-xl hover:scale-105"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
