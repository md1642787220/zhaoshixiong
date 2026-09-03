/* ============================================================
 * services/learnService.js - 学习板块业务逻辑
 * 职责：分类与资源的查询编排，数据访问由注入的 repository 完成。
 * ============================================================ */

/**
 * 创建学习服务
 * @param {{learnRepository: object, logger: object}} deps
 */
function createLearnService({ learnRepository, logger } = {}) {
  /** 分类列表（摘要） */
  function listCategories() {
    return learnRepository.findAllCategories();
  }

  /** 分类详情（含资源） */
  function getCategory(id) {
    if (logger) logger.debug(`查询学习分类: ${id}`);
    return learnRepository.findCategoryById(id);
  }

  return { listCategories, getCategory };
}

module.exports = { createLearnService };
