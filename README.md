# 声の記録ツール（プロトタイプ）

話しながら声を録音し、発話ごとの「音量・ピッチ・話速・間」を記録して、自分で感情の強さタグを付けていくためのツールです。`index.html` 1ファイルだけで動きます（ビルド不要）。

## 開き方
- マイクと音声認識は **https または localhost** でないと動きません（`file://` で直接開くとマイクが使えないことがあります）。
- おすすめ：**GitHub Pages** で公開
  1. GitHub で新しいリポジトリを作り `index.html` をアップロード
  2. Settings → Pages → Branch: `main` / root を選んで保存
  3. `https://<ユーザー名>.github.io/<リポジトリ名>/` を Android Chrome で開く
- PCでの確認：このフォルダで `python3 -m http.server 8000` → `http://localhost:8000`
- 初回はマイクの許可を求められます。**Android Chrome 推奨**（Web Speech API 対応）。

## 使い方
1. ページを開くと自動で録音が始まります（初回だけマイクを許可）。「■ 停止」で止められます。音声認識で文が確定するたびに1行の記録になります。
2. 表で「強さ」（強い / やや強い / 普通 / 弱い / 未設定）、「感情」（喜・怒・哀・楽 など自由入力）、「メモ」を入力。
3. 記録はブラウザ（localStorage）に自動保存。CSV（Excel/Googleスプレッドシート用BOM付きUTF-8）・JSONで出力、JSONで読込（重複はスキップ）できます。

## 記録される指標
| 列 | 意味 |
|---|---|
| duration | 発話の長さ（秒、前後の無音を除く） |
| avgDb / peakDb | 平均・最大音量（RMS dBFS、0が最大。-45 dB 以下は無音扱い） |
| avgHz / minHz / maxHz | ピッチ（自己相関法、70〜500 Hz） |
| rate | 話速（文字/秒、句読点・空白除く） |
| pauses / pauseSec | 300ms超の無音の回数と合計秒 |

## ライブ送信（任意）→ Googleスプレッドシート
確定した記録を、その場でJSONとしてWebhookにPOSTできます。Google Apps Script を使えばスプレッドシートにリアルタイムで1行ずつ追記されます。

1. 新しいGoogleスプレッドシートを作る →「拡張機能 > Apps Script」
2. `apps-script.gs` の内容（下記）を貼り付けて保存
3. 「デプロイ > 新しいデプロイ > 種類: ウェブアプリ」、実行ユーザー: 自分、アクセス: 全員 → デプロイ
4. 発行された `https://script.google.com/macros/s/…/exec` をツールの「ライブ送信設定」に貼って保存

```javascript
const COLS = ['time','text','duration','avgDb','peakDb','avgHz','minHz','maxHz','rate','pauses','pauseSec','strength','emotion','memo'];
function doPost(e) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('記録') ||
             SpreadsheetApp.getActiveSpreadsheet().insertSheet('記録');
  if (sh.getLastRow() === 0) sh.appendRow(COLS);
  const r = JSON.parse(e.postData.contents);
  sh.appendRow(COLS.map(c => c === 'time' ? new Date(r.time) : (r[c] ?? '')));
  return ContentService.createTextOutput(JSON.stringify({ok: true})).setMimeType(ContentService.MimeType.JSON);
}
```
注意：送信は記録確定時点のもの（タグは「未設定」）。後で付けたタグはCSV出力で反映してください。URLを知っている人は誰でも書き込めるので、URLは公開しないでください。送信は `no-cors` のため成功/失敗の詳細はブラウザ側では確認できません（シートで確認）。

## フェーズ2計画
1. **シート自動追記の強化**：タグ・メモの後編集もシートに反映（記録IDで行を更新する `doPost` に拡張）、オフライン時は未送信キューに溜めて再送。
2. **分析**：タグ（強い〜弱い）ごとに各指標の平均・分布を比較。例：強い時は peakDb・maxHz・rate が高い／pauses が少ない？ 
   - スプレッドシートのピボット・グラフ、またはPython（pandas）で相関・ロジスティック回帰
   - 自分の平常時（「普通」）を基準とした差分（zスコア）で「自分専用の感情強度スコア」を定義
3. スコアをリアルタイム表示し、タグ付けの手間を減らす（推定値を初期値に）。

## 既知の制限
- 音声認識の確定タイミングと音声の区切りは完全には一致しません（前回確定〜今回確定の区間を1発話として計測）。
- Android Chrome の音声認識はしばらくすると自動停止するため、自動で再開しています。端末によってはマイクを認識側と共有できず、音量が取れない場合があります。
- 無音閾値（-45 dBFS）はマイク・環境によって調整が必要な場合があります。
- iOS Safari は音声認識の挙動が不安定です。

## 通話との照合

録音中は 1秒ごとに「タイムライン」を自動記録します（50msフレームを1秒に集約）。各行の項目:
`iso`（端末のローカル時刻＋オフセット、例 `2026-11-01T14:20:05.000+09:00`）、`epochMs`、`avgDb`、`peakDb`、`avgHz`（有声フレームのみ）、`voicedRatio`、`isSilent`、`text`（その1秒間に出た音声認識の途中/確定テキスト）。
セッション（＝録音開始時刻）ごとにブラウザの localStorage（キー `vm_timeline`）へ保存し、容量対策として最新 約6時間分だけ保持します（古いものから削除）。
発話ごとの記録にも `startMs` / `endMs`（エポックミリ秒）が付くので、タイムラインと突き合わせられます。

手順:
1. 通話の前後にこのページで録音しておく。
2. 通話後、「タイムラインJSON」でエクスポート（表計算で見るなら「タイムラインCSV」、BOM付きUTF-8）。
3. そのJSONをジャービスに送る。ジャービスが通話の文字起こしのタイムスタンプを1秒ごとの行に照合し、どの発言のときに声の大きさ・高さがどうだったかをまとめます。
4. 不要になったら「タイムライン消去」で削除（確認あり）。

注意: Android では電話アプリや音声通話アプリ（LINE等）がマイクを使っている間、ブラウザのマイクがブロックされ無音になる・録音が止まることがあります。その場合はスピーカー通話＋別端末で録音するなどしてください。

## 録音ファイル（音声そのものの保存）

録音中はマイク音声そのものも MediaRecorder で保存します（`audio/webm;codecs=opus` 優先、非対応なら端末が対応する形式）。10秒ごとの断片をブラウザ内の IndexedDB（`vm_audio`）へ逐次保存するので、クラッシュやページを閉じても失うのは最大十数秒程度です。セッションIDはタイムラインと同じ（録音開始時刻）で、録音開始のエポックミリ秒 `audioStartMs` と形式も記録します。タイムラインJSONの各セッションにも `audioStartMs` が入るので、「ファイル先頭からN秒 = audioStartMs + N×1000」で時刻に対応します。

「録音ファイル」欄で、保存済みセッション（開始時刻JST・長さ・サイズ）ごとに 再生／「ダウンロード」（`voice_YYYYMMDD_HHMMSS.webm`）／「まとめて書き出し」（音声＋対応するタイムラインJSON）／「削除」（確認あり）ができます。

- **ジャービスでの再解析**: 音声ファイル（できればまとめて書き出しのJSONも）をジャービスに送ると、オフライン解析で1秒ごとの音量・声の高さ・間を出し直し、通話の文字起こしと照合できます。手元では `python3 analyze.py voice_....webm <audioStartMs またはISO時刻> out.csv`（ffmpeg と numpy が必要）で JST タイムスタンプ付きの1秒ごとの avgDb / avgHz / voicedRatio CSV が出ます。
- **容量の注意**: ブラウザ保存領域には上限があり（画面に使用量／上限を表示）、opus は1時間あたり約15〜30MB。起動時に永続化（`navigator.storage.persist()`）を要求しますが、許可されない場合や容量不足・ブラウザのデータ削除で消えることがあります。
- **確実なバックアップはダウンロード**です。大事な録音は終わったらすぐ「ダウンロード」してください。

## 声の印（試作）

確定した発話ごとに、テキストへ印を付けた「印つき」(`annotatedText`) を作ります（表・ライブ表示・CSV/JSON・Webhook に含む。フラグ `loud` `quiet` `trailOff` `rising` `baseDb` も出力）。
- 📢【大】: 発話の平均音量が基準 +6dB 以上 ／ 【小】: 基準 -6dB 以下（基準＝直近20発話の平均音量の中央値、5件未満は -30dB）
- ↘〔尻すぼみ〕: 有声部分の最後の約25%（最大0.6秒）がそれより前より 8dB 以上小さい
- ↗: 語尾のピッチが前半より 15% 以上高い
しきい値は「印の設定」で変更できます（端末に保存）。
