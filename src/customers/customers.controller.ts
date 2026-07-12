import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { PayFromWalletDto, TopUpWalletDto } from '../payments/dto/wallet.dto';
import { PaymentKind } from '../common/enums/payment-kind.enum';

@ApiTags('Customers')
@ApiBearerAuth('JWT-auth')
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
  @ApiOperation({
    summary: 'Create moving request',
    description:
      'Submit a new moving request with pickup, destination, items, and date.',
  })
  @ApiCreatedResponse({ description: 'Moving request created' })
  createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMovingRequestDto,
  ) {
    return this.requestsService.create(user.id, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List my moving requests' })
  @ApiOkResponse({
    description: 'List of customer moving requests with quotes',
  })
  listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.requestsService.findAllByCustomer(user.id);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get moving request by ID' })
  @ApiParam({ name: 'id', description: 'Moving request UUID' })
  @ApiOkResponse({
    description: 'Moving request details with quotes and counteroffers',
  })
  getRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.requestsService.findByIdForCustomer(id, user.id);
  }

  @Post('requests/:id/quotes/:quoteId/accept')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept a quote',
    description: 'Accept a mover quote and create a confirmed booking.',
  })
  @ApiParam({ name: 'id', description: 'Moving request UUID' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiCreatedResponse({ description: 'Booking created from accepted quote' })
  acceptQuote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') requestId: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.quotesService.acceptQuote(user.id, requestId, quoteId);
  }

  @Post('requests/:id/quotes/:quoteId/counteroffer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit counteroffer on a quote',
    description: 'Negotiate price with a counteroffer.',
  })
  @ApiParam({ name: 'id', description: 'Moving request UUID' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiCreatedResponse({ description: 'Counteroffer recorded' })
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
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({ description: 'List of customer bookings' })
  listBookings(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findByCustomer(user.id);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'Booking details with status history' })
  getBooking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.findByIdForUser(id, user.id, [
      UserRole.Customer,
    ]);
  }

  @Post('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'Booking cancelled' })
  cancelBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user.id, [UserRole.Customer], dto);
  }

  @Post('bookings/:id/review')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit review',
    description: 'Submit a rating and review after booking completion.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Review submitted' })
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.id, bookingId, dto);
  }

  @Post('bookings/:id/payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create payment',
    description: 'Record a booking payment with platform commission.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Payment recorded' })
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.id, bookingId, dto);
  }

  @Get('wallet')
  @ApiOperation({
    summary: 'Customer wallet & payment history',
    description: 'Total spent, tips paid, and payment receipts.',
  })
  @ApiOkResponse({ description: 'Customer wallet summary' })
  getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getCustomerWallet(user.id);
  }

  @Post('wallet/top-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add funds to wallet',
    description: 'Top up customer wallet balance before paying an invoice.',
  })
  @ApiCreatedResponse({ description: 'Wallet topped up' })
  topUpWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TopUpWalletDto,
  ) {
    return this.paymentsService.topUpWallet(user.id, dto.amount);
  }

  @Get('bookings/:id/invoice')
  @ApiOperation({
    summary: 'Get booking invoice',
    description: 'Full invoice preview before paying from wallet.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiOkResponse({ description: 'Invoice details' })
  getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Query('kind') kind?: PaymentKind,
    @Query('amount') amount?: string,
  ) {
    const parsedAmount = amount != null ? Number(amount) : undefined;
    return this.paymentsService.getBookingInvoice(
      user.id,
      bookingId,
      kind ?? PaymentKind.Job,
      parsedAmount,
    );
  }

  @Post('bookings/:id/pay-wallet')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Pay invoice from wallet',
    description: 'Deduct wallet balance and record payment with invoice.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Payment completed from wallet' })
  payFromWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: PayFromWalletDto,
  ) {
    return this.paymentsService.payFromWallet(user.id, bookingId, dto);
  }

  @Post('bookings/:id/dispute')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Raise a dispute',
    description: 'Open a dispute for a booking issue.',
  })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  @ApiCreatedResponse({ description: 'Dispute created' })
  createDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') bookingId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.adminService.createDispute(user.id, bookingId, dto);
  }
}
