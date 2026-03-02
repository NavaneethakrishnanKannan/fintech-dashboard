
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

  return {
    average: results.reduce((a, b) => a + b, 0) / simulations,
    best: Math.max(...results),
    worst: Math.min(...results)
  };
}
