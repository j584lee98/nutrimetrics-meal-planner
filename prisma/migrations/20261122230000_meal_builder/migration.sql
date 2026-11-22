PRAGMA foreign_keys=OFF;
BEGIN;

CREATE UNIQUE INDEX "MealPlan_id_userId_key" ON "MealPlan"("id", "userId");

ALTER TABLE "Food" ADD COLUMN "nutrientBasis" TEXT NOT NULL DEFAULT 'g';
ALTER TABLE "Food" ADD COLUMN "portionsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "FoodNutrient" ADD COLUMN "derivation" TEXT;

CREATE TABLE "new_Meal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    CONSTRAINT "Meal_mealPlanId_userId_fkey" FOREIGN KEY ("mealPlanId", "userId") REFERENCES "MealPlan" ("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Meal" ("id", "name", "nameKey", "userId", "mealPlanId")
SELECT m."id", m."name", lower(trim(m."name")), p."userId", m."mealPlanId"
FROM "Meal" m JOIN "MealPlan" p ON p."id" = m."mealPlanId";
DROP TABLE "Meal";
ALTER TABLE "new_Meal" RENAME TO "Meal";
CREATE INDEX "Meal_mealPlanId_idx" ON "Meal"("mealPlanId");
CREATE UNIQUE INDEX "Meal_userId_nameKey_key" ON "Meal"("userId", "nameKey");

CREATE TABLE "new_MealEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'g',
    "basisPerUnit" REAL NOT NULL DEFAULT 1,
    "basis" TEXT NOT NULL DEFAULT 'g',
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MealEntry_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MealEntry" ("id", "mealId", "foodId", "quantity") SELECT "id", "mealId", "foodId", "grams" FROM "MealEntry";
DROP TABLE "MealEntry";
ALTER TABLE "new_MealEntry" RENAME TO "MealEntry";
CREATE INDEX "MealEntry_mealId_idx" ON "MealEntry"("mealId");
CREATE INDEX "MealEntry_foodId_idx" ON "MealEntry"("foodId");

COMMIT;
PRAGMA foreign_keys=ON;
