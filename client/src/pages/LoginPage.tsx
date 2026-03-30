import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      toast.error("請輸入帳號和密碼");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "登入失敗");
        return;
      }

      window.location.href = "/";
    } catch (error) {
      toast.error("登入失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-800 p-8 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-100">台南家訪管理系統</h1>
          <p className="text-slate-500 text-sm mt-2">請登入以繼續</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">帳號</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="輸入帳號"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">密碼</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="輸入密碼"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            登入
          </Button>
        </div>
      </Card>
    </div>
  );
}