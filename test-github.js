import https from "https";

https.get("https://api.github.com/repos/adeend-co/-App-2/releases/latest", { headers: { "User-Agent": "node" } }, (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    let j = JSON.parse(data);
    console.log(j.message);
  });
});
