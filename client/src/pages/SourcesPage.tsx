import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  Play,
  Loader2,
  Rss,
  Zap,
  Search,
  BookTemplate,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface SourceForm {
  name: string;
  layer: "website" | "api" | "manual";
  url: string;
  sourceType: "html" | "rss" | "api";
  selectors: {
    container: string;
    title: string;
    link: string;
    date: string;
    summary: string;
  };
  dateFormat: string;
  apiConfig: {
    endpoint: string;
    headers: string;
    method: string;
    body: string;
    titleField: string;
    urlField: string;
    dateField: string;
    summaryField: string;
    dataPath: string;
  };
  description: string;
  enabled: boolean;
}

const defaultForm: SourceForm = {
  name: "",
  layer: "website",
  url: "",
  sourceType: "html",
  selectors: { container: "", title: "", link: "", date: "", summary: "" },
  dateFormat: "",
  apiConfig: {
    endpoint: "",
    headers: "",
    method: "GET",
    body: "",
    titleField: "title",
    urlField: "url",
    dateField: "date",
    summaryField: "summary",
    dataPath: "data",
  },
  description: "",
  enabled: true,
};

const layerLabels: Record<string, { label: string; color: string; icon: any }> = {
  website: { label: "公开网站", color: "bg-green-50 text-green-700", icon: Globe },
  api: { label: "API接口", color: "bg-purple-50 text-purple-700", icon: Zap },
  manual: { label: "手动添加", color: "bg-orange-50 text-orange-700", icon: Rss },
};

export default function SourcesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SourceForm>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [smartTestUrl, setSmartTestUrl] = useState("");
  const [smartTestResults, setSmartTestResults] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.source.list.useQuery();
  const { data: templates } = trpc.source.templates.useQuery();

  const createMutation = trpc.source.create.useMutation({
    onSuccess: () => {
      toast.success("信息源已添加");
      utils.source.list.invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.source.update.useMutation({
    onSuccess: () => {
      toast.success("信息源已更新");
      utils.source.list.invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.source.delete.useMutation({
    onSuccess: () => {
      toast.success("信息源已删除");
      utils.source.list.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.source.testScrape.useMutation({
    onSuccess: (result) => {
      setTestResults(result);
      if (result.errors.length > 0 && result.totalCount === 0) {
        toast.warning(`抓取有问题: ${result.errors[0]}`);
      } else {
        toast.success(`测试成功：获取到 ${result.totalCount} 条新闻`);
      }
      setTestingId(null);
    },
    onError: (err) => {
      toast.error(`测试失败: ${err.message}`);
      setTestingId(null);
    },
  });

  const addFromTemplateMutation = trpc.source.addFromTemplate.useMutation({
    onSuccess: (result) => {
      toast.success(`已添加「${result.name}」`);
      utils.source.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const smartTestMutation = trpc.source.smartTest.useMutation({
    onSuccess: (result) => {
      setSmartTestResults(result);
      if (result.totalCount > 0) {
        toast.success(`智能识别到 ${result.totalCount} 条新闻`);
      } else {
        toast.warning("未能自动识别新闻，请尝试其他URL或手动配置");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // 按分类分组模板
  const groupedTemplates = useMemo(() => {
    if (!templates) return {};
    const groups: Record<string, typeof templates> = {};
    for (const t of templates) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [templates]);

  // 已添加的信息源URL集合
  const existingUrls = useMemo(() => {
    return new Set((sources || []).map(s => s.url).filter(Boolean));
  }, [sources]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...defaultForm });
    setTestResults(null);
    setShowAdvanced(false);
    setDialogOpen(true);
  }

  function openEdit(source: any) {
    setEditingId(source.id);
    const selectors = (source.selectors as any) || {};
    const apiConfig = (source.apiConfig as any) || {};
    setForm({
      name: source.name,
      layer: source.layer,
      url: source.url || "",
      sourceType: source.sourceType,
      selectors: {
        container: selectors.container || "",
        title: selectors.title || "",
        link: selectors.link || "",
        date: selectors.date || "",
        summary: selectors.summary || "",
      },
      dateFormat: source.dateFormat || "",
      apiConfig: {
        endpoint: apiConfig.endpoint || "",
        headers: apiConfig.headers ? JSON.stringify(apiConfig.headers) : "",
        method: apiConfig.method || "GET",
        body: apiConfig.body || "",
        titleField: apiConfig.titleField || "title",
        urlField: apiConfig.urlField || "url",
        dateField: apiConfig.dateField || "date",
        summaryField: apiConfig.summaryField || "summary",
        dataPath: apiConfig.dataPath || "data",
      },
      description: source.description || "",
      enabled: source.enabled,
    });
    setTestResults(null);
    setShowAdvanced(true); // 编辑时显示高级选项
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("请填写信息源名称");
      return;
    }
    if (!form.url.trim() && form.sourceType !== "api") {
      toast.error("请填写网址");
      return;
    }

    const payload: any = {
      name: form.name,
      layer: form.layer,
      url: form.url || undefined,
      sourceType: form.sourceType,
      description: form.description || undefined,
      enabled: form.enabled,
    };

    if (form.sourceType === "html") {
      // 只有在用户填了选择器时才传
      const hasSelectors = form.selectors.container || form.selectors.title;
      if (hasSelectors) {
        payload.selectors = form.selectors;
      }
      payload.dateFormat = form.dateFormat || undefined;
    } else if (form.sourceType === "api") {
      let parsedHeaders: any = undefined;
      if (form.apiConfig.headers) {
        try { parsedHeaders = JSON.parse(form.apiConfig.headers); } catch { /* ignore */ }
      }
      payload.apiConfig = {
        endpoint: form.apiConfig.endpoint,
        headers: parsedHeaders,
        method: form.apiConfig.method,
        body: form.apiConfig.body || undefined,
        titleField: form.apiConfig.titleField,
        urlField: form.apiConfig.urlField,
        dateField: form.apiConfig.dateField,
        summaryField: form.apiConfig.summaryField,
        dataPath: form.apiConfig.dataPath,
      };
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleTest(id: number) {
    setTestingId(id);
    testMutation.mutate({ id });
  }

  function handleSmartTest() {
    if (!smartTestUrl.trim()) {
      toast.error("请输入网址");
      return;
    }
    let url = smartTestUrl.trim();
    if (!url.startsWith("http")) {
      url = "https://" + url;
      setSmartTestUrl(url);
    }
    smartTestMutation.mutate({ url });
  }

  function handleAddFromSmartTest() {
    if (!smartTestUrl.trim()) return;
    setForm({
      ...defaultForm,
      name: "",
      url: smartTestUrl,
      sourceType: "html",
    });
    setSmartTestResults(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">信息源管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            配置新闻抓取的数据来源。可以从模板一键添加，也可以手动配置。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <BookTemplate className="mr-2 h-4 w-4" />
            从模板添加
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            手动添加
          </Button>
        </div>
      </div>

      {/* 智能测试区域 */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Search className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm text-blue-900">快速测试网址</p>
              <p className="text-xs text-blue-700 mt-0.5 mb-3">
                输入任意新闻网站的网址，系统会自动尝试识别新闻列表。测试成功后可一键添加为信息源。
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="例如：https://www.sec.gov/news/pressreleases"
                  value={smartTestUrl}
                  onChange={(e) => setSmartTestUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSmartTest()}
                  className="bg-white"
                />
                <Button
                  onClick={handleSmartTest}
                  disabled={smartTestMutation.isPending}
                  size="default"
                >
                  {smartTestMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  测试
                </Button>
              </div>
              {/* 智能测试结果 */}
              {smartTestResults && (
                <div className="mt-3 p-3 bg-white rounded-lg border">
                  {smartTestResults.errors.length > 0 && smartTestResults.totalCount === 0 ? (
                    <div className="flex items-start gap-2 text-amber-700">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">未能自动识别</p>
                        <p className="text-xs mt-1">{smartTestResults.errors[0]}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            识别到 {smartTestResults.totalCount} 条新闻
                          </span>
                        </div>
                        <Button size="sm" onClick={handleAddFromSmartTest}>
                          <Plus className="mr-1 h-3 w-3" />
                          添加为信息源
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {smartTestResults.items.slice(0, 8).map((item: any, i: number) => (
                          <div key={i} className="text-xs p-1.5 bg-muted/50 rounded flex items-start gap-2">
                            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                            <span className="line-clamp-1">{item.title}</span>
                          </div>
                        ))}
                        {smartTestResults.totalCount > 8 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">
                            还有 {smartTestResults.totalCount - 8} 条...
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 信息源列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !sources || sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium">暂无信息源</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              点击「从模板添加」快速添加常用新闻网站，或点击「手动添加」自定义配置
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                <BookTemplate className="mr-2 h-4 w-4" />
                从模板添加
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sources.map((source) => {
            const layerInfo = layerLabels[source.layer] || layerLabels.website;
            const LayerIcon = layerInfo.icon;
            const hasSelectors = source.selectors && Object.keys(source.selectors as any).length > 0
              && (source.selectors as any).container;
            return (
              <Card key={source.id} className={`${!source.enabled ? "opacity-60" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-[15px]">{source.name}</h3>
                        <Badge className={`text-xs border-0 ${layerInfo.color}`}>
                          <LayerIcon className="h-3 w-3 mr-1" />
                          {layerInfo.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {hasSelectors ? "精确抓取" : "智能抓取"}
                        </Badge>
                        {!source.enabled && (
                          <Badge variant="secondary" className="text-xs">已禁用</Badge>
                        )}
                      </div>
                      {source.url && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {source.url}
                        </p>
                      )}
                      {source.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {source.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="测试抓取"
                        onClick={() => handleTest(source.id)}
                        disabled={testingId === source.id}
                      >
                        {testingId === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="编辑"
                        onClick={() => openEdit(source)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => setDeleteId(source.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 测试结果展示 */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">抓取测试结果</CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.errors.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50 rounded-lg text-sm text-amber-800 border border-amber-200">
                {testResults.errors.map((e: string, i: number) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            {testResults.totalCount > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  共获取 <strong>{testResults.totalCount}</strong> 条，预览前 {testResults.items.length} 条：
                </p>
                <div className="space-y-2">
                  {testResults.items.map((item: any, i: number) => (
                    <div key={i} className="p-2 bg-muted/50 rounded text-sm">
                      <p className="font-medium">{i + 1}. {item.title}</p>
                      {item.date && <p className="text-xs text-muted-foreground">日期: {item.date}</p>}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                          <ExternalLink className="h-3 w-3" />
                          {item.url.substring(0, 80)}{item.url.length > 80 ? "..." : ""}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">未获取到新闻条目</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 模板选择对话框 */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>从模板添加信息源</DialogTitle>
            <DialogDescription>
              选择常用的新闻网站，一键添加到您的信息源列表中。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(groupedTemplates).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{category}</h3>
                <div className="space-y-2">
                  {(items as any[]).map((template: any, idx: number) => {
                    const globalIdx = templates?.indexOf(template) ?? idx;
                    const alreadyAdded = existingUrls.has(template.url);
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="font-medium text-sm">{template.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                        </div>
                        {alreadyAdded ? (
                          <Badge variant="secondary" className="shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            已添加
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => addFromTemplateMutation.mutate({ templateIndex: globalIdx })}
                            disabled={addFromTemplateMutation.isPending}
                          >
                            {addFromTemplateMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3 mr-1" />
                            )}
                            添加
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑信息源" : "添加信息源"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "修改信息源的配置信息"
                : "填写名称和网址即可，系统会自动尝试识别新闻列表。如需精确控制，可展开高级选项。"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 基本信息 - 始终显示 */}
            <div>
              <Label>信息源名称 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="给这个信息源起个名字，例如：SEC新闻"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <Label>网址 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="粘贴新闻页面的完整网址，例如：https://www.sec.gov/news/pressreleases"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                填入新闻列表页面的网址（不是单篇文章的网址）
              </p>
            </div>

            <div>
              <Label>描述（可选）</Label>
              <Input
                placeholder="简要说明这个信息源，方便日后识别"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* 高级选项折叠区 */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>高级选项（通常不需要修改）</span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAdvanced && (
                <div className="px-3 pb-3 space-y-4 border-t pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">信息源层级</Label>
                      <Select
                        value={form.layer}
                        onValueChange={(v: any) => setForm({ ...form, layer: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Layer 1 - 公开网站</SelectItem>
                          <SelectItem value="api">Layer 2 - API接口</SelectItem>
                          <SelectItem value="manual">Layer 3 - 手动添加</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">抓取类型</Label>
                      <Select
                        value={form.sourceType}
                        onValueChange={(v: any) => setForm({ ...form, sourceType: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML网页（自动/手动）</SelectItem>
                          <SelectItem value="rss">RSS/Atom订阅</SelectItem>
                          <SelectItem value="api">API接口</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* CSS选择器 - 仅HTML类型 */}
                  {form.sourceType === "html" && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">CSS选择器（可选）</CardTitle>
                        <CardDescription className="text-xs">
                          留空则使用智能抓取模式。如果智能抓取效果不好，可以手动填写CSS选择器来精确定位新闻列表。
                          需要在浏览器中右键点击网页元素，选择"检查"来获取选择器。
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-xs">列表容器选择器</Label>
                          <Input
                            placeholder="例如：table tbody tr 或 .news-list .item"
                            value={form.selectors.container}
                            onChange={(e) => setForm({ ...form, selectors: { ...form.selectors, container: e.target.value } })}
                            className="text-sm font-mono"
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">每条新闻所在的HTML容器元素</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">标题选择器</Label>
                            <Input
                              placeholder="例如：a 或 .title"
                              value={form.selectors.title}
                              onChange={(e) => setForm({ ...form, selectors: { ...form.selectors, title: e.target.value } })}
                              className="text-sm font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">链接选择器</Label>
                            <Input
                              placeholder="留空则从标题元素获取"
                              value={form.selectors.link}
                              onChange={(e) => setForm({ ...form, selectors: { ...form.selectors, link: e.target.value } })}
                              className="text-sm font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">日期选择器</Label>
                            <Input
                              placeholder="例如：.date 或 time"
                              value={form.selectors.date}
                              onChange={(e) => setForm({ ...form, selectors: { ...form.selectors, date: e.target.value } })}
                              className="text-sm font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">日期格式</Label>
                            <Input
                              placeholder="例如：YYYY-MM-DD"
                              value={form.dateFormat}
                              onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* API配置 */}
                  {form.sourceType === "api" && (
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">API接口配置</CardTitle>
                        <CardDescription className="text-xs">
                          配置第三方API的请求参数和数据字段映射
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label className="text-xs">API端点 *</Label>
                          <Input
                            placeholder="https://api.example.com/news"
                            value={form.apiConfig.endpoint}
                            onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, endpoint: e.target.value } })}
                            className="text-sm font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">请求方法</Label>
                            <Select
                              value={form.apiConfig.method}
                              onValueChange={(v) => setForm({ ...form, apiConfig: { ...form.apiConfig, method: v } })}
                            >
                              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">数据路径</Label>
                            <Input
                              placeholder="例如：data.items"
                              value={form.apiConfig.dataPath}
                              onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, dataPath: e.target.value } })}
                              className="text-sm font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">请求头（JSON格式）</Label>
                          <Textarea
                            placeholder='{"Authorization": "Bearer your-api-key"}'
                            value={form.apiConfig.headers}
                            onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, headers: e.target.value } })}
                            className="text-sm font-mono"
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">标题字段名</Label>
                            <Input placeholder="title" value={form.apiConfig.titleField}
                              onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, titleField: e.target.value } })}
                              className="text-sm font-mono" />
                          </div>
                          <div>
                            <Label className="text-xs">链接字段名</Label>
                            <Input placeholder="url" value={form.apiConfig.urlField}
                              onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, urlField: e.target.value } })}
                              className="text-sm font-mono" />
                          </div>
                          <div>
                            <Label className="text-xs">日期字段名</Label>
                            <Input placeholder="date" value={form.apiConfig.dateField}
                              onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, dateField: e.target.value } })}
                              className="text-sm font-mono" />
                          </div>
                          <div>
                            <Label className="text-xs">摘要字段名</Label>
                            <Input placeholder="summary" value={form.apiConfig.summaryField}
                              onChange={(e) => setForm({ ...form, apiConfig: { ...form.apiConfig, summaryField: e.target.value } })}
                              className="text-sm font-mono" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.enabled}
                      onCheckedChange={(v) => setForm({ ...form, enabled: v })}
                    />
                    <Label>启用此信息源</Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "保存修改" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除这个信息源吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
