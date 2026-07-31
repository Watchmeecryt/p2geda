import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';
import type { PrivateView } from '@/hooks/usePrivateView';

/**
 * Single control for the EIP-712 decryption permit. First use asks for one signature;
 * afterwards it just shows or hides values from the cached permit.
 */
export function PrivateViewToggle({
  view,
  size = 'sm',
  fullWidth = false,
}: {
  view: PrivateView;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}) {
  const label = view.revealed
    ? 'Hide amounts'
    : view.hasPermit
      ? 'Show my amounts'
      : 'Reveal with signature';

  return (
    <Button
      variant={view.revealed ? 'secondary' : 'primary'}
      size={size}
      fullWidth={fullWidth}
      loading={view.granting}
      onClick={() => void view.toggle()}
      title={
        view.hasPermit
          ? 'Your decryption permit is cached in this browser.'
          : 'Signs an EIP-712 message so only you can read your amounts.'
      }
    >
      <HugeiconsIcon icon={view.revealed ? ViewOffSlashIcon : ViewIcon} size={16} aria-hidden />
      {label}
    </Button>
  );
}
