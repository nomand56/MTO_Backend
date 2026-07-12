import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from '../admin/dto/admin.dto';
import { PayFromWalletDto } from './dto/wallet.dto';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '../common/enums/payment-status.enum';
import { PaymentKind } from '../common/enums/payment-kind.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { CustomerProfile } from '../users/entities/customer-profile.entity';
import { MoverProfile } from '../movers/entities/mover-profile.entity';
import { Dispute } from '../admin/entities/dispute.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { WalletAccountType } from '../common/enums/wallet-account-type.enum';
import { WalletTransactionType } from '../common/enums/wallet-transaction-type.enum';

const PLATFORM_COMMISSION_RATE = 0.1;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(CustomerProfile)
    private readonly customerProfileRepository: Repository<CustomerProfile>,
    @InjectRepository(MoverProfile)
    private readonly moverProfileRepository: Repository<MoverProfile>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(WalletTransaction)
    private readonly walletTransactionRepository: Repository<WalletTransaction>,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private moverNetFromGross(grossAmount: number): number {
    const fee = Number((grossAmount * PLATFORM_COMMISSION_RATE).toFixed(2));
    return Number((grossAmount - fee).toFixed(2));
  }

  private async creditMoverWallet(moverId: string, netAmount: number) {
    if (netAmount <= 0) return 0;
    const profile = await this.moverProfileRepository.findOne({
      where: { userId: moverId },
    });
    if (!profile) return 0;
    const next = Number((Number(profile.walletBalance ?? 0) + netAmount).toFixed(2));
    profile.walletBalance = next;
    await this.moverProfileRepository.save(profile);
    return next;
  }

  private async debitMoverWallet(moverId: string, netAmount: number) {
    if (netAmount <= 0) return 0;
    const profile = await this.moverProfileRepository.findOne({
      where: { userId: moverId },
    });
    if (!profile) return 0;
    const next = Number((Number(profile.walletBalance ?? 0) - netAmount).toFixed(2));
    profile.walletBalance = next;
    await this.moverProfileRepository.save(profile);
    return next;
  }

  private async disputeRefundsByBooking(
    bookingIds: string[],
  ): Promise<Record<string, number>> {
    if (!bookingIds.length) return {};
    const disputes = await this.disputeRepository.find({
      where: { bookingId: In(bookingIds) },
    });
    const map: Record<string, number> = {};
    for (const dispute of disputes) {
      const amount = Number(dispute.refundAmount ?? 0);
      if (amount <= 0) continue;
      map[dispute.bookingId] = Number(
        ((map[dispute.bookingId] ?? 0) + amount).toFixed(2),
      );
    }
    return map;
  }

  private async syncMoverWalletFromPayments(
    moverId: string,
    payments: Payment[],
    refundByBooking: Record<string, number>,
  ): Promise<number> {
    let computed = 0;
    for (const payment of payments) {
      const amount = Number(payment.amount);
      const fee = Number(payment.platformCommission);
      const refundGross = refundByBooking[payment.bookingId] ?? 0;
      const refundRatio = amount > 0 ? Math.min(refundGross / amount, 1) : 0;
      computed += Number(((amount - fee) * (1 - refundRatio)).toFixed(2));
    }
    const profile = await this.moverProfileRepository.findOne({
      where: { userId: moverId },
    });
    if (!profile) return computed;
    if (Number(profile.walletBalance ?? 0) === 0 && computed > 0) {
      profile.walletBalance = Number(computed.toFixed(2));
      await this.moverProfileRepository.save(profile);
    }
    return Number(profile.walletBalance ?? computed);
  }

  private transactionReason(type: WalletTransactionType): string {
    const map: Record<WalletTransactionType, string> = {
      [WalletTransactionType.WalletTopUp]: 'Wallet top-up',
      [WalletTransactionType.JobPayment]: 'Move payment',
      [WalletTransactionType.TipPayment]: 'Tip payment',
      [WalletTransactionType.DisputeRefund]: 'Dispute refund',
      [WalletTransactionType.DisputeDeduction]: 'Dispute refund deduction',
      [WalletTransactionType.PaymentRefund]: 'Payment refund',
    };
    return map[type] ?? 'Transaction';
  }

  private formatStatementEntry(tx: WalletTransaction) {
    const amount = Number(tx.amount);
    return {
      id: tx.id,
      type: tx.type,
      direction: tx.direction,
      amount,
      balanceAfter: tx.balanceAfter != null ? Number(tx.balanceAfter) : null,
      reason: this.transactionReason(tx.type),
      description: tx.description,
      source: tx.sourceLabel ?? null,
      destination: tx.destinationLabel ?? null,
      counterpartyName: tx.counterpartyName ?? null,
      bookingId: tx.bookingId ?? null,
      disputeId: tx.disputeId ?? null,
      paymentId: tx.paymentId ?? null,
      reference: tx.reference ?? null,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  private summarizeStatement(
    entries: ReturnType<PaymentsService['formatStatementEntry']>[],
    currentBalance: number,
  ) {
    const totalIn = Number(
      entries
        .filter((e) => e.direction === 'credit')
        .reduce((sum, e) => sum + e.amount, 0)
        .toFixed(2),
    );
    const totalOut = Number(
      entries
        .filter((e) => e.direction === 'debit')
        .reduce((sum, e) => sum + e.amount, 0)
        .toFixed(2),
    );
    return {
      currentBalance,
      totalIn,
      totalOut,
      entries: entries.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }

  private async recordWalletTransaction(input: {
    userId: string;
    accountType: WalletAccountType;
    type: WalletTransactionType;
    direction: 'credit' | 'debit';
    amount: number;
    balanceAfter?: number;
    bookingId?: string;
    disputeId?: string;
    paymentId?: string;
    counterpartyId?: string;
    counterpartyName?: string;
    description: string;
    sourceLabel?: string;
    destinationLabel?: string;
    reference?: string;
  }) {
    const saved = await this.walletTransactionRepository.save(
      this.walletTransactionRepository.create({
        ...input,
        amount: Number(input.amount.toFixed(2)),
        balanceAfter:
          input.balanceAfter != null
            ? Number(input.balanceAfter.toFixed(2))
            : null,
      }),
    );
    return saved;
  }

  private async buildLegacyCustomerStatement(customerId: string) {
    const bookings = await this.bookingsService.findByCustomer(customerId);
    const bookingIds = bookings.map((b) => b.id);
    const entries: ReturnType<PaymentsService['formatStatementEntry']>[] = [];

    if (bookingIds.length) {
      const payments = await this.paymentRepository.find({
        where: {
          bookingId: In(bookingIds),
          payerId: customerId,
          status: PaymentStatus.Completed,
        },
        relations: {
          booking: { mover: { moverProfile: true } },
        },
        order: { createdAt: 'DESC' },
      });

      for (const payment of payments) {
        const kind = payment.kind ?? PaymentKind.Job;
        const moverName =
          payment.booking?.mover?.moverProfile?.businessName ??
          payment.booking?.mover?.email ??
          'Mover';
        entries.push({
          id: `legacy-pay-${payment.id}`,
          type:
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          direction: 'debit',
          amount: Number(payment.amount),
          balanceAfter: null,
          reason: this.transactionReason(
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          ),
          description:
            kind === PaymentKind.Tip
              ? `Tip paid to ${moverName}`
              : `Move payment to ${moverName}`,
          source: 'Your wallet',
          destination: moverName,
          counterpartyName: moverName,
          bookingId: payment.bookingId,
          disputeId: null,
          paymentId: payment.id,
          reference: payment.transactionRef ?? payment.invoiceNumber ?? null,
          createdAt: payment.createdAt.toISOString(),
        });
      }

      const disputes = await this.disputeRepository.find({
        where: { bookingId: In(bookingIds) },
      });
      for (const dispute of disputes) {
        const refundAmount = Number(dispute.refundAmount ?? 0);
        if (refundAmount <= 0) continue;
        entries.push({
          id: `legacy-dispute-${dispute.id}`,
          type: WalletTransactionType.DisputeRefund,
          direction: 'credit',
          amount: refundAmount,
          balanceAfter: null,
          reason: this.transactionReason(WalletTransactionType.DisputeRefund),
          description: 'Dispute refund credited to your wallet',
          source: 'Platform dispute resolution',
          destination: 'Your wallet',
          counterpartyName: 'MoveThisOut Support',
          bookingId: dispute.bookingId,
          disputeId: dispute.id,
          paymentId: null,
          reference: `DISPUTE-${dispute.id.slice(0, 8).toUpperCase()}`,
          createdAt: dispute.updatedAt.toISOString(),
        });
      }
    }

    return entries;
  }

  private async buildLegacyMoverStatement(moverId: string) {
    const bookings = await this.bookingsService.findByMover(moverId);
    const bookingIds = bookings.map((b) => b.id);
    const entries: ReturnType<PaymentsService['formatStatementEntry']>[] = [];

    if (bookingIds.length) {
      const payments = await this.paymentRepository.find({
        where: {
          bookingId: In(bookingIds),
          status: PaymentStatus.Completed,
        },
        relations: {
          booking: { customer: { customerProfile: true } },
        },
        order: { createdAt: 'DESC' },
      });

      const refundByBooking = await this.disputeRefundsByBooking(bookingIds);

      for (const payment of payments) {
        const amount = Number(payment.amount);
        const fee = Number(payment.platformCommission);
        const refundGross = refundByBooking[payment.bookingId] ?? 0;
        const refundRatio = amount > 0 ? Math.min(refundGross / amount, 1) : 0;
        const net = Number(((amount - fee) * (1 - refundRatio)).toFixed(2));
        const kind = payment.kind ?? PaymentKind.Job;
        const customer = payment.booking?.customer;
        const customerName = customer?.customerProfile
          ? `${customer.customerProfile.firstName ?? ''} ${customer.customerProfile.lastName ?? ''}`.trim() ||
            customer?.email
          : customer?.email ?? 'Customer';

        entries.push({
          id: `legacy-pay-${payment.id}`,
          type:
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          direction: 'credit',
          amount: net,
          balanceAfter: null,
          reason: this.transactionReason(
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          ),
          description:
            kind === PaymentKind.Tip
              ? `Tip received from ${customerName}`
              : `Job payout from ${customerName}`,
          source: customerName,
          destination: 'Your mover wallet',
          counterpartyName: customerName,
          bookingId: payment.bookingId,
          disputeId: null,
          paymentId: payment.id,
          reference: payment.transactionRef ?? payment.invoiceNumber ?? null,
          createdAt: payment.createdAt.toISOString(),
        });
      }

      const disputes = await this.disputeRepository
        .createQueryBuilder('dispute')
        .innerJoin('dispute.booking', 'booking')
        .where('booking.moverId = :moverId', { moverId })
        .andWhere('dispute.refundAmount > 0')
        .getMany();

      for (const dispute of disputes) {
        const refundGross = Number(dispute.refundAmount ?? 0);
        const deduction = this.moverNetFromGross(refundGross);
        entries.push({
          id: `legacy-dispute-${dispute.id}`,
          type: WalletTransactionType.DisputeDeduction,
          direction: 'debit',
          amount: deduction,
          balanceAfter: null,
          reason: this.transactionReason(WalletTransactionType.DisputeDeduction),
          description: 'Dispute refund deducted from your wallet',
          source: 'Your mover wallet',
          destination: 'Customer refund',
          counterpartyName: 'Customer',
          bookingId: dispute.bookingId,
          disputeId: dispute.id,
          paymentId: null,
          reference: `DISPUTE-${dispute.id.slice(0, 8).toUpperCase()}`,
          createdAt: dispute.updatedAt.toISOString(),
        });
      }
    }

    return entries;
  }

  async getWalletStatement(userId: string, accountType: WalletAccountType) {
    const stored = await this.walletTransactionRepository.find({
      where: { userId, accountType },
      order: { createdAt: 'DESC' },
    });

    let entries = stored.map((tx) => this.formatStatementEntry(tx));

    if (!entries.length) {
      entries =
        accountType === WalletAccountType.Customer
          ? await this.buildLegacyCustomerStatement(userId)
          : await this.buildLegacyMoverStatement(userId);
    }

    const currentBalance =
      accountType === WalletAccountType.Customer
        ? await this.getWalletBalance(userId)
        : Number(
            (
              await this.moverProfileRepository.findOne({
                where: { userId },
              })
            )?.walletBalance ?? 0,
          );

    return this.summarizeStatement(entries, currentBalance);
  }

  async getAllWalletStatements(limit = 200) {
    const stored = await this.walletTransactionRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });

    if (stored.length) {
      return stored.map((tx) => ({
        ...this.formatStatementEntry(tx),
        userId: tx.userId,
        accountType: tx.accountType,
      }));
    }

    const payments = await this.paymentRepository.find({
      where: { status: PaymentStatus.Completed },
      relations: {
        booking: {
          customer: { customerProfile: true },
          mover: { moverProfile: true },
        },
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const entries: Array<
      ReturnType<PaymentsService['formatStatementEntry']> & {
        userId: string;
        accountType: WalletAccountType;
      }
    > = [];

    for (const payment of payments) {
      const booking = payment.booking;
      if (!booking) continue;
      const kind = payment.kind ?? PaymentKind.Job;
      const moverName =
        booking.mover?.moverProfile?.businessName ??
        booking.mover?.email ??
        'Mover';
      const customerName = booking.customer?.customerProfile
        ? `${booking.customer.customerProfile.firstName ?? ''} ${booking.customer.customerProfile.lastName ?? ''}`.trim() ||
          booking.customer?.email
        : booking.customer?.email ?? 'Customer';
      const amount = Number(payment.amount);
      const net = this.moverNetFromGross(amount);

      entries.push({
        id: `legacy-cust-${payment.id}`,
        userId: booking.customerId,
        accountType: WalletAccountType.Customer,
        type:
          kind === PaymentKind.Tip
            ? WalletTransactionType.TipPayment
            : WalletTransactionType.JobPayment,
        direction: 'debit',
        amount,
        balanceAfter: null,
        reason: this.transactionReason(
          kind === PaymentKind.Tip
            ? WalletTransactionType.TipPayment
            : WalletTransactionType.JobPayment,
        ),
        description:
          kind === PaymentKind.Tip
            ? `Tip paid to ${moverName}`
            : `Move payment to ${moverName}`,
        source: 'Customer wallet',
        destination: moverName,
        counterpartyName: moverName,
        bookingId: booking.id,
        disputeId: null,
        paymentId: payment.id,
        reference: payment.transactionRef ?? null,
        createdAt: payment.createdAt.toISOString(),
      });

      if (booking.moverId) {
        entries.push({
          id: `legacy-mover-${payment.id}`,
          userId: booking.moverId,
          accountType: WalletAccountType.Mover,
          type:
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          direction: 'credit',
          amount: net,
          balanceAfter: null,
          reason: this.transactionReason(
            kind === PaymentKind.Tip
              ? WalletTransactionType.TipPayment
              : WalletTransactionType.JobPayment,
          ),
          description:
            kind === PaymentKind.Tip
              ? `Tip received from ${customerName}`
              : `Job payout from ${customerName}`,
          source: customerName,
          destination: 'Mover wallet',
          counterpartyName: customerName,
          bookingId: booking.id,
          disputeId: null,
          paymentId: payment.id,
          reference: payment.transactionRef ?? null,
          createdAt: payment.createdAt.toISOString(),
        });
      }
    }

    const disputes = await this.disputeRepository.find({
      where: {},
      relations: { booking: true },
      order: { updatedAt: 'DESC' },
      take: limit,
    });

    for (const dispute of disputes) {
      const refundAmount = Number(dispute.refundAmount ?? 0);
      if (refundAmount <= 0 || !dispute.booking) continue;
      entries.push({
        id: `legacy-dispute-c-${dispute.id}`,
        userId: dispute.booking.customerId,
        accountType: WalletAccountType.Customer,
        type: WalletTransactionType.DisputeRefund,
        direction: 'credit',
        amount: refundAmount,
        balanceAfter: null,
        reason: this.transactionReason(WalletTransactionType.DisputeRefund),
        description: 'Dispute refund credited to customer wallet',
        source: 'Platform dispute resolution',
        destination: 'Customer wallet',
        counterpartyName: 'MoveThisOut Support',
        bookingId: dispute.bookingId,
        disputeId: dispute.id,
        paymentId: null,
        reference: `DISPUTE-${dispute.id.slice(0, 8).toUpperCase()}`,
        createdAt: dispute.updatedAt.toISOString(),
      });
      if (dispute.booking.moverId) {
        entries.push({
          id: `legacy-dispute-m-${dispute.id}`,
          userId: dispute.booking.moverId,
          accountType: WalletAccountType.Mover,
          type: WalletTransactionType.DisputeDeduction,
          direction: 'debit',
          amount: this.moverNetFromGross(refundAmount),
          balanceAfter: null,
          reason: this.transactionReason(WalletTransactionType.DisputeDeduction),
          description: 'Dispute refund deducted from mover wallet',
          source: 'Mover wallet',
          destination: 'Customer refund',
          counterpartyName: 'Customer',
          bookingId: dispute.bookingId,
          disputeId: dispute.id,
          paymentId: null,
          reference: `DISPUTE-${dispute.id.slice(0, 8).toUpperCase()}`,
          createdAt: dispute.updatedAt.toISOString(),
        });
      }
    }

    return entries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async createPayment(
    customerId: string,
    bookingId: string,
    dto: CreatePaymentDto,
  ) {
    const booking = await this.bookingsService.findById(bookingId);

    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException(
        'Payments can only be made after the move is completed',
      );
    }

    const kind = dto.kind ?? PaymentKind.Job;
    const platformCommission = Number(
      (dto.amount * PLATFORM_COMMISSION_RATE).toFixed(2),
    );

    const payment = this.paymentRepository.create({
      bookingId,
      payerId: customerId,
      amount: dto.amount,
      platformCommission,
      kind,
      status: PaymentStatus.Completed,
      transactionRef:
        dto.transactionRef ??
        `${kind === PaymentKind.Tip ? 'TIP' : 'JOB'}-${Date.now()}`,
      invoiceNumber: `INV-${Date.now()}`,
    });

    const saved = await this.paymentRepository.save(payment);

    if (booking.moverId) {
      const label = kind === PaymentKind.Tip ? 'Tip received' : 'Payment received';
      await this.notificationsService.create(
        booking.moverId,
        NotificationType.Payment,
        label,
        `A ${kind === PaymentKind.Tip ? 'tip' : 'payment'} of $${dto.amount} was received for booking ${bookingId}.`,
        { bookingId, paymentId: saved.id, kind },
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

  async getMoverWallet(moverId: string) {
    const bookings = await this.bookingsService.findByMover(moverId);
    const bookingIds = bookings.map((b) => b.id);

    if (!bookingIds.length) {
      const statement = await this.getWalletStatement(
        moverId,
        WalletAccountType.Mover,
      );
      return {
        availableBalance: 0,
        lifetimeEarnings: 0,
        jobEarnings: 0,
        tipEarnings: 0,
        platformFees: 0,
        pendingJobs: bookings.filter((b) =>
          ['confirmed', 'in_progress'].includes(b.status),
        ).length,
        completedJobs: bookings.filter((b) => b.status === 'completed').length,
        payments: [],
        statement,
      };
    }

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.booking', 'booking')
      .leftJoinAndSelect('booking.request', 'request')
      .leftJoinAndSelect('booking.customer', 'customer')
      .leftJoinAndSelect('customer.customerProfile', 'customerProfile')
      .where('payment.bookingId IN (:...bookingIds)', { bookingIds })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.Completed,
      })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    const refundByBooking = await this.disputeRefundsByBooking(bookingIds);

    let jobGross = 0;
    let tipGross = 0;
    let platformFees = 0;
    let adjustedNetTotal = 0;

    const rows = payments.map((p) => {
      const amount = Number(p.amount);
      const fee = Number(p.platformCommission);
      const refundGross = refundByBooking[p.bookingId] ?? 0;
      const refundRatio = amount > 0 ? Math.min(refundGross / amount, 1) : 0;
      const net = Number(((amount - fee) * (1 - refundRatio)).toFixed(2));
      const kind = p.kind ?? PaymentKind.Job;

      if (kind === PaymentKind.Tip) tipGross += amount;
      else jobGross += amount;
      platformFees += fee;
      adjustedNetTotal += net;

      const customer = p.booking?.customer;
      const profile = customer?.customerProfile;
      const customerName = profile
        ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
          customer?.email
        : customer?.email;

      return {
        id: p.id,
        bookingId: p.bookingId,
        kind,
        amount,
        platformCommission: fee,
        net,
        status: p.status,
        transactionRef: p.transactionRef,
        invoiceNumber: p.invoiceNumber,
        createdAt: p.createdAt,
        customerName: customerName ?? 'Customer',
        route: p.booking
          ? {
              pickup:
                (p.booking.pickupAddress as { street?: string } | null)
                  ?.street ??
                p.booking.request?.pickupAddress ??
                'Pickup',
              destination:
                (p.booking.destinationAddress as { street?: string } | null)
                  ?.street ??
                p.booking.request?.destinationAddress ??
                'Drop-off',
            }
          : null,
      };
    });

    const lifetimeGross = jobGross + tipGross;
    const availableBalance = await this.syncMoverWalletFromPayments(
      moverId,
      payments,
      refundByBooking,
    );
    const statement = await this.getWalletStatement(
      moverId,
      WalletAccountType.Mover,
    );

    return {
      availableBalance,
      lifetimeEarnings: Number(lifetimeGross.toFixed(2)),
      jobEarnings: Number(jobGross.toFixed(2)),
      tipEarnings: Number(tipGross.toFixed(2)),
      platformFees: Number(platformFees.toFixed(2)),
      adjustedNetEarnings: Number(adjustedNetTotal.toFixed(2)),
      pendingJobs: bookings.filter((b) =>
        ['confirmed', 'in_progress'].includes(b.status),
      ).length,
      completedJobs: bookings.filter((b) => b.status === 'completed').length,
      payments: rows,
      statement,
    };
  }

  async getCustomerWallet(customerId: string) {
    const bookings = await this.bookingsService.findByCustomer(customerId);
    const bookingIds = bookings.map((b) => b.id);

    if (!bookingIds.length) {
      const statement = await this.getWalletStatement(
        customerId,
        WalletAccountType.Customer,
      );
      return {
        balance: await this.getWalletBalance(customerId),
        totalSpent: 0,
        jobPayments: 0,
        tipsPaid: 0,
        payments: [],
        statement,
      };
    }

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.booking', 'booking')
      .leftJoinAndSelect('booking.mover', 'mover')
      .leftJoinAndSelect('mover.moverProfile', 'moverProfile')
      .where('payment.bookingId IN (:...bookingIds)', { bookingIds })
      .andWhere('payment.status = :status', {
        status: PaymentStatus.Completed,
      })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();

    let jobPayments = 0;
    let tipsPaid = 0;

    const rows = payments.map((p) => {
      const amount = Number(p.amount);
      const kind = p.kind ?? PaymentKind.Job;
      if (kind === PaymentKind.Tip) tipsPaid += amount;
      else jobPayments += amount;

      return {
        id: p.id,
        bookingId: p.bookingId,
        kind,
        amount,
        status: p.status,
        transactionRef: p.transactionRef,
        invoiceNumber: p.invoiceNumber,
        createdAt: p.createdAt,
        moverName:
          p.booking?.mover?.moverProfile?.businessName ??
          p.booking?.mover?.email ??
          'Mover',
      };
    });

    return {
      balance: await this.getWalletBalance(customerId),
      totalSpent: Number((jobPayments + tipsPaid).toFixed(2)),
      jobPayments: Number(jobPayments.toFixed(2)),
      tipsPaid: Number(tipsPaid.toFixed(2)),
      payments: rows,
      statement: await this.getWalletStatement(
        customerId,
        WalletAccountType.Customer,
      ),
    };
  }

  async getWalletBalance(customerId: string) {
    const profile = await this.customerProfileRepository.findOne({
      where: { userId: customerId },
    });
    return Number(profile?.walletBalance ?? 0);
  }

  async topUpWallet(customerId: string, amount: number) {
    const profile = await this.customerProfileRepository.findOne({
      where: { userId: customerId },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }
    const next = Number((Number(profile.walletBalance ?? 0) + amount).toFixed(2));
    profile.walletBalance = next;
    await this.customerProfileRepository.save(profile);

    await this.recordWalletTransaction({
      userId: customerId,
      accountType: WalletAccountType.Customer,
      type: WalletTransactionType.WalletTopUp,
      direction: 'credit',
      amount,
      balanceAfter: next,
      description: 'Funds added to wallet',
      sourceLabel: 'Card / bank',
      destinationLabel: 'Your wallet',
      reference: `TOPUP-${Date.now()}`,
    });

    return { balance: next, added: amount };
  }

  async getBookingInvoice(
    customerId: string,
    bookingId: string,
    kind: PaymentKind = PaymentKind.Job,
    amountOverride?: number,
  ) {
    const booking = await this.bookingsService.findById(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    const amount =
      amountOverride ??
      (kind === PaymentKind.Tip ? 0 : Number(booking.price));
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invoice amount must be greater than zero');
    }

    const existing = await this.paymentRepository.findOne({
      where: {
        bookingId,
        kind,
        status: PaymentStatus.Completed,
      },
      order: { createdAt: 'DESC' },
    });

    const balance = await this.getWalletBalance(customerId);
    const customer = booking.customer;
    const profile = customer?.customerProfile;
    const moverProfile = booking.mover?.moverProfile;
    const pickup =
      (booking.pickupAddress as { street?: string } | null)?.street ??
      booking.request?.pickupAddress ??
      'Pickup';
    const destination =
      (booking.destinationAddress as { street?: string } | null)?.street ??
      booking.request?.destinationAddress ??
      'Drop-off';
    const itemCount = booking.items?.filter((i) => i.name !== 'Delivery proof').length ?? 0;

    const lineItems = [
      {
        label:
          kind === PaymentKind.Tip
            ? 'Tip for mover'
            : 'Moving service',
        description:
          kind === PaymentKind.Tip
            ? `Thank-you tip for ${moverProfile?.businessName ?? 'your mover'}`
            : `${pickup} → ${destination}`,
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ];

    if (kind === PaymentKind.Job && itemCount > 0) {
      lineItems.push({
        label: 'Items moved',
        description: `${itemCount} item${itemCount === 1 ? '' : 's'} included in this move`,
        quantity: itemCount,
        unitPrice: 0,
        amount: 0,
      });
    }

    const invoiceNumber =
      existing?.invoiceNumber ??
      `INV-${bookingId.slice(0, 8).toUpperCase()}-${kind === PaymentKind.Tip ? 'TIP' : 'JOB'}`;

    return {
      invoiceNumber,
      bookingId,
      kind,
      status: existing ? 'paid' : 'draft',
      issuedAt: new Date().toISOString(),
      dueAt: booking.scheduledDate ?? booking.request?.movingDate ?? null,
      customer: {
        name: profile
          ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
            customer?.email
          : customer?.email,
        email: customer?.email ?? null,
        phone: profile?.phone ?? null,
      },
      mover: {
        name: moverProfile?.businessName ?? booking.mover?.email ?? 'Mover',
        phone: moverProfile?.phone ?? null,
      },
      route: { pickup, destination },
      lineItems,
      subtotal: amount,
      tax: 0,
      total: amount,
      walletBalance: balance,
      canPayFromWallet: !existing && balance >= amount,
      alreadyPaid: !!existing,
      paymentId: existing?.id ?? null,
      paidAt: existing?.createdAt ?? null,
    };
  }

  async getReleasedInvoiceForMover(moverId: string, paymentId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: {
        booking: {
          customer: { customerProfile: true },
          mover: { moverProfile: true },
          request: true,
          items: true,
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.booking?.moverId !== moverId) {
      throw new ForbiddenException('Access denied');
    }

    if (payment.status !== PaymentStatus.Completed) {
      throw new BadRequestException('Invoice is only available for released payments');
    }

    const booking = payment.booking;
    const kind = payment.kind ?? PaymentKind.Job;
    const amount = Number(payment.amount);
    const platformFee = Number(payment.platformCommission);
    const netEarnings = Number((amount - platformFee).toFixed(2));
    const customer = booking.customer;
    const profile = customer?.customerProfile;
    const moverProfile = booking.mover?.moverProfile;
    const pickup =
      (booking.pickupAddress as { street?: string } | null)?.street ??
      booking.request?.pickupAddress ??
      'Pickup';
    const destination =
      (booking.destinationAddress as { street?: string } | null)?.street ??
      booking.request?.destinationAddress ??
      'Drop-off';
    const itemCount = booking.items?.filter((i) => i.name !== 'Delivery proof').length ?? 0;

    const lineItems = [
      {
        label: kind === PaymentKind.Tip ? 'Tip from customer' : 'Moving service',
        description:
          kind === PaymentKind.Tip
            ? `Tip released to ${moverProfile?.businessName ?? 'you'}`
            : `${pickup} → ${destination}`,
        quantity: 1,
        unitPrice: amount,
        amount,
      },
    ];

    if (kind === PaymentKind.Job && itemCount > 0) {
      lineItems.push({
        label: 'Items moved',
        description: `${itemCount} item${itemCount === 1 ? '' : 's'} included in this move`,
        quantity: itemCount,
        unitPrice: 0,
        amount: 0,
      });
    }

    lineItems.push({
      label: 'Platform fee (10%)',
      description: 'Deducted from your payout',
      quantity: 1,
      unitPrice: -platformFee,
      amount: -platformFee,
    });

    return {
      invoiceNumber: payment.invoiceNumber ?? `INV-${payment.id.slice(0, 8).toUpperCase()}`,
      bookingId: booking.id,
      kind,
      status: 'paid' as const,
      issuedAt: payment.createdAt.toISOString(),
      dueAt: booking.scheduledDate ?? booking.request?.movingDate ?? null,
      customer: {
        name: profile
          ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
            customer?.email
          : customer?.email,
        email: customer?.email ?? null,
        phone: profile?.phone ?? null,
      },
      mover: {
        name: moverProfile?.businessName ?? booking.mover?.email ?? 'Mover',
        phone: moverProfile?.phone ?? null,
      },
      route: { pickup, destination },
      lineItems,
      subtotal: amount,
      tax: 0,
      total: amount,
      platformFee,
      netEarnings,
      viewerRole: 'mover' as const,
      walletBalance: null,
      canPayFromWallet: false,
      alreadyPaid: true,
      paymentId: payment.id,
      paidAt: payment.createdAt.toISOString(),
    };
  }

  async payFromWallet(
    customerId: string,
    bookingId: string,
    dto: PayFromWalletDto,
  ) {
    const booking = await this.bookingsService.findById(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Access denied');
    }

    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException(
        'Payments can only be made after the move is completed',
      );
    }

    const kind = dto.kind ?? PaymentKind.Job;
    const amount =
      dto.amount ??
      (kind === PaymentKind.Tip ? 0 : Number(booking.price));

    if (!amount || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const duplicate = await this.paymentRepository.findOne({
      where: {
        bookingId,
        kind,
        status: PaymentStatus.Completed,
      },
    });
    if (duplicate && kind === PaymentKind.Job) {
      throw new BadRequestException('This move has already been paid');
    }

    const profile = await this.customerProfileRepository.findOne({
      where: { userId: customerId },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    const balance = Number(profile.walletBalance ?? 0);
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient wallet balance. Add $${(amount - balance).toFixed(2)} to continue.`,
      );
    }

    profile.walletBalance = Number((balance - amount).toFixed(2));
    await this.customerProfileRepository.save(profile);

    const platformCommission = Number(
      (amount * PLATFORM_COMMISSION_RATE).toFixed(2),
    );
    const invoiceNumber = `INV-${Date.now()}`;

    const payment = this.paymentRepository.create({
      bookingId,
      payerId: customerId,
      amount,
      platformCommission,
      kind,
      status: PaymentStatus.Completed,
      transactionRef: `WALLET-${Date.now()}`,
      invoiceNumber,
    });

    const saved = await this.paymentRepository.save(payment);

    const moverName =
      booking.mover?.moverProfile?.businessName ??
      booking.mover?.email ??
      'Mover';
    const customerName = profile
      ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() ||
        booking.customer?.email
      : booking.customer?.email ?? 'Customer';
    const txType =
      kind === PaymentKind.Tip
        ? WalletTransactionType.TipPayment
        : WalletTransactionType.JobPayment;

    await this.recordWalletTransaction({
      userId: customerId,
      accountType: WalletAccountType.Customer,
      type: txType,
      direction: 'debit',
      amount,
      balanceAfter: Number(profile.walletBalance),
      bookingId,
      paymentId: saved.id,
      counterpartyId: booking.moverId ?? undefined,
      counterpartyName: moverName,
      description:
        kind === PaymentKind.Tip
          ? `Tip paid to ${moverName}`
          : `Move payment to ${moverName}`,
      sourceLabel: 'Your wallet',
      destinationLabel: moverName,
      reference: saved.transactionRef ?? saved.invoiceNumber ?? undefined,
    });

    if (booking.moverId) {
      const moverNet = this.moverNetFromGross(amount);
      const moverBalance = await this.creditMoverWallet(booking.moverId, moverNet);

      await this.recordWalletTransaction({
        userId: booking.moverId,
        accountType: WalletAccountType.Mover,
        type: txType,
        direction: 'credit',
        amount: moverNet,
        balanceAfter: moverBalance,
        bookingId,
        paymentId: saved.id,
        counterpartyId: customerId,
        counterpartyName: customerName ?? 'Customer',
        description:
          kind === PaymentKind.Tip
            ? `Tip received from ${customerName}`
            : `Job payout from ${customerName}`,
        sourceLabel: customerName ?? 'Customer',
        destinationLabel: 'Your mover wallet',
        reference: saved.transactionRef ?? saved.invoiceNumber ?? undefined,
      });

      const label = kind === PaymentKind.Tip ? 'Tip received' : 'Payment received';
      await this.notificationsService.create(
        booking.moverId,
        NotificationType.Payment,
        label,
        `A ${kind === PaymentKind.Tip ? 'tip' : 'payment'} of $${amount} was received for booking ${bookingId}.`,
        { bookingId, paymentId: saved.id, kind, netEarnings: moverNet },
      );
    }

    return {
      payment: saved,
      balance: Number(profile.walletBalance),
      invoice: await this.getBookingInvoice(customerId, bookingId, kind, amount),
    };
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

  async refundDisputeToWallet(
    customerId: string,
    bookingId: string,
    amount: number,
    disputeId: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const booking = await this.bookingsService.findById(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('Customer does not own this booking');
    }

    const profile = await this.customerProfileRepository.findOne({
      where: { userId: customerId },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    const payment = await this.paymentRepository.findOne({
      where: {
        bookingId,
        payerId: customerId,
        kind: PaymentKind.Job,
        status: PaymentStatus.Completed,
      },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new BadRequestException(
        'No completed payment found for this booking',
      );
    }

    const maxRefund = Number(payment.amount);
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });
    const priorRefund = Number(dispute?.refundAmount ?? 0);
    if (priorRefund + amount > maxRefund) {
      throw new BadRequestException(
        `Total refund cannot exceed the paid amount of $${maxRefund.toFixed(2)}`,
      );
    }

    const nextBalance = Number(
      (Number(profile.walletBalance ?? 0) + amount).toFixed(2),
    );
    profile.walletBalance = nextBalance;
    await this.customerProfileRepository.save(profile);

    await this.recordWalletTransaction({
      userId: customerId,
      accountType: WalletAccountType.Customer,
      type: WalletTransactionType.DisputeRefund,
      direction: 'credit',
      amount,
      balanceAfter: nextBalance,
      bookingId,
      disputeId,
      counterpartyName: 'MoveThisOut Support',
      description: 'Dispute refund credited to your wallet',
      sourceLabel: 'Platform dispute resolution',
      destinationLabel: 'Your wallet',
      reference: `DISPUTE-${disputeId.slice(0, 8).toUpperCase()}`,
    });

    if (priorRefund + amount >= maxRefund) {
      payment.status = PaymentStatus.Refunded;
      await this.paymentRepository.save(payment);
    }

    let moverBalance: number | null = null;
    let moverDeduction = 0;
    if (booking.moverId) {
      moverDeduction = this.moverNetFromGross(amount);
      moverBalance = await this.debitMoverWallet(booking.moverId, moverDeduction);

      await this.recordWalletTransaction({
        userId: booking.moverId,
        accountType: WalletAccountType.Mover,
        type: WalletTransactionType.DisputeDeduction,
        direction: 'debit',
        amount: moverDeduction,
        balanceAfter: moverBalance,
        bookingId,
        disputeId,
        counterpartyName: 'Customer',
        description: 'Dispute refund deducted from your wallet',
        sourceLabel: 'Your mover wallet',
        destinationLabel: 'Customer refund',
        reference: `DISPUTE-${disputeId.slice(0, 8).toUpperCase()}`,
      });

      await this.notificationsService.create(
        booking.moverId,
        NotificationType.Payment,
        'Dispute refund deducted',
        `$${moverDeduction.toFixed(2)} was deducted from your wallet for a dispute refund on booking ${bookingId}. New balance: $${(moverBalance ?? 0).toFixed(2)}.`,
        {
          disputeId,
          bookingId,
          refundAmount: amount,
          moverDeduction,
          moverBalance,
        },
      );
    }

    await this.notificationsService.create(
      customerId,
      NotificationType.Payment,
      'Refund added to wallet',
      `$${amount.toFixed(2)} from your dispute was credited to your wallet. New balance: $${nextBalance.toFixed(2)}.`,
      { disputeId, bookingId, balance: nextBalance, refundedAmount: amount },
    );

    return {
      balance: nextBalance,
      refundedAmount: amount,
      moverDeduction,
      moverBalance,
    };
  }
}
