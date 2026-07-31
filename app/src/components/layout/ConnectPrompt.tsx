import { ConnectButton } from '@rainbow-me/rainbowkit';
import { HugeiconsIcon } from '@hugeicons/react';
import { Wallet01Icon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';

export function ConnectPrompt({
  title = 'Connect to enter the pool',
  description = 'ConfiPool never asks for a deposit before you can look around — connect on Sepolia to see your position, the draw schedule, and the faucet.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card tone="panel" className="flex flex-col items-center py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full border-2 border-dashed border-[rgba(0,0,0,0.16)] bg-surface text-ink">
        <HugeiconsIcon icon={Wallet01Icon} size={26} aria-hidden />
      </div>
      <h2 className="mt-5 text-[20px] font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">{description}</p>
      <div className="mt-6">
        <ConnectButton showBalance={false} />
      </div>
    </Card>
  );
}
