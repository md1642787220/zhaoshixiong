/* ============================================================
 * container.js - 依赖注入容器
 * 职责：集中创建并组装各层依赖（基础设施 → 数据访问 → 业务服务），
 *       上层只依赖抽象接口，替换实现无需改动业务代码。
 * ============================================================ */
const { createStorage } = require('./infrastructure/storage');
const { createFfmpeg } = require('./infrastructure/ffmpeg');
const { createPdfWorkerClient } = require('./infrastructure/pdfWorkerClient');
const { createPdfEngine } = require('./infrastructure/pdfEngineFactory');
const { createLearnRepository } = require('./repositories/learnRepository');
const { createNavRepository } = require('./repositories/navRepository');
const { createConvertService } = require('./services/convertService');
const { createMediaService } = require('./services/mediaService');
const { createTextService } = require('./services/textService');
const { createLearnService } = require('./services/learnService');
const { createNavService } = require('./services/navService');
const { createPdfService } = require('./services/pdfService');
const { createHandwritingService } = require('./services/handwritingService');

/**
 * 构建容器
 * @param {{config: object, logger: object}} params
 */
function createContainer({ config, logger }) {
  /* ---------- 基础设施层 ---------- */
  const storage = createStorage({ uploadBytes: config.limits.uploadBytes, logger });
  const ffmpeg = createFfmpeg({ logger });
  const pdfWorkerClient = createPdfWorkerClient({
    url: config.pdfWorker.url,
    timeoutMs: config.pdfWorker.timeoutMs,
    logger,
  });
  const pdfEngine = createPdfEngine();

  /* ---------- 数据访问层 ---------- */
  const learnRepository = createLearnRepository({ logger });
  const navRepository = createNavRepository({ logger });

  /* ---------- 业务服务层 ---------- */
  const services = {
    convert: createConvertService({ logger }),
    media: createMediaService({ ffmpeg, storage, logger }),
    text: createTextService({ logger }),
    learn: createLearnService({ learnRepository, logger }),
    nav: createNavService({ navRepository, logger }),
    pdf: createPdfService({ pdfEngine, workerClient: pdfWorkerClient, storage, logger }),
    handwriting: createHandwritingService({ storage, logger }),
  };

  /* ---------- 后台定时任务 ---------- */
  // 定期校验导航链接有效性，确保「网址导航」中的链接准确可用。
  // 间隔可由环境变量 NAV_VERIFY_INTERVAL_MS 调整（默认 24 小时，0 表示关闭）。
  const navVerifyMs = Number(process.env.NAV_VERIFY_INTERVAL_MS || 24 * 60 * 60 * 1000);
  if (navVerifyMs > 0 && services.nav) {
    setInterval(() => {
      services.nav.verifyLinks().catch((e) => logger && logger.warn(`导航链接校验失败: ${e.message}`));
    }, navVerifyMs);
    if (logger) logger.info(`导航链接定时校验已启用，间隔 ${navVerifyMs / 3600000}h`);
  }

  return { storage, ffmpeg, pdfWorkerClient, pdfEngine, learnRepository, navRepository, services };
}

module.exports = { createContainer };
