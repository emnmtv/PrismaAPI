-- AlterTable
ALTER TABLE `creatorprofile` ADD COLUMN `creatorLevel` VARCHAR(191) NOT NULL DEFAULT 'Beginner',
    ADD COLUMN `isVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `portfolioFile` VARCHAR(191) NULL,
    ADD COLUMN `resumeFile` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `SocialMediaLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creatorProfileId` INTEGER NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SocialMediaLink_creatorProfileId_platform_key`(`creatorProfileId`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SocialMediaLink` ADD CONSTRAINT `SocialMediaLink_creatorProfileId_fkey` FOREIGN KEY (`creatorProfileId`) REFERENCES `CreatorProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
