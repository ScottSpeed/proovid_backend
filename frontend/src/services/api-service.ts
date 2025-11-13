import { authService } from './amplify-auth';
import { sessionService } from './session-service';

const API_BASE_URL = 'https://api.proovid.ai';

export interface AnalyzeRequest {
  bucket: string;
  key: string;
  tool?: string;
  session_id?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  job_id?: string;
  message?: string;
  error?: string;
}

export interface AnalyzeBatchResponse {
  success: boolean;
  jobs?: Array<{ job_id: string; video: { bucket: string; key: string; tool?: string } }>;
  job_ids?: string[];
  error?: string;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'not_found';
  result: string;
}

export interface JobStatusResponse {
  success: boolean;
  statuses: JobStatus[];
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  session_id?: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  conversation_id?: string;
  error?: string;
}

export interface UserJob {
  job_id: string;
  status: string;
  session_id?: string;
  result?: string;
  created_at?: number | string;
  updated_at?: number;
  video?: any;
  filename?: string;
  s3_key?: string;
}

export interface UserJobsResponse {
  jobs: UserJob[];
  total: number;
  user_email: string;
}

export interface Session {
  session_id: string;
  jobs: Array<{
    job_id: string;
    status: string;
    s3_key?: string;
  }>;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at?: number;
}

export interface SessionsResponse {
  sessions: Session[];
  total: number;
}

export interface SessionJobsResponse {
  session_id: string;
  jobs: UserJob[];
  total: number;
}

class ApiService {
  private handleUnauthorized(reason: 'no_token' | 'unauthorized' = 'unauthorized') {
    try { sessionService.clearSession(); } catch {}
    // Best-effort logout; ignore errors
    authService.logout().finally(() => {
      const redirectUrl = '/?auth=required' + (reason === 'no_token' ? '&reason=no_token' : '');
      // Force redirect to login
      window.location.href = redirectUrl;
    });
  }
  
  private async getAuthHeaders() {
    const token = await authService.getToken();
    if (!token) {
      // Redirect to login on missing token
      this.handleUnauthorized('no_token');
      throw new Error('No authentication token available');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  private async apiCall<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          this.handleUnauthorized('unauthorized');
        }
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // Start video analysis
  async analyzeVideo(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    try {
      console.log('[API] Starting analyzeVideo request:', {
        bucket: request.bucket,
        key: request.key,
        tool: request.tool,
        session_id: request.session_id
      });

      const response = await this.apiCall<any>('/analyze', 'POST', {
        videos: [{
          bucket: request.bucket,
          key: request.key,
          tool: request.tool || 'analyze_video_complete'
        }],
        session_id: request.session_id
      });

      console.log('[API] analyzeVideo response:', response);
      console.log('[API] Extracted job_id:', response.jobs?.[0]?.job_id);

      return {
        success: true,
        job_id: response.jobs?.[0]?.job_id,
        message: response.message || 'Analysis started successfully'
      };
    } catch (error) {
      console.error('[API] analyzeVideo ERROR:', error);
      console.error('[API] Error type:', error instanceof Error ? 'Error' : typeof error);
      console.error('[API] Error message:', error instanceof Error ? error.message : String(error));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed to start'
      };
    }
  }

  // Start analysis for multiple videos in one request
  async analyzeVideos(requests: AnalyzeRequest[], session_id?: string): Promise<AnalyzeBatchResponse> {
    try {
      const payload = {
        videos: requests.map(r => ({
          bucket: r.bucket,
          key: r.key,
          tool: r.tool || 'analyze_video_complete'
        })),
        session_id
      };

      console.log('[API] Starting analyzeVideos batch:', payload.videos.length);
      const response = await this.apiCall<any>('/analyze', 'POST', payload);
      const jobs = Array.isArray(response.jobs) ? response.jobs : [];
      return {
        success: true,
        jobs,
        job_ids: jobs.map((j: any) => j.job_id).filter(Boolean)
      };
    } catch (error) {
      console.error('[API] analyzeVideos ERROR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch analysis failed to start'
      };
    }
  }

  // Check job status
  async getJobStatus(jobIds: string[]): Promise<JobStatusResponse> {
    try {
      const response = await this.apiCall<any>('/job-status', 'POST', {
        job_ids: jobIds
      });

      return {
        success: true,
        statuses: response.statuses || []
      };
    } catch (error) {
      return {
        success: false,
        statuses: []
      };
    }
  }

  // List all jobs
  async listJobs(): Promise<{ success: boolean; jobs: any[] }> {
    try {
      const response = await this.apiCall<any>('/jobs', 'GET');
      return {
        success: true,
        jobs: response.jobs || []
      };
    } catch (error) {
      return {
        success: false,
        jobs: []
      };
    }
  }

  // Get user's jobs (multi-tenant)
  async getMyJobs(limit: number = 50): Promise<UserJobsResponse> {
    try {
      const response = await this.apiCall<UserJobsResponse>(`/my-jobs?limit=${limit}`, 'GET');
      return response;
    } catch (error) {
      console.error('Failed to get user jobs:', error);
      return { jobs: [], total: 0, user_email: '' };
    }
  }

  // Get signed URL for video streaming
  async getVideoUrl(bucket: string, key: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const response = await this.apiCall<any>(`/video-url/${bucket}/${key}`, 'GET');
      return {
        success: true,
        url: response.url
      };
    } catch (error) {
      console.error('Failed to get video URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video URL'
      };
    }
  }

  // Create/Start an upload session
  async startUploadSession(): Promise<{ session_id: string; s3_prefix: string }> {
    const response = await this.apiCall<any>('/upload-session', 'POST');
    return {
      session_id: response.session_id,
      s3_prefix: response.s3_prefix
    };
  }

  // Get presigned upload URL (session-aware)
  async getUploadUrl(params: { bucket: string; key: string; content_type: string; session_id?: string }): Promise<{ upload_url: string; bucket: string; key: string }> {
    const response = await this.apiCall<any>('/get-upload-url', 'POST', {
      bucket: params.bucket,
      key: params.key,
      content_type: params.content_type,
      session_id: params.session_id
    });
    return {
      upload_url: response.upload_url,
      bucket: response.bucket,
      key: response.key
    };
  }

  // Get user's sessions (upload batches)
  async getMySessions(): Promise<SessionsResponse> {
    try {
      const response = await this.apiCall<SessionsResponse>('/my-sessions', 'GET');
      return response;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return { sessions: [], total: 0 };
    }
  }

  // Get jobs for a specific session
  async getSessionJobs(sessionId: string): Promise<SessionJobsResponse> {
    try {
      const response = await this.apiCall<SessionJobsResponse>(`/session/${sessionId}/jobs`, 'GET');
      return response;
    } catch (error) {
      console.error(`Failed to get session ${sessionId} jobs:`, error);
      return { session_id: sessionId, jobs: [], total: 0 };
    }
  }

  // Chat with AI about analysis results
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await this.apiCall<any>('/chat', 'POST', {
        message: request.message,
        conversation_id: request.conversation_id,
        session_id: request.session_id
      });

      return {
        success: true,
        response: response.response,
        conversation_id: response.conversation_id
      };
    } catch (error) {
      console.error('Chat API call failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chat request failed'
      };
    }
  }

  // Poll job status until completion
  async pollJobStatus(
    jobId: string, 
    onUpdate?: (status: JobStatus) => void,
    intervalMs: number = 2000,
    maxAttempts: number = 150 // 5 minutes max
  ): Promise<JobStatus> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const result = await this.getJobStatus([jobId]);
        
        if (result.success && result.statuses.length > 0) {
          const status = result.statuses[0];
          
          if (onUpdate) {
            onUpdate(status);
          }
          
          // Check if job is complete (success or failure)
          if (status.status === 'completed' || status.status === 'failed') {
            return status;
          }
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
        
      } catch (error) {
        console.error('Error polling job status:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    // Timeout reached
    throw new Error('Job status polling timeout');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;