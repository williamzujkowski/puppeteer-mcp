/**
 * REST API Session Management Example
 *
 * This example demonstrates:
 * - Creating and managing sessions
 * - Session lifecycle operations
 * - Context management
 * - Error handling and recovery
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface SessionCapabilities {
  acceptInsecureCerts?: boolean;
  browserName?: string;
  browserVersion?: string;
  platformName?: string;
  proxy?: {
    proxyType: string;
    httpProxy?: string;
    sslProxy?: string;
    noProxy?: string[];
  };
}

interface Session {
  id: string;
  capabilities: SessionCapabilities;
  contexts: Context[];
  createdAt: string;
  lastAccessedAt: string;
  status: 'active' | 'idle' | 'terminated';
}

interface Context {
  id: string;
  type: 'default' | 'incognito';
  pages: Page[];
}

interface Page {
  id: string;
  url: string;
  title: string;
}

interface ExecuteResult {
  success: boolean;
  result?: any;
  error?: string;
}

class RESTSessionManager {
  private apiClient: AxiosInstance;
  private sessions: Map<string, Session> = new Map();

  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use((response) => response, this.handleApiError);
  }

  private handleApiError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      console.error(`API Error ${status}:`, data);

      switch (status) {
        case 401:
          throw new Error('Authentication failed. Check your API key.');
        case 403:
          throw new Error('Access forbidden. Insufficient permissions.');
        case 404:
          throw new Error('Resource not found.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 500:
          throw new Error('Server error. Please try again.');
        default:
          throw new Error(`API Error: ${data.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Check connection.');
    } else {
      // Request setup error
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async createSession(capabilities: SessionCapabilities = {}): Promise<Session> {
    console.log('Creating new session...');

    const response = await this.apiClient.post('/sessions', {
      capabilities: {
        acceptInsecureCerts: true,
        browserName: 'chrome',
        ...capabilities,
      },
    });

    const session: Session = response.data.data;
    this.sessions.set(session.id, session);

    console.log(`Session created: ${session.id}`);
    return session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.apiClient.get(`/sessions/${sessionId}`);
    return response.data.data;
  }

  async listSessions(): Promise<Session[]> {
    const response = await this.apiClient.get('/sessions');
    return response.data.data;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const response = await this.apiClient.patch(`/sessions/${sessionId}`, updates);
    const updatedSession: Session = response.data.data;

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.apiClient.delete(`/sessions/${sessionId}`);
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} deleted`);
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }

  async execute(
    sessionId: string,
    script: string,
    args: any[] = [],
    context: any = {},
  ): Promise<ExecuteResult> {
    try {
      const response = await this.apiClient.post(`/sessions/${sessionId}/execute`, {
        script,
        args,
        context,
      });

      return {
        success: true,
        result: response.data.data.result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createContext(
    sessionId: string,
    type: 'default' | 'incognito' = 'default',
  ): Promise<Context> {
    const response = await this.apiClient.post(`/sessions/${sessionId}/contexts`, { type });

    return response.data.data;
  }

  async listContexts(sessionId: string): Promise<Context[]> {
    const response = await this.apiClient.get(`/sessions/${sessionId}/contexts`);
    return response.data.data;
  }

  async deleteContext(sessionId: string, contextId: string): Promise<void> {
    await this.apiClient.delete(`/sessions/${sessionId}/contexts/${contextId}`);
    console.log(`Context ${contextId} deleted`);
  }

  async createPage(sessionId: string, contextId: string, url?: string): Promise<Page> {
    const response = await this.apiClient.post(
      `/sessions/${sessionId}/contexts/${contextId}/pages`,
      { url },
    );

    return response.data.data;
  }

  async listPages(sessionId: string, contextId: string): Promise<Page[]> {
    const response = await this.apiClient.get(`/sessions/${sessionId}/contexts/${contextId}/pages`);
    return response.data.data;
  }

  async getMetrics(): Promise<any> {
    const response = await this.apiClient.get('/metrics');
    return response.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/health');
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  async cleanupAllSessions(): Promise<void> {
    const sessions = await this.listSessions();

    for (const session of sessions) {
      try {
        await this.deleteSession(session.id);
      } catch (error) {
        console.error(`Failed to cleanup session ${session.id}:`, error);
      }
    }

    console.log(`Cleaned up ${sessions.length} sessions`);
  }
}

// Example usage patterns

async function basicSessionLifecycle() {
  const manager = new RESTSessionManager();

  try {
    // Check server health
    const isHealthy = await manager.healthCheck();
    if (!isHealthy) {
      throw new Error('Server is not healthy');
    }

    // Create session
    const session = await manager.createSession({
      browserName: 'chrome',
      proxy: {
        proxyType: 'manual',
        httpProxy: 'proxy.example.com:8080',
      },
    });

    // Execute commands
    const result = await manager.execute(session.id, 'goto', ['https://example.com']);

    if (result.success) {
      console.log('Navigation successful');
    }

    // Get session info
    const updatedSession = await manager.getSession(session.id);
    console.log('Session status:', updatedSession.status);

    // Clean up
    await manager.deleteSession(session.id);
  } catch (error) {
    console.error('Session lifecycle error:', error);
  }
}

async function multiContextExample() {
  const manager = new RESTSessionManager();
  let sessionId: string | null = null;

  try {
    // Create session
    const session = await manager.createSession();
    sessionId = session.id;

    // Create multiple contexts
    const defaultContext = await manager.createContext(sessionId, 'default');
    const incognitoContext = await manager.createContext(sessionId, 'incognito');

    console.log('Created contexts:', {
      default: defaultContext.id,
      incognito: incognitoContext.id,
    });

    // Create pages in different contexts
    const page1 = await manager.createPage(sessionId, defaultContext.id, 'https://example.com');
    const page2 = await manager.createPage(sessionId, incognitoContext.id, 'https://example.org');

    console.log('Created pages:', [page1, page2]);

    // List all contexts
    const contexts = await manager.listContexts(sessionId);
    console.log(`Total contexts: ${contexts.length}`);

    // Clean up specific context
    await manager.deleteContext(sessionId, incognitoContext.id);
  } finally {
    if (sessionId) {
      await manager.deleteSession(sessionId);
    }
  }
}

async function sessionPoolExample() {
  const manager = new RESTSessionManager();
  const sessionPool: string[] = [];
  const poolSize = 5;

  try {
    // Create session pool
    console.log(`Creating session pool of size ${poolSize}...`);

    for (let i = 0; i < poolSize; i++) {
      const session = await manager.createSession();
      sessionPool.push(session.id);
    }

    console.log(`Session pool created: ${sessionPool.length} sessions`);

    // Use sessions for parallel operations
    const tasks = sessionPool.map(async (sessionId, index) => {
      const url = `https://example.com/page${index + 1}`;
      const result = await manager.execute(sessionId, 'goto', [url]);

      if (result.success) {
        // Take screenshot
        const screenshotResult = await manager.execute(sessionId, 'screenshot', [
          { fullPage: true },
        ]);

        return {
          sessionId,
          url,
          screenshot: screenshotResult.result,
        };
      }

      return null;
    });

    const results = await Promise.all(tasks);
    console.log(`Completed ${results.filter((r) => r !== null).length} tasks`);

    // Get metrics
    const metrics = await manager.getMetrics();
    console.log('System metrics:', metrics);
  } finally {
    // Clean up all sessions
    for (const sessionId of sessionPool) {
      try {
        await manager.deleteSession(sessionId);
      } catch (error) {
        console.error(`Failed to delete session ${sessionId}:`, error);
      }
    }
  }
}

async function errorRecoveryExample() {
  const manager = new RESTSessionManager();
  let sessionId: string | null = null;

  try {
    // Create session with retry logic
    let retries = 3;
    let session: Session | null = null;

    while (retries > 0 && !session) {
      try {
        session = await manager.createSession();
        sessionId = session.id;
      } catch (error) {
        retries--;
        console.log(`Session creation failed, retries left: ${retries}`);

        if (retries === 0) throw error;

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!session || !sessionId) {
      throw new Error('Failed to create session after retries');
    }

    // Execute with error handling
    const operations = [
      { script: 'goto', args: ['https://example.com'] },
      { script: 'waitForSelector', args: ['.main-content', { timeout: 5000 }] },
      { script: 'click', args: ['.submit-button'] },
    ];

    for (const op of operations) {
      const result = await manager.execute(sessionId, op.script, op.args);

      if (!result.success) {
        console.error(`Operation ${op.script} failed:`, result.error);

        // Attempt recovery
        if (result.error?.includes('timeout')) {
          console.log('Attempting to recover from timeout...');

          // Refresh page and retry
          await manager.execute(sessionId, 'reload', []);
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Retry operation
          const retryResult = await manager.execute(sessionId, op.script, op.args);
          if (!retryResult.success) {
            throw new Error(`Recovery failed for ${op.script}`);
          }
        }
      }
    }

    console.log('All operations completed successfully');
  } catch (error) {
    console.error('Error recovery example failed:', error);
  } finally {
    if (sessionId) {
      await manager.deleteSession(sessionId);
    }
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('REST API Session Management Examples\n');

    try {
      console.log('1. Basic Session Lifecycle');
      await basicSessionLifecycle();
      console.log('\n---\n');

      console.log('2. Multi-Context Example');
      await multiContextExample();
      console.log('\n---\n');

      console.log('3. Session Pool Example');
      await sessionPoolExample();
      console.log('\n---\n');

      console.log('4. Error Recovery Example');
      await errorRecoveryExample();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
