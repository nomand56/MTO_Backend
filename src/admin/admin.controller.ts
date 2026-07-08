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
  listUsers() {
    return this.adminService.listUsers();
  }

  @Put('users/:id/verify')
  verifyUser(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') userId: string,
  ) {
    return this.adminService.verifyUser(admin.id, userId);
  }

  @Get('bookings')
  listBookings() {
    return this.adminService.listBookings();
  }

  @Get('disputes')
  listDisputes() {
    return this.adminService.listDisputes();
  }

  @Post('disputes/:id/resolve')
  resolveDispute(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') disputeId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(admin.id, disputeId, dto);
  }

  @Post('promotions')
  @HttpCode(HttpStatus.CREATED)
  createPromotion(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.adminService.createPromotion(admin.id, dto);
  }

  @Post('payments/:id/refund')
  refundPayment(@Param('id') paymentId: string) {
    return this.paymentsService.refund(paymentId);
  }

  @Get('analytics')
  getAnalytics() {
    return this.analyticsService.getDashboardStats();
  }
}
