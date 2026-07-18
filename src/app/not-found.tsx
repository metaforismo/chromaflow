import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-stone-100 px-6 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <section className="max-w-lg border-l border-current/20 pl-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] opacity-60">
          404 / color not sampled
        </p>
        <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em]">
          This shade is outside the canvas.
        </h1>
        <Link
          className="mt-8 inline-flex border-b border-current pb-1 text-sm font-semibold"
          href="/"
        >
          Return to the studio
        </Link>
      </section>
    </main>
  );
}
