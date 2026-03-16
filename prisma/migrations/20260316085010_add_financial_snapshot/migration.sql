-- CreateTable
CREATE TABLE "FinancialSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedExpensesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedVariableExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInvestments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLoans" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "primaryGoal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FinancialSnapshot" ADD CONSTRAINT "FinancialSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
