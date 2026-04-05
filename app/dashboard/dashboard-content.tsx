export default function LandingContent() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          ChaosPatch
        </span>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Pricing
          </a>
          <a
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-8 px-8 py-24 text-center">
        <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Now in public beta
        </span>
        <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
          Ship patches without the chaos
        </h1>
        <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400">
          ChaosPatch helps engineering teams coordinate, review, and deploy hotfixes
          at speed — without losing visibility or breaking production.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            Start for free
          </a>
          <a
            href="#features"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            Learn more
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 dark:bg-gray-900 px-8 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
            Everything you need to patch fast
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "One-click deploys",
                description:
                  "Queue, approve, and deploy patches to any environment with a single click.",
              },
              {
                title: "Real-time audit log",
                description:
                  "Every change is tracked. Know who patched what, when, and why.",
              },
              {
                title: "Team collaboration",
                description:
                  "Built-in review flows keep your whole team aligned before anything ships.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950"
              >
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 px-8 py-6 text-center text-sm text-gray-500 dark:text-gray-500">
        © {new Date().getFullYear()} ChaosPatch. All rights reserved.
      </footer>
    </main>
  );
}