import { and, desc, eq } from "drizzle-orm";
import { purchasePriceHistory, type PurchasePriceHistory } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export type PurchasePriceKind = "ingredient" | "packaging";

export interface PurchasePriceHistoryWrite {
  kind: PurchasePriceKind;
  subjectId: string;
  price: string;
  quantity: string;
  unit: string;
  validFrom: Date;
  supplierId?: string | null;
}

export interface PurchasePriceRepository {
  append(context: RequestContext, input: PurchasePriceHistoryWrite): Promise<PurchasePriceHistory>;
}

function sameEffectiveValue(
  row: PurchasePriceHistory | undefined,
  input: PurchasePriceHistoryWrite,
): boolean {
  return (
    row?.price === input.price &&
    row.quantity === input.quantity &&
    row.unit === input.unit &&
    (row.supplierId ?? null) === (input.supplierId ?? null)
  );
}

export class DrizzlePurchasePriceRepository implements PurchasePriceRepository {
  async append(context: RequestContext, input: PurchasePriceHistoryWrite) {
    const targetPredicate =
      input.kind === "ingredient"
        ? and(
            eq(purchasePriceHistory.tenantId, context.tenantId),
            eq(purchasePriceHistory.ingredientId, input.subjectId),
          )
        : and(
            eq(purchasePriceHistory.tenantId, context.tenantId),
            eq(purchasePriceHistory.packagingId, input.subjectId),
          );
    const latestRows = await context.transaction
      .select()
      .from(purchasePriceHistory)
      .where(targetPredicate)
      .orderBy(desc(purchasePriceHistory.validFrom), desc(purchasePriceHistory.recordedAt))
      .limit(1);
    const latest = latestRows[0];
    if (sameEffectiveValue(latest, input)) return latest;

    const [row] = await context.transaction
      .insert(purchasePriceHistory)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        subjectType: input.kind,
        subjectId: input.subjectId,
        ingredientId: input.kind === "ingredient" ? input.subjectId : null,
        packagingId: input.kind === "packaging" ? input.subjectId : null,
        price: input.price,
        quantity: input.quantity,
        unit: input.unit,
        supplierId: input.supplierId ?? null,
        validFrom: input.validFrom,
        recordedAt: input.validFrom,
      })
      .returning();
    if (!row) throw new Error("DATABASE_ERROR");
    return row;
  }
}

export const purchasePriceRepository: PurchasePriceRepository =
  new DrizzlePurchasePriceRepository();
