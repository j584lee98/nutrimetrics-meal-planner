import Link from "next/link";

export function AppNav({ current, documentNavigation = false }: {
  current?: "plans" | "meals" | "custom-foods" | "foods" | "options";
  documentNavigation?: boolean;
}) {
  // Builder pages use document navigation so beforeunload also protects browser history traversal.
  const NavLink = documentNavigation ? "a" : Link;
  return (
    <header className="app-header">
      <NavLink href="/dashboard" className="brand app-brand">
        <span className="brand-mark" aria-hidden="true">N</span>
        <span>nutrimetrics<span className="brand-dot">.</span></span>
      </NavLink>
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink href="/plans" aria-current={current === "plans" ? "page" : undefined}>Plans</NavLink>
        <NavLink href="/meals" aria-current={current === "meals" ? "page" : undefined}>Meals</NavLink>
        <NavLink href="/custom-foods" aria-current={current === "custom-foods" ? "page" : undefined}>Custom foods</NavLink>
        <NavLink href="/foods" aria-current={current === "foods" ? "page" : undefined}>Lookup</NavLink>
        <NavLink href="/options" aria-current={current === "options" ? "page" : undefined}>Options</NavLink>
      </nav>
    </header>
  );
}
