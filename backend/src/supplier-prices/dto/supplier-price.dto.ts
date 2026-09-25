import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreateSupplierPriceDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsString()
  @MinLength(1)
  supplierName!: string;

  @IsNumber()
  price!: number;

  /** Остаток товара у этого поставщика. По умолчанию 0. */
  @IsOptional()
  @IsNumber()
  count?: number;
}

export class ImportSupplierPriceRowDto extends CreateSupplierPriceDto {}
