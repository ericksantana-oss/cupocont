-- Terceiro veredito: aprovado COM AJUSTE pedido pelo cliente.
--
-- E o caso mais comum na pratica: o cliente aceita o post mas manda mexer em algo. Agenda
-- normalmente, como aprovado; o que muda e o peso do comentario, que passa a ser correcao
-- pedida em vez de observacao solta.
ALTER TYPE "ClientVerdict" ADD VALUE IF NOT EXISTS 'ADJUSTED';
