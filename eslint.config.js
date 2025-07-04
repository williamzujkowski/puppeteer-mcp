import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Base configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  
  // Global ignores
  {
    ignores: [
      // Dependencies
      'node_modules/**',
      
      // Build output
      'dist/**',
      'build/**',
      'coverage/**',
      '*.tsbuildinfo',
      
      // Generated files
      'src/grpc/generated/**',
      '**/*.d.ts',
      
      // IDE
      '.vscode/**',
      '.idea/**',
      
      // Environment
      '.env',
      '.env.*',
      
      // Logs
      '*.log',
      'logs/**',
      
      // OS files
      '.DS_Store',
      'Thumbs.db',
      
      // Test coverage
      '.nyc_output/**',
      
      // Temporary files
      'tmp/**',
      'temp/**',
      '*.tmp',
      
      // Documentation build
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      
      // Scripts (JavaScript files)
      'scripts/*.js',
      
      // Config files that should be ignored
      '*.js',
      '*.mjs',
      '*.cjs',
      '!eslint.config.js', // Except this config file
    ],
  },
  
  // TypeScript parser options
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  
  // Main configuration for TypeScript files
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: {
      security,
    },
    rules: {
      // TypeScript Strict Rules (CS:TS Standards)
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': ['warn', {
        allowString: true,
        allowNumber: true,
        allowNullableObject: true,
      }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Allow require imports for dynamic loading
      '@typescript-eslint/no-base-to-string': 'warn', // Warn about object-to-string conversions
      
      // Security Rules (SEC:API Standards)
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      
      // General Best Practices
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'off', // Disabled in favor of @typescript-eslint/return-await
      '@typescript-eslint/return-await': 'error',
      'require-await': 'off', // Disabled in favor of @typescript-eslint/require-await
      '@typescript-eslint/require-await': 'error',
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      
      // Code Quality
      'complexity': ['error', 10],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
    },
  },
  
  // Test file overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },
  
  // Apply prettier config last to disable conflicting rules
  prettierConfig,
);