import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MealBuilder } from "@/app/components/meal-builder";
import { auth } from "@/lib/auth";
import { AppNav } from "@/app/components/app-nav";
import { getNutrientPreferences } from "@/lib/nutrient-preferences";
import { getFoodTypePreferences } from "@/lib/food-type-preferences";

export default async function NewMealPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const columns = await getNutrientPreferences(session.user.id);
  const foodTypes = await getFoodTypePreferences(session.user.id);
  return (
    <main className="auth-page builder-page">
      <AppNav current="meals" documentNavigation />
      <a href="/meals" className="back-link builder-back-link">← Back to your meals</a>
      <MealBuilder columns={columns} initialFoodTypes={foodTypes} />
    </main>
  );
}
