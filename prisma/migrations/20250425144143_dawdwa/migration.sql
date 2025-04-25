/*
  Warnings:

  - You are about to alter the column `creatorLevel` on the `creatorprofile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Double`.

*/
-- AlterTable
ALTER TABLE `creatorprofile` MODIFY `creatorLevel` DOUBLE NOT NULL DEFAULT 0.0;
