-- AlterTable
ALTER TABLE `creatorprofile` ADD COLUMN `rejectionReason` VARCHAR(191) NULL,
    ADD COLUMN `validIdDocument` VARCHAR(191) NULL,
    ADD COLUMN `verificationReason` VARCHAR(191) NULL,
    ADD COLUMN `verificationRequested` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `verificationRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `verificationReviewedAt` DATETIME(3) NULL,
    ADD COLUMN `verificationReviewedBy` INTEGER NULL;
