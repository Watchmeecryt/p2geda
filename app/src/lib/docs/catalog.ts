import {
  Alert02Icon,
  BookOpen01Icon,
  ChampionIcon,
  Clock01Icon,
  CodeIcon,
  DiceIcon,
  Key01Icon,
  GiftIcon,
  HelpCircleIcon,
  SafeIcon,
  Settings02Icon,
  SparklesIcon,
  SquareLock02Icon,
  UserGroupIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';

export type DocGroupId = 'start' | 'concepts' | 'security' | 'operations' | 'reference';

export type DocPageId =
  | 'what-is-confipool'
  | 'try-sepolia'
  | 'how-a-draw-works'
  | 'randomness'
  | 'time-weighted-balance'
  | 'winner-selection'
  | 'prizes-and-tiers'
  | 'prize-money'
  | 'vault-source'
  | 'why-zama'
  | 'what-stays-private'
  | 'limitations'
  | 'the-keeper'
  | 'live-stack'
  | 'vault-api'
  | 'faq';

export type DocPage = {
  id: DocPageId;
  title: string;
  blurb: string;
  icon: IconSvgElement;
};

export type DocGroup = {
  id: DocGroupId;
  label: string;
  pages: DocPage[];
};

export const DOC_GROUPS: DocGroup[] = [
  {
    id: 'start',
    label: 'Getting started',
    pages: [
      {
        id: 'what-is-confipool',
        title: 'What ConfiPool is',
        blurb: 'No-loss prize savings with encrypted balances.',
        icon: SafeIcon,
      },
      {
        id: 'try-sepolia',
        title: 'Try it on Sepolia',
        blurb: 'Faucet, wrap, deposit, wait for the hourly draw.',
        icon: Wallet01Icon,
      },
    ],
  },
  {
    id: 'concepts',
    label: 'Concepts',
    pages: [
      {
        id: 'how-a-draw-works',
        title: 'How a draw works',
        blurb: 'beginRound, unsealRound, scoreEntrant, claim.',
        icon: DiceIcon,
      },
      {
        id: 'randomness',
        title: 'Randomness',
        blurb: 'Onchain FHE.rand, unseal, then the V5 seed.',
        icon: Key01Icon,
      },
      {
        id: 'time-weighted-balance',
        title: 'Time-weighted balance',
        blurb: 'One odometer window for every tier.',
        icon: Clock01Icon,
      },
      {
        id: 'winner-selection',
        title: 'Winner selection',
        blurb: 'PoolTogether V5 per-prize rule, in FHE.',
        icon: ChampionIcon,
      },
      {
        id: 'prizes-and-tiers',
        title: 'Prizes and tiers',
        blurb: 'Apex, Pulse, Ripple — additive shots.',
        icon: SparklesIcon,
      },
      {
        id: 'prize-money',
        title: 'Where prizes come from',
        blurb: 'Encrypted reserve, harvest, Sepolia funding.',
        icon: GiftIcon,
      },
      {
        id: 'vault-source',
        title: 'Vault source',
        blurb: 'IYieldSource, ConfidentialVaultSource, batchers.',
        icon: SafeIcon,
      },
      {
        id: 'why-zama',
        title: 'Why this needs Zama',
        blurb: 'ERC-7984, FHE.rand, userDecrypt.',
        icon: BookOpen01Icon,
      },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    pages: [
      {
        id: 'what-stays-private',
        title: 'What stays private',
        blurb: 'Encrypted vs public on purpose.',
        icon: SquareLock02Icon,
      },
      {
        id: 'limitations',
        title: 'Honest limits',
        blurb: 'What V5 we did not port, and why.',
        icon: Alert02Icon,
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    pages: [
      {
        id: 'the-keeper',
        title: 'The keeper',
        blurb: 'Hourly rounds. Reviewers do not run draws.',
        icon: Settings02Icon,
      },
      {
        id: 'live-stack',
        title: 'Live Sepolia',
        blurb: 'Vault, adapter, tokens, owner.',
        icon: UserGroupIcon,
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    pages: [
      {
        id: 'vault-api',
        title: 'Vault API',
        blurb: 'JSDoc for the prize vault surface.',
        icon: CodeIcon,
      },
      {
        id: 'faq',
        title: 'FAQ',
        blurb: 'Short answers to the usual questions.',
        icon: HelpCircleIcon,
      },
    ],
  },
];

export const DEFAULT_DOC: DocPageId = 'what-is-confipool';

export function allDocPages(): DocPage[] {
  return DOC_GROUPS.flatMap((group) => group.pages);
}

export function findDoc(id: string | undefined): DocPage | undefined {
  return allDocPages().find((page) => page.id === id);
}

export function docPath(id: DocPageId): string {
  return `/app/docs/${id}`;
}
