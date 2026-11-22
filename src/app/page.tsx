import { AuthNav } from "@/app/components/auth-nav";

const features = [
  {
    number: "01",
    title: "Find your foods",
    description:
      "Search USDA FoodData Central and add your own foods to a personal library.",
  },
  {
    number: "02",
    title: "Build a plan",
    description:
      "Organize foods into meals, adjust portions, and plan your days your way.",
  },
  {
    number: "03",
    title: "See the full picture",
    description:
      "Explore calories, macros, vitamins, and minerals by meal or across a day.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>nutrimetrics<span className="brand-dot">.</span></span>
        </div>
        <AuthNav />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A MORE PERSONAL APPROACH TO NUTRITION</p>
          <h1>Good food.<br /><em>Better insight.</em></h1>
          <p className="intro">
            A space to plan meals, understand what&apos;s on your plate, and make
            nutrition data work for you.
          </p>
          <div className="notice">
            <span className="notice-icon" aria-hidden="true">✳</span>
            <div>
              <strong>We&apos;re building the foundation.</strong>
              <p>Search USDA foods now. Meal planning is coming next.</p>
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="plate">
            <div className="plate-inner">
              <div className="plate-leaf leaf-one" />
              <div className="plate-leaf leaf-two" />
              <div className="plate-circle circle-one" />
              <div className="plate-circle circle-two" />
              <div className="plate-grain" />
            </div>
          </div>
          <span className="art-label">A LITTLE MORE BALANCE, EVERY DAY</span>
        </div>
      </section>

      <section className="features" aria-labelledby="features-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THOUGHTFULLY MADE FOR YOU</p>
            <h2 id="features-heading">A clearer view of your nutrition.</h2>
          </div>
          <p>Designed to make the details feel a little simpler.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature" key={feature.number}>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>nutrimetrics<span className="brand-dot">.</span></span>
        <span>Built for a better understanding of food.</span>
      </footer>
    </main>
  );
}

