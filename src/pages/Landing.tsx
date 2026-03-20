import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
        <span className="text-[#f97316] text-xs font-black tracking-[3px] uppercase">
          LaunchRadar
        </span>
        <Link
          to="/login"
          className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="bg-[#0f172a] px-8 py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight max-w-2xl mx-auto">
          Stop guessing where to show&nbsp;up.
        </h1>
        <p className="mt-5 text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          LaunchRadar monitors Reddit, Hacker News, and Indie Hackers for the conversations
          where your app is the answer — and delivers them to you every week.
        </p>
        <Link
          to="/login"
          className="inline-block mt-8 bg-[#f97316] hover:bg-orange-600
                     text-white font-bold px-7 py-3.5 rounded text-sm tracking-wide transition-colors"
        >
          Get early access
        </Link>
      </section>

      {/* How it works */}
      <section className="px-8 py-20 bg-white max-w-4xl mx-auto">
        <h2 className="text-center text-2xl font-black text-[#0f172a] mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div className="text-center">
            <div className="w-10 h-10 rounded bg-[#0f172a] text-[#f97316] font-black text-lg
                            flex items-center justify-center mx-auto mb-4">
              1
            </div>
            <h3 className="font-bold text-[#0f172a] mb-2">Describe your app</h3>
            <p className="text-[#64748b] text-sm leading-relaxed">
              Tell us what problem your app solves. LaunchRadar extracts the exact frustration
              language your users would post online.
            </p>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 rounded bg-[#0f172a] text-[#f97316] font-black text-lg
                            flex items-center justify-center mx-auto mb-4">
              2
            </div>
            <h3 className="font-bold text-[#0f172a] mb-2">We watch the internet</h3>
            <p className="text-[#64748b] text-sm leading-relaxed">
              Every week, we scan Reddit, Hacker News, and Indie Hackers for people
              actively describing the problem your app solves.
            </p>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 rounded bg-[#0f172a] text-[#f97316] font-black text-lg
                            flex items-center justify-center mx-auto mb-4">
              3
            </div>
            <h3 className="font-bold text-[#0f172a] mb-2">You show up with confidence</h3>
            <p className="text-[#64748b] text-sm leading-relaxed">
              Every Monday, a digest lands in your inbox: the live conversations where your
              app is the answer, and exactly what to say in each one.
            </p>
          </div>

        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0f172a] px-8 py-16 text-center">
        <h2 className="text-2xl font-black text-white mb-3">
          Your users are asking for you right now.
        </h2>
        <p className="text-slate-400 text-sm mb-7">
          Start finding them this week.
        </p>
        <Link
          to="/login"
          className="inline-block bg-[#f97316] hover:bg-orange-600
                     text-white font-bold px-7 py-3.5 rounded text-sm tracking-wide transition-colors"
        >
          Get early access
        </Link>
      </section>

    </div>
  );
}
