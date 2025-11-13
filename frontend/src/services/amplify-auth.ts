import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  username: string;
  email: string;
  attributes: any;
}

class AmplifyAuthService {
  private listeners: ((isAuthenticated: boolean) => void)[] = [];

  constructor() {
    // Listen to auth events
    Hub.listen('auth', (data) => {
      const { event } = data.payload;
      if (event === 'signedIn' || event === 'signedOut') {
        this.notifyListeners();
      }
    });
  }

  async login(credentials: LoginCredentials): Promise<void> {
    try {
      await signIn({
        username: credentials.email,
        password: credentials.password
      });
    } catch (error) {
      console.error('Login error:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      const user = await getCurrentUser();
      return {
        username: user.username,
        email: user.signInDetails?.loginId || '',
        attributes: user
      };
    } catch (error) {
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      // Consider authenticated only if ID token is present (backend expects ID token)
      return !!session.tokens?.idToken;
    } catch (error) {
      return false;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      // Backend expects ID token (not access token) for Cognito authentication
      return session.tokens?.idToken?.toString() || null;
    } catch (error) {
      return null;
    }
  }

  // Event listeners for auth state changes
  onAuthStateChange(callback: (isAuthenticated: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private async notifyListeners() {
    const isAuth = await this.isAuthenticated();
    this.listeners.forEach(callback => callback(isAuth));
  }
}

export const authService = new AmplifyAuthService();