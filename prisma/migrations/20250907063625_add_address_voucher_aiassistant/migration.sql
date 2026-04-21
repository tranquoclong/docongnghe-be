-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIKnowledgeType" AS ENUM ('PRODUCT', 'FAQ', 'POLICY', 'GUIDE', 'PROMOTION', 'CATEGORY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "addressId" INTEGER,
ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "voucherId" INTEGER;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "helpfulCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sellerId" INTEGER,
ADD COLUMN     "sellerResponse" TEXT,
ADD COLUMN     "sellerResponseAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "provinceId" VARCHAR(50) NOT NULL,
    "provinceName" VARCHAR(500) NOT NULL,
    "districtId" VARCHAR(50) NOT NULL,
    "districtName" VARCHAR(500) NOT NULL,
    "wardId" VARCHAR(50) NOT NULL,
    "wardName" VARCHAR(500) NOT NULL,
    "detail" VARCHAR(500) NOT NULL,
    "fullAddress" VARCHAR(1000) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "type" "VoucherType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minOrderValue" DOUBLE PRECISION,
    "maxDiscount" DOUBLE PRECISION,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "userUsageLimit" INTEGER DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sellerId" INTEGER,
    "applicableProducts" INTEGER[],
    "excludedProducts" INTEGER[],
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedById" INTEGER,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVoucher" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "voucherId" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" VARCHAR(500),
    "context" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "responseTime" INTEGER,
    "model" VARCHAR(100),
    "error" TEXT,
    "contextUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIKnowledge" (
    "id" TEXT NOT NULL,
    "type" "AIKnowledgeType" NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER,
    "categoryId" INTEGER,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "Address_isDefault_isActive_idx" ON "Address"("isDefault", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_code_idx" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_type_idx" ON "Voucher"("type");

-- CreateIndex
CREATE INDEX "Voucher_isActive_startDate_endDate_idx" ON "Voucher"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Voucher_sellerId_idx" ON "Voucher"("sellerId");

-- CreateIndex
CREATE INDEX "Voucher_deletedAt_idx" ON "Voucher"("deletedAt");

-- CreateIndex
CREATE INDEX "UserVoucher_userId_idx" ON "UserVoucher"("userId");

-- CreateIndex
CREATE INDEX "UserVoucher_voucherId_idx" ON "UserVoucher"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "UserVoucher_userId_voucherId_key" ON "UserVoucher"("userId", "voucherId");

-- CreateIndex
CREATE INDEX "AIConversation_userId_isActive_idx" ON "AIConversation"("userId", "isActive");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIMessage_role_idx" ON "AIMessage"("role");

-- CreateIndex
CREATE INDEX "AIKnowledge_type_isActive_idx" ON "AIKnowledge"("type", "isActive");

-- CreateIndex
CREATE INDEX "AIKnowledge_keywords_idx" ON "AIKnowledge"("keywords");

-- CreateIndex
CREATE INDEX "AIKnowledge_productId_idx" ON "AIKnowledge"("productId");

-- CreateIndex
CREATE INDEX "AIKnowledge_categoryId_idx" ON "AIKnowledge"("categoryId");

-- CreateIndex
CREATE INDEX "Order_addressId_idx" ON "Order"("addressId");

-- CreateIndex
CREATE INDEX "Order_voucherId_idx" ON "Order"("voucherId");

-- CreateIndex
CREATE INDEX "Review_isVerifiedPurchase_idx" ON "Review"("isVerifiedPurchase");

-- CreateIndex
CREATE INDEX "Review_sellerId_idx" ON "Review"("sellerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserVoucher" ADD CONSTRAINT "UserVoucher_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIKnowledge" ADD CONSTRAINT "AIKnowledge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIKnowledge" ADD CONSTRAINT "AIKnowledge_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIKnowledge" ADD CONSTRAINT "AIKnowledge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIKnowledge" ADD CONSTRAINT "AIKnowledge_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
