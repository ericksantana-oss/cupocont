-- Stories da peca: ["texto 1", "texto 2", ...] na ordem.
--
-- Nasce como copia do texto da arte (um story por card do carrossel, ou um so no card
-- unico) e depois e editavel e apagavel a mao. Fica no texto gerado, e nao em tabela
-- propria, porque pertence a ESTA versao: gerar nova versao refaz a arte e os stories
-- precisam acompanhar.
--
-- Aditiva e nula: textos ja existentes ficam sem stories e ganham o botao de gerar a
-- partir da arte na tela, sem precisar de backfill.
ALTER TABLE "generated_texts" ADD COLUMN "stories" JSONB;
