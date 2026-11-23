import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { FoodSearch } from "@/app/components/food-search";
import { auth } from "@/lib/auth";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";
import { getFoodTypePreferences } from "@/lib/food-type-preferences";

export default async function FoodsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const columns = await getNutrientPreferences(session.user.id);
  const foodTypes = await getFoodTypePreferences(session.user.id);

  return (
    <main className="auth-page">
      <AppNav current="foods" />
      <div className="lookup-heading">
        <h1>Food lookup.</h1>
      </div>
      <FoodSearch columns={columns} initialFoodTypes={foodTypes} />
    </main>
  );
}
