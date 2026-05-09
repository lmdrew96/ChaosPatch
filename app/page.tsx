import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      {/* Animated background blobs — ADHDesigns palette */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{ backgroundColor: 'color-mix(in srgb, var(--adhd-lavender) 60%, transparent)' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse animation-delay-2000"
          style={{ backgroundColor: 'color-mix(in srgb, var(--adhd-purple) 30%, transparent)' }}
        />
        <div
          className="absolute bottom-0 right-1/3 w-96 h-96 rounded-full blur-3xl animate-pulse animation-delay-4000"
          style={{ backgroundColor: 'color-mix(in srgb, var(--adhd-amber) 25%, transparent)' }}
        />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-4 py-32 min-h-[calc(100vh-64px)]">
        <div className="text-center max-w-3xl space-y-8">
          <div className="space-y-4">
            <h1
              className="font-[family-name:var(--font-display)] text-7xl md:text-8xl font-normal tracking-tight bg-clip-text text-transparent animate-fade-in"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--adhd-purple), var(--adhd-amber))',
              }}
            >
              ChaosPatch
            </h1>
            <div
              className="h-1 w-24 mx-auto rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--adhd-purple), var(--adhd-amber))',
              }}
            />
          </div>

          <p className="text-xl md:text-2xl text-foreground/80 leading-relaxed animate-fade-in animation-delay-200">
            A lightweight patch tracker for developers — log bug fixes and{" "}
            <span className="font-[family-name:var(--font-display)] italic">refactors</span>{" "}
            across your projects.
            <span className="block text-lg mt-2 text-muted-foreground">
              Manage patches from your browser or directly from Claude Code.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in animation-delay-400">
            <Button
              asChild
              className="h-12 px-8 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <Link href="/sign-up">Get Started Free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 px-8 text-lg font-semibold backdrop-blur transition-all duration-300 hover:scale-105"
            >
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-4 py-16 max-w-6xl mx-auto">
        <h2
          className="font-[family-name:var(--font-display)] text-5xl md:text-6xl font-normal italic tracking-tight text-center mb-16 bg-clip-text text-transparent"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--adhd-purple), var(--adhd-amber))',
          }}
        >
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
              className="p-6 rounded-2xl border border-border bg-card/70 backdrop-blur hover:bg-card transition-all duration-300 hover:shadow-xl hover:scale-105"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-normal text-card-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
