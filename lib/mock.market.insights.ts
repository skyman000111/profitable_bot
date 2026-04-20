import chalk from "chalk";

type PopularParameter = {
  name: string;
  value: string;
  reason: string;
};

type MockMarketSnapshot = {
  timestamp: string;
  network: string;
  marketTrend: string;
  avgLiquiditySOL: number;
  estVolatilityPct: number;
  estimatedRoundTripFeeSOL: number;
  popularParameters: PopularParameter[];
};

const MOCK_UPDATE_INTERVAL_MS = 30 * 1000;
const SOLANA_FETCH_DURATION_MS = 2 * 60 * 1000;
const MOCK_STUDYING_DURATION_MS = 60 * 1000;
const MOCK_STUDYING_PROGRESS_INTERVAL_MS = 250;
const ML_START_DELAY_MS = 2 * 1000;
const MINIMUM_WALLET_BALANCE_FOR_PROFIT_MIN_SOL = 120;
const MINIMUM_WALLET_BALANCE_FOR_PROFIT_MAX_SOL = 130;
let marketInfoIntervalId: NodeJS.Timeout | null = null;
let phaseProgressIntervalId: NodeJS.Timeout | null = null;
let mockStudyCycleTimeoutId: NodeJS.Timeout | null = null;
let hasStartedMockPipeline = false;

const pickOne = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const randomRange = (min: number, max: number, decimals = 2): number =>
  Number((Math.random() * (max - min) + min).toFixed(decimals));

const formatSol = (value: number, decimals = 1): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

const renderProgressBar = (percent: number, width = 24): string => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
};

const writeProgressLine = (line: string): void => {
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
    return;
  }

  console.log(line);
};

const stopMarketUpdates = (): void => {
  if (!marketInfoIntervalId) {
    return;
  }
  clearInterval(marketInfoIntervalId);
  marketInfoIntervalId = null;
};

const startMarketUpdates = (): void => {
  if (marketInfoIntervalId) {
    return;
  }

  logMockSolanaTradingMarketInfo();
  marketInfoIntervalId = setInterval(() => {
    logMockSolanaTradingMarketInfo();
  }, MOCK_UPDATE_INTERVAL_MS);
};

const createMockMarketSnapshot = (): MockMarketSnapshot => {
  const entryPricePerTokenSol = randomRange(0.0000005, 0.00002, 8);
  const stopLoss = randomRange(8, 16, 0);
  const takeProfit = randomRange(18, 35, 0);
  const maxSlippage = randomRange(5, 10, 0);
  const maxHoldSeconds = randomRange(120, 300, 0);

  return {
    timestamp: new Date().toISOString(),
    network: "Solana Mainnet",
    marketTrend: pickOne([
      "Meme season recovery",
      "Sideways accumulation",
      "High beta breakout",
      "Risk-off chop",
    ]),
    avgLiquiditySOL: randomRange(5000, 75000, 1),
    estVolatilityPct: randomRange(12, 30, 1),
    estimatedRoundTripFeeSOL: randomRange(0.0007, 0.0014, 5),
    popularParameters: [
      {
        name: "Entry Size",
        value: `${entryPricePerTokenSol} SOL / 1 token`,
        reason: "Token entry price quoted in SOL per token",
      },
      {
        name: "Take Profit",
        value: `+${takeProfit}%`,
        reason: "Popular first target for fast exits",
      },
      {
        name: "Stop Loss",
        value: `-${stopLoss}%`,
        reason: "Typical risk cap for volatile pairs",
      },
      {
        name: "Max Slippage",
        value: `${maxSlippage}%`,
        reason: "Balances fill probability and pricing",
      },
      {
        name: "Max Hold Time",
        value: `${maxHoldSeconds}s`,
        reason: "Common time-based risk control",
      },
    ],
  };
};

export const logMockSolanaTradingMarketInfo = (): void => {
  const snapshot = createMockMarketSnapshot();
  const minimumWalletBalanceSol = randomRange(
    MINIMUM_WALLET_BALANCE_FOR_PROFIT_MIN_SOL,
    MINIMUM_WALLET_BALANCE_FOR_PROFIT_MAX_SOL,
    1
  );

  console.log(chalk.magenta("📈 SOLANA MARKET SNAPSHOT"));
  console.log(chalk.gray("   (all values below are generated data for development/testing)"));
  console.log(
    `${chalk.cyan("Network:")} ${snapshot.network} | ${chalk.cyan("Trend:")} ${
      snapshot.marketTrend
    } | ${chalk.cyan("Volatility:")} ~${snapshot.estVolatilityPct}%`
  );
  console.log(
    `${chalk.cyan("Avg Liquidity:")} ${formatSol(snapshot.avgLiquiditySOL)} SOL | ${chalk.cyan(
      "Est. Round-Trip Fee:"
    )} ${snapshot.estimatedRoundTripFeeSOL} SOL`
  );
  console.log(chalk.yellow("Popular Parameter Values:"));

  for (const parameter of snapshot.popularParameters) {
    console.log(`  - ${parameter.name}: ${parameter.value} (${parameter.reason})`);
  }

  console.log(
    chalk.green(
      `💼 Minimum wallet balance to make profit: ${minimumWalletBalanceSol} SOL`
    )
  );
  console.log(chalk.gray(`Snapshot Time: ${snapshot.timestamp}`));
};

export const startMockSolanaMarketInfoUpdater = (): void => {
  if (hasStartedMockPipeline) {
    return;
  }
  hasStartedMockPipeline = true;

  const runMockStudyCycle = (): void => {
    stopMarketUpdates();

    const runPhaseProgress = (
      headerLine: string,
      estimatedTimeLine: string,
      progressPrefix: string,
      doneLine: string,
      phaseDurationMs: number,
      onDone: () => void
    ): void => {
      const phaseStartMs = Date.now();
      console.log(chalk.blue(headerLine));
      console.log(chalk.gray(estimatedTimeLine));

      const logProgress = (): void => {
        const elapsedMs = Date.now() - phaseStartMs;
        const progressPct = Math.min(100, Math.floor((elapsedMs / phaseDurationMs) * 100));
        const progressBar = renderProgressBar(progressPct);
        const remainingMs = Math.max(0, phaseDurationMs - elapsedMs);
        const elapsedText = formatDuration(elapsedMs);
        const remainingText = formatDuration(remainingMs);

        writeProgressLine(
          chalk.blue(
            `${progressPrefix}: ${progressBar} ${progressPct}% | elapsed: ${elapsedText} | eta: ${remainingText}`
          )
        );
      };

      logProgress();
      phaseProgressIntervalId = setInterval(() => {
        logProgress();
      }, MOCK_STUDYING_PROGRESS_INTERVAL_MS);

      setTimeout(() => {
        if (phaseProgressIntervalId) {
          clearInterval(phaseProgressIntervalId);
          phaseProgressIntervalId = null;
        }

        if (process.stdout.isTTY) {
          process.stdout.write("\n");
        }

        console.log(chalk.green(doneLine));
        onDone();
      }, phaseDurationMs);
    };

    runPhaseProgress(
      "🌐 Fetching Solana market data...",
      "   Estimated fetch time: 2 minutes",
      "📡 Solana data fetch progress",
      "✅ Solana data fetch complete. Starting Machine Learning study...",
      SOLANA_FETCH_DURATION_MS,
      () => {
        runPhaseProgress(
          "🤖 Machine Learning model is studying Solana market state...",
          "   Estimated study time: 1 minute",
          "🧠 Machine Learning study progress",
          "✅ Machine Learning studying complete. Starting live market updates...",
          MOCK_STUDYING_DURATION_MS,
          () => {
            startMarketUpdates();

            mockStudyCycleTimeoutId = setTimeout(() => {
              runMockStudyCycle();
            }, MOCK_STUDYING_DURATION_MS);
          }
        );
      }
    );
  };

  setTimeout(() => {
    runMockStudyCycle();
  }, ML_START_DELAY_MS);
};
