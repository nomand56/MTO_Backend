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
import { CreateQuoteDto, CreateCounterofferDto } from '../quotes/dto/create-quote.dto';
import { RespondCounterofferDto } from '../quotes/dto/respond-counteroffer.dto';
import { UpdateBookingStatusDto } from '../bookings/dto/update-booking-status.dto';
import { CreateTrackingEventDto } from '../tracking/dto/create-tracking-event.dto';

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
  ) {}

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMoverProfileDto,
  ) {
    return this.moversService.upsertProfile(user.id, dto);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertMoverProfileDto,
  ) {
    return this.moversService.upsertProfile(user.id, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.moversService.getProfile(user.id);
  }

  @Get('available-requests')
  listAvailableRequests() {
    return this.requestsService.findAvailableForMovers();
  }

  @Post('requests/:id/quote')
  @HttpCode(HttpStatus.CREATED)
  submitQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.moversService.ensureVerified(user.id).then(() =>
      this.quotesService.createQuote(user.id, requestId, dto),
    );
  }

  @Post('quotes/:id/counteroffer')
  @HttpCode(HttpStatus.CREATED)
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
  listBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findByMover(user.id);
  }

  @Post('bookings/:id/accept')
  acceptBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
  ) {
    return this.bookingsService.acceptBooking(user.id, bookingId);
  }

  @Post('bookings/:id/update-status')
  updateBookingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(bookingId, user.id, dto);
  }

  @Post('bookings/:id/tracking')
  @HttpCode(HttpStatus.CREATED)
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
  getTrackingTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
  ) {
    return this.trackingService.getTimeline(
      bookingId,
      user.id,
      [UserRole.Mover],
    );
  }
}
