/*
  Warnings:

  - You are about to drop the column `orderStatus` on the `payment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_clientId_fkey`;

-- DropIndex
DROP INDEX `Payment_clientId_fkey` ON `payment`;

-- AlterTable
ALTER TABLE `payment` DROP COLUMN `orderStatus`;
