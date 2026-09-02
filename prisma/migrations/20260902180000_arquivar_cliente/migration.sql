-- Arquivar cliente em vez de excluir.
--
-- Excluir um cliente apaga em cascata os meses de metricas congeladas, que o Meta ja
-- descartou da API e nao devolve nem reconectando. Arquivar tira da operacao e preserva.
ALTER TABLE "clients" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "clients_archivedAt_idx" ON "clients"("archivedAt");
