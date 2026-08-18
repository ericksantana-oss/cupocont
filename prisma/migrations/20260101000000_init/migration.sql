-- Extensão necessária para armazenar e buscar embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WRITER');
CREATE TYPE "DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
CREATE TYPE "ThemeStatus" AS ENUM ('SUGGESTED', 'SELECTED', 'DISCARDED');
CREATE TYPE "TextStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WRITER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    CONSTRAINT "client_access_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_access_userId_clientId_key" ON "client_access"("userId", "clientId");
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_access" ADD CONSTRAINT "client_access_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "originalPath" TEXT,
    "sourceUrl" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable (embedding usa o tipo vector do pgvector, dimensão do text-embedding-3-small)
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunkIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "document_chunks_clientId_idx" ON "document_chunks"("clientId");
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "client_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Índice de busca por similaridade (cosine) — HNSW é o recomendado no pgvector >= 0.5
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- CreateTable
CREATE TABLE "keyword_reports" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "keyword_reports_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "keyword_reports" ADD CONSTRAINT "keyword_reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "briefings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "campaigns" TEXT,
    "keyDates" TEXT,
    "highlights" TEXT,
    "restrictions" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "briefings_clientId_period_key" ON "briefings"("clientId", "period");
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "content_themes" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "ThemeStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_themes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "content_themes" ADD CONSTRAINT "content_themes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_themes" ADD CONSTRAINT "content_themes_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "generated_texts" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "status" "TextStatus" NOT NULL DEFAULT 'DRAFT',
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_texts_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "generated_texts" ADD CONSTRAINT "generated_texts_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "content_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_texts" ADD CONSTRAINT "generated_texts_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
