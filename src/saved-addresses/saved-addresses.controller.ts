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
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateSavedAddressDto,
  SetDefaultSavedAddressDto,
  UpdateSavedAddressDto,
} from './dto/saved-address.dto';
import { SavedAddressesService } from './saved-addresses.service';

@ApiTags('Saved Addresses')
@ApiBearerAuth('JWT-auth')
@Controller('saved-addresses')
@UseGuards(JwtAuthGuard)
export class SavedAddressesController {
  constructor(private readonly savedAddressesService: SavedAddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List saved addresses' })
  @ApiOkResponse({ description: 'Saved addresses for the current user' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.savedAddressesService.findAll(user.id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default saved address' })
  @ApiOkResponse({ description: 'Default saved address' })
  getDefault(@CurrentUser() user: AuthenticatedUser) {
    return this.savedAddressesService.getDefault(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create saved address' })
  @ApiCreatedResponse({ description: 'Saved address created' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedAddressDto,
  ) {
    return this.savedAddressesService.create(user.id, dto);
  }

  @Post('default')
  @ApiOperation({ summary: 'Set default saved address' })
  @ApiOkResponse({ description: 'Default address updated' })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetDefaultSavedAddressDto,
  ) {
    return this.savedAddressesService.setDefault(user.id, dto.addressId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update saved address' })
  @ApiParam({ name: 'id', description: 'Saved address UUID' })
  @ApiOkResponse({ description: 'Saved address updated' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSavedAddressDto,
  ) {
    return this.savedAddressesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete saved address' })
  @ApiParam({ name: 'id', description: 'Saved address UUID' })
  @ApiOkResponse({ description: 'Saved address deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.savedAddressesService.remove(user.id, id);
  }
}
