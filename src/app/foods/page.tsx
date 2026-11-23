import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { FoodSearch } from "@/app/components/food-search";
import { auth } from "@/lib/auth";

export default async function FoodsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <main className="auth-page">
      <AppNav current="foods" />
      <div className="lookup-heading">
        <h1>Food lookup.</h1>
      </div>
      <FoodSearch />
    </main>
  );
}
