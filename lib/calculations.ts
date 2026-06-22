import type { MarketStatus } from "@/types/domain";

export function calculateSettlement(
  status: MarketStatus,
  stakeInput: number,
  oddsInput: number,
) {
  const stake = Number.isFinite(stakeInput) ? stakeInput : 0;
  const odds = Number.isFinite(oddsInput) ? oddsInput : 0;

  if (status === "pending") {
    return { payout: null, profit: null };
  }

  let payout = 0;
  if (status === "won") payout = stake * odds;
  if (status === "lost") payout = 0;
  if (status === "push" || status === "void") payout = stake;
  if (status === "half_won") payout = stake + (stake * (odds - 1)) / 2;
  if (status === "half_lost") payout = stake / 2;

  return {
    payout: roundMoney(payout),
    profit: roundMoney(payout - stake),
  };
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
