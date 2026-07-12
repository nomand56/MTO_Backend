import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { MoversService } from './movers.service';
import { RequestsService } from '../requests/requests.service';
import { QuotesService } from '../quotes/quotes.service';
import { BookingsService } from '../bookings/bookings.service';
import { TrackingService } from '../tracking/tracking.service';
import { UpsertMoverProfileDto } from './dto/upsert-mover-profile.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import {
  CreateQuoteDto,
  CreateCounterofferDto,
} from '../quotes/dto/create-quote.dto';
import { RespondCounterofferDto } from '../quotes/dto/respond-counteroffer.dto';
import { UpdateBookingStatusDto } from '../bookings/dto/update-booking-status.dto';
import { CreateTrackingEventDto } from '../tracking/dto/create-tracking-event.dto';
import { BookingItemPhotoDto } from '../bookings/dto/booking.dto';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('Movers')
@ApiBearerAuth('JWT-auth')
@Controller('movers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Mover)
export class MoversController {
  constructor(
    private readonly moversService: MoversService,
    private readonly requestsService: RequestsService,
    private readonly quotesService: QuotesService,
    private readonly bookingsService: BookingsService,
    private readonly trackingService: TrackingService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create mover profile',
    description:
      'Create profile with business info, service areas, and documents.',
  })
  @ApiCreatedResponse({ description: 'Mover profile created' })
  createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMoverProfileDto,
  ) {
    return this.moversService.upsertProfile(user.id, dto);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update mover profile' })
  @ApiOkResponse({ description: 'Mover profile updated' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMoverProfileDto,
  ) {
    return this.moversService.upsertProfile(user.id, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get mover profile' })
  @ApiOkResponse({ description: 'Current mover profile' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.moversService.getProfile(user.id);
  }

  @Put('presence')
  @ApiOperation({
    summary: 'Update online status and GPS location',
    description:
      'Driver heartbeat endpoint. Requires coordinates when going online.',
  })
  @ApiOkResponse({ description: 'Presence updated' })
  updatePresence(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePresenceDto,
  ) {
    return this.moversService.updatePresence(user.id, dto);
  }

  @Get('available-requests')
  @ApiOperation({
    summary: 'List available moving requests',
    description:
      'Open requests available for quoting (verified movers only for quotes).',
  })
  @ApiOkResponse({ description: 'List of pending/active moving requests' })
  listAvailableRequests() {
    return this.requestsService.findAvailableForMovers();
  }

  @Post('requests/:id/quote')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit quote on request',
    description:
      'Submit a price quote for a moving request. Requires verified mover profile.',
  })
  @ApiParam({ name: 'id', description: 'Moving request UUID' })
  @ApiCreatedResponse({ description: 'Quote submitted' })
  submitQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.moversService
      .ensureVerified(user.id)
      .then(() => this.quotesService.createQuote(user.id, requestId, dto));
  }

  @Post('quotes/:id/counteroffer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit counteroffer on quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiCreatedResponse({ description: 'Counteroffer recorded' })
  counteroffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') quoteId: string,
    @Body() dto: CreateCounterofferDto,
  ) {
    return this.quotesService.createCounteroffer(
      user.id,
      UserRole.Mover,
      quoteId,
      dto,
    );
  }

  @Post('quotes/:id/counteroffer/respond')
  @ApiOperation({
    summary: 'Respond to customer counteroffer',
    description: 'Accept or reject the latest counteroffer.',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiOkResponse({ description: 'Counteroffer response recorded' })
  respondToCounteroffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') quoteId: string,
    @Body() dto: RespondCounterofferDto,
  ) {
    return this.quotesService.respondToCounteroffer(
      user.id,
      UserRole.Mover,
      quoteId,
      dto.accept,
    );
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({ description: 'List of mover bookings' })
  listBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findByMover(user.id);
  }

  @Get('wallet')
  @ApiOperation({
    summary: 'Mover wallet & earnings',
    description:
      'Available balance, job earnings, tips, and payment history for the mover.',
  })
  @ApiOkResponse({ description: 'Mover wallet summary' })
  getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getMoverWallet(user.id);
  }

  @Get('payments/:paymentId/invoice')
  @ApiOperation({
    summary: 'View released payment invoice',
    description: 'Full invoice for a completed customer payment released to the mover.',
  })
  @ApiParam({ name: 'paymentId', description: 'Payment UUID' })
  @ApiOkResponse({ description: 'Released invoice' })
  getPaymentInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getReleasedInvoiceForMover(user.id, paymentId);
  }

  @Post('bookings/:id/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept booking',
    description: 'Accept booking and move status to in_progress.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Booking accepted' })
  acceptBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
  ) {
    return this.bookingsService.acceptBooking(user.id, bookingId);
  }

  @Post('bookings/:id/update-status')
  @ApiOperation({
    summary: 'Update booking status',
    description: 'Transition booking: confirmed → in_progress → completed.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'Booking status updated' })
  updateBookingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(bookingId, user.id, dto);
  }

  @Post('bookings/:id/tracking')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add tracking event',
    description: 'Add GPS location or status update to booking timeline.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Tracking event added' })
  addTrackingEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreateTrackingEventDto,
  ) {
    return this.trackingService.addEvent(
      bookingId,
      user.id,
      [UserRole.Mover],
      dto,
    );
  }

  @Get('bookings/:id/tracking')
  @ApiOperation({ summary: 'Get booking tracking timeline' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'List of tracking events' })
  getTrackingTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
  ) {
    return this.trackingService.getTimeline(bookingId, user.id, [
      UserRole.Mover,
    ]);
  }

  @Post('bookings/:id/completion-photo')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload delivery proof photo for a booking' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Completion photo attached' })
  uploadCompletionPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: BookingItemPhotoDto,
  ) {
    return this.bookingsService.addItemPhoto(
      bookingId,
      user.id,
      [UserRole.Mover],
      dto.photoUrl,
      dto.itemId,
      'Delivery proof',
    );
  }
}
