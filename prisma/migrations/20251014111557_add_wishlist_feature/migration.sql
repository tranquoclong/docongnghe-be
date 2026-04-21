-- CreateTable
CREATE TABLE "public"."WishlistItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "skuId" INTEGER,
    "note" VARCHAR(500),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notifyOnPriceDrops" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBackInStock" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPromotion" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WishlistCollection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareCode" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WishlistCollectionItem" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "wishlistItemId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WishlistPriceAlert" (
    "id" SERIAL NOT NULL,
    "wishlistItemId" INTEGER NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertSentAt" TIMESTAMP(3),

    CONSTRAINT "WishlistPriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_userId_addedAt_idx" ON "public"."WishlistItem"("userId", "addedAt");

-- CreateIndex
CREATE INDEX "WishlistItem_productId_idx" ON "public"."WishlistItem"("productId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_priority_idx" ON "public"."WishlistItem"("userId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_skuId_key" ON "public"."WishlistItem"("userId", "productId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistCollection_shareCode_key" ON "public"."WishlistCollection"("shareCode");

-- CreateIndex
CREATE INDEX "WishlistCollection_userId_idx" ON "public"."WishlistCollection"("userId");

-- CreateIndex
CREATE INDEX "WishlistCollection_shareCode_idx" ON "public"."WishlistCollection"("shareCode");

-- CreateIndex
CREATE INDEX "WishlistCollectionItem_collectionId_idx" ON "public"."WishlistCollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "WishlistCollectionItem_wishlistItemId_idx" ON "public"."WishlistCollectionItem"("wishlistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistCollectionItem_collectionId_wishlistItemId_key" ON "public"."WishlistCollectionItem"("collectionId", "wishlistItemId");

-- CreateIndex
CREATE INDEX "WishlistPriceAlert_wishlistItemId_idx" ON "public"."WishlistPriceAlert"("wishlistItemId");

-- CreateIndex
CREATE INDEX "WishlistPriceAlert_lastCheckedAt_idx" ON "public"."WishlistPriceAlert"("lastCheckedAt");

-- AddForeignKey
ALTER TABLE "public"."WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistItem" ADD CONSTRAINT "WishlistItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "public"."SKU"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistCollection" ADD CONSTRAINT "WishlistCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistCollectionItem" ADD CONSTRAINT "WishlistCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."WishlistCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistCollectionItem" ADD CONSTRAINT "WishlistCollectionItem_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "public"."WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WishlistPriceAlert" ADD CONSTRAINT "WishlistPriceAlert_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "public"."WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
