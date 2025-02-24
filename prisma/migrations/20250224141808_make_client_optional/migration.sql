-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_clientId_fkey`;

-- DropIndex
DROP INDEX `Payment_clientId_fkey` ON `payment`;

-- AlterTable
ALTER TABLE `payment` MODIFY `clientId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
