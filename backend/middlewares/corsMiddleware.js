/* ============================================================
 * middlewares/corsMiddleware.js - 跨域中间件
 * ============================================================ */

/** 创建 CORS 中间件（支持前后端分离部署） */
function createCorsMiddleware() {
  return function corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}

module.exports = { createCorsMiddleware };
