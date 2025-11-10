/**
 * Plivo Service Layer
 * 
 * This layer handles direct communication with the Plivo API.
 * It provides basic REST operations for making calls and retrieving call details.
 * No business logic or resilience patterns - pure API interaction.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
    MakeCallRequest,
    MakeCallResponse,
    GetCallDetailsRequest,
    GetCallDetailsResponse,
    PlivoServiceError,
    PlivoError,
} from '@/lib/types/plivo.types';

export class PlivoService {
    private client: AxiosInstance;
    private authId: string;
    private authToken: string;

    constructor(authId: string, authToken: string) {
        this.authId = authId;
        this.authToken = authToken;

        this.client = axios.create({
            baseURL: `https://api.plivo.com/v1/Account/${authId}`,
            headers: {
                'Content-Type': 'application/json',
            },
            auth: {
                username: authId,
                password: authToken,
            },
            timeout: 30000, // 30 seconds
        });
    }

    /**
     * Make an outbound call via Plivo API
     * 
     * @param request - Call parameters including from, to, and answer_url
     * @returns Promise with call request UUID and API ID
     * @throws PlivoServiceError if the API request fails
     */
    async makeCall(request: MakeCallRequest): Promise<MakeCallResponse> {
        try {
            const response = await this.client.post<MakeCallResponse>('/Call/', request);
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'makeCall');
        }
    }

    /**
     * Get details of a specific call by UUID
     * 
     * @param request - Object containing the call UUID
     * @returns Promise with complete call details
     * @throws PlivoServiceError if the API request fails
     */
    async getCallDetails(request: GetCallDetailsRequest): Promise<GetCallDetailsResponse> {
        try {
            const response = await this.client.get<GetCallDetailsResponse>(
                `/Call/${request.callUuid}/`
            );
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'getCallDetails');
        }
    }

    /**
     * Get all calls with optional filtering
     * 
     * @param filters - Optional query parameters for filtering calls
     * @returns Promise with array of call details
     * @throws PlivoServiceError if the API request fails
     */
    async getCalls(filters?: {
        subaccount?: string;
        call_direction?: 'inbound' | 'outbound';
        from_number?: string;
        to_number?: string;
        end_time__gt?: string;
        end_time__gte?: string;
        end_time__lt?: string;
        end_time__lte?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        api_id: string;
        meta: {
            limit: number;
            offset: number;
            next: string | null;
            previous: string | null;
            total_count: number;
        };
        objects: GetCallDetailsResponse[];
    }> {
        try {
            const response = await this.client.get('/Call/', {
                params: filters,
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'getCalls');
        }
    }

    /**
     * Get live call details (while call is in progress)
     * 
     * @param request - Object containing the call UUID
     * @returns Promise with live call status
     * @throws PlivoServiceError if the API request fails
     */
    async getLiveCall(request: GetCallDetailsRequest): Promise<{
        api_id: string;
        calls: string[];
    }> {
        try {
            const response = await this.client.get(`/Call/${request.callUuid}/`, {
                params: { status: 'live' },
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'getLiveCall');
        }
    }

    /**
     * Terminate an ongoing call
     * 
     * @param callUuid - UUID of the call to terminate
     * @returns Promise with termination result
     * @throws PlivoServiceError if the API request fails
     */
    async terminateCall(callUuid: string): Promise<{ message: string; api_id: string }> {
        try {
            const response = await this.client.delete(`/Call/${callUuid}/`);
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'terminateCall');
        }
    }

    /**
     * Update an ongoing call (transfer, play audio, etc.)
     * 
     * @param callUuid - UUID of the call to update
     * @param updates - Update parameters
     * @returns Promise with update result
     * @throws PlivoServiceError if the API request fails
     */
    async updateCall(
        callUuid: string,
        updates: {
            legs?: 'aleg' | 'bleg' | 'both';
            aleg_url?: string;
            aleg_method?: 'GET' | 'POST';
            bleg_url?: string;
            bleg_method?: 'GET' | 'POST';
        }
    ): Promise<{ message: string; api_id: string }> {
        try {
            const response = await this.client.post(`/Call/${callUuid}/`, updates);
            return response.data;
        } catch (error) {
            throw this.handleError(error, 'updateCall');
        }
    }

    /**
     * Handle errors from Plivo API and convert to PlivoServiceError
     * 
     * @param error - The caught error
     * @param method - The method name where error occurred
     * @returns PlivoServiceError with detailed error information
     */
    private handleError(error: unknown, method: string): PlivoServiceError {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError<PlivoError>;
            const serviceError = new Error(
                `Plivo API error in ${method}: ${axiosError.message}`
            ) as PlivoServiceError;

            serviceError.statusCode = axiosError.response?.status;
            serviceError.plivoError = axiosError.response?.data;
            serviceError.name = 'PlivoServiceError';

            return serviceError;
        }

        const serviceError = new Error(
            `Unknown error in ${method}: ${error instanceof Error ? error.message : String(error)}`
        ) as PlivoServiceError;
        serviceError.name = 'PlivoServiceError';

        return serviceError;
    }

    /**
     * Validate credentials by making a test API call
     * 
     * @returns Promise<boolean> - true if credentials are valid
     */
    async validateCredentials(): Promise<boolean> {
        try {
            await this.client.get('/');
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Factory function to create a PlivoService instance
 * 
 * @param authId - Plivo Auth ID
 * @param authToken - Plivo Auth Token
 * @returns Configured PlivoService instance
 */
export function createPlivoService(authId: string, authToken: string): PlivoService {
    if (!authId || !authToken) {
        throw new Error('Plivo Auth ID and Auth Token are required');
    }
    return new PlivoService(authId, authToken);
}
