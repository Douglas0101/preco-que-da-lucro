ALTER TABLE "chat_conversations" DROP CONSTRAINT "chat_conversations_tenant_id_current_product_id_products_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "simulations" DROP CONSTRAINT "simulations_tenant_id_product_id_products_tenant_id_id_fk";
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_tenant_id_current_product_id_products_tenant_id_id_fk" FOREIGN KEY ("tenant_id","current_product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_tenant_id_product_id_products_tenant_id_id_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_identity_check" CHECK ("profiles"."id" = "profiles"."user_id");