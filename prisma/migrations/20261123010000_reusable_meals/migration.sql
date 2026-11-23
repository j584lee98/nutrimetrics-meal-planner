PRAGMA foreign_keys=OFF;
BEGIN;

CREATE TABLE "new_Meal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meal" ("id", "name", "nameKey", "userId")
SELECT "id", "name", "nameKey", "userId" FROM "Meal";

CREATE TABLE "MealPlanMeal" (
  "mealPlanId" TEXT NOT NULL,
  "mealId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("mealPlanId", "mealId"),
  CONSTRAINT "MealPlanMeal_mealPlanId_userId_fkey" FOREIGN KEY ("mealPlanId", "userId") REFERENCES "MealPlan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MealPlanMeal_mealId_userId_fkey" FOREIGN KEY ("mealId", "userId") REFERENCES "Meal" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "MealPlanMeal" ("mealPlanId", "mealId", "userId")
SELECT "mealPlanId", "id", "userId" FROM "Meal";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE UNIQUE INDEX "Meal_id_userId_key" ON "Meal"("id", "userId");
CREATE UNIQUE INDEX "Meal_userId_nameKey_key" ON "Meal"("userId", "nameKey");
CREATE INDEX "MealPlanMeal_mealId_idx" ON "MealPlanMeal"("mealId");

COMMIT;
PRAGMA foreign_keys=ON;
