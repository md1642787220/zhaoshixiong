/* ============================================================
 * server.js - 服务启动入口
 * 职责：加载配置、构建容器、创建应用并监听端口。
 *       不含任何业务逻辑。
 * ============================================================ */
const { loadConfig } = require('./config');
const { createLogger } = require('./core/logger');
const { createContainer } = require('./container');
const { createApp } = require('./app');
const { attachPdfWs } = require('./wsProxy');
const { maybeLaunchPdfWorker } = require('./infrastructure/pdfWorkerLauncher');

async function bootstrap() {
  let config = loadConfig();
  const logger = createLogger({ level: config.log.level });

  // 随 Node 后端按需启动本地 PDF Worker（成功后写入 PDF_WORKER_URL）
  const pdfWorker = await maybeLaunchPdfWorker({ config, logger });
  if (pdfWorker && !config.pdfWorker.url) config = loadConfig();

  const container = createContainer({ config, logger });
  const app = createApp({
    config,
    logger,
    services: container.services,
    storage: container.storage,
  });

  const { port, host } = config.server;
  const server = app.listen(port, host, () => {
    logger.info('==================================');
    logger.info('  shixiong 后端服务已启动');
    logger.info(`  站点: http://localhost:${port}`);
    logger.info(`  API : http://localhost:${port}/api/health`);
    logger.info(`  环境: ${config.env}`);
    logger.info(`  PDF Worker: ${config.pdfWorker.url || '未启用（引擎类工具降级）'}`);
    logger.info('==================================');
  });

  // 挂载 PDF Worker 的 WebSocket 代理（实时进度推送）
  attachPdfWs(server, { pdfWorkerUrl: config.pdfWorker.url, logger });

  /** 优雅关闭 */
  function shutdown(signal) {
    logger.info(`收到 ${signal}，正在关闭服务…`);
    server.close(() => {
      if (pdfWorker && pdfWorker.stop) pdfWorker.stop();
      logger.info('服务已关闭');
      process.exit(0);
    });
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('exit', () => { if (pdfWorker && pdfWorker.stop) pdfWorker.stop(); });

  return { app, server, config, logger, container };
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('服务启动失败:', err);
    process.exit(1);
  });
}

module.exports = { bootstrap };
