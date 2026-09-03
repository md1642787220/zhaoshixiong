/* ============================================================
 * infrastructure/pdfEngineFactory.js - PDF 引擎门面
 * 职责：隔离 pdfEngine 具体实现的加载方式，
 *       业务层通过工厂获取能力，便于替换底层库或做延迟加载。
 * ============================================================ */

/** 创建 PDF 引擎实例（当前基于 pdf-lib 实现） */
function createPdfEngine() {
  // eslint-disable-next-line global-require
  return require('./pdfEngine');
}

module.exports = { createPdfEngine };
