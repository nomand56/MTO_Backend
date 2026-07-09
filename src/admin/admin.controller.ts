import {
  Controller,
  Get,
  Put,
  Post,
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
import { AdminService } from './admin.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PaymentsService } from '../payments/payments.service';
import { CreatePromotionDto, ResolveDisputeDto } from './dto/admin.dto';

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get('users')
  @ApiOperation({
    summary: 'List all users',
    description: 'List users with customer and mover profiles.',
  })
  @ApiOkResponse({ description: 'List of platform users' })
  listUsers() {
    return this.adminService.listUsers();
  }

  @Put('users/:id/verify')
  @ApiOperation({
    summary: 'Verify user',
    description: 'Verify user account and mover profile if applicable.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiOkResponse({ description: 'User verified' })
  verifyUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    return this.adminService.verifyUser(admin.id, userId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings' })
  @ApiOkResponse({ description: 'List of all platform bookings' })
  listBookings() {
    return this.adminService.listBookings();
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List all disputes' })
  @ApiOkResponse({ description: 'List of open and resolved disputes' })
  listDisputes() {
    return this.adminService.listDisputes();
  }

  @Post('disputes/:id/resolve')
  @ApiOperation({ summary: 'Resolve dispute' })
  @ApiParam({ name: 'id', description: 'Dispute UUID' })
  @ApiOkResponse({ description: 'Dispute resolved' })
  resolveDispute(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') disputeId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(admin.id, disputeId, dto);
  }

  @Post('promotions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create promotion',
    description: 'Create a discount code or promotion campaign.',
  })
  @ApiCreatedResponse({ description: 'Promotion created' })
  createPromotion(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.adminService.createPromotion(admin.id, dto);
  }

  @Post('payments/:id/refund')
  @ApiOperation({ summary: 'Refund payment' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiOkResponse({ description: 'Payment refunded' })
  refundPayment(@Param('id') paymentId: string) {
    return this.paymentsService.refund(paymentId);
  }

  @Get('analytics')
  @ApiOperation({
    summary: 'Platform analytics dashboard',
    description: 'Users, marketplace stats, revenue, and quality metrics.',
  })
  @ApiOkResponse({
    description: 'Analytics dashboard data',
    schema: {
      example: {
        success: true,
        data: {
          users: { total: 10, customers: 7, movers: 2 },
          marketplace: {
            requests: 5,
            quotes: 8,
            bookings: 3,
            completedBookings: 1,
          },
          revenue: { totalRevenue: 2250, totalCommission: 225 },
          quality: { totalReviews: 1, averageRating: 5, openDisputes: 0 },
        },
      },
    },
  })
  getAnalytics() {
    return this.analyticsService.getDashboardStats();
  }
}
