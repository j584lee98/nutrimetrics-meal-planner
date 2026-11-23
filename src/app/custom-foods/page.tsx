import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { DeleteItemButton } from "@/app/components/delete-item-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { foodInclude, toBuilderFood } from "@/lib/builder-food";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function CustomFoodsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const foods = await db.food.findMany({
    where: { ownerId: session.user.id },
    include: foodInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const columns = await getNutrientPreferences(session.user.id);
  return (
    <main className="auth-page">
      <AppNav current="custom-foods" />
      <div className="lookup-heading"><h1>Custom foods</h1></div>
      <section className="search-panel" aria-label="Custom foods">
        <p className="search-intro">Create your own food or start with an existing food. Modified foods are saved as separate copies, so existing meals stay unchanged.</p>
        <Link href="/custom-foods/new" className="button button-small">Create custom food</Link>
        {foods.length === 0 && <p className="planner-empty">You don&apos;t have any custom foods yet.</p>}
        {foods.map((food) => {
          const item = toBuilderFood(food);
          return (
          <article className="plan-card" key={food.id}>
            <div className="plan-heading"><h2>{food.name}</h2><DeleteItemButton id={food.id} name={food.name} kind="food" /></div>
            <p className="nutrient-note">Default: {food.defaultAmount} {food.defaultUnit}</p>
            {columns.length > 0 ? <div className="table-scroll nutrient-table">
              <table>
                <thead><tr>{columns.map((column) => <th scope="col" key={column.id}>{column.name} ({column.unit})</th>)}</tr></thead>
                <tbody><tr>{columns.map((column) => {
                  const nutrient = item.nutrients.find((entry) => entry.id === column.id);
                  return <td key={column.id}>{nutrient && item.defaultAmount !== null ? (nutrient.value * item.defaultAmount / 100).toLocaleString(undefined, { maximumSignificantDigits: 6 }) : "—"}</td>;
                })}</tr></tbody>
              </table>
            </div> : <p className="nutrient-note">No nutrients selected in Options.</p>}
            <Link className="button button-secondary button-small" href={`/custom-foods/${encodeURIComponent(food.id)}/copy`}>Create modified copy<span className="visually-hidden"> of {food.name}</span></Link>
          </article>
          );
        })}
      </section>
    </main>
  );
}
