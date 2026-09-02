import { MESES, parsePeriod } from "@/lib/periodo";

// Nomenclatura das demandas e dos posts.
//
// Os títulos são DERIVADOS, nunca guardados no banco. Se a sigla do cliente mudar, os
// títulos antigos acompanham; guardar o texto montado deixaria demandas velhas com a
// sigla errada e ninguém saberia de onde veio.
//
// Formato acordado com a operação:
//   demanda  ETM | 92857 | Redes Sociais Setembro
//   post     ETM | 92857 | Post 1 - Tema do post

const SEPARADOR = " | ";

// Quando a sigla ainda não foi preenchida, aparece assim em vez de sumir do título: um
// buraco visível é melhor que um título que parece certo e não é.
const SIGLA_AUSENTE = "???";

export const SIGLA_MIN = 2;
export const SIGLA_MAX = 5;

export interface DadosDaDemanda {
  acronym: string | null;
  taskNumber: string;
  period: string;
}

export function nomeDoMes(period: string): string {
  const { month } = parsePeriod(period);
  return MESES[month - 1] ?? period;
}

export function tituloDaDemanda({ acronym, taskNumber, period }: DadosDaDemanda): string {
  return [acronym ?? SIGLA_AUSENTE, taskNumber, `Redes Sociais ${nomeDoMes(period)}`].join(SEPARADOR);
}

// O número do post vem do banco (postIndex), congelado no momento em que a produção foi
// finalizada. Um tema ainda sem número aparece sem "Post N" em vez de receber um número
// provisório, que seria pior: alguém poderia escrevê-lo no Meta e ele mudaria depois.
export function tituloDoPost(
  demanda: Pick<DadosDaDemanda, "acronym" | "taskNumber">,
  post: { postIndex: number | null; title: string }
): string {
  const prefixo = [demanda.acronym ?? SIGLA_AUSENTE, demanda.taskNumber].join(SEPARADOR);
  const nome = post.postIndex === null ? post.title : `Post ${post.postIndex} - ${post.title}`;
  return `${prefixo}${SEPARADOR}${nome}`;
}

// Normaliza a sigla digitada: maiúsculas, sem acento, só letras e números.
// "etm" e "Etm " chegam iguais ao banco, senão a unicidade não valeria nada.
export function normalizarSigla(bruta: string): string {
  return bruta
    // NFD separa o acento da letra ("Ç" vira "C" + cedilha) e o filtro seguinte
    // descarta o acento junto com o resto: não precisa de uma faixa de diacríticos.
    .normalize("NFD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function validarSigla(bruta: string): { ok: true; sigla: string } | { ok: false; erro: string } {
  const sigla = normalizarSigla(bruta);
  if (sigla.length < SIGLA_MIN || sigla.length > SIGLA_MAX) {
    return { ok: false, erro: `A sigla precisa ter de ${SIGLA_MIN} a ${SIGLA_MAX} letras ou números.` };
  }
  return { ok: true, sigla };
}

// O nº da tarefa vem de uma ferramenta externa, então é tratado como texto: pode ter
// zero à esquerda ou prefixo, e nada aqui faz conta com ele.
export function validarNumeroDaTarefa(bruto: string): { ok: true; numero: string } | { ok: false; erro: string } {
  const numero = bruto.trim();
  if (!numero) return { ok: false, erro: "Informe o número da tarefa." };
  if (numero.length > 30) return { ok: false, erro: "Número da tarefa longo demais." };
  return { ok: true, numero };
}
