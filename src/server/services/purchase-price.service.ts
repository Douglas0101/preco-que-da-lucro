import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { productIngredients, productPackaging } from "@/db/schema";
import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import { toDecimalString } from "@/lib/financial-values";
import {
  purchasePriceRepository,
  type PurchasePriceHistoryWrite,
  type PurchasePriceKind,
  type PurchasePriceRepository,
} from "@/server/repositories/purchase-price.repository";

export interface PurchasePriceUpdate {
  kind: PurchasePriceKind;
  subjectId: string;
  price: string;
  quantity: string;
  unit: string;
}

export interface PurchasePriceUpdateResult {
  id: string;
  packagePrice: string;
  priceUpdatedAt: Date;
  historyId: string;
}

export interface PurchasePriceService {
  append(context: RequestContext, input: PurchasePriceHistoryWrite): Promise<{ id: string }>;
  update(context: RequestContext, input: PurchasePriceUpdate): Promise<PurchasePriceUpdateResult>;
}

function validateMetadata(input: Pick<PurchasePriceHistoryWrite, "quantity" | "unit">): string {
  let quantity: Decimal;
  try {
    quantity = new Decimal(input.quantity);
  } catch {
    throw new Error("INVALID_PRICE_QUANTITY");
  }
  if (!quantity.isFinite() || quantity.lte(0)) throw new Error("INVALID_PRICE_QUANTITY");
  const unit = input.unit.trim();
  if (!unit) throw new Error("INVALID_PRICE_UNIT");
  return unit;
}

function normalizedPriceInput(input: PurchasePriceHistoryWrite): PurchasePriceHistoryWrite {
  const unit = validateMetadata(input);
  const price = new Decimal(input.price);
  if (!price.isFinite() || price.lt(0)) throw new Error("INVALID_PRICE");
  return {
    ...input,
    price: toDecimalString(price, 4),
    quantity: toDecimalString(new Decimal(input.quantity), 6),
    unit,
  };
}

export class DefaultPurchasePriceService implements PurchasePriceService {
  constructor(private readonly repository: PurchasePriceRepository) {}

  async append(context: RequestContext, input: PurchasePriceHistoryWrite) {
    assertTenantMutationAuthorized(context);
    const row = await this.repository.append(context, normalizedPriceInput(input));
    return { id: row.id };
  }

  async update(context: RequestContext, input: PurchasePriceUpdate) {
    assertTenantMutationAuthorized(context);
    const normalized = normalizedPriceInput({
      ...input,
      validFrom: new Date(),
    });
    const now = normalized.validFrom;

    if (input.kind === "ingredient") {
      const rows = await context.transaction
        .update(productIngredients)
        .set({
          packagePrice: normalized.price,
          packageQty: normalized.quantity,
          packageUnit: normalized.unit,
          priceUpdatedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(productIngredients.tenantId, context.tenantId),
            eq(productIngredients.id, input.subjectId),
          ),
        )
        .returning({
          id: productIngredients.id,
          packagePrice: productIngredients.packagePrice,
          priceUpdatedAt: productIngredients.priceUpdatedAt,
        });
      const row = rows[0];
      if (!row) throw new Error("NOT_FOUND");
      const history = await this.repository.append(context, {
        ...normalized,
        kind: "ingredient",
        subjectId: row.id,
      });
      return {
        id: row.id,
        packagePrice: row.packagePrice ?? normalized.price,
        priceUpdatedAt: row.priceUpdatedAt ?? now,
        historyId: history.id,
      };
    }

    if (normalized.unit !== "unidade") throw new Error("INVALID_PRICE_UNIT");
    const rows = await context.transaction
      .update(productPackaging)
      .set({
        packagePrice: normalized.price,
        unitsPerPackage: normalized.quantity,
        priceUpdatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(productPackaging.tenantId, context.tenantId),
          eq(productPackaging.id, input.subjectId),
        ),
      )
      .returning({
        id: productPackaging.id,
        packagePrice: productPackaging.packagePrice,
        priceUpdatedAt: productPackaging.priceUpdatedAt,
      });
    const row = rows[0];
    if (!row) throw new Error("NOT_FOUND");
    const history = await this.repository.append(context, {
      ...normalized,
      kind: "packaging",
      subjectId: row.id,
    });
    return {
      id: row.id,
      packagePrice: row.packagePrice,
      priceUpdatedAt: row.priceUpdatedAt ?? now,
      historyId: history.id,
    };
  }
}

export const purchasePriceService: PurchasePriceService = new DefaultPurchasePriceService(
  purchasePriceRepository,
);
