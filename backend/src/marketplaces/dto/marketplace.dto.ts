import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

export class RoundingConfigDto {
  @IsIn(["none", "nearest", "up", "down"])
  mode!: "none" | "nearest" | "up" | "down";

  @IsNumber()
  step!: number;

  @IsOptional()
  @IsNumber()
  forceEnding?: number | null;
}

export class SolverConfigDto {
  @IsNumber()
  minX!: number;

  @IsNumber()
  maxX!: number;

  @IsNumber()
  searchMultiplierMin!: number;

  @IsNumber()
  searchMultiplierMax!: number;

  @IsNumber()
  maxIterations!: number;
}

export class CreateMarketplaceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(["direct", "targetMargin"])
  pricingMode!: "direct" | "targetMargin";

  @ValidateNested()
  @Type(() => RoundingConfigDto)
  rounding!: RoundingConfigDto;

  @IsOptional()
  @IsString()
  minPriceFormula?: string;

  @IsOptional()
  @IsString()
  maxPriceFormula?: string;

  @ValidateNested()
  @Type(() => SolverConfigDto)
  solver!: SolverConfigDto;
}

export class UpdateMarketplaceDto extends CreateMarketplaceDto {}
