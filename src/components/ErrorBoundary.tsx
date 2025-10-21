import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const boundaryName = this.props.name || 'Unknown';
    console.error(`🚨 [ERROR BOUNDARY: ${boundaryName}]`, error);
    console.error(`🚨 [ERROR BOUNDARY: ${boundaryName}] Component Stack:`, errorInfo.componentStack);
    console.error(`🚨 [ERROR BOUNDARY: ${boundaryName}] Error Message:`, error.message);
    console.error(`🚨 [ERROR BOUNDARY: ${boundaryName}] Error Stack:`, error.stack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <View style={styles.container}>
          <Text style={styles.errorText}>
            Error in {this.props.name || 'component'}
          </Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    margin: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
  },
});

export default ErrorBoundary;

