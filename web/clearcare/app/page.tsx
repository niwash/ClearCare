import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
      <h1 className="mb-6 font-serif text-3xl font-semibold tracking-tight">Welcome to ClearCare</h1>
      <Link
        href="/home"  //temporary redirect to home
        className="w-56 rounded-lg bg-primary py-3 text-center font-medium text-on-primary no-underline hover:text-on-primary hover:opacity-90 adult:hover:bg-primary-hover adult:hover:opacity-100"
      >
        Log in (coming soon)
      </Link>
      <Link
        href="/home"
        className="w-56 rounded-lg border border-line py-3 text-center font-medium text-ink-muted no-underline hover:text-ink"
      >
        Continue as guest
      </Link>
    </main>
    );
}
