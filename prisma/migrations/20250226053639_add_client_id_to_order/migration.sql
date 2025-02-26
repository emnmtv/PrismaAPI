/*
  Warnings:

  - You are about to drop the `order` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_paymentId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_userId_fkey`;

-- AlterTable
ALTER TABLE `payment` ADD COLUMN `orderStatus` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `order`;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
