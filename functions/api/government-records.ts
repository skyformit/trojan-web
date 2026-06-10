import { json, governmentRegistries } from '../_shared';

export async function onRequestGet() {
  return json({
    status: 'success',
    description: 'Sandbox Government Business registries connected in sandbox environment.',
    records: governmentRegistries
  });
}

