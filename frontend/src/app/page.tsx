export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        NiffyInsur
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Parametric insurance powered by DAO governance on the Stellar network.
      </p>
    </section>
  );
}
