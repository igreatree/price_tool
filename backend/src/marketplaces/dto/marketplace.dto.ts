import { Type } from "class-transformer";
import { IsArray, IsIn, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

export class RoundingConfigDto {
  @IsIn(["none", "nearest", "up", "down"])
  mode!: "none" | "nearest" | "up" | "down";

  @IsNumber()
  step!: number;

  @IsOptional()
  @IsNumber()
  forceEnding?: number | null;
}

export class CreateMarketplaceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @ValidateNested()
  @Type(() => RoundingConfigDto)
  rounding!: RoundingConfigDto;

  @IsOptional()
  @IsString()
  minPriceFormula?: string;

  @IsOptional()
  @IsString()
  maxPriceFormula?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedProductIds?: string[];

  @IsOptional()
  @IsString()
  exclusionCondition?: string;

  @IsString()
  startPriceScript!: string;

  @IsString()
  priceFormulaScript!: string;
}

export class UpdateMarketplaceDto extends CreateMarketplaceDto {}
