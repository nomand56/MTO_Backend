import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { BookingsService } from './bookings.service';
import {
  BookingEstimateDto,
  BookingItemDto,
  BookingItemPhotoDto,
  BookingPreviewDto,
  CreateBookingDto,
  RescheduleBookingDto,
  ShareBookingDto,
  UpdateBookingDto,
  UpdateBookingItemDto,
} from './dto/booking.dto';
import { CancelBookingDto } from './dto/update-booking-status.dto';

@ApiTags('Bookings')
@ApiBearerAuth('JWT-auth')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.Customer)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create booking' })
  @ApiCreatedResponse({ description: 'Booking created' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Post('estimate')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Estimate booking price' })
  estimate(@CurrentUser() user: AuthenticatedUser, @Body() dto: BookingEstimateDto) {
    return this.bookingsService.estimate(user.id, dto);
  }

  @Post('preview')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Preview booking before confirmation' })
  preview(@CurrentUser() user: AuthenticatedUser, @Body() dto: BookingPreviewDto) {
    return this.bookingsService.preview(user.id, dto);
  }

  @Get()
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'List bookings' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    if (user.roles.includes(UserRole.Mover)) {
      return this.bookingsService.findByMover(user.id);
    }
    if (user.roles.includes(UserRole.Admin)) {
      return this.bookingsService.findAll();
    }
    return this.bookingsService.findByCustomer(user.id);
  }

  @Get(':id')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.findByIdForUser(
      id,
      user.id,
      user.roles as UserRole[],
    );
  }

  @Patch(':id')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Update booking' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, user.id, [UserRole.Customer], dto);
  }

  @Delete(':id')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Delete draft booking' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.remove(id, user.id, [UserRole.Customer]);
  }

  @Post(':id/cancel')
  @Roles(UserRole.Customer, UserRole.Mover)
  @ApiOperation({ summary: 'Cancel booking' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, user.id, user.roles as UserRole[], dto);
  }

  @Post(':id/reschedule')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Reschedule booking' })
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.reschedule(id, user.id, [UserRole.Customer], dto);
  }

  @Post(':id/duplicate')
  @Roles(UserRole.Customer)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate booking' })
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.duplicate(id, user.id, [UserRole.Customer]);
  }

  @Post(':id/rebook')
  @Roles(UserRole.Customer)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Rebook a completed move' })
  rebook(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.rebook(id, user.id, [UserRole.Customer]);
  }

  @Get(':id/status')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'Get live booking status' })
  getStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.getStatus(id, user.id, user.roles as UserRole[]);
  }

  @Get(':id/timeline')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'Get booking timeline' })
  getTimeline(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.getTimeline(id, user.id, user.roles as UserRole[]);
  }

  @Get(':id/location')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'Get booking location snapshot' })
  getLocation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.getLocation(id, user.id, user.roles as UserRole[]);
  }

  @Get(':id/tracking')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'Get booking tracking data' })
  getTracking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.getTracking(id, user.id, user.roles as UserRole[]);
  }

  @Post(':id/share')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Share booking tracking link' })
  share(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShareBookingDto,
  ) {
    return this.bookingsService.shareBooking(id, user.id, [UserRole.Customer], dto);
  }

  @Get(':id/items')
  @Roles(UserRole.Customer, UserRole.Mover, UserRole.Admin)
  @ApiOperation({ summary: 'List booking items' })
  listItems(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.listItems(id, user.id, user.roles as UserRole[]);
  }

  @Post(':id/items')
  @Roles(UserRole.Customer)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add booking item' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BookingItemDto,
  ) {
    return this.bookingsService.addItem(id, user.id, [UserRole.Customer], dto);
  }

  @Patch(':id/items/:itemId')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Update booking item' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBookingItemDto,
  ) {
    return this.bookingsService.updateItem(id, itemId, user.id, [UserRole.Customer], dto);
  }

  @Delete(':id/items/:itemId')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Delete booking item' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.bookingsService.removeItem(id, itemId, user.id, [UserRole.Customer]);
  }

  @Post(':id/items/photo')
  @Roles(UserRole.Customer)
  @ApiOperation({ summary: 'Attach photo to booking item' })
  @ApiParam({ name: 'id', description: 'Booking UUID' })
  addItemPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BookingItemPhotoDto,
  ) {
    return this.bookingsService.addItemPhoto(
      id,
      user.id,
      [UserRole.Customer],
      dto.photoUrl,
      dto.itemId,
    );
  }
}
