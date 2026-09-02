"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireClientAccess } from "@/lib/auth/guards";
import { logActivity } from "@/lib/activity";
import { validarNumeroDaTarefa } from "@/lib/demanda";
import { diaParaData } from "@/lib/agendamento";
import { contarPendenciasDeAprovacao } from "@/lib/contentDemand";

function revalidar(clientId: string) {
  revalidatePath("/agendamentos");
  revalidatePath(`/clients/${clientId}/agendamentos`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/conteudo`);
}

// Abrir o mês: cria a demanda com o nº da tarefa, ou atualiza o número se o mês já
// existia. Não mexe em nada do fluxo de conteúdo — briefing, temas e textos continuam
// nascendo como antes.
export async function abrirMesAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const period = String(formData.get("period") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("Período inválido.");

  const tarefa = validarNumeroDaTarefa(String(formData.get("taskNumber") ?? ""));
  if (!tarefa.ok) throw new Error(tarefa.erro);

  await db.contentDemand.upsert({
    where: { clientId_period: { clientId, period } },
    create: { clientId, period, taskNumber: tarefa.numero, createdById: user.id },
    // Reabrir o mês corrige o número se foi digitado errado. Não reabre a produção
    // finalizada: para isso existe reabrirProducaoAction.
    update: { taskNumber: tarefa.numero },
  });

  await logActivity({ clientId, userId: user.id, action: "DEMAND_OPENED", period, detail: tarefa.numero });
  revalidar(clientId);
}

// Finalizar a produção. É aqui que a numeração dos posts congela — e é por isso que
// existe um botão em vez de acontecer sozinho: o número é o nome que a pessoa vai
// escrever no Meta, e ele não pode mudar de lugar depois.
export async function finalizarProducaoAction(clientId: string, period: string) {
  const user = await requireClientAccess(clientId);

  const demanda = await db.contentDemand.findUnique({
    where: { clientId_period: { clientId, period } },
    select: { id: true, productionClosedAt: true },
  });
  if (!demanda) throw new Error("Abra o mês e informe o número da tarefa antes de finalizar.");
  if (demanda.productionClosedAt) return;

  const { selecionados, aprovados } = await contarPendenciasDeAprovacao(clientId, period);
  if (selecionados === 0) throw new Error("Nenhum post selecionado neste mês.");
  if (aprovados < selecionados) {
    throw new Error(`Faltam ${selecionados - aprovados} texto(s) para aprovar antes de finalizar.`);
  }

  const briefing = await db.briefing.findUnique({
    where: { clientId_period: { clientId, period } },
    select: {
      themes: {
        where: { status: "SELECTED" },
        orderBy: { createdAt: "asc" },
        select: { id: true, postIndex: true },
      },
    },
  });

  // Numera na ordem em que os temas foram criados. Tema que já tem número mantém o que
  // tem: se a produção for reaberta e finalizada de novo, o que já foi agendado não
  // muda de nome.
  const temas = briefing?.themes ?? [];
  const semNumero = temas.filter((t) => t.postIndex === null);
  const maiorUsado = Math.max(0, ...temas.map((t) => t.postIndex ?? 0));

  await db.$transaction([
    ...semNumero.map((tema, i) =>
      db.contentTheme.update({ where: { id: tema.id }, data: { postIndex: maiorUsado + i + 1 } })
    ),
    db.contentDemand.update({
      where: { id: demanda.id },
      data: { productionClosedAt: new Date(), closedById: user.id },
    }),
  ]);

  await logActivity({ clientId, userId: user.id, action: "PRODUCTION_CLOSED", period });
  revalidar(clientId);
}

// Reabrir a produção para incluir um post a mais. Os números já atribuídos ficam:
// renumerar quebraria o que já está agendado no Meta com o nome antigo.
export async function reabrirProducaoAction(clientId: string, period: string) {
  const user = await requireClientAccess(clientId);
  await db.contentDemand.update({
    where: { clientId_period: { clientId, period } },
    data: { productionClosedAt: null, closedById: null },
  });
  await logActivity({ clientId, userId: user.id, action: "DEMAND_OPENED", period, detail: "produção reaberta" });
  revalidar(clientId);
}

// Registra (ou move) o agendamento de um post para um dia. Um post ocupa um dia só,
// então arrastar move o registro em vez de criar outro — daí o upsert por themeId.
export async function agendarPostAction(params: { themeId: string; dia: string }) {
  const user = await requireUser();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dia)) throw new Error("Dia inválido.");

  const tema = await db.contentTheme.findUnique({
    where: { id: params.themeId },
    select: { clientId: true, briefing: { select: { period: true } } },
  });
  if (!tema) throw new Error("Post não encontrado.");

  await requireClientAccess(tema.clientId);

  const demanda = await db.contentDemand.findUnique({
    where: { clientId_period: { clientId: tema.clientId, period: tema.briefing.period } },
    select: { id: true, productionClosedAt: true },
  });
  if (!demanda?.productionClosedAt) {
    throw new Error("Finalize a produção deste mês antes de registrar agendamentos.");
  }

  const scheduledFor = diaParaData(params.dia);

  await db.postSchedule.upsert({
    where: { themeId: params.themeId },
    create: {
      themeId: params.themeId,
      clientId: tema.clientId,
      demandId: demanda.id,
      scheduledFor,
      registeredById: user.id,
    },
    update: { scheduledFor, registeredById: user.id },
  });

  await logActivity({
    clientId: tema.clientId,
    userId: user.id,
    action: "POST_SCHEDULED",
    period: tema.briefing.period,
    detail: params.dia,
  });
  revalidar(tema.clientId);
}

// Desfaz o registro. Serve para quando o agendamento foi cancelado no Meta ou anotado
// no post errado — o post volta para a lista de "ainda não agendados".
export async function desagendarPostAction(themeId: string) {
  const user = await requireUser();

  const registro = await db.postSchedule.findUnique({
    where: { themeId },
    select: { clientId: true, demand: { select: { period: true } } },
  });
  if (!registro) return;

  await requireClientAccess(registro.clientId);
  await db.postSchedule.delete({ where: { themeId } });

  await logActivity({
    clientId: registro.clientId,
    userId: user.id,
    action: "POST_SCHEDULED",
    period: registro.demand.period,
    detail: "agendamento removido",
  });
  revalidar(registro.clientId);
}
