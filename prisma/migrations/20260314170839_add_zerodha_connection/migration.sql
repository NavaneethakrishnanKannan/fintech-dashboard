-- CreateTable
CREATE TABLE "ZerodhaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "kiteUserId" TEXT,
    "userName" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZerodhaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZerodhaConnection_userId_key" ON "ZerodhaConnection"("userId");

-- AddForeignKey
ALTER TABLE "ZerodhaConnection" ADD CONSTRAINT "ZerodhaConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
