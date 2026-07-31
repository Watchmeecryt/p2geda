import { useAccount, useSwitchChain } from 'wagmi';
import { sepolia } from 'viem/chains';
import { HugeiconsIcon } from '@hugeicons/react';
import { Alert02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepolia.id) return null;

  return (
    <div
      role="alert"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-sm border border-caution/25 bg-caution-bg px-4 py-3"
    >
      <HugeiconsIcon icon={Alert02Icon} size={20} className="text-caution" aria-hidden />
      <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
        ConfiPool runs on Sepolia. Switch networks to deposit, draw, or claim.
      </p>
      <Button size="sm" loading={isPending} onClick={() => switchChain({ chainId: sepolia.id })}>
        Switch to Sepolia
      </Button>
    </div>
  );
}
