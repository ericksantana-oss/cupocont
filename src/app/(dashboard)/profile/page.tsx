"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Trocar senha"}
    </Button>
  );
}

export default function ProfilePage() {
  const [state, formAction] = useFormState<ChangePasswordResult | null, FormData>(changePasswordAction, null);

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="display text-3xl">Meu perfil</h1>

      <form action={formAction} className="cartao mt-6 space-y-4 p-6">
        <h2 className="text-sm font-semibold">Trocar senha</h2>

        <div className="space-y-2">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input id="currentPassword" name="currentPassword" type="password" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">Nova senha</Label>
          <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} />
        </div>

        {state && "error" in state && <p className="text-sm text-risco">{state.error}</p>}
        {state && "success" in state && <p className="text-sm text-salvia">Senha alterada.</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
