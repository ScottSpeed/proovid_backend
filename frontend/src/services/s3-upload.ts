import { authService } from './amplify-auth';

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
  
  private generateTimestampFolder(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `analysis_${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
  }
  
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
    onProgress?: (progress: UploadProgress) => void
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
      
      // Generate upload path with timestamp folder
      const folder = this.generateTimestampFolder();
      const key = `${folder}/${file.name}`;
      const bucket = 'christian-aws-development';
      
      console.log(`Starting real S3 upload to s3://${bucket}/${key}`);
      
      // Real S3 upload using presigned URL from backend
      // Get upload credentials from backend
      const token = await authService.getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Request presigned URL from backend
      const presignResponse = await fetch(`https://api.proovid.de/get-upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucket: bucket,
          key: key,
          content_type: file.type
        })
      });
      
      if (!presignResponse.ok) {
        throw new Error(`Failed to get upload URL: ${presignResponse.status}`);
      }
      
      const { upload_url } = await presignResponse.json();
      
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
        bucket: bucket,
        key: key
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