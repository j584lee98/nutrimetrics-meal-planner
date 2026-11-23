import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { CustomFoodBuilder } from "@/app/components/custom-food-builder";
import { auth } from "@/lib/auth";
import { getFoodTypePreferences } from "@/lib/food-type-preferences";
import { nutrientGroups } from "@/lib/nutrient-preferences";

export default async function NewCustomFoodPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const foodTypes = await getFoodTypePreferences(session.user.id);
  return (
    <main className="auth-page builder-page">
      <AppNav current="custom-foods" />
      <Link href="/custom-foods" className="back-link builder-back-link">← Back to custom foods</Link>
      <CustomFoodBuilder groups={nutrientGroups} initialFoodTypes={foodTypes} />
    </main>
  );
}
