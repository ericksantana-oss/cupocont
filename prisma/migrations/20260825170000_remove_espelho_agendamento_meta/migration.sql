-- Remove o cache do espelhamento de agendamentos do Meta. O Business Suite não expõe
-- sua fila de agendamento por API, então essas colunas só guardavam ausência de dado —
-- e alimentavam um alerta que dizia "sem posts agendados" para todo cliente, sempre.
ALTER TABLE "instagram_accounts" DROP COLUMN "facebookScheduledUntil",
DROP COLUMN "facebookScheduledCount",
DROP COLUMN "facebookScheduleCheckedAt";
