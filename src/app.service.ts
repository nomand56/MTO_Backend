import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'movethisout-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
