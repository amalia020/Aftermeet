export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.08em] text-slate-500">
          AfterMeet
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-950">
          Intelligence layer backend is ready for capture, extraction, and evidence.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-700">
          This scaffold keeps the product surface intentionally quiet while Parts 1 and 2
          expose typed APIs for objectives, capture, processing, enrichment, and confidence.
        </p>
        <a
          href="/docs"
          className="inline-flex w-fit rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open Swagger API docs
        </a>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Objective", "GET/POST /api/objectives"],
          ["Capture", "POST /api/capture/text"],
          ["Process", "POST /api/intelligence/process"]
        ].map(([label, endpoint]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-950">{label}</p>
            <p className="mt-2 text-sm text-slate-600">{endpoint}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
