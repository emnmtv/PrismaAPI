-- AlterTable
ALTER TABLE `payment` ADD COLUMN `orderStatus` VARCHAR(191) NOT NULL DEFAULT 'pending';

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
