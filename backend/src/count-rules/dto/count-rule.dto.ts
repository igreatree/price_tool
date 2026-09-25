import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { ConditionGroupDto } from "../../rules/dto/rule.dto";

export class CreateCountRuleBodyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  priority!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsIn(["builder", "raw"])
  conditionMode!: "builder" | "raw";

  @ValidateNested()
  @Type(() => ConditionGroupDto)
  conditionGroup!: ConditionGroupDto;

  @IsOptional()
  @IsString()
  rawCondition?: string;

  /** JS-скрипт: обязателен явный return числа — остаток товара, если условие подошло. */
  @IsOptional()
  @IsString()
  script?: string;

  /** Если false — при совпадении условия каскад продолжается к следующему подходящему правилу
   * (по приоритету), которому передаётся результат этого правила через prevCount. */
  @IsBoolean()
  isFinal!: boolean;
}

export class UpdateCountRuleDto extends CreateCountRuleBodyDto {}

export class PatchCountRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

/** Строка импорта из Excel/Google Sheets — условие всегда как raw-выражение. */
export class ImportCountRuleRowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  priority!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  rawCondition?: string;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
