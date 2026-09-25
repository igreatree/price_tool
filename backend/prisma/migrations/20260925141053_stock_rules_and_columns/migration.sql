-- AlterTable
ALTER TABLE "CalculatedPrice" ADD COLUMN     "appliedCountRuleId" TEXT,
ADD COLUMN     "appliedCountRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "countCalculatedAt" TIMESTAMP(3),
ADD COLUMN     "countWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SupplierPrice" ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CountRule" (
    "id" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditionMode" "RuleConditionMode" NOT NULL DEFAULT 'builder',
    "conditionGroup" JSONB NOT NULL,
    "rawCondition" TEXT NOT NULL DEFAULT '',
    "script" TEXT NOT NULL DEFAULT 'return prevCount;',
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountRule_marketplaceId_idx" ON "CountRule"("marketplaceId");

-- AddForeignKey
ALTER TABLE "CountRule" ADD CONSTRAINT "CountRule_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "Marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
