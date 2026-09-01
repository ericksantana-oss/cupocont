-- Saude da conexao com o Meta, conferida pelo cron diario via /debug_token.
--
-- O token de Pagina nao expira (o debug_token devolve expires_at = 0), mas o acesso
-- aos dados vence 90 dias depois da autorizacao. Quando vence, as consultas falham em
-- silencio e o cron para de congelar os meses -- e mes nao congelado nao volta.
--
-- Colunas aditivas: tokenValid entra como true e as demais nulas, entao as contas ja
-- conectadas continuam funcionando ate o cron rodar e preencher os prazos reais.
ALTER TABLE "instagram_accounts"
  ADD COLUMN "tokenValid" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tokenCheckedAt" TIMESTAMP(3),
  ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "tokenDataAccessExpiresAt" TIMESTAMP(3),
  ADD COLUMN "tokenError" TEXT;
