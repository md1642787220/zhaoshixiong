/* ============================================================
 * data/nav.js - 网址导航本地降级数据
 * 仅在后端 /api/nav 不可用时使用，保证前端展示完整。
 * 结构与服务端 nav.json 的 categories 一致。
 * ============================================================ */
export const NAV = {
  categories: [
    {
      id: 'gov',
      name: '政府',
      icon: 'landmark',
      description: '全国各地政府官方网站',
      sites: [
        { id: 'gov-central', name: '中国政府网', url: 'https://www.gov.cn', region: '全国', level: '国家级', description: '中华人民共和国中央人民政府门户网站' },
        { id: 'gov-bj', name: '首都之窗（北京）', url: 'https://www.beijing.gov.cn', region: '北京', level: '省级', description: '北京市人民政府门户网站' },
        { id: 'gov-sh', name: '上海市人民政府', url: 'https://www.shanghai.gov.cn', region: '上海', level: '省级', description: '上海市人民政府门户网站' },
        { id: 'gov-gd', name: '广东省人民政府', url: 'https://www.gd.gov.cn', region: '广东', level: '省级', description: '广东省人民政府门户网站' },
        { id: 'gov-sc', name: '四川省人民政府', url: 'https://www.sc.gov.cn', region: '四川', level: '省级', description: '四川省人民政府门户网站' },
      ],
    },
    {
      id: 'edu',
      name: '教育',
      icon: 'graduation-cap',
      description: '各地教育机构和学校官方网站',
      sites: [
        { id: 'edu-moe', name: '中华人民共和国教育部', url: 'http://www.moe.gov.cn', region: '全国', level: '国家级', description: '中华人民共和国教育部官方网站' },
        { id: 'edu-neea', name: '中国教育考试网', url: 'http://www.neea.edu.cn', region: '全国', level: '国家级', description: '教育部教育考试院官方网站' },
        { id: 'edu-tsinghua', name: '清华大学', url: 'https://www.tsinghua.edu.cn', region: '北京', level: '高校', description: '清华大学官方网站' },
        { id: 'edu-fudan', name: '复旦大学', url: 'https://www.fudan.edu.cn', region: '上海', level: '高校', description: '复旦大学官方网站' },
        { id: 'edu-zju', name: '浙江大学', url: 'https://www.zju.edu.cn', region: '浙江', level: '高校', description: '浙江大学官方网站' },
      ],
    },
  ],
};
