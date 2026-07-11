import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MoversService } from './movers.service';
import { NearbyMoversQueryDto } from './dto/nearby-movers-query.dto';

@ApiTags('Movers')
@Controller()
export class MoversDiscoveryController {
  constructor(private readonly moversService: MoversService) {}

  @Get('movers/nearby')
  @ApiOperation({
    summary: 'List nearby online movers',
    description:
      'Public discovery endpoint for verified movers sharing live GPS near a pickup point.',
  })
  @ApiOkResponse({ description: 'Nearby movers with summary stats' })
  findNearby(@Query() query: NearbyMoversQueryDto) {
    return this.moversService.findNearbyMovers(query);
  }
}
