-- AlterTable
ALTER TABLE "Marketplace" ADD COLUMN     "marginRatioScript" TEXT NOT NULL DEFAULT 'return price !== 0 ? netProceeds / price : 0;',
ADD COLUMN     "netProceedsScript" TEXT NOT NULL DEFAULT 'return price - price*commissionRate - price*(1-discount)*taxRate - logistics - ads - otherExpenses;';
