import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// CORS utility
function runCors(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (runCors(req, res)) return;

  try {
    const { data } = await axios.get("https://www.cpc.com.tw/GetOilPriceJson.aspx?type=TodayOilPriceString");
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
}
