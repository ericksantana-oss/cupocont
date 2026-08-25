-- Dobra o conteúdo dos campos que saem para dentro de "goals", que passa a ser o
-- briefing inteiro em texto livre. concat_ws ignora NULL, então briefing sem esses
-- campos preenchidos fica intacto.
UPDATE "briefings" SET "goals" = concat_ws(
  E'\n\n',
  "goals",
  CASE WHEN btrim(coalesce("campaigns", '')) <> '' THEN 'Campanhas: ' || "campaigns" END,
  CASE WHEN btrim(coalesce("highlights", '')) <> '' THEN 'Destaques: ' || "highlights" END,
  CASE WHEN btrim(coalesce("restrictions", '')) <> '' THEN 'Restrições: ' || "restrictions" END
);

-- AlterTable
ALTER TABLE "briefings" DROP COLUMN "campaigns",
DROP COLUMN "highlights",
DROP COLUMN "restrictions";
