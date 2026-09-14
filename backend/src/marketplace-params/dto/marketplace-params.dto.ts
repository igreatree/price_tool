import { IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class UpsertParamsDto {
  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  commissionRate?: number;

  @IsOptional()
  @IsNumber()
  logistics?: number;

  @IsOptional()
  @IsNumber()
  ads?: number;

  @IsOptional()
  @IsNumber()
  otherExpenses?: number;
}

export class ImportParamsRowDto extends UpsertParamsDto {
  @IsString()
  @MinLength(1)
  productId!: string;
}
