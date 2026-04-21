/*
  Warnings:

  - A unique constraint covering the columns `[email,type,code]` on the table `VerificationCode` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "VerificationCode_email_type_key";

-- CreateIndex
CREATE INDEX "CartItem_skuId_idx" ON "CartItem"("skuId");

-- CreateIndex
CREATE INDEX "Order_userId_deletedAt_idx" ON "Order"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentId_idx" ON "Order"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Product_brandId_deletedAt_idx" ON "Product"("brandId", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_publishedAt_deletedAt_idx" ON "Product"("publishedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_basePrice_idx" ON "Product"("basePrice");

-- CreateIndex
CREATE INDEX "Product_createdById_deletedAt_idx" ON "Product"("createdById", "deletedAt");

-- CreateIndex
CREATE INDEX "Review_productId_createdAt_idx" ON "Review"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "SKU_stock_deletedAt_idx" ON "SKU"("stock", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCode_email_type_code_key" ON "VerificationCode"("email", "type", "code");
