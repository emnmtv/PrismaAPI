/*
  Warnings:

  - Made the column `clientId` on table `payment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_clientId_fkey`;

-- DropIndex
DROP INDEX `Payment_clientId_fkey` ON `payment`;

-- AlterTable
ALTER TABLE `payment` MODIFY `clientId` INTEGER NOT NULL;
