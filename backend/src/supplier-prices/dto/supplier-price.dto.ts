import { IsNumber, IsString, MinLength } from "class-validator";

export class CreateSupplierPriceDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsString()
  @MinLength(1)
  supplierName!: string;

  @IsNumber()
  price!: number;
}

export class ImportSupplierPriceRowDto extends CreateSupplierPriceDto {}
