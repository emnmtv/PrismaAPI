/*
  Warnings:

  - A unique constraint covering the columns `[referenceNumber]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Payment_referenceNumber_key` ON `Payment`(`referenceNumber`);
