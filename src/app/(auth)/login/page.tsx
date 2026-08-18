"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CupolaMark } from "@/components/CupolaMark";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await loginAction(formData);
      return result ?? null;
    },
    null
  );

  return (
    <main className="sup-campo grao flex min-h-screen items-center justify-center px-4">
      <form action={formAction} className="relative z-10 w-full max-w-sm space-y-4 rounded-campo bg-carta p-8 shadow-alto">
        <div className="flex items-center gap-2.5">
          <CupolaMark className="size-7" />
          <span className="display text-base">CupoCont</span>
        </div>

        <div className="space-y-2 pt-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required />
        </div>

        {state?.error && <p className="text-sm text-risco">{state.error}</p>}

        <SubmitButton />
      </form>
    </main>
  );
}
