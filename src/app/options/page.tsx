import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { NutrientOptions } from "@/app/components/nutrient-options";
import { FoodTypeOptions } from "@/app/components/food-type-filter";
import { auth } from "@/lib/auth";
import { getNutrientPreferenceState, nutrientCatalog } from "@/lib/nutrient-preferences";
import { getFoodTypePreferences } from "@/lib/food-type-preferences";

export default async function OptionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const [{ columns, hiddenCount }, foodTypes] = await Promise.all([
    getNutrientPreferenceState(session.user.id),
    getFoodTypePreferences(session.user.id),
  ]);
  return <main className="auth-page">
    <AppNav current="options" />
    <div className="lookup-heading"><h1>Options</h1></div>
    <FoodTypeOptions initial={foodTypes} />
    <NutrientOptions catalog={nutrientCatalog} initial={columns} hiddenCount={hiddenCount} />
  </main>;
}
