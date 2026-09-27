"use client";

import { TextField } from "@/components/ui/field";

export const MIN_PASSWORD_LENGTH = 12;

export function passwordError(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

interface PasswordFieldsProps {
  password: string;
  confirm: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  showErrors: boolean;
}

export function PasswordFields({ password, confirm, onPassword, onConfirm, showErrors }: PasswordFieldsProps) {
  const tooShort = showErrors && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = showErrors && !tooShort && password !== confirm;
  return (
    <>
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters required.` : undefined}
      />
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => onConfirm(e.target.value)}
        error={mismatch ? "Passwords do not match." : undefined}
      />
    </>
  );
}
