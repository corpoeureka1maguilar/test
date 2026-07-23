import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['vite.config.ts', 'vitest.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        // Habilita reglas type-aware (no-floating-promises, strict-boolean-expressions,
        // etc.) sin adoptar todo recommendedTypeChecked, que agregaría ~20 reglas nuevas
        // en 'error' sobre código existente no auditado para eso.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // Hooks: en un POS, deps mal declaradas dejan un total/descuento "stale" tras
      // cambiar cantidad — no es cosmético, es plata mal calculada.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Comparaciones y coerción: precios/cantidades vienen de inputs y de RPC de Odoo,
      // donde "10" == 10 puede colarse.
      eqeqeq: ['error', 'always'],
      // Odoo devuelve `false` (no null/undefined) en Many2one/Text/etc. vacíos.
      // no-eq-null obliga a comparar explícito contra false/null/undefined en vez
      // de agrupar todo con == null, que en un campo boolean/0 legítimo esconde bugs.
      'no-eq-null': 'error',
      'no-implicit-coercion': 'error',
      radix: 'error',

      // Errores silenciosos
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error',
      'default-case': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // Async/promesas: crítico en el flujo de pago y en llamadas RPC a Odoo/bridge.
      // no-floating-promises evita que un write()/create() contra Odoo se dispare
      // y el código siga como si ya hubiese terminado (carrito "confirmado" en la UI
      // que en realidad falló en el servidor).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
      'no-promise-executor-return': 'error',

      // Errores de Odoo llegan anidados en error.data.message vía JSON-RPC; forzar
      // que la capa de traducción a UI siempre trabaje con Error reales, no strings.
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',

      // TS estricto sobre datos que vienen del ORM de Odoo (false en vez de null/undefined,
      // cliente sin tipos estrictos para modelos eu_*).
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/strict-boolean-expressions': ['warn', { allowNullableBoolean: true }],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-assertions': 'error',

      // Precisión numérica: nunca hagas aritmética de totales confiando en floats;
      // esta regla solo atrapa el caso extremo de un literal que ya perdió precisión.
      'no-loss-of-precision': 'error',

      // Accesibilidad en pantalla táctil/kiosco
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // vite.config.ts / vitest.config.ts quedan fuera de tsconfig.json (include: ["src"]),
    // así que el parser type-aware (projectService) no los puede resolver. Se lintean
    // sin type info en vez de agregarlos al tsconfig de la app.
    files: ['vite.config.ts', 'vitest.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  },
  {
    // Boundary del offlineQueue: el count es un espejo síncrono de IndexedDB y
    // SOLO debe mutarse re-derivándolo desde la fuente de verdad vía
    // orderQueue.hydrateCount(). Llamar setCount() directo saltea IndexedDB y
    // puede desincronizar el contador. La regla vuelve dura esa convención.
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/shared/lib/orderQueue.ts', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='setCount'][callee.object.type='CallExpression'][callee.object.callee.property.name='getState']",
          message:
            'No mutes el offlineQueue store directamente. Usá orderQueue.enqueue/dequeue/hydrateCount — IndexedDB es la fuente de verdad y el count se re-deriva de ahí.',
        },
      ],
    },
  },
  {
    files: [
      'server.js',
      'proxy-local.js',
      'merchant-mock.js',
      'api/**/*.js',
      '.agents/**/*.js',
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      // Este proxy habla JSON-RPC con Odoo/el bridge — mismos riesgos que en el
      // frontend pero sin type-checking disponible acá.
      eqeqeq: ['error', 'always'],
      'no-eq-null': 'error',
      'no-shadow': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-promise-executor-return': 'error',
    },
  },
  prettierConfig
)
