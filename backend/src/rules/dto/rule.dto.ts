import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
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

  @IsString()
  formula!: string;

  @IsOptional()
  @IsString()
  postScript?: string;
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

  @IsString()
  formula!: string;

  @IsOptional()
  @IsString()
  postScript?: string;
}
