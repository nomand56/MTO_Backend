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
  Query,
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
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums/user-role.enum';
import {
  CheckZoneDto,
  CreateZoneDto,
  UpdateZoneDto,
  ZoneAvailabilityQueryDto,
  ZonePricingQueryDto,
} from './dto/zone.dto';
import { ZonesService } from './zones.service';

@ApiTags('Zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List active service zones' })
  @ApiOkResponse({ description: 'Active zones' })
  findAll() {
    return this.zonesService.findAll();
  }

  @Get('check')
  @ApiOperation({
    summary: 'Check whether a location is inside a service zone',
  })
  @ApiOkResponse({ description: 'Zone coverage result' })
  check(@Query() query: CheckZoneDto) {
    return this.zonesService.checkCoverage(query);
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Get zone pricing for a location' })
  @ApiOkResponse({ description: 'Zone pricing breakdown' })
  pricing(@Query() query: ZonePricingQueryDto) {
    return this.zonesService.getPricing(query);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Check zone availability for a location' })
  @ApiOkResponse({ description: 'Zone availability result' })
  availability(@Query() query: ZoneAvailabilityQueryDto) {
    return this.zonesService.getAvailability(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a service zone' })
  @ApiCreatedResponse({ description: 'Zone created' })
  create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a service zone' })
  @ApiParam({ name: 'id', description: 'Zone UUID' })
  @ApiOkResponse({ description: 'Zone updated' })
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    return this.zonesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a service zone' })
  @ApiParam({ name: 'id', description: 'Zone UUID' })
  @ApiOkResponse({ description: 'Zone deleted' })
  remove(@Param('id') id: string) {
    return this.zonesService.remove(id);
  }
}
