/**
 * Performance instrumentation utility
 * Tracks latency, reconnect times, and other metrics
 */

export interface PerfMetric {
  name: string;
  value: number;
  timestamp: number;
}

export interface PerfStats {
  sendLatency: number[];
  receiveLatency: number[];
  reconnectTime: number[];
  launchTime: number;
  scrollJank: number;
}

class PerformanceMonitor {
  private metrics: PerfMetric[] = [];
  private marks: Map<string, number> = new Map();
  private stats: PerfStats = {
    sendLatency: [],
    receiveLatency: [],
    reconnectTime: [],
    launchTime: 0,
    scrollJank: 0,
  };

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : Date.now();
    
    if (!start) {
      console.warn(`[PERF] Start mark "${startMark}" not found`);
      return 0;
    }

    const duration = (end || Date.now()) - start;
    
    this.metrics.push({
      name,
      value: duration,
      timestamp: Date.now(),
    });

    // Update stats
    if (name.includes('SEND_LATENCY')) {
      this.stats.sendLatency.push(duration);
    } else if (name.includes('RECEIVE_LATENCY')) {
      this.stats.receiveLatency.push(duration);
    } else if (name.includes('RECONNECT')) {
      this.stats.reconnectTime.push(duration);
    } else if (name.includes('LAUNCH')) {
      this.stats.launchTime = duration;
    }

    return duration;
  }

  recordSendLatency(latency: number): void {
    this.stats.sendLatency.push(latency);
    this.metrics.push({
      name: 'SEND_LATENCY',
      value: latency,
      timestamp: Date.now(),
    });
  }

  recordReceiveLatency(latency: number): void {
    this.stats.receiveLatency.push(latency);
    this.metrics.push({
      name: 'RECEIVE_LATENCY',
      value: latency,
      timestamp: Date.now(),
    });
  }

  getStats(): PerfStats {
    return { ...this.stats };
  }

  getMetrics(): PerfMetric[] {
    return [...this.metrics];
  }

  calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getSummary() {
    const { sendLatency, receiveLatency, reconnectTime, launchTime } = this.stats;

    return {
      send: {
        count: sendLatency.length,
        p50: this.calculatePercentile(sendLatency, 50),
        p95: this.calculatePercentile(sendLatency, 95),
        p99: this.calculatePercentile(sendLatency, 99),
        avg: sendLatency.length > 0 
          ? sendLatency.reduce((a, b) => a + b, 0) / sendLatency.length 
          : 0,
      },
      receive: {
        count: receiveLatency.length,
        p50: this.calculatePercentile(receiveLatency, 50),
        p95: this.calculatePercentile(receiveLatency, 95),
        p99: this.calculatePercentile(receiveLatency, 99),
        avg: receiveLatency.length > 0
          ? receiveLatency.reduce((a, b) => a + b, 0) / receiveLatency.length
          : 0,
      },
      reconnect: {
        count: reconnectTime.length,
        avg: reconnectTime.length > 0
          ? reconnectTime.reduce((a, b) => a + b, 0) / reconnectTime.length
          : 0,
        last: reconnectTime[reconnectTime.length - 1] || 0,
      },
      launch: {
        time: launchTime,
      },
    };
  }

  reset(): void {
    this.metrics = [];
    this.marks.clear();
    this.stats = {
      sendLatency: [],
      receiveLatency: [],
      reconnectTime: [],
      launchTime: 0,
      scrollJank: 0,
    };
  }

  exportJSON(): string {
    return JSON.stringify({
      metrics: this.metrics,
      stats: this.stats,
      summary: this.getSummary(),
      timestamp: Date.now(),
    }, null, 2);
  }
}

export const perf = new PerformanceMonitor();

