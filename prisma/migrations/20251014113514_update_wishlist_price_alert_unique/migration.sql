/*
  Warnings:

  - A unique constraint covering the columns `[wishlistItemId]` on the table `WishlistPriceAlert` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."WishlistPriceAlert_wishlistItemId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "WishlistPriceAlert_wishlistItemId_key" ON "public"."WishlistPriceAlert"("wishlistItemId");
