import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";

test("accounts and database-backed sessions work end to end", { timeout: 60000 }, async (t) => {
  const file = join(process.cwd(), "prisma", `auth-test-${randomUUID()}.db`);
  const databaseUrl = `file:${file}`;
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const baseUrl = `http://localhost:${port}`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
    USDA_API_KEY: "test-usda-key",
  };
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  let server;
  let output = "";
  t.after(async () => {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once("exit", resolve));
    }
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (existsSync(file + suffix)) unlinkSync(file + suffix);
    }
  });

  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env,
    encoding: "utf8",
  });
  assert.equal(migration.status, 0, `Migration failed: ${migration.stderr}`);

  server = spawn(process.execPath, ["--require", join(process.cwd(), "tests", "mock-usda.cjs"), "node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) break;
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // The server may not be listening yet.
    }
    await delay(250);
  }
  assert.ok(ready, `Server failed to start: ${output}`);

  async function request(path, { body, cookie, redirect = "follow", method, origin = baseUrl } = {}) {
    const headers = {};
    if (origin !== null) headers.origin = origin;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    return fetch(`${baseUrl}${path}`, {
      method: method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect,
    });
  }

  const cookieFrom = (response) => response.headers.getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const password = "test-password-12345";
  const signup = await request("/api/auth/sign-up/email", {
    body: { name: "Test User", email: "test@example.com", password },
  });
  assert.equal(signup.status, 200, await signup.text());
  const cookie = cookieFrom(signup);
  assert.ok(cookie);

  const account = await prisma.account.findFirstOrThrow({ where: { providerId: "credential" } });
  assert.ok(account.password && account.password !== password);
  const session = await request("/api/auth/get-session", { cookie });
  assert.equal((await session.json()).user.email, "test@example.com");
  const dashboard = await request("/dashboard", { cookie });
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.doesNotMatch(dashboardHtml, /Your plans\./);
  assert.doesNotMatch(dashboardHtml, /Your meals\./);
  assert.doesNotMatch(dashboardHtml, /Explore foods and their reported nutrients/);
  assert.match(dashboardHtml, /href="\/plans"/);
  assert.match(dashboardHtml, /href="\/meals"/);
  assert.match(dashboardHtml, /href="\/foods"/);
  const foodsPage = await request("/foods", { cookie });
  assert.equal(foodsPage.status, 200);
  const foodsHtml = await foodsPage.text();
  assert.match(foodsHtml, /Explore foods and their reported nutrients/);
  assert.doesNotMatch(foodsHtml, /Your plans\./);
  assert.match(foodsHtml, /href="\/dashboard"/);
  for (const path of ["/plans", "/meals", "/options"]) {
    const response = await request(path, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "/sign-in");
  }
  const anonymousFoods = await request("/foods", { redirect: "manual" });
  assert.equal(anonymousFoods.status, 307);
  assert.equal(anonymousFoods.headers.get("location"), "/sign-in");
  assert.equal((await request("/api/foods/search?q=apple")).status, 401);
  assert.equal((await request("/api/foods/search?q=%20", { cookie })).status, 400);
  assert.equal((await request("/api/foods/search?q=apple&page=0", { cookie })).status, 400);
  const search = await request("/api/foods/search?q=apple", { cookie });
  assert.equal(search.status, 200);
  assert.equal(search.headers.get("cache-control"), "no-store");
  const results = await search.json();
  assert.equal(results.totalHits, 21);
  assert.equal(results.foods[0].description, "Test apple");
  assert.deepEqual(results.foods[0].nutrients, [
    { id: 1003, name: "Protein", unit: "G", value: 0.26, derivation: null },
    { id: 1004, name: "Fat", unit: "G", value: 0, derivation: "Calculated from a less than value per serving size measure" },
  ]);
  assert.ok(!JSON.stringify(results).includes("test-usda-key"));
  const secondPage = await request("/api/foods/search?q=apple&page=2", { cookie });
  assert.equal((await secondPage.json()).foods[0].description, "Test pear");
  const noResults = await request("/api/foods/search?q=no%20results", { cookie });
  assert.deepEqual((await noResults.json()).foods, []);
  const allWords = await request("/api/foods/search?q=red%20apple&all=1", { cookie });
  assert.equal((await allWords.json()).foods[0].description, "Test apple");
  assert.equal((await request("/api/foods/search?q=rate%20limit", { cookie })).status, 429);
  assert.equal((await request("/api/foods/search?q=bad%20response", { cookie })).status, 502);
  const anonymous = await request("/dashboard", { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.headers.get("location"), "/sign-in");

  const secondSignup = await request("/api/auth/sign-up/email", {
    body: { name: "Second User", email: "second@example.com", password },
  });
  assert.equal(secondSignup.status, 200);
  const secondCookie = cookieFrom(secondSignup);
  const typesPath = "/api/foods/preferences";
  const allTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"];
  assert.equal((await request(typesPath)).status, 401);
  assert.equal((await request(typesPath, { method: "PUT", body: { types: [] } })).status, 401);
  assert.equal((await request(typesPath, { cookie, method: "PUT", origin: "https://evil.example", body: { types: [] } })).status, 403);
  const initialTypes = await request(typesPath, { cookie });
  assert.equal(initialTypes.headers.get("cache-control"), "no-store");
  assert.deepEqual((await initialTypes.json()).types, allTypes);
  for (const types of [["Experimental"], ["Foundation", "Foundation"], ["invalid"], null, "Branded"]) {
    assert.equal((await request(typesPath, { cookie, method: "PUT", body: { types } })).status, 400);
  }
  const selectedTypes = ["SR Legacy", "Branded"];
  const savedTypes = await request(typesPath, { cookie, method: "PUT", body: { types: selectedTypes } });
  assert.equal(savedTypes.status, 200);
  assert.equal(savedTypes.headers.get("cache-control"), "no-store");
  assert.deepEqual((await (await request(typesPath, { cookie })).json()).types, selectedTypes);
  assert.deepEqual((await (await request(typesPath, { cookie: secondCookie })).json()).types, allTypes);
  for (const path of ["/options", "/meals/new", "/foods"]) {
    const html = (await (await request(path, { cookie })).text()).replaceAll("<!-- -->", "");
    assert.match(html, /<input type="checkbox"\/>Foundation/);
    assert.match(html, /<input type="checkbox" checked=""\/>SR Legacy/);
    assert.match(html, /<input type="checkbox" checked=""\/>Branded/);
    assert.doesNotMatch(html, /Experimental/);
  }
  for (const path of ["/api/foods/search?q=filter%20check", "/api/foods/search?q=filter%20check&all=1&page=2"]) {
    const filtered = await (await request(path, { cookie })).json();
    assert.deepEqual(filtered.foods.map((food) => food.dataType), selectedTypes);
  }
  assert.deepEqual((await (await request("/api/foods/search?q=filter%20check", { cookie: secondCookie })).json()).foods.map((food) => food.dataType), allTypes);
  assert.equal((await request(typesPath, { cookie, method: "PUT", body: { types: [] } })).status, 200);
  const none = await request("/api/foods/search?q=rate%20limit", { cookie });
  assert.equal(none.status, 200);
  assert.deepEqual((await none.json()).foods, []);
  assert.deepEqual((await (await request(typesPath, { cookie })).json()).types, []);
  assert.equal((await request(typesPath, { cookie, method: "PUT", body: { types: allTypes } })).status, 200);
  const options = await request("/options", { cookie });
  assert.equal(options.status, 200);
  const optionsHtml = (await options.text()).replaceAll("<!-- -->", "");
  assert.match(optionsHtml, /Vitamin C/);
  assert.match(optionsHtml, /Fiber \(g\)/);
  assert.match(optionsHtml, /Saturated Fat \(g\)/);
  assert.match(optionsHtml, /Vitamin E \(mg\)/);
  const groups = [...optionsHtml.matchAll(/<fieldset class="nutrient-group"><legend>([^<]+)<\/legend>(.*?)<\/fieldset>/g)];
  assert.deepEqual(groups.map((group) => group[1]), ["Macros", "Vitamins", "Minerals"]);
  assert.match(groups[0][2], /Protein \(g\)/);
  assert.match(groups[0][2], /Fiber \(g\)/);
  assert.match(groups[1][2], /Vitamin C \(mg\)/);
  assert.match(groups[2][2], /Calcium \(mg\)/);
  assert.doesNotMatch(optionsHtml, /Fatty acids, total saturated|Fiber, total dietary|Vitamin E, added|Serine|Cryptoxanthin/);
  assert.match(optionsHtml, /href="\/options"/);
  assert.equal((await request("/api/options", { method: "PUT", body: { nutrientIds: [] } })).status, 401);
  assert.equal((await request("/api/options", { cookie, origin: "https://evil.example", method: "PUT", body: { nutrientIds: [] } })).status, 403);
  for (const nutrientIds of [[1003, 1003], [999999], ["1003"], [0]]) {
    assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds } })).status, 400);
  }
  assert.equal((await request("/api/meal-plans")).status, 401);
  assert.equal((await request("/api/meal-plans", { body: { name: "Plan" } })).status, 401);
  assert.equal((await request("/api/meal-plans", { cookie, origin: "https://evil.example", body: { name: "Plan" } })).status, 403);
  assert.equal((await request("/api/meal-plans", { cookie, origin: null, body: { name: "Plan" } })).status, 403);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "   " } })).status, 400);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "a".repeat(101) } })).status, 400);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "Empty", mealIds: [] } })).status, 400);
  const mealsPath = "/api/meals";
  assert.equal((await request("/api/foods/import", { body: { fdcId: 123 } })).status, 401);
  assert.equal((await request("/api/foods/import", { cookie, origin: "https://evil.example", body: { fdcId: 123 } })).status, 403);
  const imported = await request("/api/foods/import", { cookie, body: { fdcId: 123 } });
  assert.equal(imported.status, 200);
  const apple = await imported.json();
  assert.equal(apple.basis, "g");
  assert.deepEqual(apple.portions, [{ label: "1 apple (150 g)", basis: "g", amount: 150 }]);
  assert.equal(apple.nutrients.find((n) => n.id === 1004).derivation, "Calculated from a less than value");
  assert.equal((await (await request("/api/foods/import", { cookie, body: { fdcId: 123 } })).json()).id, apple.id);
  const drink = await (await request("/api/foods/import", { cookie, body: { fdcId: 456 } })).json();
  assert.equal(drink.basis, "ml");
  assert.equal(drink.portions[0].amount, 250);
  const unknown = await (await request("/api/foods/import", { cookie, body: { fdcId: 789 } })).json();
  assert.equal(unknown.basis, "unknown");
  assert.equal((await request("/api/foods/import", { cookie, body: { fdcId: 999 } })).status, 404);
  const entry = { foodId: apple.id, quantity: 2, unitLabel: "whole apple", basisPerUnit: 150, basis: "g" };
  assert.equal((await request(mealsPath, { cookie, body: { name: " ", entries: [] } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Bad", entries: [{ ...entry, quantity: 0 }] } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Bad", entries: [{ ...entry, basisPerUnit: -1 }] } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Bad", entries: [{ ...entry, basis: "ml" }] } })).status, 400);
  const secondUser = await prisma.user.findUniqueOrThrow({ where: { email: "second@example.com" } });
  const privateFood = await prisma.food.create({ data: { name: "Private", ownerId: secondUser.id } });
  await prisma.nutrient.create({ data: { id: 99999, name: "Private nutrient", unit: "mg", foods: { create: { foodId: privateFood.id, per100Unit: 1 } } } });
  assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [99999] } })).status, 400);
  assert.doesNotMatch(await (await request("/options", { cookie })).text(), /Private nutrient/);
  assert.doesNotMatch(await (await request("/options", { cookie: secondCookie })).text(), /Private nutrient/);
  assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [1242] } })).status, 400);
  assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [1227] } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Bad", entries: [{ ...entry, foodId: privateFood.id }] } })).status, 400);
  const createMeal = await request(mealsPath, { cookie, body: { name: "  Breakfast  ", entries: [entry] } });
  assert.equal(createMeal.status, 201);
  const meal = await createMeal.json();
  assert.equal(meal.name, "Breakfast");
  const savedEntry = await prisma.mealEntry.findFirstOrThrow({ where: { mealId: meal.id } });
  assert.equal(savedEntry.quantity * savedEntry.basisPerUnit * apple.nutrients[0].value / 100, 6);
  assert.equal((await request(mealsPath, { cookie, body: { name: "ＢＲＥＡＫＦＡＳＴ", entries: [] } })).status, 409);
  const editPath = `/api/meals/${meal.id}`;
  assert.equal((await request(editPath, { cookie: secondCookie, method: "PUT", body: { name: "Stolen", entries: [] } })).status, 404);
  assert.equal((await request(editPath, { cookie, origin: null, method: "PUT", body: { name: "Stolen", entries: [] } })).status, 403);
  const revised = { foodId: drink.id, quantity: 2, unitLabel: "serving", basisPerUnit: 250, basis: "ml" };
  assert.equal((await request(editPath, { cookie, method: "PUT", body: { name: "Brunch", entries: [revised] } })).status, 200);
  assert.equal((await prisma.mealEntry.findFirstOrThrow({ where: { mealId: meal.id } })).basis, "ml");
  const editPage = await request(`/meals/${meal.id}/edit`, { cookie });
  assert.equal(editPage.status, 200);
  assert.match(await editPage.text(), /Brunch/);
  const otherMealResponse = await request(mealsPath, { cookie, body: { name: "Dinner", entries: [entry] } });
  assert.equal(otherMealResponse.status, 201);
  const otherMeal = await otherMealResponse.json();
  assert.equal((await request(mealsPath, { cookie, body: { name: "dinner", entries: [] } })).status, 409);
  assert.equal((await request(editPath, { cookie, method: "PUT", body: { name: "Dinner", entries: [] } })).status, 409);
  assert.equal((await request("/api/meal-plans", { cookie: secondCookie, body: { name: "Stolen", mealIds: [meal.id] } })).status, 400);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "Duplicates", mealIds: [meal.id, meal.id] } })).status, 400);
  const createPlan = await request("/api/meal-plans", { cookie, body: { name: "  Week one  ", mealIds: [meal.id, otherMeal.id] } });
  assert.equal(createPlan.status, 201, output);
  const plan = await createPlan.json();
  assert.equal(plan.name, "Week one");
  assert.deepEqual(await (await request("/api/meal-plans", { cookie: secondCookie })).json(), []);
  const secondPlanResponse = await request("/api/meal-plans", { cookie, body: { name: "Another plan", mealIds: [meal.id] } });
  assert.equal(secondPlanResponse.status, 201);
  const secondPlan = await secondPlanResponse.json();
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie: secondCookie, method: "PUT", body: { name: "Stolen", mealIds: [meal.id] } })).status, 404);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie, origin: null, method: "PUT", body: { name: "Stolen", mealIds: [meal.id] } })).status, 403);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie, method: "PUT", body: { name: "Invalid", mealIds: [] } })).status, 400);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie, method: "PUT", body: { name: "Renamed", mealIds: [otherMeal.id, meal.id] } })).status, 200);
  const planPage = await request(`/plans/${plan.id}/edit`, { cookie });
  assert.equal(planPage.status, 200);
  assert.match(await planPage.text(), /Renamed/);
  assert.equal((await request(`/plans/${plan.id}/edit`, { cookie: secondCookie })).status, 404);
  const plansList = await request("/plans", { cookie });
  assert.equal(plansList.status, 200);
  const plansHtml = (await plansList.text()).replaceAll("<!-- -->", "");
  assert.match(plansHtml, /<dt>Protein \(g\)<\/dt><dd>11<\/dd>/);
  assert.match(plansHtml, /<dt>Fat \(g\)<\/dt><dd>0 \(partial\)<\/dd>/);
  assert.match(plansHtml, /<dt>Calories \(kcal\)<\/dt><dd>—<\/dd>/);
  assert.match(plansHtml, /<caption class="visually-hidden">Renamed nutrient breakdown<\/caption>/);
  assert.match(plansHtml, /<th scope="row">Dinner<\/th><td>—<\/td><td>6<\/td><td>—<\/td><td>0<\/td>/);
  assert.match(plansHtml, /<th scope="row">Brunch<\/th><td>—<\/td><td>5<\/td><td>—<\/td><td>—<\/td>/);
  assert.match(plansHtml, /<th scope="row">Total<\/th><td>—<\/td><td>11<\/td><td>—<\/td><td>0 \(partial\)<\/td>/);
  assert.doesNotMatch(plansHtml, /Choose nutrient columns/);
  assert.doesNotMatch(plansHtml, /Your meals\./);
  const mealsList = await request("/meals", { cookie });
  assert.equal(mealsList.status, 200);
  const mealsHtml = (await mealsList.text()).replaceAll("<!-- -->", "");
  assert.match(mealsHtml, /<dt>Protein \(g\)<\/dt><dd>5<\/dd>/);
  assert.match(mealsHtml, /<dt>Protein \(g\)<\/dt><dd>6<\/dd>/);
  assert.match(mealsHtml, /<caption class="visually-hidden">Dinner nutrient breakdown<\/caption>/);
  assert.match(mealsHtml, /<th scope="col">Food<\/th><th scope="col">Amount<\/th><th scope="col">Unit<\/th>/);
  assert.match(mealsHtml, /<th scope="row">Test apple<\/th><td>2<\/td><td>whole apple<\/td><td>—<\/td><td>6<\/td><td>—<\/td><td>0<\/td>/);
  assert.match(mealsHtml, /<th scope="row">Total<\/th><td><\/td><td><\/td><td>—<\/td><td>6<\/td><td>—<\/td><td>0<\/td>/);
  assert.doesNotMatch(mealsHtml, /Your plans\./);
  assert.doesNotMatch(await (await request("/meals", { cookie: secondCookie })).text(), /Brunch|Dinner/);
  assert.doesNotMatch(await (await request("/plans", { cookie: secondCookie })).text(), /Renamed/);
  const firstUser = await prisma.user.findUniqueOrThrow({ where: { email: "test@example.com" } });
  const legacyPreferences = [
    { id: 1079, name: "Fiber, total dietary", unit: "g" },
    { id: 1258, name: "Fatty acids, total saturated", unit: "g" },
    { id: 1109, name: "Vitamin E", unit: "mg" },
    { id: 1106, name: "Vitamin A, RAE", unit: "µg" },
    { id: 1242, name: "Vitamin E, added", unit: "mg" },
    { id: 1227, name: "Serine", unit: "g" },
  ];
  await prisma.user.update({ where: { id: firstUser.id }, data: { nutrientPreferences: JSON.stringify(legacyPreferences) } });
  const revisedOptions = await (await request("/options", { cookie })).text();
  assert.match(revisedOptions, /Previously selected nutrients outside this list are hidden/);
  assert.doesNotMatch(revisedOptions, /Vitamin E, added|Serine|Fatty acids, total saturated|Fiber, total dietary/);
  const revisedMeals = (await (await request("/meals", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(revisedMeals, /<th scope="col">Fiber \(g\)<\/th><th scope="col">Saturated Fat \(g\)<\/th><th scope="col">Vitamin E \(mg\)<\/th><th scope="col">Vitamin A, RAE \(µg\)<\/th>/);
  assert.match(revisedMeals, /<th scope="row">Test apple<\/th><td>2<\/td><td>whole apple<\/td><td>6<\/td><td>1.5<\/td><td>0.54<\/td><td>9<\/td>/);
  assert.match(revisedMeals, /<th scope="row">Test drink<\/th><td>2<\/td><td>serving<\/td><td>—<\/td><td>—<\/td><td>—<\/td><td>—<\/td>/);
  const revisedPlans = (await (await request("/plans", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(revisedPlans, /<th scope="row">Total<\/th><td>6 \(partial\)<\/td><td>1.5 \(partial\)<\/td><td>0.54 \(partial\)<\/td><td>9 \(partial\)<\/td>/);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: firstUser.id } })).nutrientPreferences, JSON.stringify(legacyPreferences));
  const cleanedOptions = await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [1079, 1258, 1109, 1106] } });
  assert.deepEqual((await cleanedOptions.json()).nutrients.map(({ id, name }) => [id, name]),
    [[1079, "Fiber"], [1258, "Saturated Fat"], [1109, "Vitamin E"], [1106, "Vitamin A, RAE"]]);
  assert.doesNotMatch(await (await request("/options", { cookie })).text(), /Previously selected nutrients outside this list are hidden/);
  assert.equal((await prisma.foodNutrient.findUniqueOrThrow({ where: { foodId_nutrientId: { foodId: apple.id, nutrientId: 1242 } } })).per100Unit, 9);
  const saveOptions = await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [1087, 1003] } });
  assert.equal(saveOptions.status, 200);
  assert.equal(saveOptions.headers.get("cache-control"), "no-store");
  assert.deepEqual((await saveOptions.json()).nutrients.map((item) => item.id), [1087, 1003]);
  const selectedPlans = (await (await request("/plans", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(selectedPlans, /<th scope="col">Calcium \(mg\)<\/th><th scope="col">Protein \(g\)<\/th>/);
  assert.match(selectedPlans, /<th scope="row">Brunch<\/th><td>—<\/td><td>5<\/td>/);
  const selectedMeals = (await (await request("/meals", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(selectedMeals, /<th scope="row">Test apple<\/th><td>2<\/td><td>whole apple<\/td><td>30<\/td><td>6<\/td>/);
  for (const path of ["/meals/new", `/meals/${meal.id}/edit`, "/plans/new", `/plans/${plan.id}/edit`, "/foods"]) {
    const html = await (await request(path, { cookie })).text();
    assert.match(html, /Calcium/);
    assert.doesNotMatch(html, /Choose nutrient columns/);
  }
  const secondOptions = await prisma.user.findUniqueOrThrow({ where: { id: secondUser.id } });
  assert.equal(secondOptions.nutrientPreferences, null);
  assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [] } })).status, 200);
  const emptyPlans = (await (await request("/plans", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(emptyPlans, /<th scope="col">Meal<\/th><\/tr>/);
  const emptyMeals = (await (await request("/meals", { cookie })).text()).replaceAll("<!-- -->", "");
  assert.match(emptyMeals, /<th scope="col">Food<\/th><th scope="col">Amount<\/th><th scope="col">Unit<\/th><\/tr>/);
  assert.match(emptyMeals, /<th scope="row">Total<\/th><td><\/td><td><\/td><\/tr>/);
  assert.match(await (await request("/options", { cookie })).text(), /No nutrients selected/);
  assert.equal((await request("/api/options", { cookie, method: "PUT", body: { nutrientIds: [1008, 1003, 1005, 1004] } })).status, 200);
  const plansResponse = await request("/api/meal-plans", { cookie });
  assert.equal(plansResponse.headers.get("cache-control"), "no-store");
  const plans = await plansResponse.json();
  assert.deepEqual(new Set(plans.find((item) => item.id === plan.id).meals.map((item) => item.id)), new Set([otherMeal.id, meal.id]));
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie: secondCookie, method: "DELETE" })).status, 404);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie: secondCookie, method: "DELETE" })).status, 404);
  assert.ok(await prisma.meal.findUnique({ where: { id: meal.id } }));
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie, method: "DELETE" })).status, 409);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.ok(await prisma.meal.findUnique({ where: { id: otherMeal.id } }));
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie, method: "DELETE" })).status, 409);
  assert.equal((await request(`/api/meal-plans/${secondPlan.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.equal((await request(`/api/meals/${otherMeal.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.deepEqual(await (await request("/api/meal-plans", { cookie })).json(), []);

  const duplicate = await request("/api/auth/sign-up/email", {
    body: { name: "Other", email: "test@example.com", password },
  });

  assert.notEqual(duplicate.status, 200);
  const shortPassword = await request("/api/auth/sign-up/email", {
    body: { name: "Other", email: "other@example.com", password: "short" },
  });
  assert.notEqual(shortPassword.status, 200);
  const wrongPassword = await request("/api/auth/sign-in/email", {
    body: { email: "test@example.com", password: "wrong-password-12345" },
  });
  assert.notEqual(wrongPassword.status, 200);
  const signout = await request("/api/auth/sign-out", { body: {}, cookie });
  assert.equal(signout.status, 200);
  assert.equal(await (await request("/api/auth/get-session", { cookie })).json(), null);
  assert.equal((await request("/dashboard", { cookie, redirect: "manual" })).status, 307);

  const signin = await request("/api/auth/sign-in/email", {
    body: { email: "test@example.com", password },
  });
  assert.equal(signin.status, 200, await signin.text());
  assert.equal((await (await request("/api/auth/get-session", { cookie: cookieFrom(signin) })).json()).user.email, "test@example.com");
});

test("meal migration rolls back when legacy names conflict", { timeout: 60000 }, async (t) => {
  const file = join(process.cwd(), "prisma", `auth-test-${randomUUID()}.db`);
  const databaseUrl = `file:${file}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  t.after(async () => {
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (existsSync(file + suffix)) unlinkSync(file + suffix);
    }
  });
  function run(args) {
    return spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env, encoding: "utf8" });
  }
  for (const migration of ["20261122200445_init", "20261122202913_add_authentication"]) {
    assert.equal(run(["db", "execute", "--url", databaseUrl, "--file", `prisma/migrations/${migration}/migration.sql`]).status, 0);
    assert.equal(run(["migrate", "resolve", "--applied", migration]).status, 0);
  }
  await prisma.$executeRaw`INSERT INTO "User" ("id", "email", "updatedAt") VALUES ('user', 'migration@example.com', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "MealPlan" ("id", "name", "userId", "updatedAt") VALUES ('plan', 'Plan', 'user', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "Meal" ("id", "name", "date", "mealPlanId") VALUES ('one', 'Lunch', '2028-01-01', 'plan'), ('two', ' lunch ', '2028-01-02', 'plan')`;
  assert.notEqual(run(["migrate", "deploy"]).status, 0);
  const meals = await prisma.$queryRaw`SELECT "id", "date" FROM "Meal" ORDER BY "id"`;
  assert.deepEqual(meals.map((meal) => meal.date), ["2028-01-01", "2028-01-02"]);
  const columns = await prisma.$queryRaw`PRAGMA table_info("Food")`;
  assert.ok(!columns.some((column) => column.name === "nutrientBasis"));
});

test("authentication migration preserves existing records", { timeout: 60000 }, async (t) => {
  const file = join(process.cwd(), "prisma", `auth-test-${randomUUID()}.db`);
  const databaseUrl = `file:${file}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  t.after(async () => {
    await prisma.$disconnect();
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      if (existsSync(file + suffix)) unlinkSync(file + suffix);
    }
  });

  function runPrisma(args) {
    const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `Prisma command failed: ${result.stderr}`);
  }

  runPrisma(["db", "execute", "--url", databaseUrl, "--file", "prisma/migrations/20261122200445_init/migration.sql"]);
  runPrisma(["migrate", "resolve", "--applied", "20261122200445_init"]);
  await prisma.$executeRaw`INSERT INTO "User" ("id", "email", "passwordHash", "updatedAt") VALUES ('old-user', 'old@example.com', 'old-hash', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "Session" ("id", "userId", "tokenHash", "expiresAt") VALUES ('old-session', 'old-user', 'old-token-hash', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "Food" ("id", "name", "ownerId", "updatedAt") VALUES ('old-food', 'Old food', 'old-user', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "MealPlan" ("id", "name", "userId", "updatedAt") VALUES ('old-plan', 'Old plan', 'old-user', CURRENT_TIMESTAMP)`;
  await prisma.$executeRaw`INSERT INTO "Meal" ("id", "name", "date", "mealPlanId") VALUES ('old-meal', 'Old meal', '2028-01-02', 'old-plan')`;
  await prisma.$executeRaw`INSERT INTO "MealEntry" ("id", "mealId", "foodId", "grams") VALUES ('old-entry', 'old-meal', 'old-food', 150)`;

  runPrisma(["migrate", "deploy"]);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "old-user" } })).passwordHash, "old-hash");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "old-user" } })).nutrientPreferences, null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "old-user" } })).foodTypePreferences, null);
  assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: "old-session" } })).token, "old-token-hash");
  assert.equal((await prisma.food.findUniqueOrThrow({ where: { id: "old-food" } })).ownerId, "old-user");
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: "old-plan" } })).userId, "old-user");
  assert.equal((await prisma.meal.findUniqueOrThrow({ where: { id: "old-meal" } })).name, "Old meal");
  const entry = await prisma.mealEntry.findUniqueOrThrow({ where: { id: "old-entry" } });
  assert.equal(entry.quantity, 150);
  assert.equal(entry.unitLabel, "g");
  assert.equal(entry.basisPerUnit, 1);
  assert.equal(entry.basis, "g");
  const membership = await prisma.mealPlanMeal.findFirstOrThrow({ where: { mealPlanId: "old-plan" } });
  assert.equal(membership.mealId, "old-meal");
  assert.equal(membership.userId, "old-user");
  assert.deepEqual(await prisma.$queryRaw`PRAGMA foreign_key_check`, []);
});
