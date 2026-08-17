type ProductDetailLike = { product: { id: string } };

export function deriveProductSelection<T extends ProductDetailLike>(
  details: readonly T[],
  requestedProductId: string,
): {
  products: T["product"][];
  selectedProductId: string;
  selectedDetail: T | undefined;
} {
  const products: T["product"][] = details.map((detail) => detail.product);
  const selectedProductId =
    requestedProductId && products.some((product) => product.id === requestedProductId)
      ? requestedProductId
      : (products[0]?.id ?? "");
  const selectedDetail = details.find((detail) => detail.product.id === selectedProductId);

  return { products, selectedProductId, selectedDetail };
}
