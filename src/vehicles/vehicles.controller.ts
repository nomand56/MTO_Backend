import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CalculateVehicleRecommendationDto } from './dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles')
@Controller()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('vehicle-recommendations')
  @ApiOperation({ summary: 'Get vehicle recommendation guidance' })
  @ApiOkResponse({
    description: 'Recommendation guidance for active vehicle types',
  })
  getRecommendations() {
    return this.vehiclesService.getRecommendations();
  }

  @Post('vehicle-recommendations/calculate')
  @ApiOperation({ summary: 'Calculate recommended vehicle type' })
  @ApiCreatedResponse({ description: 'Vehicle recommendation calculated' })
  calculateRecommendation(@Body() dto: CalculateVehicleRecommendationDto) {
    return this.vehiclesService.calculateRecommendation(dto);
  }

  @Get('vehicle-types')
  @ApiOperation({ summary: 'List active vehicle types' })
  getVehicleTypes() {
    return this.vehiclesService.findVehicleTypes();
  }

  @Get('vehicle-types/:id')
  @ApiOperation({ summary: 'Get vehicle type by ID' })
  @ApiParam({ name: 'id', description: 'Vehicle type UUID' })
  @ApiOkResponse({ description: 'Vehicle type details' })
  getVehicleType(@Param('id') id: string) {
    return this.vehiclesService.findVehicleType(id);
  }
}
