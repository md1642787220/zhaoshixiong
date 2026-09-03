/* ============================================================
 * server.js - 服务启动入口
 * 职责：加载配置、构建容器、创建应用并监听端口。
 *       不含任何业务逻辑。
 * ============================================================ */
const { loadConfig } = require('./config');
const { createLogger } = require('./core/logger');
const { createContainer } = require('./container');
const { createApp } = require('./app');

function bootstrap() {
  const config = loadConfig();
  const logger = createLogger({ level: config.log.level });

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
    logger.info('==================================');
  });

  /** 优雅关闭 */
  function shutdown(signal) {
    logger.info(`收到 ${signal}，正在关闭服务…`);
    server.close(() => {
      logger.info('服务已关闭');
      process.exit(0);
    });
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { app, server, config, logger, container };
}

if (require.main === module) {
  bootstrap();
}

module.exports = { bootstrap };
