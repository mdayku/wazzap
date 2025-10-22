import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  children?: ReactNode;
  name: string; // Name of the component being wrapped
  fallback?: ReactNode; // Optional fallback UI
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`❌ [ERROR_BOUNDARY] Error in ${this.props.name}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Something went wrong in {this.props.name}.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#FFCCCC',
    borderRadius: 5,
    margin: 5,
  },
  text: {
    color: '#CC0000',
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
