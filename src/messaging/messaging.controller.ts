import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Messaging')
@ApiBearerAuth('JWT-auth')
@Controller('bookings/:bookingId/messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get()
  @ApiOperation({
    summary: 'Get booking messages',
    description: 'List chat messages for a booking (customer or mover).',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'List of chat messages' })
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.messagingService.getMessages(
      bookingId,
      user.id,
      user.roles as UserRole[],
    );
  }

  private userRoles(user: AuthenticatedUser) {
    return user.roles as UserRole[];
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send message',
    description: 'Send an in-app chat message on a booking.',
  })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Message sent' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagingService.sendMessage(
      user.id,
      bookingId,
      dto,
      this.userRoles(user),
    );
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'Messages marked as read' })
  markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.messagingService.markAsRead(bookingId, user.id);
  }
}
