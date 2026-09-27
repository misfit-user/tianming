// @ts-check

import { createCore } from './core.js';
import { createValidators } from './validators.js';
import { createReconcile } from './reconcile.js';
import { createLegacyDeps, validateDependencies } from './context.js';
import { installLegacyFacade } from './legacy-adapter.js';

export function buildAIChangeApplier(deps) {
  validateDependencies(deps);
  var core = createCore(deps);
  var validators = createValidators({ global: deps.global, core: core.internals });
  var reconcile = createReconcile({
    global: deps.global,
    core: core.internals,
    validators: validators
  });
  core.bindModules({ validators: validators, reconcile: reconcile });
  core.facade.writeGuards = Object.freeze({
    runAtomicMutation: reconcile.runAtomicMutation,
    sensitiveCharFieldSourced: validators._sensitiveCharFieldSourced
  });
  return {
    facade: core.facade,
    legacyExports: Object.assign({}, core.legacyExports, reconcile.legacyExports)
  };
}

export function createAIChangeApplier(deps) {
  return buildAIChangeApplier(deps).facade;
}

export function installAIChangeApplier(global) {
  return installLegacyFacade(global, buildAIChangeApplier, createLegacyDeps);
}

var rendererRoot = typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : null);

if (rendererRoot) installAIChangeApplier(rendererRoot);
