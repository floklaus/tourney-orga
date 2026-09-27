"use client";

import { useState, type ReactNode } from "react";
import { errorMessage } from "@/lib/errors";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Alert } from "./alert";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} size="sm">
      <ConfirmBody {...props} />
    </Dialog>
  );
}

function ConfirmBody({ message, confirmLabel = "Confirm", danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-700">{message}</div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
