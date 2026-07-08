import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check', description: 'Returns service status and timestamp.' })
  @ApiOkResponse({
    description: 'Service is healthy',
    schema: {
      example: {
        success: true,
        data: {
          status: 'ok',
          service: 'movethisout-backend',
          timestamp: '2026-07-08T08:00:00.000Z',
        },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
