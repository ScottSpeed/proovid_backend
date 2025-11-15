// import { apiService } from './api-service';

const SESSION_STORAGE_KEY = 'proovid_session_id';
const SESSION_PREFIX_KEY = 'proovid_session_prefix';

class SessionService {
  private generateUuid(): string {
    // RFC4122 v4 simplified UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  getSessionId(): string | null {
    try {
      return localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  getSessionPrefix(): string | null {
    try {
      return localStorage.getItem(SESSION_PREFIX_KEY);
    } catch {
      return null;
    }
  }

  async ensureSession(forceNew: boolean = false): Promise<{ session_id: string; s3_prefix: string }> {
    if (!forceNew) {
      const existing = this.getSessionId();
      const prefix = this.getSessionPrefix();
      if (existing && prefix) {
        return { session_id: existing, s3_prefix: prefix };
      }
    }
    // Temporary hardening: avoid backend /upload-session (preflight issues) and generate client-side session
    const session_id = this.generateUuid();
    const s3_prefix = `sessions/${session_id}/`;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, session_id);
      localStorage.setItem(SESSION_PREFIX_KEY, s3_prefix);
    } catch {}
    return { session_id, s3_prefix };
  }

  clearSession() {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_PREFIX_KEY);
    } catch {}
  }
}

export const sessionService = new SessionService();
export default sessionService;
