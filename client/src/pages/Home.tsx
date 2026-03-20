import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, RefreshCw, ExternalLink, Search, Newspaper, Sparkles, X, Plus, Minus, Tag, ShieldX, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Home() {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [dateFrom, setDateFrom] = useState(formatDateInput(weekAgo));
  const [dateTo, setDateTo] = useState(formatDateInput(today));
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // 关键词/排除词弹窗状态
  const [showKeywordDialog, setShowKeywordDialog] = useState(false);
  const [showExcludeDialog, setShowExcludeDialog] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newExcludeWord, setNewExcludeWord] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.article.list.useQuery({
    dateFrom,
    dateTo: dateTo + "T23:59:59",
    limit: pageSize,
    offset: page * pageSize,
    excludeExcluded: true,
  });

  const { data: keywordRules, refetch: refetchRules } = trpc.keywordRule.list.useQuery();

  const scrapeAll = trpc.article.scrapeAll.useMutation({
    onSuccess: (result) => {
      const totalPassed = result.results.reduce((sum, r) => sum + r.passed, 0);
      const totalFetched = result.results.reduce((sum, r) => sum + r.fetched, 0);
      toast.success(`抓取完成：共获取 ${totalFetched} 条，通过筛选 ${totalPassed} 条`);
      refetch();
    },
    onError: (err) => toast.error(`抓取失败: ${err.message}`),
  });

  const summarize = trpc.article.summarize.useMutation({
    onSuccess: (result) => {
      setSummaryText(result.summary);
      setShowSummary(true);
      toast.success(`已总结 ${result.articleCount} 条新闻`);
    },
    onError: (err) => toast.error(`总结失败: ${err.message}`),
  });

  const createRule = trpc.keywordRule.create.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("规则已添加");
    },
    onError: (err) => toast.error(`添加失败: ${err.message}`),
  });

  const deleteRule = trpc.keywordRule.delete.useMutation({
    onSuccess: () => {
      refetchRules();
      toast.success("规则已删除");
    },
    onError: (err) => toast.error(`删除失败: ${err.message}`),
  });

  const articles = data?.items ?? [];
  const total = data?.total ?? 0;

  // 分类规则
  const includeRules = (keywordRules ?? []).filter(r => r.ruleType === "include");
  const excludeRules = (keywordRules ?? []).filter(r => r.ruleType === "exclude");
  const whitelistRules = (keywordRules ?? []).filter(r => r.ruleType === "whitelist");

  const handleSummarize = () => {
    summarize.mutate({ dateFrom, dateTo: dateTo + "T23:59:59" });
  };

  const handleAddKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw) return;
    createRule.mutate({
      name: `快捷添加: ${kw}`,
      ruleType: "include",
      logic: "or",
      keywords: [kw],
      description: `从新闻浏览页面快捷添加的包含关键词`,
      enabled: true,
    });
    setNewKeyword("");
  };

  const handleAddExclude = () => {
    const kw = newExcludeWord.trim();
    if (!kw) return;
    createRule.mutate({
      name: `快捷排除: ${kw}`,
      ruleType: "exclude",
      logic: "or",
      keywords: [kw],
      excludeStrength: "hard",
      description: `从新闻浏览页面快捷添加的排除词`,
      enabled: true,
    });
    setNewExcludeWord("");
  };

  const handleDeleteRule = (id: number) => {
    deleteRule.mutate({ id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">新闻浏览</h1>
          <p className="text-muted-foreground text-sm mt-1">
            查看已抓取并通过筛选的新闻，支持按日期范围筛选
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowKeywordDialog(true)}>
            <Tag className="mr-1.5 h-3.5 w-3.5" />
            关键词
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowExcludeDialog(true)}>
            <ShieldX className="mr-1.5 h-3.5 w-3.5" />
            排除词
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarize}
            disabled={summarize.isPending || total === 0}
          >
            {summarize.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            AI总结
          </Button>
          <Button
            size="sm"
            onClick={() => scrapeAll.mutate()}
            disabled={scrapeAll.isPending}
          >
            {scrapeAll.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            立即抓取
          </Button>
        </div>
      </div>

      {/* 日期筛选 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">开始日期</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              />
            </div>
            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">结束日期</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              />
            </div>
            <Button variant="outline" onClick={() => refetch()} className="shrink-0">
              <Search className="mr-2 h-4 w-4" />
              查询
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI总结展示区 */}
      {showSummary && summaryText && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI 新闻总结
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSummary(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <Streamdown>{summaryText}</Streamdown>
          </CardContent>
        </Card>
      )}

      {/* 统计 */}
      <div className="text-sm text-muted-foreground">
        共 <span className="font-semibold text-foreground">{total}</span> 条新闻
        {total > pageSize && (
          <span>，当前第 {page + 1} 页</span>
        )}
      </div>

      {/* 新闻列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">暂无新闻数据</p>
            <p className="text-sm text-muted-foreground mt-1">
              请先在「信息源管理」中添加信息源，然后点击「立即抓取」
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[15px] leading-relaxed">
                      {article.title}
                    </h3>
                    {article.titleCn && article.titleCn !== article.title && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {article.titleCn}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {article.sourceName && (
                        <Badge variant="outline" className="text-xs">
                          {article.sourceName}
                        </Badge>
                      )}
                      {article.publishDate && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.publishDate).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                      {(article.matchedKeywords as string[] | null)?.map((kw) => (
                        <Badge key={kw} className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {article.url && (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            第 {page + 1} / {Math.ceil(total / pageSize)} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* ========== 关键词管理弹窗 ========== */}
      <Dialog open={showKeywordDialog} onOpenChange={setShowKeywordDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-600" />
              管理包含关键词
            </DialogTitle>
            <DialogDescription>
              添加关键词后，只有标题中包含这些关键词的新闻才会被保留。
            </DialogDescription>
          </DialogHeader>

          {/* 快速添加 */}
          <div className="flex gap-2">
            <Input
              placeholder="输入新关键词，如 ETF、blockchain..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddKeyword(); }}
            />
            <Button onClick={handleAddKeyword} disabled={!newKeyword.trim() || createRule.isPending} size="sm" className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              添加
            </Button>
          </div>

          {/* 现有包含规则列表 */}
          <div className="space-y-2 mt-2">
            <p className="text-sm font-medium text-muted-foreground">
              当前包含规则 ({includeRules.length})
            </p>
            {includeRules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无包含规则，所有新闻都会通过</p>
            ) : (
              includeRules.map((rule) => {
                const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
                return (
                  <div key={rule.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/50 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{rule.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(keywords as string[]).slice(0, 8).map((kw) => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {keywords.length > 8 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{keywords.length - 8} 更多
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}

            {/* 白名单规则 */}
            {whitelistRules.length > 0 && (
              <>
                <p className="text-sm font-medium text-muted-foreground mt-4">
                  白名单规则 ({whitelistRules.length}) - 优先保留
                </p>
                {whitelistRules.map((rule) => {
                  const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
                  return (
                    <div key={rule.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-green-50/50 border border-green-200/50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800">{rule.name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(keywords as string[]).slice(0, 8).map((kw) => (
                            <Badge key={kw} variant="outline" className="text-xs border-green-300 text-green-700">
                              {kw}
                            </Badge>
                          ))}
                          {keywords.length > 8 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{keywords.length - 8} 更多
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeywordDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== 排除词管理弹窗 ========== */}
      <Dialog open={showExcludeDialog} onOpenChange={setShowExcludeDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-red-600" />
              管理排除词
            </DialogTitle>
            <DialogDescription>
              添加排除词后，标题中包含这些词的新闻将被过滤掉。
            </DialogDescription>
          </DialogHeader>

          {/* 快速添加 */}
          <div className="flex gap-2">
            <Input
              placeholder="输入排除词，如 appoints、dividend..."
              value={newExcludeWord}
              onChange={(e) => setNewExcludeWord(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddExclude(); }}
            />
            <Button onClick={handleAddExclude} disabled={!newExcludeWord.trim() || createRule.isPending} size="sm" className="shrink-0" variant="destructive">
              <Plus className="mr-1 h-4 w-4" />
              添加
            </Button>
          </div>

          {/* 现有排除规则列表 */}
          <div className="space-y-2 mt-2">
            <p className="text-sm font-medium text-muted-foreground">
              当前排除规则 ({excludeRules.length})
            </p>
            {excludeRules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无排除规则</p>
            ) : (
              excludeRules.map((rule) => {
                const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
                const isHard = rule.excludeStrength === "hard";
                return (
                  <div key={rule.id} className={`flex items-start justify-between gap-2 p-3 rounded-lg group ${isHard ? "bg-red-50/50 border border-red-200/50" : "bg-orange-50/50 border border-orange-200/50"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${isHard ? "border-red-300 text-red-600" : "border-orange-300 text-orange-600"}`}>
                          {isHard ? "硬排除" : "软排除"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(keywords as string[]).slice(0, 8).map((kw) => (
                          <Badge key={kw} variant="outline" className={`text-xs ${isHard ? "border-red-200 text-red-600" : "border-orange-200 text-orange-600"}`}>
                            {kw}
                          </Badge>
                        ))}
                        {keywords.length > 8 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            +{keywords.length - 8} 更多
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExcludeDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
