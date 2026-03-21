import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mail, Save, Loader2, CheckCircle, AlertCircle, Zap, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function EmailPage() {
  const [form, setForm] = useState({
    smtpHost: "",
    smtpPort: 465,
    smtpUser: "",
    smtpPass: "",
    useSsl: true,
    fromName: "新闻聚合平台",
    fromEmail: "",
    toEmails: "",
    autoSendEnabled: false,
    dailySendTime: "08:00",
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: config, isLoading } = trpc.emailConfig.get.useQuery();

  useEffect(() => {
    if (config) {
      const recipients = config.recipients as string[] | null;
      setForm({
        smtpHost: config.smtpHost || "",
        smtpPort: config.smtpPort || 465,
        smtpUser: config.smtpUser || "",
        smtpPass: config.smtpPass || "",
        useSsl: config.useSsl ?? true,
        fromName: config.fromName || "新闻聚合平台",
        fromEmail: config.fromEmail || "",
        toEmails: recipients?.join(", ") || "",
        autoSendEnabled: config.autoSendEnabled ?? false,
        dailySendTime: config.dailySendTime || "08:00",
      });
    }
  }, [config]);

  const utils = trpc.useUtils();

  const saveMutation = trpc.emailConfig.save.useMutation({
    onSuccess: () => {
      toast.success("邮件配置已保存");
      utils.emailConfig.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testMutation = trpc.emailConfig.testConnection.useMutation({
    onSuccess: (result) => {
      const msg = result.error || (result.success ? "SMTP连接测试成功" : "连接失败");
      setTestResult({ success: result.success, message: msg });
      if (result.success) {
        toast.success("SMTP连接测试成功");
      } else {
        toast.error(`连接失败: ${msg}`);
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, message: err.message });
      toast.error(err.message);
    },
  });

  function handleSave() {
    const { toEmails, ...rest } = form;
    const recipients = toEmails
      .split(/[,;，；\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);
    saveMutation.mutate({ ...rest, recipients } as any);
  }

  function handleTest() {
    setTestResult(null);
    testMutation.mutate({
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpUser: form.smtpUser,
      smtpPass: form.smtpPass,
      useSsl: form.useSsl,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">邮件设置</h1>
        <p className="text-muted-foreground text-sm mt-1">
          配置SMTP邮件服务器，用于自动发送新闻报告
        </p>
      </div>

      {/* 使用说明 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-medium">如何获取SMTP配置？</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li><strong>QQ邮箱</strong>：设置 → 账户 → 开启SMTP服务 → 获取授权码。服务器：smtp.qq.com，端口：465</li>
                <li><strong>163邮箱</strong>：设置 → POP3/SMTP → 开启 → 获取授权码。服务器：smtp.163.com，端口：465</li>
                <li><strong>Gmail</strong>：需开启两步验证并生成应用密码。服务器：smtp.gmail.com，端口：465</li>
                <li><strong>Outlook</strong>：服务器：smtp.office365.com，端口：587（关闭SSL）</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMTP配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP服务器配置</CardTitle>
          <CardDescription>配置邮件发送服务器的连接信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>SMTP服务器地址 *</Label>
              <Input
                placeholder="例如：smtp.qq.com"
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
              />
            </div>
            <div>
              <Label>端口号 *</Label>
              <Input
                type="number"
                placeholder="465"
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 465 })}
              />
            </div>
            <div>
              <Label>用户名/邮箱 *</Label>
              <Input
                placeholder="your-email@qq.com"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              />
            </div>
            <div>
              <Label>密码/授权码 *</Label>
              <Input
                type="password"
                placeholder="SMTP授权码"
                value={form.smtpPass}
                onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.useSsl}
              onCheckedChange={(v) => setForm({ ...form, useSsl: v })}
            />
            <Label>使用SSL/TLS加密（端口465时建议开启）</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending}>
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              测试连接
            </Button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 发件人和收件人 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">发件人和收件人</CardTitle>
          <CardDescription>设置报告邮件的发送方和接收方</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>发件人名称</Label>
              <Input
                placeholder="新闻聚合平台"
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              />
            </div>
            <div>
              <Label>发件人邮箱</Label>
              <Input
                placeholder="与SMTP用户名相同"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>收件人邮箱 *（多个用逗号分隔）</Label>
            <Input
              placeholder="例如：user1@example.com, user2@example.com"
              value={form.toEmails}
              onChange={(e) => setForm({ ...form, toEmails: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 定时发送 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">定时发送</CardTitle>
          <CardDescription>设置每日自动抓取并发送报告的时间</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.autoSendEnabled}
              onCheckedChange={(v) => setForm({ ...form, autoSendEnabled: v })}
            />
            <Label>启用每日定时发送</Label>
          </div>
          {form.autoSendEnabled && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0">每天</Label>
              <Input
                type="time"
                className="w-32"
                value={form.dailySendTime}
                onChange={(e) => setForm({ ...form, dailySendTime: e.target.value })}
              />
              <span>自动发送</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存所有设置
        </Button>
      </div>
    </div>
  );
}
