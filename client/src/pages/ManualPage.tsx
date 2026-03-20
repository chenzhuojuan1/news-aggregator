import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardPaste, Loader2, CheckCircle, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ManualPage() {
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("手动添加");
  const [result, setResult] = useState<any>(null);

  const addManual = trpc.article.addManual.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(data.message);
      setText("");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">手动添加新闻</h1>
        <p className="text-muted-foreground text-sm mt-1">
          将其他渠道的新闻内容粘贴到这里，系统会自动识别并应用关键词筛选规则
        </p>
      </div>

      {/* 使用说明 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-medium">使用说明</p>
              <p>支持以下格式的新闻内容粘贴：</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>每条新闻用空行分隔，第一行为标题</li>
                <li>如果包含URL链接，会自动识别</li>
                <li>如果包含日期（如 2024-03-20），会自动识别</li>
                <li>也可以每行一条新闻标题（简单模式）</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            粘贴新闻内容
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>来源名称</Label>
            <Input
              placeholder="例如：金十数据、微信公众号"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
          </div>
          <div>
            <Label>新闻内容 *</Label>
            <Textarea
              placeholder={"粘贴新闻内容到这里...\n\n示例格式：\n\nNYSE Announces New Trading Rules for ETF Market Makers\nhttps://www.nyse.com/article/123\n2024-03-20\n\nSEC Approves Amendments to Regulation SHO\nhttps://www.sec.gov/news/456\n2024-03-19"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {text.trim() ? `已输入 ${text.split("\n").filter(l => l.trim()).length} 行内容` : "请粘贴新闻内容"}
            </p>
          </div>
          <Button
            onClick={() => addManual.mutate({ text, sourceName })}
            disabled={addManual.isPending || !text.trim()}
            className="w-full"
          >
            {addManual.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ClipboardPaste className="mr-2 h-4 w-4" />
            )}
            解析并添加
          </Button>
        </CardContent>
      </Card>

      {/* 结果展示 */}
      {result && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">{result.message}</p>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-green-600">总计添加</p>
                    <p className="text-lg font-semibold">{result.added}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600">通过筛选</p>
                    <p className="text-lg font-semibold">{result.passed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600">被排除</p>
                    <p className="text-lg font-semibold">{result.excluded}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
