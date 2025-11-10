import axios from 'axios';
import { supabase } from './supabase';
import type { CallInitiateRequest, CallInitiateResponse, Call, AdminCall, PlivoCredentials } from './types';

// For Next.js internal API routes, use relative paths
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  };
}

export async function initiateCall(request: CallInitiateRequest): Promise<CallInitiateResponse> {
  const headers = await getAuthHeaders();
  const response = await api.post<CallInitiateResponse>('/api/calls/initiate', request, { headers });
  return response.data;
}

export async function getUserCalls(): Promise<Call[]> {
  const headers = await getAuthHeaders();
  const response = await api.get<{ calls: Call[] }>('/api/calls', { headers });
  return response.data.calls;
}

export async function getAdminCalls(flaggedOnly: boolean = false): Promise<AdminCall[]> {
  const headers = await getAuthHeaders();
  const response = await api.get<{ calls: AdminCall[] }>('/api/admin/calls', {
    params: { flagged_only: flaggedOnly },
    headers
  });
  return response.data.calls;
}

export async function getPlivoCredentials(): Promise<PlivoCredentials> {
  const headers = await getAuthHeaders();
  const response = await api.get<PlivoCredentials>('/api/plivo/endpoint-credentials', { headers });
  return response.data;
}
