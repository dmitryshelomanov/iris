// Re-export the native module. On web, it will be resolved to IrisLookBakeModule.web.ts
// and on native platforms to IrisLookBakeModule.ts
export { default } from './src/IrisLookBakeModule';
export * from './src/IrisLookBake.types';
