
import { NextResponse } from 'next/server';
import { simulateScenario } from '@/lib/simulation';

export async function POST(req: Request) {
  const body = await req.json();
  const result = simulateScenario(
    body.salary,
    body.emi,
    body.sip,
    body.expenses,
    body.years
  );
  return NextResponse.json(result);
}
