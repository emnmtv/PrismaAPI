/*
  Warnings:

  - You are about to drop the column `postId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `comment` on the `rating` table. All the data in the column will be lost.
  - You are about to drop the column `creatorId` on the `rating` table. All the data in the column will be lost.
  - You are about to drop the column `orderId` on the `rating` table. All the data in the column will be lost.
  - You are about to drop the column `postId` on the `rating` table. All the data in the column will be lost.
  - You are about to alter the column `rating` on the `rating` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - A unique constraint covering the columns `[paymentId]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentId` to the `Rating` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_postId_fkey`;

-- DropForeignKey
ALTER TABLE `rating` DROP FOREIGN KEY `Rating_creatorId_fkey`;

-- DropForeignKey
ALTER TABLE `rating` DROP FOREIGN KEY `Rating_postId_fkey`;

-- DropIndex
DROP INDEX `Payment_postId_fkey` ON `payment`;

-- DropIndex
DROP INDEX `Rating_creatorId_fkey` ON `rating`;

-- DropIndex
DROP INDEX `Rating_postId_fkey` ON `rating`;

-- AlterTable
ALTER TABLE `payment` DROP COLUMN `postId`;

-- AlterTable
ALTER TABLE `rating` DROP COLUMN `comment`,
    DROP COLUMN `creatorId`,
    DROP COLUMN `orderId`,
    DROP COLUMN `postId`,
    ADD COLUMN `clientId` INTEGER NOT NULL,
    ADD COLUMN `paymentId` INTEGER NOT NULL,
    ADD COLUMN `review` VARCHAR(191) NULL,
    MODIFY `rating` DOUBLE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Rating_paymentId_key` ON `Rating`(`paymentId`);

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rating` ADD CONSTRAINT `Rating_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
