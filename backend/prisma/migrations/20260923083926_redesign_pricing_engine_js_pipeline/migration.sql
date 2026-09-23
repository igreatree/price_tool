/*
  Warnings:

  - You are about to drop the column `iterations` on the `CalculatedPrice` table. All the data in the column will be lost.
  - You are about to drop the column `pricingMode` on the `Marketplace` table. All the data in the column will be lost.
  - You are about to drop the column `solver` on the `Marketplace` table. All the data in the column will be lost.
  - You are about to drop the column `formula` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `postScript` on the `Rule` table. All the data in the column will be lost.
  - You are about to drop the column `priceMode` on the `Rule` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CalculatedPrice" DROP COLUMN "iterations";

-- AlterTable
ALTER TABLE "Marketplace" DROP COLUMN "pricingMode",
DROP COLUMN "solver",
ADD COLUMN     "priceFormulaScript" TEXT NOT NULL DEFAULT 'return startPrice;',
ADD COLUMN     "startPriceScript" TEXT NOT NULL DEFAULT 'return cost;';

-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "formula",
DROP COLUMN "postScript",
DROP COLUMN "priceMode",
ADD COLUMN     "actionScript" TEXT NOT NULL DEFAULT '';

-- DropEnum
DROP TYPE "PricingMode";
