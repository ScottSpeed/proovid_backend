import { authService } from './amplify-auth';
import { apiService } from './api-service';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  bucket: string;
  key: string;
  jobId?: string;
  error?: string;
}

class S3UploadService {
  
  
  private validateVideoFile(file: File): { valid: boolean; error?: string } {
    const validTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // .avi
      'video/x-ms-wmv',   // .wmv
    ];
    
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload MP4, MPEG, MOV, AVI, or WMV files.'
      };
    }
    
    // Check file size (max 500MB)
    const maxSizeBytes = 500 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: 'File too large. Maximum size is 500MB.'
      };
    }
    
    return { valid: true };
  }


  
  async uploadVideo(
    file: File,
    _onProgress?: (progress: UploadProgress) => void,
    options?: { session_id?: string }
  ): Promise<UploadResult> {
    try {
      // Validate file
      const validation = this.validateVideoFile(file);
      if (!validation.valid) {
        return {
          success: false,
          bucket: '',
          key: '',
          error: validation.error
        };
      }
      
      // Check authentication
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        return {
          success: false,
          bucket: '',
          key: '',
          error: 'Authentication required for upload'
        };
      }
      
      // Prepare upload params
      const bucket = 'christian-aws-development';
      // We send the filename as the key; backend will rewrite to session folder when session_id is provided
      const requestedKey = `${file.name}`;
      console.log(`Requesting presigned URL for s3://${bucket}/${requestedKey} (session: ${options?.session_id || 'none'})`);

      // Request presigned URL from backend (session-aware)
      const presign = await apiService.getUploadUrl({
        bucket,
        key: requestedKey,
        content_type: file.type,
        session_id: options?.session_id
      });
      const upload_url = presign.upload_url;
      const finalBucket = presign.bucket;
      const finalKey = presign.key;
      
      // Upload file to S3 using presigned URL
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status}`);
      }
      
      console.log('S3 upload completed successfully');
      
      return {
        success: true,
        bucket: finalBucket,
        key: finalKey
      };
      
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        bucket: '',
        key: '',
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }
}

// Export singleton instance
export const s3UploadService = new S3UploadService();
export default s3UploadService;