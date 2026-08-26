const express = require('express');
const router = express.Router();
const data = require('../data/learn.json');

/* 学习板块分类列表 */
router.get('/categories', (req, res) => {
  res.json(data.categories.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    description: c.description,
    count: c.resources.length,
  })));
});

/* 分类详情（含资源列表） */
router.get('/categories/:id', (req, res) => {
  const cat = data.categories.find(c => c.id === req.params.id);
  if (!cat) return res.status(404).json({ message: '分类不存在' });
  res.json(cat);
});

module.exports = router;
