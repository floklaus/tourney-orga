import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { runListQuery } from '../../common/list/list-engine';
import { ListQueryDto } from '../../common/list/list-query.dto';
import { ListSpec } from '../../common/list/list-spec';
import { InvitationService } from './invitation.service';
import { InviteUserDto, UpdateUserDto } from './user.dto';
import { User } from './user.entity';
import { toInvitationResponse, toUserResponse } from './user.mapper';
import { UserService } from './user.service';

type UserItem = ReturnType<typeof toUserResponse>;

const USER_LIST_SPEC: ListSpec<UserItem> = {
  search: (u) => [`${u.firstName} ${u.lastName}`, u.email],
  filters: [
    {
      key: 'active',
      label: 'Active',
      type: 'boolean',
      values: (u) => [u.isActive],
    },
  ],
  sorts: {
    name: (u) => `${u.firstName} ${u.lastName}`,
    lastLoginAt: (u) => u.lastLoginAt,
    createdAt: (u) => u.createdAt,
  },
  defaultSort: 'name',
};

@Controller('users')
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly invitations: InvitationService,
  ) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    return runListQuery(
      (await this.users.findAll()).map(toUserResponse),
      USER_LIST_SPEC,
      query,
    );
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return toUserResponse(await this.users.setActive(actor, id, dto.isActive));
  }

  @Get('invitations')
  async pendingInvitations() {
    return (await this.invitations.findPending()).map(toInvitationResponse);
  }

  @Post('invitations')
  async invite(@CurrentUser() actor: User, @Body() dto: InviteUserDto) {
    const { invitation, inviteUrl } = await this.invitations.invite(
      actor,
      dto.email,
    );
    return { ...toInvitationResponse(invitation), inviteUrl };
  }

  @Post('invitations/:id/resend')
  async resend(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { invitation, inviteUrl } = await this.invitations.resend(actor, id);
    return { ...toInvitationResponse(invitation), inviteUrl };
  }

  @Delete('invitations/:id')
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    await this.invitations.revoke(id);
    return null;
  }
}
