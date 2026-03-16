-- CreateTable
CREATE TABLE "OnboardingCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "OnboardingCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingCompletion_userId_key" ON "OnboardingCompletion"("userId");

-- AddForeignKey
ALTER TABLE "OnboardingCompletion" ADD CONSTRAINT "OnboardingCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
