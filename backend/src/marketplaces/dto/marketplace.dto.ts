import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Matches, MinLength, ValidateNested } from "class-validator";

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedProductIds?: string[];

  @IsOptional()
  @IsString()
  exclusionCondition?: string;
}

export class UpdateMarketplaceDto extends CreateMarketplaceDto {}

export class RecalcScheduleDayDto {
  @IsBoolean()
  enabled!: boolean;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be in HH:MM (24h) format" })
  time!: string;
}

/** Одна запись на каждый день недели — день, отсутствующий в объекте на входе, не сохраняется
 * (frontend всегда отправляет все 7), но чтения старых/дефолтных `{}` переживают отсутствие ключа. */
export class RecalcScheduleDto {
  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  mon!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  tue!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  wed!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  thu!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  fri!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  sat!: RecalcScheduleDayDto;

  @ValidateNested()
  @Type(() => RecalcScheduleDayDto)
  sun!: RecalcScheduleDayDto;
}
