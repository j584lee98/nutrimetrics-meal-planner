import Link from "next/link";

export function AppNav({ current }: { current?: "plans" | "meals" | "foods" | "options" }) {
  return (
    <header className="app-header">
      <Link href="/dashboard" className="brand app-brand">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span>nutrimetrics<span className="brand-dot">.</span></span>
      </Link>
      <nav className="app-nav" aria-label="Main navigation">
        <Link href="/plans" aria-current={current === "plans" ? "page" : undefined}>Plans</Link>
        <Link href="/meals" aria-current={current === "meals" ? "page" : undefined}>Meals</Link>
        <Link href="/foods" aria-current={current === "foods" ? "page" : undefined}>Lookup</Link>
        <Link href="/options" aria-current={current === "options" ? "page" : undefined}>Options</Link>
      </nav>
    </header>
  );
}
