const fs = require("fs");
const f = "src/lib/ai/llm.ts";
let s = fs.readFileSync(f, "utf8");

const trocas = [
  [
    `// gemini-3.6-flash e o que o proprio Google indica como atual (o 2.5 responde 404
// apontando pra ele). Evitar "gemini-3.7-flash" e "gemini-flash-latest": ambos aparecem
// na listagem de modelos mas penduram sem responder nem dar erro — testado em 20/08/2026.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";`,
    `// Cuidado ao trocar de modelo — testado em 25/08/2026 nesta chave:
//   gemini-3.7-flash e gemini-flash-latest: aparecem na listagem mas PENDURAM, sem
//     responder nem dar erro.
//   gemini-2.5-flash: 404 para chaves novas.
//   gemini-3.6-flash: funciona, mas a cota gratuita é de apenas 20 chamadas por DIA,
//     o que não cobre nem um mês de um cliente (24 chamadas).
// Modelos com cota gratuita maior costumam ser os de geração anterior e os "lite".
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";`,
  ],
  [
    `function ehErroTemporario(mensagem: string): boolean {
  // 429 = estourou o limite de chamadas por minuto (comum no plano gratuito, que
  // permite poucas por minuto); 5xx = instabilidade do lado do Google.
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit|abort/i.test(mensagem);
}`,
    `// A cota diária esgotada não melhora com espera: insistir só queima mais de um minuto
// antes de falhar igual. Vale distinguir para avisar o redator do que está acontecendo.
function ehCotaDiariaEsgotada(mensagem: string): boolean {
  return /PerDay|RequestsPerDay|per day|quota_limit_value.*\bday\b/i.test(mensagem);
}

function ehErroTemporario(mensagem: string): boolean {
  if (ehCotaDiariaEsgotada(mensagem)) return false;
  // 429 por minuto = janela vira em segundos, vale esperar; 5xx = instabilidade do Google.
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit|abort/i.test(mensagem);
}

// Traduz o erro cru da API para algo que o redator entenda e saiba o que fazer.
function mensagemParaOUsuario(bruto: string): string {
  if (ehCotaDiariaEsgotada(bruto)) {
    return "A cota diária gratuita da IA acabou. Ela é renovada no dia seguinte — ou o plano pago do Gemini remove esse limite.";
  }
  if (/\b429\b|RESOURCE_EXHAUSTED|rate limit/i.test(bruto)) {
    return "A IA recusou por limite de chamadas por minuto. Espere um minuto e tente de novo.";
  }
  if (/abort/i.test(bruto)) {
    return "A IA não respondeu no tempo esperado. Tente de novo.";
  }
  return \`Falha ao gerar conteúdo com a IA: \${bruto}\`;
}`,
  ],
  [
    `  const mensagem = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
  throw new Error(\`Falha ao gerar conteúdo com a IA: \${mensagem}\`);`,
    `  const mensagem = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
  throw new Error(mensagemParaOUsuario(mensagem));`,
  ],
];

for (const [de, para] of trocas) {
  if (!s.includes(de)) { console.error("FALHA em: " + de.slice(0, 60).replace(/\n/g, " ")); process.exit(1); }
  s = s.split(de).join(para);
}
fs.writeFileSync(f, s);
console.log("llm.ts: 3 trocas aplicadas");
