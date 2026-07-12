import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { UserRole } from '../common/enums/user-role.enum';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      client.data.user = payload;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('joinBooking')
  handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    client.join(`booking:${bookingId}`);
    return { event: 'joined', bookingId };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookingId: string; content: string },
  ) {
    const user = client.data.user;
    if (!user?.sub) {
      return { event: 'error', message: 'Unauthorized' };
    }

    const message = await this.messagingService.sendMessage(
      user.sub,
      data.bookingId,
      { content: data.content },
      (user.roles ?? []) as UserRole[],
    );

    this.server.to(`booking:${data.bookingId}`).emit('newMessage', message);

    return { event: 'messageSent', message };
  }
}
