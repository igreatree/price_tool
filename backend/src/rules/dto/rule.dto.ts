import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ConditionRowDto {
  @IsString()
  id!: string;

  @IsString()
  field!: string;

  @IsIn(["==", "!=", ">", "<", ">=", "<=", "contains", "notContains"])
  operator!: "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "notContains";

  @IsString()
  value!: string;
}

export class ConditionGroupDto {
  @IsIn(["AND", "OR"])
  joiner!: "AND" | "OR";

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => ConditionRowDto)
  rows!: ConditionRowDto[];
}

export class RuleScheduleDayDto {
  @IsIn(["enable", "disable"])
  action!: "enable" | "disable";

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be in HH:MM (24h) format" })
  time!: string;
}

/** Одна (необязательная, может быть null) запись на каждый день недели — день без расписания
 * не управляется автоматически. Frontend всегда отправляет все 7 ключей. */
export class RuleScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  mon?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  tue?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  wed?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  thu?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  fri?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  sat?: RuleScheduleDayDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDayDto)
  sun?: RuleScheduleDayDto | null;
}

export class CreateRuleBodyDto {
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

  /** JS-скрипт действия: меняет переменные контекста расчёта (напр. commissionRate = commissionRate + 0.05;). */
  @IsOptional()
  @IsString()
  actionScript?: string;

  /** Если false — при совпадении условия каскад продолжается к следующему подходящему правилу
   * (по приоритету), сохраняя изменения переменных, сделанные этим правилом. */
  @IsBoolean()
  isFinal!: boolean;

  /** Расписание автовкл/выкл по дням недели — см. RuleScheduleDto. */
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleScheduleDto)
  schedule?: RuleScheduleDto;
}

export class UpdateRuleDto extends CreateRuleBodyDto {}

export class PatchRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

/** Строка импорта из Excel/Google Sheets — условие всегда как raw-выражение (без структурированного builder-режима). */
export class ImportRuleRowDto {
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
  actionScript?: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
