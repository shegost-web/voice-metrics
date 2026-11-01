// 声の記録ツール → Google スプレッドシート追記用 Apps Script
// スプレッドシートの「拡張機能 > Apps Script」に貼り付け、
// 「デプロイ > 新しいデプロイ > ウェブアプリ」（実行ユーザー: 自分 / アクセス: 全員）で公開し、
// 発行された /exec URL をツールの「ライブ送信設定」に貼ってください。
const COLS = ['time','text','duration','avgDb','peakDb','avgHz','minHz','maxHz','rate','pauses','pauseSec','strength','emotion','memo'];
function doPost(e) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('記録') ||
             SpreadsheetApp.getActiveSpreadsheet().insertSheet('記録');
  if (sh.getLastRow() === 0) sh.appendRow(COLS);
  const r = JSON.parse(e.postData.contents);
  sh.appendRow(COLS.map(c => c === 'time' ? new Date(r.time) : (r[c] ?? '')));
  return ContentService.createTextOutput(JSON.stringify({ok: true})).setMimeType(ContentService.MimeType.JSON);
}
