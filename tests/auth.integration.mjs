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
  assert.equal((await request("/dashboard", { cookie })).status, 200);
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
  assert.equal((await request("/api/meal-plans")).status, 401);
  assert.equal((await request("/api/meal-plans", { body: { name: "Plan" } })).status, 401);
  assert.equal((await request("/api/meal-plans", { cookie, origin: "https://evil.example", body: { name: "Plan" } })).status, 403);
  assert.equal((await request("/api/meal-plans", { cookie, origin: null, body: { name: "Plan" } })).status, 403);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "   " } })).status, 400);
  assert.equal((await request("/api/meal-plans", { cookie, body: { name: "a".repeat(101) } })).status, 400);
  const createPlan = await request("/api/meal-plans", { cookie, body: { name: "  Week one  " } });
  assert.equal(createPlan.status, 201);
  const plan = await createPlan.json();
  assert.equal(plan.name, "Week one");
  assert.deepEqual(await (await request("/api/meal-plans", { cookie: secondCookie })).json(), []);
  const mealsPath = `/api/meal-plans/${plan.id}/meals`;
  assert.equal((await request(mealsPath, { cookie: secondCookie, body: { name: "Other", date: "2028-02-29" } })).status, 404);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Breakfast", date: "2027-02-29" } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: "Breakfast", date: "2028-13-01" } })).status, 400);
  assert.equal((await request(mealsPath, { cookie, body: { name: " ", date: "2028-02-29" } })).status, 400);
  const createMeal = await request(mealsPath, { cookie, body: { name: "  Breakfast  ", date: "2028-02-29" } });
  assert.equal(createMeal.status, 201);
  const meal = await createMeal.json();
  assert.equal(meal.name, "Breakfast");
  assert.equal(meal.date, "2028-02-29");
  const otherMealResponse = await request(mealsPath, { cookie, body: { name: "Dinner", date: "2028-02-28" } });
  assert.equal(otherMealResponse.status, 201);
  const otherMeal = await otherMealResponse.json();
  const plansResponse = await request("/api/meal-plans", { cookie });
  assert.equal(plansResponse.headers.get("cache-control"), "no-store");
  const plans = await plansResponse.json();
  assert.deepEqual(plans[0].meals.map((entry) => entry.id), [otherMeal.id, meal.id]);
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie: secondCookie, method: "DELETE" })).status, 404);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie: secondCookie, method: "DELETE" })).status, 404);
  assert.ok(await prisma.meal.findUnique({ where: { id: meal.id } }));
  assert.equal((await request(`/api/meals/${meal.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.equal((await request(`/api/meal-plans/${plan.id}`, { cookie, method: "DELETE" })).status, 204);
  assert.equal(await prisma.meal.findUnique({ where: { id: otherMeal.id } }), null);
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

  runPrisma(["migrate", "deploy"]);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: "old-user" } })).passwordHash, "old-hash");
  assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: "old-session" } })).token, "old-token-hash");
  assert.equal((await prisma.food.findUniqueOrThrow({ where: { id: "old-food" } })).ownerId, "old-user");
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: "old-plan" } })).userId, "old-user");
  assert.deepEqual(await prisma.$queryRaw`PRAGMA foreign_key_check`, []);
});
