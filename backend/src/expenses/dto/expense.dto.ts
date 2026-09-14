import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(["fixed", "percent"])
  type!: "fixed" | "percent";

  @IsNumber()
  value!: number;

  @IsBoolean()
  appliesToAll!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(["fixed", "percent"])
  type?: "fixed" | "percent";

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsBoolean()
  appliesToAll?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
