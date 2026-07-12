import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Messaging')
@ApiBearerAuth('JWT-auth')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'List message conversations',
    description:
      'WhatsApp-style inbox: partners, last message preview, and unread counts per booking thread.',
  })
  @ApiOkResponse({ description: 'List of conversation threads' })
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.messagingService.listConversations(
      user.id,
      user.roles as UserRole[],
    );
  }
}
