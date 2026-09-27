import { Invitation } from './invitation.entity';
import { User } from './user.entity';

export type UserRef = {
  id: string;
  firstName: string;
  lastName: string;
} | null;

export const toUserRef = (user: User | null | undefined): UserRef =>
  user
    ? { id: user.id, firstName: user.firstName, lastName: user.lastName }
    : null;

export const toUserResponse = (user: User) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

export const toInvitationResponse = (inv: Invitation) => ({
  id: inv.id,
  email: inv.email,
  invitedBy: toUserRef(inv.invitedBy),
  expiresAt: inv.expiresAt,
  acceptedAt: inv.acceptedAt,
  revokedAt: inv.revokedAt,
  createdAt: inv.createdAt,
});
