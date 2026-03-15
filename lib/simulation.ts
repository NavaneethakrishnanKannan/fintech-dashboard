
export function simulateScenario(
  salary: number,
  emi: number,
  sip: number,
  expenses: number,
  years: number
) {
  const simulations = 500;
  const results = [];

  for (let i = 0; i < simulations; i++) {
    let netWorth = 0;
    for (let y = 0; y < years; y++) {
      const annualSavings = (salary - emi - expenses - sip) * 12;
      const marketReturn = (Math.random() * 0.2) + 0.05;
      netWorth = (netWorth + (sip * 12) + annualSavings) * (1 + marketReturn);
    }
    results.push(netWorth);
  }

  results.sort((a, b) => a - b);
  const n = results.length;
  const pct = (p: number) => {
    const idx = Math.min(n - 1, Math.floor((p / 100) * n));
    return results[idx] ?? 0;
  };

  return {
    average: results.reduce((a, b) => a + b, 0) / simulations,
    best: results[n - 1] ?? 0,
    worst: results[0] ?? 0,
    p10: pct(10),
    p50: pct(50),
    p90: pct(90),
  };
}
