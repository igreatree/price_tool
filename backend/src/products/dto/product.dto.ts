import { IsNumber, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  externalId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsNumber()
  cost!: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, string | number>;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, string | number>;
}

export class ImportProductRowDto extends CreateProductDto {}
