import { useEffect, useState } from "react";
import { Droplet, TrendingDown, TrendingUp, Info, Calendar, Newspaper, Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";

import { App as CapacitorApp } from "@capacitor/app";

export default function App() {
  const [prices, setPrices] = useState<any[]>([]);
  const [news, setNews] = useState<any>(null);
  const [analysis, setAnalysis] = useState<{
    hasAnnounced: boolean | null;
    adjustment: string;
    reasoning: string;
    date: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState<{ url: string, version: string } | null>(null);

  // Check for updates
  useEffect(() => {
    async function checkUpdate() {
      try {
        const currentVersion = import.meta.env.VITE_APP_VERSION;
        if (!currentVersion || currentVersion === "development") return;

        const res = await fetch("https://api.github.com/repos/adeend-co/-App-2/releases/latest");
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
        const defaultApiUrl = isNative ? "https://app-2-chi.vercel.app" : ""; // 更換成您在 Vercel 實際部署完成後的網址
        const apiUrl = import.meta.env.VITE_API_BASE_URL || defaultApiUrl;
        
        const [newsRes, pricesRes] = await Promise.all([
          fetch(`${apiUrl}/api/news-analysis`),
          fetch(`${apiUrl}/api/prices`)
        ]);
        
        const newsData = await newsRes.json();
        const priceData = await pricesRes.json();

        setNews({ title: newsData.title, url: newsData.url });
        if (newsData.analysis) {
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
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 font-medium">資料載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* 新版 APK 更新提示 */}
        {updateAvailable && (
          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Download className="w-6 h-6 flex-shrink-0" />
              <div>
                <h3 className="font-bold">發現新版本：{updateAvailable.version}</h3>
                <p className="text-blue-100 text-sm">請更新以獲得更好的體驗與最新功能</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  await CapacitorApp.openUrl({ url: updateAvailable.url });
                } else {
                  window.open(updateAvailable.url, "_blank");
                }
              }}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap text-center w-full sm:w-auto cursor-pointer"
            >
              立即下載更新
            </button>
          </div>
        )}

        <header className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
            <Droplet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">台灣中油油價查詢</h1>
            <p className="text-gray-500 mt-1">最新油價與下週調整公告分析</p>
          </div>
        </header>

        {analysis && (
          <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Newspaper className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">下週油價調整公告</h2>
                {news && news.title !== "No news found" && (
                  <a href={news.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline mt-1 block">
                    來源：{news.title}
                  </a>
                )}
              </div>
            </div>

            {analysis.hasAnnounced ? (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                      <TrendingDown className="w-5 h-5 text-green-600" /> 
                      調整狀況
                    </div>
                    <p className="text-lg font-bold text-gray-900">{analysis.adjustment}</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                      實施日期
                    </div>
                    <p className="text-lg font-bold text-gray-900">{analysis.date}</p>
                  </div>
                </div>

                <div className="mt-6 bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-800 font-medium mb-3">
                    <Info className="w-5 h-5" />
                    調整原因探討
                  </div>
                  <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                    {analysis.reasoning}
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 p-6 md:p-8 rounded-xl border border-gray-100 text-center flex flex-col items-center justify-center min-h-[160px]">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                  <Info className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">官方尚未宣布</h3>
                <p className="text-gray-500 max-w-md">
                  台灣中油通常於每週日中午發布下一週油價調整資訊，目前尚未有最新公告。
                </p>
              </div>
            )}
          </section>
        )}

        <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
           <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
             <Droplet className="w-5 h-5 text-gray-400" />
             目前各油品供應價格
           </h2>
           {prices && prices.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
               {prices.map((item, idx) => (
                 <div key={idx} className="bg-white border text-center border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                   <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.產品名稱 || item.name || "不明油品"}</h3>
                   <div className="text-3xl font-bold text-blue-600">
                     <span className="text-sm font-normal text-gray-500 mr-1">$</span>
                     {item.參考牌價 || item.price || item.Price || "--"}
                     <span className="text-sm font-normal text-gray-500 ml-1">/ 公升</span>
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
               <p className="text-gray-500">暫時無法取得油價資料</p>
             </div>
           )}
        </section>
      </div>
    </div>
  );
}
