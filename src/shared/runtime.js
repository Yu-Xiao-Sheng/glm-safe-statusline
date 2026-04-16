function detectProviderRuntime(options = {}) {
  const env = options.env || process.env;
  const baseUrl = String(env.ANTHROPIC_BASE_URL || '');

  if (baseUrl.includes('open.bigmodel.cn')) {
    return {
      isGlm: true,
      provider: 'glm',
    };
  }

  return {
    isGlm: false,
    provider: 'unknown',
  };
}

module.exports = {
  detectProviderRuntime,
};
