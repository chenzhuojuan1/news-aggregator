import type { Article } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

// ========== LLM 翻译 ==========
export async function translateTitle(title: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "你是一个专业的金融翻译。请将以下英文标题翻译为简洁准确的中文。只返回翻译结果，不要添加任何解释。",
        },
        { role: "user", content: title },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    const translated = typeof content === 'string' ? content.trim() : '';
    return translated || title;
  } catch (err) {
    console.error("[Translation] Failed:", err);
    return title;
  }
}

export async function batchTranslateTitles(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return [];
  
  // 过滤出需要翻译的（非中文标题）
  const results: string[] = new Array(titles.length);
  const toTranslate: { index: number; title: string }[] = [];

  for (let i = 0; i < titles.length; i++) {
    if (isChinese(titles[i])) {
      results[i] = titles[i];
    } else {
      toTranslate.push({ index: i, title: titles[i] });
    }
  }

  if (toTranslate.length === 0) return results;

  // 批量翻译（每批最多20条）
  const batchSize = 20;
  for (let i = 0; i < toTranslate.length; i += batchSize) {
    const batch = toTranslate.slice(i, i + batchSize);
    const numberedTitles = batch.map((item, idx) => `${idx + 1}. ${item.title}`).join("\n");

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "你是一个专业的金融翻译。请将以下编号的英文标题逐条翻译为简洁准确的中文。保持编号格式，每行一条翻译结果。",
          },
          { role: "user", content: numberedTitles },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const translated = typeof rawContent === 'string' ? rawContent.trim() : '';
      const lines = translated.split("\n").filter((l: string) => l.trim());

      for (let j = 0; j < batch.length; j++) {
        const line = lines[j];
        if (line) {
          // 去掉编号前缀
          results[batch[j].index] = line.replace(/^\d+\.\s*/, "").trim();
        } else {
          results[batch[j].index] = batch[j].title;
        }
      }
    } catch (err) {
      console.error("[BatchTranslation] Failed:", err);
      for (const item of batch) {
        results[item.index] = item.title;
      }
    }
  }

  return results;
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text) && !/^[a-zA-Z\s]+$/.test(text);
}

// ========== LLM 总结当日新闻 ==========
export async function summarizeNews(articleList: Article[]): Promise<string> {
  if (articleList.length === 0) {
    return "当前日期范围内没有通过筛选的新闻。";
  }

  // 只发送标题列表给LLM进行总结
  const titlesText = articleList.map((a, idx) => {
    const source = a.sourceName ? ` [${a.sourceName}]` : "";
    return `${idx + 1}. ${a.title}${source}`;
  }).join("\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一位资深金融监管政策分析师。请根据以下新闻标题列表，生成一份简洁的中文总结报告。

要求：
1. 按主题分类归纳（如：交易所动态、监管政策、市场结构、技术创新、跨境合作等）
2. 每个主题下用2-3句话概括要点
3. 在总结中引用具体的新闻标题（保留原文标题）
4. 最后给出1-2句整体趋势观察
5. 使用Markdown格式输出
6. 总结应基于提供的新闻标题内容，不要编造信息`,
        },
        {
          role: "user",
          content: `以下是今日抓取到的 ${articleList.length} 条金融监管新闻标题：\n\n${titlesText}`,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : "总结生成失败，请重试。";
  } catch (err: any) {
    console.error("[Summarize] Failed:", err);
    return `总结生成失败: ${err.message}`;
  }
}

// ========== 报告生成 ==========
export interface ReportData {
  title: string;
  dateFrom: Date;
  dateTo: Date;
  articles: Article[];
  contentHtml: string;
  contentText: string;
}

export async function generateReport(
  dateFrom: Date,
  dateTo: Date,
  articleList: Article[],
): Promise<ReportData> {
  // 按来源分组
  const grouped = new Map<string, Article[]>();
  for (const article of articleList) {
    const sourceName = article.sourceName || "未知来源";
    if (!grouped.has(sourceName)) grouped.set(sourceName, []);
    grouped.get(sourceName)!.push(article);
  }

  // 翻译缺少中文标题的文章
  const needTranslation = articleList.filter(a => !a.titleCn && !isChinese(a.title));
  if (needTranslation.length > 0) {
    const translations = await batchTranslateTitles(needTranslation.map(a => a.title));
    for (let i = 0; i < needTranslation.length; i++) {
      needTranslation[i].titleCn = translations[i];
    }
  }

  const dateFromStr = formatDate(dateFrom);
  const dateToStr = formatDate(dateTo);
  const reportTitle = `交易所与监管新闻日报 (${dateFromStr} - ${dateToStr})`;

  // 生成HTML报告
  let html = `<div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">`;
  html += `<h1 style="color: #1a365d; border-bottom: 3px solid #2b6cb0; padding-bottom: 12px; font-size: 22px;">${reportTitle}</h1>`;
  html += `<p style="color: #718096; font-size: 14px;">报告生成时间: ${new Date().toLocaleString("zh-CN")} | 共 ${articleList.length} 条新闻</p>`;

  // 纯文本报告
  let text = `${reportTitle}\n${"=".repeat(50)}\n`;
  text += `报告生成时间: ${new Date().toLocaleString("zh-CN")} | 共 ${articleList.length} 条新闻\n\n`;

  let articleIndex = 1;
  for (const [sourceName, sourceArticles] of Array.from(grouped.entries())) {
    html += `<h2 style="color: #2d3748; margin-top: 24px; font-size: 18px; border-left: 4px solid #4299e1; padding-left: 12px;">${sourceName} (${sourceArticles.length})</h2>`;
    text += `\n【${sourceName}】(${sourceArticles.length}条)\n${"-".repeat(40)}\n`;

    for (const article of sourceArticles) {
      const cnTitle = article.titleCn || "";
      const keywords = (article.matchedKeywords as string[]) || [];
      const keywordTags = keywords.map(k => `<span style="display:inline-block;background:#ebf8ff;color:#2b6cb0;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;">${k}</span>`).join("");
      const publishDate = article.publishDate ? formatDate(article.publishDate) : "";

      html += `<div style="margin: 16px 0; padding: 14px; background: #f7fafc; border-radius: 8px; border-left: 3px solid #4299e1;">`;
      html += `<p style="margin:0 0 4px 0; font-weight:600; color:#2d3748; font-size:15px;">${articleIndex}. ${article.title}</p>`;
      if (cnTitle && cnTitle !== article.title) {
        html += `<p style="margin:0 0 4px 0; color:#4a5568; font-size:14px;">📌 ${cnTitle}</p>`;
      }
      if (publishDate) {
        html += `<p style="margin:0 0 4px 0; color:#a0aec0; font-size:12px;">📅 ${publishDate}</p>`;
      }
      if (keywordTags) {
        html += `<p style="margin:4px 0;">${keywordTags}</p>`;
      }
      if (article.url) {
        html += `<p style="margin:4px 0 0 0;"><a href="${article.url}" style="color:#3182ce; font-size:13px; text-decoration:none;">🔗 查看原文</a></p>`;
      }
      html += `</div>`;

      text += `\n${articleIndex}. ${article.title}\n`;
      if (cnTitle && cnTitle !== article.title) text += `   中文: ${cnTitle}\n`;
      if (publishDate) text += `   日期: ${publishDate}\n`;
      if (keywords.length > 0) text += `   关键词: ${keywords.join(", ")}\n`;
      if (article.url) text += `   链接: ${article.url}\n`;

      articleIndex++;
    }
  }

  html += `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;">`;
  html += `<p style="color: #a0aec0; font-size: 12px; text-align: center;">本报告由新闻聚合平台自动生成</p>`;
  html += `</div>`;

  text += `\n${"=".repeat(50)}\n本报告由新闻聚合平台自动生成\n`;

  return {
    title: reportTitle,
    dateFrom,
    dateTo,
    articles: articleList,
    contentHtml: html,
    contentText: text,
  };
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
