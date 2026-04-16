const path = require('node:path');

const RESET = '\x1b[0m';
const CYAN = '\x1b[38;5;51m';
const GREEN = '\x1b[38;5;82m';
const YELLOW = '\x1b[38;5;220m';
const RED = '\x1b[38;5;196m';
const BLUE = '\x1b[38;5;117m';
const MAGENTA = '\x1b[38;5;183m';
const GRAY = '\x1b[90m';
const GOLD = '\x1b[38;5;228m';
const SPRING = '\x1b[38;5;78m';

function colorForPercentage(value) {
  if (value > 80) {
    return RED;
  }
  if (value > 50) {
    return YELLOW;
  }
  return GREEN;
}

function colorize(color, text) {
  return `${color}${text}${RESET}`;
}

function getThroughput(stdin) {
  const outputTokens = Number(stdin.context_window?.total_output_tokens || 0);
  const durationMs = Number(stdin.cost?.total_api_duration_ms || 0);

  if (!outputTokens || !durationMs || durationMs < 1000) {
    return null;
  }

  return `${(outputTokens / (durationMs / 1000)).toFixed(1)} t/s`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0m';
  }

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${minutes}m`;
}

function formatFreshness(snapshot) {
  if (!snapshot || snapshot.snapshot_age_ms === null) {
    return null;
  }

  return `${snapshot.status} ${formatDuration(snapshot.snapshot_age_ms)}`;
}

function makeBar(pct, width = 8) {
  if (!Number.isFinite(pct)) {
    return `${GRAY}${'░'.repeat(width)}${RESET}`;
  }

  const filled = Math.max(pct > 0 ? 1 : 0, Math.round((pct / 100) * width));
  const empty = Math.max(0, width - filled);
  const color = colorForPercentage(pct);

  return `${color}${'█'.repeat(filled)}${GRAY}${'░'.repeat(empty)}${RESET}`;
}

function getWorkspaceName(stdin) {
  const currentDir = stdin.workspace?.current_dir;
  return currentDir ? path.basename(currentDir) : '';
}

function getErrorMessage(snapshot) {
  const messages = {
    no_token: 'no token configured',
    timeout: 'request timeout',
    network_error: 'network error',
    unauthorized: 'unauthorized',
    forbidden: 'forbidden',
    client_error: 'client error',
    server_error: 'server error',
    invalid_response: 'invalid response',
    unavailable: 'quota unavailable',
  };

  return messages[snapshot.status] || 'quota unavailable';
}

function buildBaseParts(stdin) {
  const parts = [];
  const model = stdin.model?.display_name;
  const ctxPct = Math.trunc(Number(stdin.context_window?.used_percentage || 0));
  const throughput = getThroughput(stdin);

  if (model) {
    parts.push(colorize(CYAN, model));
  }
  if (ctxPct > 0) {
    parts.push(colorize(colorForPercentage(ctxPct), `CTX ${ctxPct}%`));
  }
  if (throughput) {
    parts.push(colorize(BLUE, throughput));
  }

  return parts;
}

function buildProjectLine(stdin, branch) {
  const workspace = getWorkspaceName(stdin);
  const parts = [];

  if (workspace) {
    parts.push(colorize(GOLD, workspace));
  }
  if (branch) {
    parts.push(colorize(SPRING, branch));
  }

  return parts.join(colorize(GRAY, ' | '));
}

function renderStatusOutput(options) {
  const {
    stdin,
    snapshot,
    provider,
    branch,
    now = Date.now,
  } = options;
  const lines = [];
  const baseParts = buildBaseParts(stdin);

  if (baseParts.length > 0) {
    lines.push(baseParts.join(colorize(GRAY, ' | ')));
  }

  if (provider.isGlm) {
    const errorStatuses = [
      'no_token', 'timeout', 'network_error', 'unauthorized',
      'forbidden', 'client_error', 'server_error', 'invalid_response',
    ];

    if (!snapshot || snapshot.status === 'unavailable' || errorStatuses.includes(snapshot.status)) {
      const errorMsg = snapshot ? getErrorMessage(snapshot) : 'quota unavailable';
      lines.push(colorize(RED, `QUOTA    | ${errorMsg}`));
    } else {
      const tokenPct = snapshot.token_usage_pct ?? 0;
      const railColor = colorForPercentage(tokenPct);
      const resetMs = Number(snapshot.token_reset_at || 0) - now();
      const planLevel = String(snapshot.plan_level || 'unknown').toUpperCase();
      const freshness = formatFreshness(snapshot);
      const mcpText = snapshot.mcp_total
        ? `${snapshot.mcp_remaining}/${snapshot.mcp_total}`
        : '--';

      lines.push(
        `TOKEN 5H | ${makeBar(tokenPct)} | ${colorize(railColor, `${tokenPct}%`)}`,
      );
      lines.push(
        `PLAN     | ${colorize(MAGENTA, planLevel)} | ${colorize(YELLOW, `reset ${formatDuration(resetMs)}`)}`,
      );
      lines.push(
        `MCP      | ${colorize(GREEN, mcpText)}${freshness ? ` | ${colorize(GRAY, freshness)}` : ''}`,
      );
    }
  }

  const projectLine = buildProjectLine(stdin, branch);
  if (projectLine) {
    lines.push(projectLine);
  }

  return lines.join('\n');
}

module.exports = {
  buildBaseParts,
  getThroughput,
  renderStatusOutput,
  getErrorMessage,
};
