import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { User } from '../user/user.entity';
import {
  BulkStepActionDto,
  EmailStepFieldsDto,
  STEP_ACTIONS,
  StepAction,
  UpdateEmailStepDto,
} from './email-step.dto';
import { EmailStepService } from './email-step.service';

@Controller()
export class EmailStepController {
  constructor(private readonly steps: EmailStepService) {}

  @Get('participations/:id/steps')
  async list(@Param('id', ParseUUIDPipe) participationId: string) {
    return this.steps.toResponses(
      await this.steps.findForParticipation(participationId),
    );
  }

  @Post('participations/:id/steps')
  async create(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) participationId: string,
    @Body() dto: EmailStepFieldsDto,
  ) {
    return this.steps.toResponse(
      await this.steps.create(user, participationId, dto),
    );
  }

  @Post('steps/bulk')
  @HttpCode(200)
  async bulk(@CurrentUser() user: User, @Body() dto: BulkStepActionDto) {
    return { results: await this.steps.bulk(user, dto.ids, dto.action) };
  }

  @Patch('steps/:id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmailStepDto,
  ) {
    return this.steps.toResponse(await this.steps.update(user, id, dto));
  }

  @Delete('steps/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.steps.remove(id);
    return null;
  }

  @Post('steps/:id/:action')
  @HttpCode(200)
  async action(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: string,
  ) {
    if (!(STEP_ACTIONS as readonly string[]).includes(action)) {
      throw new NotFoundException(`Unknown email action "${action}"`);
    }
    return this.steps.toResponse(
      await this.steps.action(user, id, action as StepAction),
    );
  }
}
