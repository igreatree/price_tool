-- AlterTable
ALTER TABLE "Marketplace" ADD COLUMN     "excludedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "exclusionCondition" TEXT NOT NULL DEFAULT '';
