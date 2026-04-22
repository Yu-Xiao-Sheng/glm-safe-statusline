function detectProviderRuntime(options = {}) {
  const env = options.env || process.env;
  const baseUrl = String(env.ANTHROPIC_BASE_URL || '');

  if (baseUrl.includes('open.bigmodel.cn')) {
    return { isGlm: true, isMinimax: false, provider: 'glm' };
  }
  if (baseUrl.includes('api.minimaxi.com')) {
    return { isGlm: false, isMinimax: true, provider: 'minimax' };
  }
  return { isGlm: false, isMinimax: false, provider: 'unknown' };
}

module.exports = {
  detectProviderRuntime,
};
