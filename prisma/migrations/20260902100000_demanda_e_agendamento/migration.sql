-- Sigla do cliente, demanda do mes e registro manual de agendamento.

-- 1) Sigla. Entra como nula para nao quebrar os clientes existentes, e recebe um valor
-- derivado das 3 primeiras letras do nome logo abaixo. E um ponto de partida editavel,
-- nao um palpite definitivo: quem cadastra confere na tela de edicao.
ALTER TABLE "clients" ADD COLUMN "acronym" TEXT;

UPDATE "clients" SET "acronym" = UPPER(LEFT(REGEXP_REPLACE("name", '[^A-Za-z]', '', 'g'), 3))
WHERE "acronym" IS NULL
  AND LENGTH(REGEXP_REPLACE("name", '[^A-Za-z]', '', 'g')) >= 3;

-- Se duas siglas derivadas colidirem, a segunda fica nula em vez de a migration falhar:
-- melhor pedir para alguem escolher do que travar o deploy.
UPDATE "clients" c SET "acronym" = NULL
WHERE EXISTS (
  SELECT 1 FROM "clients" o
  WHERE o."acronym" = c."acronym" AND o."id" <> c."id" AND o."createdAt" < c."createdAt"
);

CREATE UNIQUE INDEX "clients_acronym_key" ON "clients"("acronym");

-- 2) Numero do post dentro da demanda. Congelado ao finalizar a producao.
ALTER TABLE "content_themes" ADD COLUMN "postIndex" INTEGER;

-- 3) A demanda: o mes como registro proprio, porque o nº da tarefa e pedido ao ABRIR
-- o mes, antes de existir briefing.
CREATE TABLE "content_demands" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "taskNumber" TEXT NOT NULL,
  "productionClosedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_demands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_demands_clientId_period_key" ON "content_demands"("clientId", "period");

ALTER TABLE "content_demands" ADD CONSTRAINT "content_demands_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_demands" ADD CONSTRAINT "content_demands_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "content_demands" ADD CONSTRAINT "content_demands_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Registro manual do agendamento feito no Business Suite. Nao publica nada.
CREATE TABLE "post_schedules" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "demandId" TEXT NOT NULL,
  "themeId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "registeredById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "post_schedules_pkey" PRIMARY KEY ("id")
);

-- Um dia por post: arrastar move o registro em vez de duplicar.
CREATE UNIQUE INDEX "post_schedules_themeId_key" ON "post_schedules"("themeId");
CREATE INDEX "post_schedules_clientId_scheduledFor_idx" ON "post_schedules"("clientId", "scheduledFor");
CREATE INDEX "post_schedules_scheduledFor_idx" ON "post_schedules"("scheduledFor");

ALTER TABLE "post_schedules" ADD CONSTRAINT "post_schedules_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_schedules" ADD CONSTRAINT "post_schedules_demandId_fkey"
  FOREIGN KEY ("demandId") REFERENCES "content_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_schedules" ADD CONSTRAINT "post_schedules_themeId_fkey"
  FOREIGN KEY ("themeId") REFERENCES "content_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_schedules" ADD CONSTRAINT "post_schedules_registeredById_fkey"
  FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Acoes novas na trilha de atividade. Os timestamps daqui sao o que permite medir
-- depois quanto tempo cada etapa levou, sem pedir para ninguem apontar hora.
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DEMAND_OPENED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PRODUCTION_CLOSED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'POST_SCHEDULED';
