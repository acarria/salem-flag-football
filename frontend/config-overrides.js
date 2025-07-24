module.exports = function override(config, env) {
  // For now, just return the config as-is
  // The webpack deprecation warnings are from webpack-dev-server internals
  // and are not critical - they don't affect functionality
  return config;
}; 