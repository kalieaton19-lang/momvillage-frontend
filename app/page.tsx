import Image from "next/image";
import Link from "next/link";
import Header from "./components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-zinc-50 dark:from-black dark:to-zinc-900">
      <Header />

      <main className="max-w-6xl mx-auto p-6 flex flex-col gap-12">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-zinc-900 dark:text-zinc-50">
              A Village of Moms,<br />For Moms.
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300 max-w-xl">
              Because motherhood was never meant to be done alone. Too many stay-at-home moms face their days in isolation, far from family and without the support network that once came naturally.
            </p>
            <p className="mt-4 text-lg font-semibold text-pink-600 dark:text-pink-400">
              It's time to bring the village back.
            </p>
            <div className="mt-6 flex gap-4">
              <Link
                className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-6 py-3 text-white font-medium hover:bg-pink-700"
                href="/signup"
              >
                Join Your Village
              </Link>
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-6 py-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                href="/login"
              >
                Sign In
              </Link>
            </div>
          </div>

          <div className="relative w-full">
            <div className="aspect-[4/3] w-full rounded-2xl bg-gradient-to-tr from-pink-50 to-pink-100 dark:from-transparent dark:to-zinc-800 flex items-center justify-center">
              <svg className="w-3/4 h-3/4" viewBox="0 0 600 450" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="600" height="450" rx="24" fill="url(#g)" />
                <g opacity="0.95">
                  <circle cx="180" cy="180" r="60" fill="#fff" />
                  <rect x="260" y="120" width="220" height="180" rx="12" fill="#fff" />
                </g>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#ffd6e0" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
            Remember the Village?
          </h2>
          <div className="space-y-4 text-zinc-700 dark:text-zinc-300 leading-relaxed">
            <p>
              Generations ago, mothers had something we've lost: a village. Neighbors who watched each other's children, friends who dropped by for coffee and conversation, and a community that understood the beautiful chaos of raising little ones.
            </p>
            <p>
              Today, too many stay-at-home moms navigate parenthood without the network of support that once came naturally. Moving to new cities, living far from family, facing each day in isolation.
            </p>
            <p className="text-pink-600 dark:text-pink-400 font-semibold text-lg">
              MomVillage helps you build your own network of like-minded mothers in your area.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6 text-center">Build Your Own Village</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="🤝 Connect Locally">Find like-minded mothers in your area who share your values and parenting style.</Card>
            <Card title="📅 Share Schedules">Coordinate playdates, coffee meetups, and support when you need it most.</Card>
            <Card title="💕 Build Community">Create the network of support that stay-at-home moms deserve.</Card>
            <Card title="🏘️ Your Village">You don't have to do this alone anymore.</Card>
          </div>
        </section>

        <footer className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">© {new Date().getFullYear()} MomVillage</div>
            <div className="flex gap-4 text-sm">
              <a href="#" className="text-zinc-600 dark:text-zinc-400">Privacy</a>
              <a href="#" className="text-zinc-600 dark:text-zinc-400">Terms</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>
    </div>
  );
}
