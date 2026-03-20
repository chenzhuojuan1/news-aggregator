import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tags, Plus, Pencil, Trash2, Loader2, ShieldCheck, ShieldX, ShieldAlert, Beaker } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RuleForm {
  name: string;
  ruleType: "include" | "exclude" | "whitelist";
  logic: "or" | "and";
  keywordsText: string;
  excludeStrength: "hard" | "soft" | null;
  description: string;
  enabled: boolean;
}

const defaultForm: RuleForm = {
  name: "",
  ruleType: "include",
  logic: "or",
  keywordsText: "",
  excludeStrength: null,
  description: "",
  enabled: true,
};

const ruleTypeInfo: Record<string, { label: string; color: string; icon: any; desc: string }> = {
  include: { label: "包含规则", color: "bg-green-50 text-green-700", icon: ShieldCheck, desc: "标题中包含这些关键词的新闻会被保留" },
  exclude: { label: "排除规则", color: "bg-red-50 text-red-700", icon: ShieldX, desc: "标题中包含这些关键词的新闻会被排除" },
  whitelist: { label: "白名单", color: "bg-blue-50 text-blue-700", icon: ShieldAlert, desc: "优先级最高，匹配即保留（不受排除规则影响）" },
};

export default function KeywordsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...defaultForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.keywordRule.list.useQuery();

  const createMutation = trpc.keywordRule.create.useMutation({
    onSuccess: () => { toast.success("规则已添加"); utils.keywordRule.list.invalidate(); setDialogOpen(false); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.keywordRule.update.useMutation({
    onSuccess: () => { toast.success("规则已更新"); utils.keywordRule.list.invalidate(); setDialogOpen(false); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.keywordRule.delete.useMutation({
    onSuccess: () => { toast.success("规则已删除"); utils.keywordRule.list.invalidate(); setDeleteId(null); },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.keywordRule.testMatch.useMutation({
    onSuccess: (result) => setTestResult(result),
    onError: (err) => toast.error(err.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  }

  function openEdit(rule: any) {
    setEditingId(rule.id);
    const keywords = rule.keywords as string[];
    setForm({
      name: rule.name,
      ruleType: rule.ruleType,
      logic: rule.logic,
      keywordsText: keywords.join("\n"),
      excludeStrength: rule.excludeStrength || null,
      description: rule.description || "",
      enabled: rule.enabled,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const keywords = form.keywordsText.split("\n").map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) {
      toast.error("请至少输入一个关键词");
      return;
    }
    const payload: any = {
      name: form.name,
      ruleType: form.ruleType,
      logic: form.logic,
      keywords,
      excludeStrength: form.ruleType === "exclude" ? form.excludeStrength : undefined,
      description: form.description || undefined,
      enabled: form.enabled,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">关键词规则</h1>
          <p className="text-muted-foreground text-sm mt-1">
            配置新闻筛选规则：包含规则决定保留哪些新闻，排除规则过滤噪音，白名单优先保留
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          添加规则
        </Button>
      </div>

      {/* 测试区域 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            关键词匹配测试
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="输入一个新闻标题来测试匹配结果..."
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={() => testTitle && testMutation.mutate({ title: testTitle })}
              disabled={testMutation.isPending || !testTitle}
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "测试"}
            </Button>
          </div>
          {testResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.passed ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              <p className="font-medium">{testResult.passed ? "通过筛选" : "被排除"}</p>
              {testResult.matchedKeywords?.length > 0 && (
                <p className="mt-1">匹配关键词: {testResult.matchedKeywords.join(", ")}</p>
              )}
              {testResult.excludeReason && (
                <p className="mt-1">排除原因: {testResult.excludeReason}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 规则列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !rules || rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Tags className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">暂无关键词规则</p>
            <p className="text-sm text-muted-foreground mt-1">
              添加规则来筛选新闻，例如添加包含规则保留特定交易所相关新闻
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => {
            const info = ruleTypeInfo[rule.ruleType] || ruleTypeInfo.include;
            const Icon = info.icon;
            const keywords = rule.keywords as string[];
            return (
              <Card key={rule.id} className={`${!rule.enabled ? "opacity-60" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-[15px]">{rule.name}</h3>
                        <Badge className={`text-xs border-0 ${info.color}`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {info.label}
                        </Badge>
                        {rule.ruleType === "exclude" && rule.excludeStrength && (
                          <Badge variant="outline" className="text-xs">
                            {rule.excludeStrength === "hard" ? "硬排除" : "软排除"}
                          </Badge>
                        )}
                        {rule.ruleType === "include" && (
                          <Badge variant="outline" className="text-xs">
                            {rule.logic === "and" ? "全部匹配(AND)" : "任一匹配(OR)"}
                          </Badge>
                        )}
                        {!rule.enabled && (
                          <Badge variant="secondary" className="text-xs">已禁用</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {keywords.slice(0, 15).map((kw) => (
                          <Badge key={kw} variant="secondary" className="text-xs font-normal">
                            {kw}
                          </Badge>
                        ))}
                        {keywords.length > 15 && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            +{keywords.length - 15} 更多
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground mt-2">{rule.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(rule.id)}>
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

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑规则" : "添加规则"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>规则名称 *</Label>
              <Input
                placeholder="例如：交易所关键词"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>规则类型</Label>
                <Select value={form.ruleType} onValueChange={(v: any) => setForm({ ...form, ruleType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="include">包含规则（保留匹配的）</SelectItem>
                    <SelectItem value="exclude">排除规则（过滤匹配的）</SelectItem>
                    <SelectItem value="whitelist">白名单（优先保留）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.ruleType === "include" && (
                <div>
                  <Label>匹配逻辑</Label>
                  <Select value={form.logic} onValueChange={(v: any) => setForm({ ...form, logic: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="or">任一匹配 (OR)</SelectItem>
                      <SelectItem value="and">全部匹配 (AND)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.ruleType === "exclude" && (
                <div>
                  <Label>排除强度</Label>
                  <Select value={form.excludeStrength || "hard"} onValueChange={(v: any) => setForm({ ...form, excludeStrength: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hard">硬排除（直接丢弃）</SelectItem>
                      <SelectItem value="soft">软排除（标记但保留）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>关键词列表 *（每行一个）</Label>
              <Textarea
                placeholder={"例如：\nNYSE\nNasdaq\nLSE\nSEC\nFCA"}
                value={form.keywordsText}
                onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                当前 {form.keywordsText.split("\n").filter(l => l.trim()).length} 个关键词
              </p>
            </div>
            <div>
              <Label>描述（可选）</Label>
              <Input
                placeholder="简要说明这条规则的用途..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>启用此规则</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <AlertDialogDescription>删除后无法恢复，确定要删除这条规则吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
