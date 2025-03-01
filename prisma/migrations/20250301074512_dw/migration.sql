-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_postId_fkey`;

-- DropIndex
DROP INDEX `Payment_postId_fkey` ON `payment`;

-- AlterTable
ALTER TABLE `payment` MODIFY `postId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
