CREATE TABLE "EmailJob" (
  "id" UUID NOT NULL,
  "tokenId" UUID NOT NULL,
  "tokenCiphertext" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailJob_tokenId_key" ON "EmailJob"("tokenId");
CREATE INDEX "EmailJob_availableAt_attempts_idx" ON "EmailJob"("availableAt", "attempts");
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ActionToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
