/*
  Warnings:

  - A unique constraint covering the columns `[productId,languageId]` on the table `ProductTranslation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProductTranslation" ADD COLUMN     "highlights" JSONB,
ADD COLUMN     "seoDescription" VARCHAR(500),
ADD COLUMN     "seoTitle" VARCHAR(255);

-- CreateTable
CREATE TABLE "ProductSpecGroup" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecGroupTranslation" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "languageId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,

    CONSTRAINT "ProductSpecGroupTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpec" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSpecTranslation" (
    "id" SERIAL NOT NULL,
    "specId" INTEGER NOT NULL,
    "languageId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProductSpecTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecGroup_productId_idx" ON "ProductSpecGroup"("productId");

-- CreateIndex
CREATE INDEX "ProductSpecGroup_deletedAt_idx" ON "ProductSpecGroup"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecGroup_productId_key_key" ON "ProductSpecGroup"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecGroupTranslation_groupId_languageId_key" ON "ProductSpecGroupTranslation"("groupId", "languageId");

-- CreateIndex
CREATE INDEX "ProductSpec_groupId_idx" ON "ProductSpec"("groupId");

-- CreateIndex
CREATE INDEX "ProductSpec_deletedAt_idx" ON "ProductSpec"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpec_groupId_key_key" ON "ProductSpec"("groupId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecTranslation_specId_languageId_key" ON "ProductSpecTranslation"("specId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_productId_languageId_key" ON "ProductTranslation"("productId", "languageId");

-- AddForeignKey
ALTER TABLE "ProductSpecGroup" ADD CONSTRAINT "ProductSpecGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecGroupTranslation" ADD CONSTRAINT "ProductSpecGroupTranslation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductSpecGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecGroupTranslation" ADD CONSTRAINT "ProductSpecGroupTranslation_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpec" ADD CONSTRAINT "ProductSpec_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductSpecGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecTranslation" ADD CONSTRAINT "ProductSpecTranslation_specId_fkey" FOREIGN KEY ("specId") REFERENCES "ProductSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecTranslation" ADD CONSTRAINT "ProductSpecTranslation_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
