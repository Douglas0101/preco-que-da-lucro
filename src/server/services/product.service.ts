import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import {
  productRepository,
  type ProductQuery,
  type ProductRepository,
  type ProductWrite,
} from "@/server/repositories/product.repository";
import type { Product } from "@/db/schema";

export interface ProductService {
  list(context: RequestContext, query?: ProductQuery): Promise<Product[]>;
  findById(context: RequestContext, id: string): Promise<Product | null>;
  save(context: RequestContext, input: ProductWrite): Promise<Product>;
  archive(context: RequestContext, id: string): Promise<void>;
}

export class DefaultProductService implements ProductService {
  constructor(private readonly repository: ProductRepository) {}

  list(context: RequestContext, query?: ProductQuery): Promise<Product[]> {
    return this.repository.list(context, query);
  }

  findById(context: RequestContext, id: string): Promise<Product | null> {
    return this.repository.findById(context, id);
  }

  async save(context: RequestContext, input: ProductWrite): Promise<Product> {
    assertTenantMutationAuthorized(context);
    return this.repository.save(context, input);
  }

  async archive(context: RequestContext, id: string): Promise<void> {
    assertTenantMutationAuthorized(context);
    await this.repository.archive(context, id);
  }
}

export const productService: ProductService = new DefaultProductService(productRepository);
