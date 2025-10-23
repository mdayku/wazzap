module.exports = {
  root: true,
  extends: [
    'expo',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Warn on console.log (except in specific files)
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    
    // TypeScript specific
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    
    // React Native specific  
    'react-hooks/exhaustive-deps': 'off', // Too noisy, handle manually
    
    // General code quality
    'no-debugger': 'error',
    'prefer-const': 'warn',
  },
  overrides: [
    {
      // Test files can use require() for dynamic imports
      files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'build/',
    '*.config.js',
    'firebase/functions/', // Backend code with different dependencies
    'scripts/', // Utility scripts use CommonJS and console.log
  ],
};

