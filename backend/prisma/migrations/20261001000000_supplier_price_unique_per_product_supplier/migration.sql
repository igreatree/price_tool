-- Deduplicate existing rows before enforcing uniqueness: keep the most recently
-- updated SupplierPrice per (productId, supplierName), drop the rest.
DELETE FROM "SupplierPrice"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "productId", "supplierName"
      ORDER BY "updatedAt" DESC, "id" DESC
    ) AS "rn"
    FROM "SupplierPrice"
  ) "ranked"
  WHERE "rn" > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPrice_productId_supplierName_key" ON "SupplierPrice"("productId", "supplierName");
