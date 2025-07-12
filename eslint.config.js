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
      'starlight-docs/**',

      // Scripts (JavaScript files)
      'scripts/*.js',

      // Test mocks
      'tests/__mocks__/**',

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
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off', // Allow require imports for dynamic loading
      '@typescript-eslint/no-base-to-string': 'warn', // Warn about object-to-string conversions
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Security Rules (SEC:API Standards)
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',

      // General Best Practices
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'warn',
      'prefer-promise-reject-errors': 'warn',
      'no-return-await': 'off', // Disabled in favor of @typescript-eslint/return-await
      '@typescript-eslint/return-await': 'warn',
      'require-await': 'off', // Disabled in favor of @typescript-eslint/require-await
      '@typescript-eslint/require-await': 'warn',
      'no-async-promise-executor': 'warn',
      'no-promise-executor-return': 'warn',

      // Code Quality
      complexity: ['warn', 15],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 6],
      'max-params': ['warn', 6],
    },
  },

  // Test file overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'no-console': 'off', // Allow console.log in tests
      '@typescript-eslint/no-unused-vars': 'off', // More permissive for test files
    },
  },

  // Apply prettier config last to disable conflicting rules
  prettierConfig,
);
