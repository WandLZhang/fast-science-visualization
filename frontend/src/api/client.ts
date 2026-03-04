import type { InfraConfig, AllResources } from '../types/resources';

const BASE = '';

export async function fetchConfig(): Promise<InfraConfig> {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAllResources(): Promise<AllResources> {
  const res = await fetch(`${BASE}/api/resources/all`);
  if (!res.ok) throw new Error(`Resources fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchProjectResources(projectId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/resources/${projectId}`);
  if (!res.ok) throw new Error(`Project resources fetch failed: ${res.status}`);
  return res.json();
}
