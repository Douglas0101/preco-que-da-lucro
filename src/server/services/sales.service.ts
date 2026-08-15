import Decimal from "decimal.js";
import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import { toDecimalString } from "@/lib/financial-values";
import {
  salesRepository,
  type SalesRepository,
  type SaleWrite,
} from "@/server/repositories/sales.repository";

export interface SaleDraft {
  occurredAt: Date;
  channel: string;
  netAmount?: string;
  items: ReadonlyArray<{
    productId: string;
    quantity: string;
    unitPrice: string;
  }>;
}

export interface SalesService {
  create(context: RequestContext, input: SaleDraft): ReturnType<SalesRepository["create"]>;
  revenue(context: RequestContext, range?: { from?: Date; to?: Date }): Promise<string>;
}

export class DefaultSalesService implements SalesService {
  constructor(private readonly repository: SalesRepository) {}

  async create(context: RequestContext, input: SaleDraft) {
    assertTenantMutationAuthorized(context);
    if (!input.items.length) throw new Error("SALE_REQUIRES_ITEM");

    let gross = new Decimal(0);
    const items = input.items.map((item) => {
      const quantity = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice);
      if (!quantity.isFinite() || quantity.lte(0)) throw new Error("INVALID_SALE_QUANTITY");
      if (!unitPrice.isFinite() || unitPrice.lt(0)) throw new Error("INVALID_SALE_PRICE");
      const totalAmount = quantity.mul(unitPrice);
      gross = gross.plus(totalAmount);
      return {
        productId: item.productId,
        quantity: toDecimalString(quantity, 6),
        unitPrice: toDecimalString(unitPrice, 4),
        totalAmount: toDecimalString(totalAmount, 4),
      };
    });

    const grossAmount = toDecimalString(gross, 4);
    const netAmount = toDecimalString(input.netAmount ?? grossAmount, 4);
    if (new Decimal(netAmount).lt(0)) throw new Error("INVALID_SALE_NET_AMOUNT");

    const write: SaleWrite = {
      occurredAt: input.occurredAt,
      channel: input.channel,
      grossAmount,
      netAmount,
      items,
    };
    return this.repository.create(context, write);
  }

  revenue(context: RequestContext, range?: { from?: Date; to?: Date }) {
    return this.repository.revenue(context, range);
  }
}

export const salesService: SalesService = new DefaultSalesService(salesRepository);
