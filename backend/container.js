/* ============================================================
 * container.js - 依赖注入容器
 * 职责：集中创建并组装各层依赖（基础设施 → 数据访问 → 业务服务），
 *       上层只依赖抽象接口，替换实现无需改动业务代码。
 * ============================================================ */
const { createStorage } = require('./infrastructure/storage');
const { createPdfWorkerClient } = require('./infrastructure/pdfWorkerClient');
const { createPdfEngine } = require('./infrastructure/pdfEngineFactory');
const { createLearnRepository } = require('./repositories/learnRepository');
const { createConvertService } = require('./services/convertService');
const { createTextService } = require('./services/textService');
const { createLearnService } = require('./services/learnService');
const { createPdfService } = require('./services/pdfService');
const { createHandwritingService } = require('./services/handwritingService');
const { createMediaSourceService } = require('./services/mediaSourceService');

/**
 * 构建容器
 * @param {{config: object, logger: object}} params
 */
function createContainer({ config, logger }) {
  /* ---------- 基础设施层 ---------- */
  const storage = createStorage({ uploadBytes: config.limits.uploadBytes, logger });
  const pdfWorkerClient = createPdfWorkerClient({
    url: config.pdfWorker.url,
    timeoutMs: config.pdfWorker.timeoutMs,
    logger,
  });
  const pdfEngine = createPdfEngine();

  /* ---------- 数据访问层 ---------- */
  const learnRepository = createLearnRepository({ logger });

  /* ---------- 业务服务层 ---------- */
  const services = {
    convert: createConvertService({ logger }),
    text: createTextService({ logger }),
    learn: createLearnService({ learnRepository, logger }),
    pdf: createPdfService({ pdfEngine, workerClient: pdfWorkerClient, storage, logger }),
    handwriting: createHandwritingService({ storage, logger }),
    mediaSource: createMediaSourceService({ config, logger }),
  };

  return { storage, pdfWorkerClient, pdfEngine, learnRepository, services };
}

module.exports = { createContainer };
