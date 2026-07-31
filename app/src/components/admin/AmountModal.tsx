import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AmountField } from '@/components/ui/AmountField';
import { validateConfidentialInput } from '@/lib/errors';
import { isPositiveAmount, parseConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';

type Props = {
  onClose: () => void;
  title: string;
  description: string;
  icon?: ReactNode;
  fieldLabel: string;
  confirmLabel: string;
  note?: ReactNode;
  busy: boolean;
  onConfirm: (amount: bigint) => Promise<boolean>;
};

/**
 * Shared modal for the two admin actions that submit an encrypted amount. Callers mount
 * it only while it is open, so the amount field starts empty on every use.
 */
export function AmountModal({
  onClose,
  title,
  description,
  icon,
  fieldLabel,
  confirmLabel,
  note,
  busy,
  onConfirm,
}: Props) {
  const [amount, setAmount] = useState('');

  const validation = amount ? validateConfidentialInput(amount) : null;
  const parsed = isPositiveAmount(amount) ? parseConfidential(amount) : 0n;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      dismissible={!busy}
      footer={
        <>
          <Button
            fullWidth
            loading={busy}
            disabled={parsed === 0n || Boolean(validation)}
            onClick={async () => {
              if (await onConfirm(parsed)) onClose();
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <AmountField
        label={fieldLabel}
        value={amount}
        onChange={setAmount}
        symbol={CONFIDENTIAL_SYMBOL}
        error={validation}
        disabled={busy}
      />
      {note ? (
        <p className="mt-4 note-block text-[0.8rem] leading-relaxed text-muted">
          {note}
        </p>
      ) : null}
    </Modal>
  );
}
