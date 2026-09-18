-- AlterTable
ALTER TABLE "Rule" ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CalculatedPrice" ADD COLUMN     "appliedRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
