import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyToDocumentButton } from "@/components/client/CopyToDocumentButton";
import { formatEmailForDocument } from "@/lib/emailDocument";
import {
  updateEmailFieldsAction,
  updateEmailStatusAction,
  regenerateFullAction,
  regenerateBodyAction,
  regenerateSubjectsAction,
  regeneratePreheaderAction,
  regenerateCtaAction,
} from "../actions";

const STATUS_OPTIONS: { value: "DRAFT" | "REVIEW" | "APPROVED"; label: string }[] = [
  { value: "DRAFT", label: "Rascunho" },
  { value: "REVIEW", label: "Em revisão" },
  { value: "APPROVED", label: "Aprovado" },
];

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; emailId: string }>;
}) {
  const { clientId, emailId } = await params;
  await requireClientAccess(clientId);

  const [client, email] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    db.marketingEmail.findUnique({ where: { id: emailId }, include: { flow: true } }),
  ]);
  if (!client || !email || email.clientId !== clientId) notFound();

  const saveFields = updateEmailFieldsAction.bind(null, clientId, emailId);
  const setStatus = updateEmailStatusAction.bind(null, clientId, emailId);
  const regenAll = regenerateFullAction.bind(null, clientId, emailId);
  const regenBody = regenerateBodyAction.bind(null, clientId, emailId);
  const regenSubjects = regenerateSubjectsAction.bind(null, clientId, emailId);
  const regenPreheader = regeneratePreheaderAction.bind(null, clientId, emailId);
  const regenCta = regenerateCtaAction.bind(null, clientId, emailId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/clients/${clientId}/emails`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        E-mails de {client.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="display text-2xl">{email.name}</h1>
            <Badge variant="secondary">{email.type === "PONTUAL" ? "Pontual" : "Fluxo"}</Badge>
          </div>
          {email.flow && <p className="mt-1 text-sm text-tinta-3">Fluxo: {email.flow.name}</p>}
        </div>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <form key={opt.value} action={setStatus.bind(null, opt.value)}>
              <Button type="submit" size="sm" variant={email.status === opt.value ? "default" : "outline"}>
                {opt.label}
              </Button>
            </form>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <form action={regenAll}>
          <Button type="submit" variant="secondary">
            <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
            Regenerar e-mail inteiro
          </Button>
        </form>
        <CopyToDocumentButton text={formatEmailForDocument(email)} />
      </div>

      <p className="cartao mt-6 p-4 text-sm text-tinta-2">
        <span className="rotulo mb-1 block">Contexto/direcionamento original</span>
        {email.briefing}
      </p>

      <form action={saveFields} className="mt-6 space-y-8">
        <section className="cartao space-y-4 p-6">
          <h2 className="text-sm font-semibold">Informações de disparo (preenchimento manual)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audience">Base que será impactada</Label>
              <Input id="audience" name="audience" defaultValue={email.audience ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderName">Remetente</Label>
              <Input id="senderName" name="senderName" defaultValue={email.senderName ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderEmail">E-mail do remetente</Label>
              <Input id="senderEmail" name="senderEmail" defaultValue={email.senderEmail ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imagesFolderUrl">Drive com imagens</Label>
              <Input id="imagesFolderUrl" name="imagesFolderUrl" defaultValue={email.imagesFolderUrl ?? ""} />
            </div>
          </div>
        </section>

        <section className="cartao space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Assuntos (teste A/B)</h2>
            <form action={regenSubjects}>
              <Button type="submit" size="sm" variant="ghost">
                <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
                Regenerar assuntos
              </Button>
            </form>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjectA">Assunto A (máx. 50 caracteres)</Label>
            <Input id="subjectA" name="subjectA" maxLength={50} defaultValue={email.subjectA ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjectB">Assunto B (máx. 50 caracteres)</Label>
            <Input id="subjectB" name="subjectB" maxLength={50} defaultValue={email.subjectB ?? ""} />
          </div>
        </section>

        <section className="cartao space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Preheader (máx. 40 caracteres)</h2>
            <form action={regenPreheader}>
              <Button type="submit" size="sm" variant="ghost">
                <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
                Regenerar preheader
              </Button>
            </form>
          </div>
          <Input name="preheader" maxLength={40} defaultValue={email.preheader ?? ""} />
        </section>

        <section className="cartao space-y-4 p-6">
          <h2 className="text-sm font-semibold">Card (opcional)</h2>
          <Textarea name="cardText" rows={2} defaultValue={email.cardText ?? ""} placeholder="Deixe em branco se este e-mail não usa card." />
        </section>

        <section className="cartao space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Corpo do e-mail</h2>
            <form action={regenBody}>
              <Button type="submit" size="sm" variant="ghost">
                <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
                Regenerar corpo
              </Button>
            </form>
          </div>
          <Textarea name="body" rows={14} className="leading-relaxed" defaultValue={email.body ?? ""} />
        </section>

        <section className="cartao space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">CTA</h2>
            <form action={regenCta}>
              <Button type="submit" size="sm" variant="ghost">
                <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
                Regenerar CTA
              </Button>
            </form>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ctaText">Texto do botão</Label>
              <Input id="ctaText" name="ctaText" defaultValue={email.ctaText ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaColor">Cor do botão (código, preenchimento manual)</Label>
              <Input id="ctaColor" name="ctaColor" placeholder="#316748" defaultValue={email.ctaColor ?? ""} />
            </div>
          </div>
        </section>

        <section className="cartao space-y-4 p-6">
          <h2 className="text-sm font-semibold">Despedida</h2>
          <Textarea name="farewell" rows={2} defaultValue={email.farewell ?? ""} />
        </section>

        <div className="space-y-2">
          <Label htmlFor="name">Nome do e-mail</Label>
          <Input id="name" name="name" defaultValue={email.name} />
        </div>

        <Button type="submit">Salvar edições</Button>
      </form>
    </div>
  );
}
