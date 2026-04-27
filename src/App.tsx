import { useEffect, useState } from "react";
import { Droplet, TrendingDown, TrendingUp, Info, Calendar, Newspaper, Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";

import { App as CapacitorApp } from "@capacitor/app";

const getWeekRange = (date: Date, offsetWeeks: number = 0) => {
  const resultStart = new Date(date);
  const day = resultStart.getDay();
  const diffToMonday = resultStart.getDate() - day + (day === 0 ? -6 : 1);
  resultStart.setDate(diffToMonday + offsetWeeks * 7);

  const resultEnd = new Date(resultStart);
  resultEnd.setDate(resultStart.getDate() + 6);

  const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${format(resultStart)}~${format(resultEnd)}`;
};

const getMondayStr = (date: Date, offsetWeeks: number = 0) => {
  const resultStart = new Date(date);
  const day = resultStart.getDay();
  const diffToMonday = resultStart.getDate() - day + (day === 0 ? -6 : 1);
  resultStart.setDate(diffToMonday + offsetWeeks * 7);
  return `${resultStart.getMonth() + 1}/${resultStart.getDate()}`;
};

export default function App() {
  const today = new Date();
  const currentWeekStr = getWeekRange(today, 0);
  const nextWeekStr = getWeekRange(today, 1);
  const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
  const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 (星期${daysOfWeek[today.getDay()]})`;

  const [prices, setPrices] = useState<any[]>([]);
  const [news, setNews] = useState<any>(null);
  const [analysis, setAnalysis] = useState<{
    hasAnnounced: boolean | null;
    adjustment: string;
    reasoning: string;
    date: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("資料載入中...");
  const [updateAvailable, setUpdateAvailable] = useState<{ url: string, version: string } | null>(null);

  // Check for updates
  useEffect(() => {
    async function checkUpdate() {
      try {
        const currentVersion = import.meta.env.VITE_APP_VERSION;
        if (!currentVersion || currentVersion === "development") return;

        const res = await fetch("https://api.github.com/repos/adeend-co/App3/releases/latest");
        if (!res.ok) return;
        const data = await res.json();
        
        if (data && data.tag_name && data.tag_name !== currentVersion) {
            // If the latest tag is different from our current tag, show update
            const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
            const downloadUrl = apkAsset ? apkAsset.browser_download_url : data.html_url;
            setUpdateAvailable({ url: downloadUrl, version: data.tag_name });
        }
      } catch (err) {
        console.error("Update check failed", err);
      }
    }
    checkUpdate();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // 使用 Capacitor 的 API 精準判斷是否在原生 APP 內執行
        const isNative = Capacitor.isNativePlatform();
        const defaultApiUrl = isNative ? "https://app3-tau-livid.vercel.app" : ""; 
        const apiUrl = import.meta.env.VITE_API_BASE_URL || defaultApiUrl;
        
        setLoadingMessage("正在連線並獲取各項油品最新價格...");
        const pricesRes = await fetch(`${apiUrl}/api/prices`);
        const priceData = await pricesRes.json();
        
        setLoadingMessage("正在準備 AI 分析模型 (請稍候約 3~5 秒)...");
        const newsRes = await fetch(`${apiUrl}/api/news-analysis`);
        const newsData = await newsRes.json();

        setLoadingMessage("資料分析完成！準備顯示畫面...");

        setNews({ title: newsData.title, url: newsData.url });
        if (newsData.analysis && newsData.title) {
          // 強制使用 App 端的時間與邏輯來判斷：直接對比新聞標題是否包含「本週一」的日期字串
          const title = newsData.title;
          const today = new Date();
          const thisWeekMondayStr = getMondayStr(today, 0); 
          const nextWeekMondayStr = getMondayStr(today, 1);
          
          if (title.includes(thisWeekMondayStr)) {
              // 標題寫的是本週起始日 -> 這是本週的舊新聞，下週尚未宣布
              newsData.analysis.hasAnnounced = false;
          } else if (title.includes(nextWeekMondayStr)) {
              // 標題寫的是下週起始日 -> 真的是下週新聞
              newsData.analysis.hasAnnounced = true;
          }
          
          setAnalysis(newsData.analysis);
        }

        if (priceData && priceData.sPrice1) {
          setPrices([
             { name: "92無鉛汽油", price: priceData.sPrice1 },
             { name: "95無鉛汽油", price: priceData.sPrice2 },
             { name: "98無鉛汽油", price: priceData.sPrice3 },
             { name: "超級柴油", price: priceData.sPrice5 },
             { name: "酒精汽油", price: priceData.sPrice4 },
             { name: "液化石油氣", price: priceData.sPrice6 },
          ]);
        } else if (newsData.prices && Array.isArray(newsData.prices)) {
          // Fallback to AI extracted prices if real-time API fails
          setPrices(newsData.prices);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#F0F4F9] px-6 select-none">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex justify-center items-center w-16 h-16">
            <svg className="md-spinner text-[#0B57D0] w-12 h-12" viewBox="25 25 50 50">
              <circle className="md-spinner-circle" cx="50" cy="50" r="20" fill="none" strokeWidth="4"></circle>
            </svg>
          </div>
          <p className="text-[#444746] font-medium text-[15px] animate-pulse tracking-wide">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4F9] font-sans pb-[calc(1rem+var(--sab))] pt-[calc(0.5rem+var(--sat))] select-none">
      <div className="max-w-lg mx-auto">
        
        <header className="px-6 pt-8 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <img src="/icon.svg" alt="Icon" className="w-12 h-12 rounded-[16px] shadow-sm object-cover" />
            <h1 className="text-[32px] font-medium tracking-tight text-[#1F1F1F]">油價查詢</h1>
          </div>
          <div className="mt-1 bg-[#D3E3FD] text-[#041E49] px-4 py-2 rounded-full text-[14px] font-medium inline-flex items-center self-start tracking-wide">
            {todayStr}
          </div>
        </header>

        <div className="px-4 space-y-4 pb-8 mt-2">
          {/* 新版 APK 更新提示 */}
          {updateAvailable && (
            <div className="bg-[#0B57D0] text-white p-5 rounded-[28px] shadow-sm flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-full shrink-0">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-medium text-[18px]">發現新版本 ({updateAvailable.version})</h3>
                  <p className="text-blue-100 text-[14px] mt-0.5">請更新以獲得更好的體驗與最新功能</p>
                </div>
              </div>
              <button 
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) {
                    try {
                      const { Browser } = await import('@capacitor/browser');
                      await Browser.open({ url: updateAvailable.url });
                    } catch (e) {
                      console.error("Browser", e);
                      window.open(updateAvailable.url, "_blank", "noopener,noreferrer");
                    }
                  } else {
                    window.open(updateAvailable.url, "_blank", "noopener,noreferrer");
                  }
                }}
                className="bg-white text-[#0B57D0] px-6 py-3 rounded-full font-medium active:opacity-80 transition-opacity text-center w-full sm:w-auto"
              >
                立即下載
              </button>
            </div>
          )}

          {analysis && (
            <section className="bg-white rounded-[32px] p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className="p-3 bg-[#D3E3FD] text-[#0B57D0] rounded-full shrink-0">
                  <Newspaper className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-[20px] font-medium text-[#1F1F1F] tracking-tight leading-tight">下週油價調整分析 ({nextWeekStr})</h2>
                </div>
              </div>

              {news && news.title !== "No news found" && (
                <a href={news.url} target="_blank" rel="noreferrer" className="block text-[14px] text-[#0B57D0] active:scale-[0.99] transition-transform bg-[#F0F4F9] p-4 rounded-[20px] mb-5 font-medium selectable">
                  中油近期新聞：{news.title}
                </a>
              )}

              {analysis.hasAnnounced ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#F0F4F9] p-5 rounded-[24px]">
                      <div className="flex items-center gap-2 text-[#444746] text-[13px] font-medium mb-2">
                        <TrendingDown className="w-4 h-4 text-[#0B57D0]" /> 
                        狀態
                      </div>
                      <p className="text-[18px] font-medium text-[#1F1F1F] leading-snug">{analysis.adjustment}</p>
                    </div>
                    <div className="bg-[#F0F4F9] p-5 rounded-[24px]">
                      <div className="flex items-center gap-2 text-[#444746] text-[13px] font-medium mb-2">
                        <Calendar className="w-4 h-4 text-[#0B57D0]" />
                        日期
                      </div>
                      <p className="text-[18px] font-medium text-[#1F1F1F] leading-snug">{analysis.date}</p>
                    </div>
                  </div>

                  <div className="bg-[#EAF1FB] p-5 rounded-[24px]">
                    <div className="flex items-center gap-2 text-[#041E49] text-[15px] font-medium mb-2">
                      <Info className="w-5 h-5 text-[#0B57D0]" />
                      官方說明
                    </div>
                    <p className="text-[#041E49] opacity-80 leading-relaxed text-[15px] selectable selection:bg-blue-200">
                      {analysis.reasoning}
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-[#F0F4F9] p-8 rounded-[24px] text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                    <Info className="w-6 h-6 text-[#0B57D0]" />
                  </div>
                  <h3 className="text-[18px] font-medium text-[#1F1F1F] mb-2 tracking-tight">尚未發布公告</h3>
                  <p className="text-[14px] text-[#444746] leading-relaxed">
                    中油通常於每週日中午發布下一週資訊，目前尚無最新消息。
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="bg-white rounded-[32px] p-6 shadow-sm">
             <div className="flex items-center justify-between gap-2 mb-5">
               <h2 className="text-[20px] font-medium text-[#1F1F1F] tracking-tight">本週各油品價格</h2>
               <span className="text-[13px] font-medium text-[#444746] bg-[#F0F4F9] px-3 py-1.5 rounded-full">{currentWeekStr}</span>
             </div>
             
             {prices && prices.length > 0 ? (
               <div className="grid grid-cols-2 gap-3">
                 {prices.map((item, idx) => (
                   <div key={idx} className="bg-[#F0F4F9] rounded-[24px] p-5 flex flex-col justify-center active:scale-[0.98] transition-transform">
                     <span className="text-[#444746] text-[14px] font-medium mb-1.5">{item.產品名稱 || item.name || "不明油品"}</span>
                     <div className="flex items-baseline gap-1">
                       <span className="text-[16px] font-medium text-[#444746] leading-none">$</span>
                       <span className="text-[28px] font-medium text-[#1F1F1F] tracking-tight leading-none">
                         {item.參考牌價 || item.price || item.Price || "--"}
                       </span>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-10 bg-[#F0F4F9] rounded-[24px]">
                 <p className="text-[#444746] font-medium text-[15px]">暫時無法取得油價資料</p>
               </div>
             )}
          </section>
        </div>
      </div>
    </div>
  );
}
