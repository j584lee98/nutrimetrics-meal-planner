import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { NutrientOptions } from "@/app/components/nutrient-options";
import { auth } from "@/lib/auth";
import { getNutrientPreferenceState, nutrientCatalog } from "@/lib/nutrient-preferences";

export default async function OptionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const { columns, hiddenCount } = await getNutrientPreferenceState(session.user.id);
  return <main className="auth-page">
    <AppNav current="options" />
    <div className="lookup-heading"><h1>Options</h1></div>
    <NutrientOptions catalog={nutrientCatalog} initial={columns} hiddenCount={hiddenCount} />
  </main>;
}
