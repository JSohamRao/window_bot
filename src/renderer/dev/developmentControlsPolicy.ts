declare const __THUKUNA_PRODUCTION_BUILD__: boolean;

export const developmentControlsEnabledFor = (
  productionBuild: boolean
): boolean => !productionBuild;

const productionBuild =
  typeof __THUKUNA_PRODUCTION_BUILD__ !== "undefined" &&
  __THUKUNA_PRODUCTION_BUILD__;

export const DEVELOPMENT_CONTROLS_ENABLED =
  developmentControlsEnabledFor(productionBuild);
