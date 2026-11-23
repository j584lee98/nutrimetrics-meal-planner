import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { NutrientOptions } from "@/app/components/nutrient-options";
import { auth } from "@/lib/auth";
import { getNutrientCatalog, getNutrientPreferences } from "@/lib/nutrient-preferences";

export default async function OptionsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const [catalog, initial] = await Promise.all([
    getNutrientCatalog(session.user.id),
    getNutrientPreferences(session.user.id),
  ]);
  return <main className="auth-page">
    <AppNav current="options" />
    <div className="lookup-heading"><h1>Options</h1></div>
    <NutrientOptions catalog={catalog} initial={initial} />
  </main>;
}
