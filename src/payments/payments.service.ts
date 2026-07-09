import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from '../admin/dto/admin.dto';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

const PLATFORM_COMMISSION_RATE = 0.1;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPayment(
    customerId: string,
    bookingId: string,
    dto: CreatePaymentDto,
  ) {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const platformCommission = Number(
      (dto.amount * PLATFORM_COMMISSION_RATE).toFixed(2),
    );

    const payment = this.paymentRepository.create({
      bookingId,
      payerId: customerId,
      amount: dto.amount,
      platformCommission,
      status: PaymentStatus.Completed,
      transactionRef: dto.transactionRef ?? `TXN-${Date.now()}`,
      invoiceNumber: `INV-${Date.now()}`,
    });

    const saved = await this.paymentRepository.save(payment);

    if (booking.moverId) {
      await this.notificationsService.create(
        booking.moverId,
        NotificationType.Payment,
        'Payment received',
        `A payment of $${dto.amount} was received for booking ${bookingId}.`,
        { bookingId, paymentId: saved.id },
      );
    }

    return saved;
  }

  async getByBooking(bookingId: string, userId: string) {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.customerId !== userId && booking.moverId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.paymentRepository.find({
      where: { bookingId },
      order: { createdAt: 'DESC' },
    });
  }

  async refund(paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: { booking: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.Refunded) {
      throw new BadRequestException('Payment already refunded');
    }

    payment.status = PaymentStatus.Refunded;
    const saved = await this.paymentRepository.save(payment);

    await this.notificationsService.create(
      payment.payerId,
      NotificationType.Payment,
      'Payment refunded',
      `Your payment of $${payment.amount} has been refunded.`,
      { paymentId: saved.id },
    );

    return saved;
  }
}
