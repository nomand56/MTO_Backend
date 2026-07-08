import {
  Controller,
  Get,
  Post,
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
import { RequestsService } from '../requests/requests.service';
import { QuotesService } from '../quotes/quotes.service';
import { BookingsService } from '../bookings/bookings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PaymentsService } from '../payments/payments.service';
import { AdminService } from '../admin/admin.service';
import { CreateMovingRequestDto } from '../requests/dto/create-moving-request.dto';
import { CreateCounterofferDto } from '../quotes/dto/create-quote.dto';
import { CancelBookingDto } from '../bookings/dto/update-booking-status.dto';
import { CreateReviewDto } from '../reviews/dto/create-review.dto';
import { CreatePaymentDto, CreateDisputeDto } from '../admin/dto/admin.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Customer)
export class CustomersController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly quotesService: QuotesService,
    private readonly bookingsService: BookingsService,
    private readonly reviewsService: ReviewsService,
    private readonly paymentsService: PaymentsService,
    private readonly adminService: AdminService,
  ) {}

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMovingRequestDto,
  ) {
    return this.requestsService.create(user.id, dto);
  }

  @Get('requests')
  listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.findAllByCustomer(user.id);
  }

  @Get('requests/:id')
  getRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.findByIdForCustomer(id, user.id);
  }

  @Post('requests/:id/quotes/:quoteId/accept')
  acceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.quotesService.acceptQuote(user.id, requestId, quoteId);
  }

  @Post('requests/:id/quotes/:quoteId/counteroffer')
  counteroffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quoteId') quoteId: string,
    @Body() dto: CreateCounterofferDto,
  ) {
    return this.quotesService.createCounteroffer(
      user.id,
      UserRole.Customer,
      quoteId,
      dto,
    );
  }

  @Get('bookings')
  listBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findByCustomer(user.id);
  }

  @Get('bookings/:id')
  getBooking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.findByIdForUser(id, user.id, [UserRole.Customer]);
  }

  @Post('bookings/:id/cancel')
  cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user.id, [UserRole.Customer], dto);
  }

  @Post('bookings/:id/review')
  @HttpCode(HttpStatus.CREATED)
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.id, bookingId, dto);
  }

  @Post('bookings/:id/payment')
  @HttpCode(HttpStatus.CREATED)
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.id, bookingId, dto);
  }

  @Post('bookings/:id/dispute')
  @HttpCode(HttpStatus.CREATED)
  createDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.adminService.createDispute(user.id, bookingId, dto);
  }
}
