import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { perf } from '../utils/perf';

interface PerfPanelProps {
  visible?: boolean;
  onClose?: () => void;
}

export default function PerfPanel({ visible = true, onClose }: PerfPanelProps) {
  const [summary, setSummary] = useState(perf.getSummary());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setSummary(perf.getSummary());
      setRefreshKey(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  const handleExport = async () => {
    const json = perf.exportJSON();
    try {
      await Share.share({
        message: json,
        title: 'Performance Metrics',
      });
    } catch (error) {
      console.error('Error sharing metrics:', error);
    }
  };

  const handleReset = () => {
    perf.reset();
    setSummary(perf.getSummary());
  };

  const getBudgetColor = (value: number, budget: number): string => {
    if (value === 0) return '#666';
    if (value <= budget) return '#4CAF50';
    if (value <= budget * 1.5) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Performance Panel</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={handleReset} style={styles.button}>
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleExport} style={styles.button}>
            <Text style={styles.buttonText}>Export</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.button}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Send Latency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📤 Send Latency (Budget: 120ms p50, 250ms p95)</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Count</Text>
              <Text style={styles.metricValue}>{summary.send.count}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>p50</Text>
              <Text style={[
                styles.metricValue,
                { color: getBudgetColor(summary.send.p50, 120) }
              ]}>
                {summary.send.p50.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>p95</Text>
              <Text style={[
                styles.metricValue,
                { color: getBudgetColor(summary.send.p95, 250) }
              ]}>
                {summary.send.p95.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>p99</Text>
              <Text style={styles.metricValue}>
                {summary.send.p99.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>avg</Text>
              <Text style={styles.metricValue}>
                {summary.send.avg.toFixed(0)}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Receive Latency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📥 Receive Latency</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Count</Text>
              <Text style={styles.metricValue}>{summary.receive.count}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>p50</Text>
              <Text style={styles.metricValue}>
                {summary.receive.p50.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>p95</Text>
              <Text style={styles.metricValue}>
                {summary.receive.p95.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>avg</Text>
              <Text style={styles.metricValue}>
                {summary.receive.avg.toFixed(0)}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Reconnect Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Reconnect (Budget: &lt;1s)</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Count</Text>
              <Text style={styles.metricValue}>{summary.reconnect.count}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Last</Text>
              <Text style={[
                styles.metricValue,
                { color: getBudgetColor(summary.reconnect.last, 1000) }
              ]}>
                {summary.reconnect.last.toFixed(0)}ms
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Avg</Text>
              <Text style={styles.metricValue}>
                {summary.reconnect.avg.toFixed(0)}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Launch Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Launch (Budget: &lt;2s)</Text>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Time</Text>
              <Text style={[
                styles.metricValue,
                { color: getBudgetColor(summary.launch.time, 2000) }
              ]}>
                {summary.launch.time > 0 
                  ? `${(summary.launch.time / 1000).toFixed(2)}s`
                  : 'N/A'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Budget Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Budget Status</Text>
          <View style={styles.budgetList}>
            <Text style={styles.budgetItem}>
              🟢 Green: Within budget
            </Text>
            <Text style={styles.budgetItem}>
              🟠 Orange: 1-1.5x budget
            </Text>
            <Text style={styles.budgetItem}>
              🔴 Red: &gt;1.5x budget
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metric: {
    minWidth: 80,
  },
  metricLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  budgetList: {
    gap: 8,
  },
  budgetItem: {
    fontSize: 12,
    color: '#ccc',
    marginBottom: 4,
  },
});

