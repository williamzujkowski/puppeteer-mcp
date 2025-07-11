/**
 * WebSocket Real-Time Monitoring Example
 *
 * This example demonstrates:
 * - Establishing WebSocket connections
 * - Real-time event streaming
 * - Subscription management
 * - Handling reconnections
 * - Live browser event monitoring
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000';
const API_KEY = process.env.API_KEY || 'your-api-key';

interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
  requestId?: string;
}

interface AuthMessage {
  type: 'auth';
  payload: {
    apiKey: string;
  };
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  payload: {
    channel: string;
    filters?: Record<string, any>;
  };
}

interface BrowserEvent {
  sessionId: string;
  contextId: string;
  pageId?: string;
  event: string;
  data: any;
  timestamp: string;
}

class WebSocketMonitor extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;
  private subscriptions = new Set<string>();
  private messageQueue: WSMessage[] = [];
  private isAuthenticated = false;

  constructor(
    private url: string,
    private apiKey: string,
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to WebSocket: ${this.url}`);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.authenticate();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} - ${reason}`);
        this.isAuthenticated = false;
        this.handleReconnection();
      });

      // Timeout for initial connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  private authenticate(): void {
    const authMessage: AuthMessage = {
      type: 'auth',
      payload: {
        apiKey: this.apiKey,
      },
    };

    this.send(authMessage);
  }

  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'auth_success':
          this.isAuthenticated = true;
          console.log('Authentication successful');
          this.processQueuedMessages();
          this.resubscribeAll();
          this.emit('authenticated');
          break;

        case 'auth_failed':
          console.error('Authentication failed:', message.payload);
          this.disconnect();
          break;

        case 'subscribed':
          console.log(`Subscribed to channel: ${message.payload.channel}`);
          this.emit('subscribed', message.payload.channel);
          break;

        case 'unsubscribed':
          console.log(`Unsubscribed from channel: ${message.payload.channel}`);
          this.emit('unsubscribed', message.payload.channel);
          break;

        case 'browser_event':
          this.handleBrowserEvent(message.payload);
          break;

        case 'error':
          console.error('Server error:', message.payload);
          this.emit('server_error', message.payload);
          break;

        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleBrowserEvent(event: BrowserEvent): void {
    console.log(`Browser event: ${event.event} on ${event.pageId || event.contextId}`);

    // Emit specific event types
    switch (event.event) {
      case 'page_created':
        this.emit('page_created', event);
        break;

      case 'page_navigated':
        this.emit('page_navigated', event);
        break;

      case 'page_loaded':
        this.emit('page_loaded', event);
        break;

      case 'console_message':
        this.emit('console', event);
        break;

      case 'network_request':
        this.emit('network', event);
        break;

      case 'error':
        this.emit('browser_error', event);
        break;

      default:
        this.emit('browser_event', event);
    }
  }

  subscribe(channel: string, filters?: Record<string, any>): void {
    if (!this.isAuthenticated) {
      console.log('Queueing subscription until authenticated');
      this.messageQueue.push({
        type: 'subscribe',
        payload: { channel, filters },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const message: SubscriptionMessage = {
      type: 'subscribe',
      payload: { channel, filters },
    };

    this.send(message);
    this.subscriptions.add(channel);
  }

  unsubscribe(channel: string): void {
    const message: SubscriptionMessage = {
      type: 'unsubscribe',
      payload: { channel },
    };

    this.send(message);
    this.subscriptions.delete(channel);
  }

  private resubscribeAll(): void {
    console.log('Resubscribing to all channels...');
    this.subscriptions.forEach((channel) => {
      this.subscribe(channel);
    });
  }

  private processQueuedMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_exceeded');
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Reconnecting in ${this.reconnectInterval}ms... (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectInterval);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getState(): string {
    if (!this.ws) return 'DISCONNECTED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return this.isAuthenticated ? 'AUTHENTICATED' : 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Example 1: Monitor all browser events
async function monitorAllEvents() {
  const monitor = new WebSocketMonitor(WS_URL, API_KEY);

  try {
    // Set up event handlers
    monitor.on('authenticated', () => {
      console.log('Ready to monitor events');

      // Subscribe to all browser events
      monitor.subscribe('browser:*');
    });

    monitor.on('page_created', (event: BrowserEvent) => {
      console.log(`New page created: ${event.data.url}`);
    });

    monitor.on('page_navigated', (event: BrowserEvent) => {
      console.log(`Page navigated to: ${event.data.url}`);
    });

    monitor.on('console', (event: BrowserEvent) => {
      console.log(`Console ${event.data.level}: ${event.data.message}`);
    });

    monitor.on('browser_error', (event: BrowserEvent) => {
      console.error(`Browser error: ${event.data.message}`);
    });

    // Connect and start monitoring
    await monitor.connect();

    // Keep monitoring for 60 seconds
    await new Promise((resolve) => setTimeout(resolve, 60000));
  } finally {
    monitor.disconnect();
  }
}

// Example 2: Monitor specific session
async function monitorSession(sessionId: string) {
  const monitor = new WebSocketMonitor(WS_URL, API_KEY);
  const events: BrowserEvent[] = [];

  try {
    monitor.on('authenticated', () => {
      // Subscribe to specific session events
      monitor.subscribe('session:events', { sessionId });
    });

    monitor.on('browser_event', (event: BrowserEvent) => {
      events.push(event);
      console.log(`[${event.timestamp}] ${event.event}: ${JSON.stringify(event.data)}`);
    });

    await monitor.connect();

    // Monitor for 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Generate report
    console.log('\nSession Event Summary:');
    console.log(`Total events: ${events.length}`);

    const eventCounts = events.reduce(
      (acc, event) => {
        acc[event.event] = (acc[event.event] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(eventCounts).forEach(([event, count]) => {
      console.log(`  ${event}: ${count}`);
    });
  } finally {
    monitor.disconnect();
  }
}

// Example 3: Real-time performance monitoring
async function performanceMonitoring() {
  const monitor = new WebSocketMonitor(WS_URL, API_KEY);
  const performanceMetrics: Map<string, any[]> = new Map();

  try {
    monitor.on('authenticated', () => {
      // Subscribe to performance metrics
      monitor.subscribe('metrics:performance');
      monitor.subscribe('metrics:resource');
    });

    monitor.on('message', (message: WSMessage) => {
      if (message.type === 'performance_metric') {
        const { metric, value, pageId } = message.payload;

        if (!performanceMetrics.has(pageId)) {
          performanceMetrics.set(pageId, []);
        }

        performanceMetrics.get(pageId)?.push({
          metric,
          value,
          timestamp: message.timestamp,
        });

        // Alert on high values
        if (metric === 'memory_usage' && value > 100 * 1024 * 1024) {
          console.warn(`High memory usage detected: ${value / 1024 / 1024}MB`);
        }

        if (metric === 'cpu_usage' && value > 80) {
          console.warn(`High CPU usage detected: ${value}%`);
        }
      }
    });

    await monitor.connect();

    // Monitor for 60 seconds and generate periodic reports
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10000));

      console.log('\n--- Performance Report ---');
      performanceMetrics.forEach((metrics, pageId) => {
        console.log(`Page ${pageId}:`);

        const latest = metrics.slice(-10); // Last 10 metrics
        const avgMemory =
          latest.filter((m) => m.metric === 'memory_usage').reduce((sum, m) => sum + m.value, 0) /
          latest.length;

        const avgCpu =
          latest.filter((m) => m.metric === 'cpu_usage').reduce((sum, m) => sum + m.value, 0) /
          latest.length;

        console.log(`  Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Avg CPU: ${avgCpu.toFixed(2)}%`);
      });
    }
  } finally {
    monitor.disconnect();
  }
}

// Example 4: Multi-channel subscription
async function multiChannelMonitoring() {
  const monitor = new WebSocketMonitor(WS_URL, API_KEY);

  try {
    // Track events by channel
    const channelEvents: Map<string, number> = new Map();

    monitor.on('authenticated', () => {
      // Subscribe to multiple channels
      monitor.subscribe('browser:navigation');
      monitor.subscribe('browser:console');
      monitor.subscribe('browser:network');
      monitor.subscribe('browser:errors');
    });

    monitor.on('subscribed', (channel: string) => {
      channelEvents.set(channel, 0);
    });

    monitor.on('browser_event', (event: BrowserEvent) => {
      // Increment counter for the channel
      const channel = `browser:${event.event.split('_')[0]}`;
      channelEvents.set(channel, (channelEvents.get(channel) || 0) + 1);
    });

    await monitor.connect();

    // Monitor for 30 seconds
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Show statistics
    console.log('\nChannel Statistics:');
    channelEvents.forEach((count, channel) => {
      console.log(`${channel}: ${count} events`);
    });

    // Unsubscribe from busy channels
    channelEvents.forEach((count, channel) => {
      if (count > 100) {
        console.log(`Unsubscribing from busy channel: ${channel}`);
        monitor.unsubscribe(channel);
      }
    });
  } finally {
    monitor.disconnect();
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    console.log('WebSocket Real-Time Monitoring Examples\n');

    // Get session ID from command line or use default
    const sessionId = process.argv[2] || 'example-session-id';

    try {
      console.log('1. Monitor All Events (60s)');
      await monitorAllEvents();
      console.log('\n---\n');

      console.log(`2. Monitor Specific Session: ${sessionId} (30s)`);
      await monitorSession(sessionId);
      console.log('\n---\n');

      console.log('3. Performance Monitoring (60s)');
      await performanceMonitoring();
      console.log('\n---\n');

      console.log('4. Multi-Channel Monitoring (30s)');
      await multiChannelMonitoring();
    } catch (error) {
      console.error('Example failed:', error);
    }
  })();
}
