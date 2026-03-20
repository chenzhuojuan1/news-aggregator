/**
 * 预置默认信息源和关键词规则
 * 
 * 包含：交易所/证监会信息源模板 + 关键词规则（包含/排除/白名单）
 */

// 默认信息源配置（seedDefaults时自动导入）
export const DEFAULT_SOURCES = [
  {
    name: "Mondo Visione - 交易所新闻",
    layer: "website",
    enabled: true,
    url: "https://mondovisione.com/news/",
    sourceType: "html",
    selectors: JSON.stringify({
      container: "table.views-table tbody tr",
      title: "td.views-field-title a",
      link: "td.views-field-title a",
      date: "td.views-field-created span.date-display-single",
      summary: ""
    }),
    dateFormat: "DD/MM/YYYY",
    description: "全球交易所和金融基础设施新闻聚合网站，覆盖主要交易所公告",
  },
];

// ========== 可供用户一键添加的网站模板 ==========
export const SOURCE_TEMPLATES = [
  // --- 交易所 ---
  {
    name: "Mondo Visione - 交易所新闻",
    category: "交易所",
    url: "https://mondovisione.com/news/",
    sourceType: "html" as const,
    selectors: {
      container: "table.views-table tbody tr",
      title: "td.views-field-title a",
      link: "td.views-field-title a",
      date: "td.views-field-created span.date-display-single",
    },
    dateFormat: "DD/MM/YYYY",
    description: "全球交易所和金融基础设施新闻聚合网站",
  },
  {
    name: "Nasdaq - 新闻发布",
    category: "交易所",
    url: "https://www.nasdaq.com/press-release",
    sourceType: "html" as const,
    selectors: {},
    description: "纳斯达克交易所新闻发布（智能抓取模式）",
  },
  {
    name: "NYSE - 新闻",
    category: "交易所",
    url: "https://www.nyse.com/news",
    sourceType: "html" as const,
    selectors: {},
    description: "纽约证券交易所新闻（智能抓取模式）",
  },
  {
    name: "LSEG - 新闻发布",
    category: "交易所",
    url: "https://www.lseg.com/en/media-centre/press-releases",
    sourceType: "html" as const,
    selectors: {},
    description: "伦敦证券交易所集团新闻发布（智能抓取模式）",
  },
  {
    name: "SGX - 新闻发布",
    category: "交易所",
    url: "https://www.sgx.com/media-centre",
    sourceType: "html" as const,
    selectors: {},
    description: "新加坡交易所新闻发布（智能抓取模式）",
  },
  {
    name: "JPX - 新闻发布",
    category: "交易所",
    url: "https://www.jpx.co.jp/english/corporate/news/news-releases/index.html",
    sourceType: "html" as const,
    selectors: {},
    description: "日本交易所集团新闻发布（智能抓取模式）",
  },
  {
    name: "KRX - 新闻",
    category: "交易所",
    url: "https://global.krx.co.kr/contents/GLB/06/0608/0608010000/GLB0608010000.jsp",
    sourceType: "html" as const,
    selectors: {},
    description: "韩国交易所新闻（智能抓取模式）",
  },
  {
    name: "HKEX - 新闻发布",
    category: "交易所",
    url: "https://www.hkex.com.hk/News/News-Release?sc_lang=en",
    sourceType: "html" as const,
    selectors: {},
    description: "香港交易所新闻发布（智能抓取模式）",
  },
  {
    name: "Deutsche Börse - 新闻发布",
    category: "交易所",
    url: "https://www.deutsche-boerse.com/dbg-en/media/press-releases",
    sourceType: "html" as const,
    selectors: {},
    description: "德意志交易所集团新闻发布（智能抓取模式）",
  },
  {
    name: "Euronext - 新闻发布",
    category: "交易所",
    url: "https://www.euronext.com/en/about/media/press-releases",
    sourceType: "html" as const,
    selectors: {},
    description: "泛欧交易所新闻发布（智能抓取模式）",
  },
  {
    name: "WFE - 世界交易所联合会",
    category: "交易所",
    url: "https://www.world-exchanges.org/news",
    sourceType: "html" as const,
    selectors: {},
    description: "世界交易所联合会新闻与研究报告（智能抓取模式）",
  },

  // --- 监管机构/证监会 ---
  {
    name: "SEC - 新闻发布",
    category: "监管机构",
    url: "https://www.sec.gov/news/pressreleases",
    sourceType: "html" as const,
    selectors: {},
    description: "美国证券交易委员会新闻发布（智能抓取模式）",
  },
  {
    name: "FCA - 新闻与声明",
    category: "监管机构",
    url: "https://www.fca.org.uk/news",
    sourceType: "html" as const,
    selectors: {},
    description: "英国金融行为监管局新闻（智能抓取模式）",
  },
  {
    name: "MAS - 新闻发布",
    category: "监管机构",
    url: "https://www.mas.gov.sg/news",
    sourceType: "html" as const,
    selectors: {},
    description: "新加坡金融管理局新闻发布（智能抓取模式）",
  },
  {
    name: "JFSA - 新闻发布",
    category: "监管机构",
    url: "https://www.fsa.go.jp/en/news/index.html",
    sourceType: "html" as const,
    selectors: {},
    description: "日本金融厅新闻发布（智能抓取模式）",
  },
  {
    name: "FSC 韩国 - 新闻发布",
    category: "监管机构",
    url: "https://www.fsc.go.kr/eng/pr010101",
    sourceType: "html" as const,
    selectors: {},
    description: "韩国金融委员会新闻发布（智能抓取模式）",
  },
  {
    name: "SFC 香港 - 新闻发布",
    category: "监管机构",
    url: "https://www.sfc.hk/en/News-and-announcements/Policy-statements-and-announcements",
    sourceType: "html" as const,
    selectors: {},
    description: "香港证券及期货事务监察委员会新闻（智能抓取模式）",
  },
  {
    name: "ESMA - 新闻与公告",
    category: "监管机构",
    url: "https://www.esma.europa.eu/press-news/esma-news",
    sourceType: "html" as const,
    selectors: {},
    description: "欧洲证券和市场管理局新闻（智能抓取模式）",
  },
];

// ========== 默认关键词规则 ==========
export const DEFAULT_KEYWORD_RULES = [
  // ===== 包含规则 =====
  {
    name: "交易所关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "NYSE", "Nasdaq", "LSE", "LSEG", "CME", "ICE", "Cboe", "HKEX",
      "SGX", "ASX", "TMX", "JSE", "B3", "Euronext", "Deutsche Börse",
      "Deutsche Borse", "SIX", "Borsa Italiana", "JPX", "KRX",
      "LME", "Eurex", "EEX", "ATHEX", "Bursa Malaysia",
      "Warsaw Stock Exchange", "Taiwan Futures Exchange",
      "London Metal Exchange", "WFE", "World Federation of Exchanges"
    ]),
    description: "主要全球交易所名称，匹配任一即保留",
    enabled: true,
  },
  {
    name: "监管机构关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "SEC", "FCA", "ESMA", "CFTC", "IOSCO", "MAS", "SFC", "ASIC",
      "JFSA", "FSC", "FSA"
    ]),
    description: "主要金融监管机构缩写",
    enabled: true,
  },
  {
    name: "国际组织关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "BIS", "FSB", "IMF", "World Bank", "WFE"
    ]),
    description: "国际金融组织",
    enabled: true,
  },
  {
    name: "机构全称短语",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "Securities and Exchange Commission",
      "Financial Conduct Authority",
      "Commodity Futures Trading Commission",
      "European Securities and Markets Authority",
      "Bank for International Settlements",
      "Financial Stability Board",
      "International Organization of Securities Commissions",
      "Monetary Authority of Singapore",
      "Securities and Futures Commission",
      "Australian Securities and Investments Commission",
      "New York Stock Exchange",
      "London Stock Exchange",
      "Hong Kong Exchanges",
      "Japan Exchange Group",
      "Korea Exchange",
      "Chicago Mercantile Exchange",
      "Intercontinental Exchange",
      "Singapore Exchange",
      "Financial Services Agency",
      "Financial Services Commission",
      "World Federation of Exchanges"
    ]),
    description: "机构全称，避免缩写误匹配",
    enabled: true,
  },

  // --- 制度改革 ---
  {
    name: "制度改革关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "regulatory reform", "rule change", "rule amendment",
      "rule proposal", "rule filing", "regulation change",
      "regulatory framework", "new regulation", "deregulation",
      "regulatory sandbox", "pilot program", "consultation paper",
      "policy reform", "legislative reform", "capital framework",
      "liquidity regulation", "market reform", "governance reform"
    ]),
    description: "制度改革、规则修订、监管框架变更",
    enabled: true,
  },

  // --- 重要产品 ---
  {
    name: "重要产品关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "DR listing", "depositary receipt", "ETF",
      "ESG", "green bond", "sustainability bond",
      "derivatives", "futures", "options",
      "structured product", "new index", "new contract",
      "carbon credit", "SPAC", "REIT",
      "tokenized", "digital asset", "stablecoin"
    ]),
    description: "DR、ETF、ESG、衍生品等重要产品类型",
    enabled: true,
  },

  // --- 市场结构 ---
  {
    name: "市场结构关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "market structure", "trading system", "matching engine",
      "order type", "tick size", "circuit breaker",
      "market maker", "liquidity provider", "dark pool",
      "best execution", "price discovery", "auction",
      "closing auction", "opening auction", "continuous trading",
      "market microstructure", "trading venue", "lit market",
      "clearing", "settlement", "CCP", "central counterparty",
      "T+1 settlement", "T+0 settlement", "netting"
    ]),
    description: "市场结构、交易系统、清算结算相关",
    enabled: true,
  },

  // --- 数据 ---
  {
    name: "数据相关关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "market data", "data standard",
      "data sharing", "data transparency", "consolidated tape",
      "reporting requirement", "trade reporting",
      "transaction reporting", "data analytics",
      "reference data", "LEI", "ISIN",
      "data regulation", "data access"
    ]),
    description: "市场数据、数据标准、报告要求相关",
    enabled: true,
  },

  // --- 技术改革 ---
  {
    name: "技术改革关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "technology upgrade", "cloud migration", "cloud computing",
      "artificial intelligence", "machine learning", "AI trading",
      "blockchain", "distributed ledger", "DLT",
      "tokenization", "smart contract", "API",
      "cyber security", "cybersecurity", "resilience",
      "system upgrade", "platform migration",
      "RegTech", "SupTech", "FinTech",
      "quantum computing", "real-time", "low latency"
    ]),
    description: "技术升级、云计算、AI、区块链、网络安全等技术改革",
    enabled: true,
  },

  // --- 交易所合作 ---
  {
    name: "交易所合作关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "partnership", "strategic alliance", "collaboration",
      "joint venture", "cooperation agreement",
      "exchange cooperation", "exchange partnership",
      "technology partnership", "licensing agreement",
      "merger", "acquisition", "stake",
      "consortium", "working group"
    ]),
    description: "交易所间合作、联盟、并购、技术合作",
    enabled: true,
  },

  // --- 对外开放 ---
  {
    name: "对外开放关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "cross-border", "international access", "foreign investor",
      "QFII", "RQFII", "Stock Connect", "Bond Connect",
      "mutual recognition", "passport", "equivalence",
      "market access", "liberalization", "opening up",
      "interoperability", "cross-listing", "dual listing",
      "global offering", "international listing",
      "MOU", "memorandum of understanding",
      "regulatory cooperation", "supervisory cooperation"
    ]),
    description: "跨境互联互通、对外开放、互认机制、监管合作",
    enabled: true,
  },

  // --- SEC专题 ---
  {
    name: "SEC专题关键词",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "SEC Chairman", "SEC Chair", "SEC Speaks",
      "SEC enforcement", "SEC rulemaking",
      "SEC no-action", "SEC guidance",
      "SEC exemptive", "SEC concept release",
      "Regulation NMS", "Regulation SHO",
      "Regulation ATS", "Regulation Best Interest",
      "Form 10-K", "proxy", "disclosure requirement"
    ]),
    description: "SEC相关专题：主席讲话、执法、规则制定、关键法规",
    enabled: true,
  },

  // ===== 排除规则 =====
  {
    name: "人事变动排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "appoints", "appointed", "appointment", "resigns", "resignation",
      "retires", "retirement", "steps down", "new CEO", "new chairman",
      "commissioner"
    ]),
    description: "排除人事任命、辞职、退休等新闻",
    enabled: true,
  },
  {
    name: "企业财务排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "quarterly results", "annual results", "financial results",
      "revenue growth", "profit", "earnings", "dividend"
    ]),
    description: "排除企业财务报告类新闻",
    enabled: true,
  },
  {
    name: "低价值内容排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "monthly report", "monthly summary", "monthly review",
      "monthly bulletin", "monthly volumes", "monthly headlines",
      "trading statistics", "market statistics", "daily statistics",
      "weekly report", "weekly summary", "weekly bulletin"
    ]),
    description: "排除月度/周度统计报告、交易量统计等低价值内容",
    enabled: true,
  },
  {
    name: "个股上市排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "new listing", "lists on", "listed on", "begins trading",
      "starts trading", "IPO", "initial public offering",
      "prime standard", "general standard",
      "new in the", "welcomes.*to trading",
      "joins.*exchange", "moves to.*main",
      "transfers to"
    ]),
    description: "排除个股上市、转板等新闻",
    enabled: true,
  },
  {
    name: "中国交易所排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "soft",
    keywords: JSON.stringify([
      "Shanghai Stock Exchange", "Shenzhen Stock Exchange",
      "Beijing Stock Exchange", "SSE", "SZSE"
    ]),
    description: "软排除以中国交易所为主体的新闻（标记但保留）",
    enabled: true,
  },
  {
    name: "监管日常事务排除",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "disciplinary action", "reprimands", "bans",
      "fines.*individual", "suspends licence",
      "warns against", "investor alert",
      "circular to intermediaries", "compliance deadline",
      "licence revoked", "licence suspended",
      "restriction notice", "winding up petition"
    ]),
    description: "排除监管机构日常执法、处罚个人/小机构、投资者警示等事务性新闻",
    enabled: true,
  },

  // ===== 白名单 =====
  {
    name: "SEC主席讲话白名单",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "SEC Chairman", "SEC Chair", "SEC Speaks",
      "Chairman Gensler", "Chairman Atkins"
    ]),
    description: "SEC主席讲话优先保留，不受排除规则影响",
    enabled: true,
  },
  {
    name: "重大监管改革白名单",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "regulatory reform", "regulatory framework",
      "market reform", "new regulation",
      "market structure reform", "capital framework reform"
    ]),
    description: "重大监管改革新闻优先保留",
    enabled: true,
  },
  {
    name: "交易所合作白名单",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "exchange cooperation", "exchange partnership",
      "Stock Connect", "Bond Connect",
      "cross-border cooperation", "interoperability"
    ]),
    description: "交易所合作与互联互通新闻优先保留",
    enabled: true,
  },
];
