import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_LIST_LIMIT = 500;

/** Query of every generic list endpoint: ?search=&filter[key]=a,b&sort=-key&page=&limit= */
export class ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Parsed by Express from filter[key]=... ; values are validated against the resource's spec. */
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit = 25;
}
