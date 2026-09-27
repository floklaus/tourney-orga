import { Controller, Get } from '@nestjs/common';
import { AttentionService } from './attention.service';

@Controller('attention')
export class AttentionController {
  constructor(private readonly attention: AttentionService) {}

  @Get()
  list() {
    return this.attention.list();
  }
}
