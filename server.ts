import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());

  app.get("/api/prices", async (req, res) => {
    try {
      const { data } = await axios.get("https://www.cpc.com.tw/GetOilPriceJson.aspx?type=TodayOilPriceString");
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch prices" });
    }
  });

  app.get("/api/news-analysis", async (req, res) => {
    try {
      const newsUrl = "https://www.cpc.com.tw/News2.aspx?n=28&sms=8920";
      const { data } = await axios.get(newsUrl);
      const $ = cheerio.load(data);
      
      const oilNewsLink = $(".message a.div").filter((i, el) => {
        const title = $(el).attr("title") || "";
        return title.includes("汽、柴油") || title.includes("油價");
      }).first();

      const firstNewsHref = oilNewsLink.attr("href");
      const title = oilNewsLink.attr("title") || "";
      
      if (!firstNewsHref) {
        return res.json({ title: "No news found", content: "", analysis: null, prices: [] });
      }

      const articleUrl = `https://www.cpc.com.tw/${firstNewsHref}`;
      const actData = await axios.get(articleUrl);
      const $art = cheerio.load(actData.data);
      const content = $art(".essay").text().trim() || $art("body").text().replace(/\s+/g, ' ').substring(0, 5000);

      let analysis = null;
      let prices = [];
      const currentDate = new Date().toISOString();

      if (content && process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const prompt = `
          這是一篇台灣中油的官方公告：
          標題：${title}
          內容：${content}
          
          今天是：${currentDate}

          請從中提取以下資訊並以 JSON 格式回傳（不要加上 Markdown 語法，直接回傳 JSON）：
          {
            "hasAnnounced": （布林值）根據這篇公告的標題、內容中的生效日期與今天的日期判斷，這篇公告是否是針對「下一週」（未來一週）的最新油價調整公告？如果是舊的（例如已過期或針對上一週），請填 false；如果是剛宣布要用於下週的，請填 true。如果尚未宣布，前端將顯示尚未宣布。,
            "adjustment": "簡短說明下週油價調整狀況（例如：汽柴油各調降0.1元、汽油調漲0.1元柴油不調整、汽柴油不調整等）。",
            "reasoning": "說明調降或不調整的完整原因（例如國際油價下跌或平穩雙機制吸收等細節，如果尚未宣布下週油價則填空字串。）。",
            "date": "正式實施日期及時段（例如：4月27日凌晨零時起至5月3日），如果無相關資訊則填空字串。"
          }`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            }
          });

          if (response.text) {
             console.log("Raw LLM response:", response.text);
             const data = JSON.parse(response.text);
             analysis = {
               hasAnnounced: data.hasAnnounced,
               adjustment: data.adjustment,
               reasoning: data.reasoning,
               date: data.date
             };
          } else {
             console.log("LLM returned no text.");
          }
        } catch (e: any) {
             console.log("Gemini AI API not available or invalid key, falling back to local extraction.");
        }
      } 
      
      // Fallback if AI fails or key is missing
      if (!analysis) {
        let hasAnnounced = false;
        let adjustment = "尚未宣布";
        let date = "";
        let reasoning = "官方尚未宣布";

        if (title.includes("汽") || title.includes("柴") || title.includes("油價")) {
             hasAnnounced = true;
             
             // Check if it's an old announcement
             const dateMatches = title.match(/(\d{1,2})\/(\d{1,2})/g);
             if (dateMatches && dateMatches.length >= 2) {
                 const endDateStr = dateMatches[1]; // e.g. "5/3" or "4/26"
                 const [m, d] = endDateStr.split('/').map(Number);
                 const now = new Date();
                 const currentMonth = now.getMonth() + 1;
                 const currentDay = now.getDate();
                 
                 // if the announcement's end date is today or earlier, it's for the current/past week
                 if (m < currentMonth || (m === currentMonth && d <= currentDay)) {
                     hasAnnounced = false;
                     adjustment = "尚未宣布";
                     date = "";
                     reasoning = "官方尚未宣布";
                 }
             }

             if (hasAnnounced) {
               // extract from title like "4/27-5/3國內汽、柴油價格維持不調整"
               const keyword = "價格";
               const index = title.indexOf(keyword);
               if (index !== -1) {
                  adjustment = title.substring(index + keyword.length).trim() || "調整公告已發布";
               } else {
                  adjustment = "調整公告已發布";
               }
               
               const bodyDateMatch = content.match(/(自[^止]+止)/);
               date = bodyDateMatch ? bodyDateMatch[0] : "依公告內容為準";
               
               // Extract reasoning from the paragraph
               const parts = content.split("元。");
               if (parts.length > 1) {
                   const extractedReasoning = parts[1].split(/\(?附表|實際零售價格/)[0].replace(/\s+/g, " ").trim();
                   reasoning = extractedReasoning || "您可點擊上方來源連結，閱讀完整中油官方說明。";
               } else {
                   reasoning = "您可點擊上方來源連結，閱讀完整中油官方說明。";
               }
             }
        }
        
        analysis = { hasAnnounced, adjustment, date, reasoning };
      }

      res.json({ title, url: articleUrl, analysis, prices });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch news" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
