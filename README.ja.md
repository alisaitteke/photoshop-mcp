# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — AIによるPhotoshop自動化" width="100%" />
  </a>
</p>

**言語：** [English](README.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Deutsch](README.de.md) · 日本語

*v1.1+ — レシピワークフロー、ラウンドトリップ削減、軽快なセッション。スタンドアロンUIには計画→実行を担う **Action Plan（ベータ）** が付属しています。*

> **注意：** これは非公式のコミュニティ管理プロジェクトであり、Adobe Inc.との提携・承認関係はありません。

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![GitHub release](https://img.shields.io/github/v/release/alisaitteke/photoshop-mcp?include_prereleases)](https://github.com/alisaitteke/photoshop-mcp/releases)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

モデルコンテキストプロトコル（MCP）サーバーで、ClaudeやCursorなどのAIアシスタントがAdobe Photoshopをプログラム的に操作できます。IDEから自然言語でデザイン作成・画像編集・ワークフロー自動化が可能です。同梱の**スタンドアロンWebUI**ではAPIキーとCLIサブスクリプションアカウント（Claude Code / Gemini CLI）の両方に対応しています。UIにはオプトインの**Action Plan（ベータ）**モードもあり、すべてのPhotoshopステップを1回のLLM呼び出しで計画し、一括実行できます。

## このプロジェクトが存在する理由

デザイナーや開発者はAIアシスタントからPhotoshopを操作したいと考えています。しかし生のExtendScript呼び出しは脆弱で、エージェントが試行錯誤でトークンを浪費し、レイヤータイプがフィルターを壊し、コマンドが1つ失敗するとドキュメントが不明な状態になります。

Photoshop MCPは**状態認識**（`get_state`・`get_preview`・`get_capabilities`）、**レシピツール**（複数ステップの結果を1つのUndo単位にまとめる）、そして**構造化エラーエンベロープ**（エージェントが次の手順を把握できる）を追加します。オプションのスタンドアロンUIとAction Planモードにより、長いワークフローでのラウンドトリップを削減し、自然言語で実際にピクセルを生み出せます。

技術的詳細：[`docs/architecture.md`](docs/architecture.md)

## 🖥️ スタンドアロンUI（IDEは不要）

Claude DesktopやCursorに組み込みたくない場合でも大丈夫です。同じパッケージにフルローカルのWebUIが同梱されており、AIモデルとチャットしてこのMCPサーバー経由でPhotoshopを操作できます。プロバイダーのAPIキーで接続するか、AnthropicとGoogleの場合は**Claude Code**または**Gemini CLI**のOAuthセッションを再利用できます（別途APIキー不要）。

![スタンドアロンUIスクリーンショット](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

これだけです。`127.0.0.1`（ランダムな空きポート）でローカルサーバーが起動し、デフォルトブラウザにチャットUIが自動で開きます。

### 対応プロバイダー

初回起動時に以下のいずれかを選択します。APIキーまたは既存のCLIサブスクリプションアカウント（AnthropicとGoogle）を使用できます：

| プロバイダー | モデル | APIキー | CLIアカウント |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100以上のモデル（各プロバイダー） | [openrouter.ai](https://openrouter.ai/keys) | — |

### 認証モード

- **`api_key`（デフォルト）** — Vercel AI SDK＋プロバイダーAPIキー。使用量はAPIレートでトークン単位で請求され、UIにはチャットごとの推定コストが表示されます。
- **`cli_account`** — Claude CodeまたはGemini CLIのローカルOAuthセッションを使用します。APIキーは保存されず、UIが`claude auth status` / `gemini`をヘッドレスで確認してログインを検証します。使用量はAPI課金ではなく**サブスクリプション枠**に計上されます。ステータスバーには「Included in subscription」と表示されます。

設定でプロバイダーごとに認証方法を切り替えても、もう一方のクレデンシャルは失われません（例：CLIアカウントを試しながらAPIキーを保持し、後で切り替えるなど）。

### Action Plan（ベータ）

スタンドアロンWebUIのオプション実行モードで、**APIキー認証専用**です（`cli_account`は常にデフォルトのエージェントフローを使用します）。composerのモデルセレクター横にある**Action Plan**トグルで有効にします。

ステップごとのReActループ（モデル → ツール → モデル → ツール …）の代わりに、Action Planは以下を行います：

1. **1回**の計画LLM呼び出しで、Photoshop MCPツール呼び出しとパラメーターの順序付きToDoリストを出力します。
2. それらのツールを**直接**順番に実行します（ステップ間の追加モデルラウンドトリップなし）。
3. ステップが失敗した場合や依存関係が未解決の場合、限定的な**修復**ループを実行します（残りのステップを最大3回再計画）。

計画はツール呼び出しカードの上にライブToDoリストとして表示され、ステップごとのステータス（`pending` → `running` → `done` / `error`）が確認できます。計画はチャット履歴に保存され、リロードしても残ります。トグルはデフォルトで無効で、Action Planを無効にしている間は既存のエージェントフローに影響しません。

*「背景を削除してWeb用にエクスポートして」*のようなモデル呼び出しを減らしてエンドツーエンドの実行を高速化したいマルチステッププロンプトに最適です。

### 初回起動時の動作

1. プロバイダーを選択し、**API key**または**Uses your account**を選択します。
2. キーを検証するかCLI接続を確認します。設定は`~/.photoshop-mcp/data.db`（SQLite、`chmod 600`）にローカル保存されます。APIキーは端末外に出ません。CLIモードはOAuthを`~/.claude/`または`~/.gemini/`から継承します。
3. 自然言語でプロンプトを入力します。UIはモデルの返答をストリーミングし、Photoshopツール呼び出しをリアルタイムで実行し、各ツール呼び出しを確認可能なカード（入力＋結果）としてレンダリングします。
4. プロバイダー、認証方法、モデルはいつでも設定／モデルセレクターから変更できます。チャット、コスト、ツール履歴はセッションをまたいで保持されます。

### 認証方法の後からの変更

サイドバーからいつでも**設定**を開いてください：

| 操作 | APIキーモード | CLIアカウントモード |
|---|---|---|
| 設定 | キーを貼り付け → **Save** | CLIをインストール → `auth login` → **Check connection** |
| 切り替え | **API key**を選択（保存済みキーは保持） | **Uses your account**を選択（キーは削除されない） |
| カスタムバイナリ | — | `claude` / `gemini`が`PATH`にない場合はオプションの**CLI path** |
| コスト表示 | ステータスバーにトークン単位の見積もり | **Included in subscription**バッジ |

認証方法は`~/.photoshop-mcp/data.db`にプロバイダーごとに保存されます（`authMethod`：`api_key`または`cli_account`）。`authMethod`のない既存の設定は`api_key`がデフォルトとなり、変更なく動作し続けます。

### CLIオプション

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### 注意事項

- エージェントはPhotoshop MCPツールのみに制限されています。組み込みのシェル・ファイル・Webツールは無効化されています。
- 技術スタック：フロントエンドはVue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/)、バックエンドは[Hono](https://hono.dev/)。APIキーモードは[Vercel AI SDK](https://sdk.vercel.ai/)を、CLIアカウントモードは[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp)（Anthropic）またはGemini CLIヘッドレスの`stream-json`（Google）を使用します。すべてのパスはSTDIO経由でこのPhotoshop MCPサーバーと通信します。
- **CLIアカウントの制限：** Geminiヘッドレスはターンごとに新しいセッションを開始する場合があります（履歴はプロンプトに追記されます）。AnthropicのCLIアカウントはサブスクリプション枠を消費します。OAuthログインはmacOS優先です（ターミナルで`claude auth login` / `gemini auth login`）。

---

## Photoshop向けAI/プロンプトレイヤー

アトミックな`photoshop_*`ツールに加え、サーバーにはホストLLM（Cursor、Claude Desktopなど）があいまいなユーザーリクエストを確実なPhotoshopアクションに変換するためのAI/プロンプトレイヤーが付属しています：

- **サーバー`instructions`** — MCPの`initialize`時にアドバタイズされるワークフロー規約（1回ping、アクション前に状態確認、レシピを優先、エラー回復）。[`src/prompts/instructions.ts`](src/prompts/instructions.ts)を参照。
- **MCPの`prompts`プリミティブ** — 19個の事前設計済みテンプレート（12レシピ＋7ガイド：`ps.enhance_portrait`・`ps.remove_background`・`ps.generative_fill`など）を`prompts/list`と`prompts/get`で利用可能。
- **レシピツール** — 12個の成果指向`photoshop_recipe_*`ツール（背景削除、ポートレート強調、Web向け準備、ソーシャル用バリアントエクスポート、カラーグレーディング、周波数分離、バッチモックアップ、レイヤー整理、グラデーションフェード、空の合成、ドッジ＆バーン、邪魔なもの削除）。各ステップは1つのPhotoshop履歴状態にまとめられます（Undoで全ステップを一括取り消し）。**合計86ツール**（アトミック74＋レシピ12）。
- **生成AI** — `photoshop_generative_fill`・`photoshop_generative_remove`・`photoshop_generative_expand`・`photoshop_generative_upscale`・`photoshop_sky_replacement`・`photoshop_generate_image`（ExtendScript経由のFirefly；Adobeアカウント＋クレジットが必要）。
- **ニューラルフィルター** — オプションのUXPブリッジプラグイン（`uxp-plugin/`）経由の`photoshop_neural_filter`。
- **状態とプレビュー** — `photoshop_get_state`（軽量スナップショット）・`photoshop_get_preview`（ビジョン確認用のBase64 JPEG）・`photoshop_get_capabilities`（バージョン対応の機能フラグ）。
- **構造化エラー** — 失敗時に`code`と`suggested_next_tool`を含むJSONエンベロープを返し、自己修正を支援します。

完全なリファレンス：[`docs/prompt-layer.md`](docs/prompt-layer.md)

パリティ確認：`npm run verify:photoshop-prompts`。最新の結果：[`docs/development.md#integration-test-results`](docs/development.md#integration-test-results)

## プロンプト例

以下はこのMCPサーバーを設定したAIアシスタント（Claude、Cursorなど）で使用できるプロンプト例です。複数ステップの作業には**レシピツール**（`photoshop_recipe_*`）を優先してください。各レシピは1つのUndoステップです。レシピでカバーできない細かい編集にのみアトミックな`photoshop_*`ツールを使用してください。

<details>
<summary>🧠 状態認識セッション（最初の推奨ステップ）</summary>

```
Photoshopにpingして、インストール済みバージョンの機能を読み取ってください。
変更を加える前に現在のドキュメント状態を取得してください。
portrait.jpgを開き、縮小プレビューを取得して被写体を確認してください。
主要なレシピを実行するたびに、結果確認のためプレビューをもう一度取得してください。
```

</details>

<details>
<summary>👤 ポートレートリタッチ（レシピ）</summary>

```
アクティブなレイヤーのポートレートを中程度の強度と肌のスムージングで強調してください。
enhance-portrait recipeを使用してください — 周波数分離＋自動トーンを1つのUndoステップにまとめてください。
アクティブなレイヤーがテキストまたはSmart Objectの場合は、先にラスタライズするかラスターレイヤーを選んでください。
完了したらプレビューを表示してください。
```

対応するMCPプロンプトテンプレート：`ps.enhance_portrait`（`{ intensity: "medium", skin_smoothing: "true" }`）

</details>

<details>
<summary>✂️ 背景削除（レシピ）</summary>

```
アクティブなポートレートレイヤーから背景を削除してください。
Select Subjectとフェザー2pxのレイヤーマスクを使用してください。マスクの後ろにオリジナルのピクセルを保持してください。
EC出品でRGB(255,255,255)の白背景が必要な場合は、商品をセンタリングして画像面積の70%以上を占めるようにしてください。
被写体はアクティブなレイヤーにある必要があります — べた塗りフィルレイヤーは不可です。
```

対応するMCPプロンプトテンプレート：`ps.remove_background`（`{ feather_px: "2", keep_shadow: "false" }`）

</details>

<details>
<summary>🎨 カラーグレーディング（レシピ）</summary>

```
開いているドキュメントにウォームフィルムのカラーグレードを非破壊調整レイヤーとして適用してください。
apply-color-grade recipeをプリセットwarm_filmで使用してください。
完了したら結果をプレビューしてください。
```

</details>

<details>
<summary>🔬 周波数分離のセットアップ（レシピ）</summary>

```
アクティブなラスターレイヤーにブラー半径6pxで周波数分離をセットアップしてください。
LowレイヤーとHighレイヤーへの描き込みは自分で行います — 追加のスムージングは適用しないでください。
レイヤースタックの準備ができたら、どのレイヤーを編集すべきか教えてください。
```

対応するMCPプロンプトテンプレート：`ps.frequency_separation`（`{ radius_px: "6" }`）

</details>

<details>
<summary>🌐 Web向け準備＋ソーシャルエクスポート（レシピ）</summary>

```
アクティブなドキュメントをWeb向けに準備してください：sRGB変換、縮小、シャープネス処理を行い、最適化したJPEGを~/.photoshop-mcp/exportsにエクスポートしてください。
続いて以下の形式で別々のJPEGをエクスポートしてください：
Instagramフィード（1080×1080）、Instagramポートレート（1080×1350）、
Instagram・LINE VOOMストーリー＆リール（1080×1920）、X（Twitter）投稿（1280×720）。
出力パスを表にして一覧表示してください。
```

対応するテンプレート：`ps.prepare_for_web`・`ps.export_social_variants`

</details>

<details>
<summary>📦 バッチモックアップ置換（レシピ）</summary>

```
「Screen」という名前のSmart ObjectレイヤーがあるモックアップPSDを開いています。
~/assets/mockups/内のすべてのPNG/JPGで置換し、アセットごとに1枚JPEGをエクスポートしてください。
フラットなレイヤーは配置せず、パースを維持するためにSmart Objectを差し替えてください。
```

対応するMCPプロンプトテンプレート：`ps.batch_mockup_replace`

</details>

<details>
<summary>🗂️ レイヤーの整理（レシピ）</summary>

```
レイヤースタックを整理してください：種類ごとにリネームし、関連するレイヤーを自動グループ化し、オリジナルを保持してください。
organize-layers recipeを実行して、新しい構造を確認できるようにレイヤーをリストアップしてください。
```

</details>

<details>
<summary>🎨 基本的なデザイン作成</summary>

```
RGBカラーモードで1920×1080のPhotoshopドキュメントを作成してください。
薄い青の背景レイヤーを追加し、RGB(240, 248, 255)で塗りつぶしてください。
中央に「Welcome」という64ptフォントのテキストを追加してください。
デスクトップにwelcome.psdとして保存してください。
```

</details>

<details>
<summary>🖼️ ストック画像デザイン（Pexels MCPと連携）</summary>

```
Pexelsで「mountain sunset」の画像を検索してください。
1920×1080のPhotoshopドキュメントを作成してください。
ダウンロードした画像を配置し、キャンバス全体に収まるようにフィットさせてください。
3pxのガウスぼかしを適用してください。
明るさを15、コントラストを10上げてください。
72ptの白いテキスト「Adventure Awaits」を上部中央に追加してください。
テキストの不透明度を90%、ブレンドモードをOVERLAYに設定してください。
品質10でadventure.jpgとして保存してください。
```

</details>

<details>
<summary>✨ 写真補正</summary>

```
デスクトップからphoto.jpgをPhotoshopで開いてください。
状態を取得してから、enhance-portrait recipeを低い強度で実行してください。
簡単なトーン調整だけが必要な場合は、代わりにアクティブなレイヤーにオートレベル、オートコントラスト、アンシャープマスク（120%、1.5、0）を適用してください。
色相を+15、彩度を+15調整するか、エクスポートの準備ができたらprepare-for-webを使用してください。
品質12でenhanced-photo.jpgとして保存してください。
```

</details>

<details>
<summary>🎭 レイヤーエフェクト＆ブレンディング</summary>

```
1200×800のドキュメントを作成してください。
「Background」という名前の新しいレイヤーを追加し、RGB(50, 50, 50)で塗りつぶしてください。
logo.pngを位置(100, 100)に配置してください。
ロゴレイヤーを現在のサイズの50%にスケールしてください。
ブレンドモードをSCREEN、不透明度を85%に設定してください。
別のレイヤーを追加してRGB(255, 100, 50)で塗りつぶしてください。
このレイヤーのブレンドモードをMULTIPLY、不透明度を60%に設定してください。
表示中のレイヤーをすべて結合してください。
composite.psdとして保存してください。
```

</details>

<details>
<summary>📝 テキストポスターデザイン</summary>

```
1080×1350の縦長ドキュメントを作成してください（Instagramストーリーサイズ）。
レイヤーを追加してグラデーション風の色RGB(120, 40, 200)で塗りつぶしてください。
位置(540, 300)に96ptで「SUMMER」テキストを追加してください。
テキストカラーをホワイトRGB(255, 255, 255)に変更してください。
テキストの配置をCENTERに設定してください。
位置(540, 450)に128pt、ホワイトで「2026」テキストをもう一つ追加してください。
背景レイヤーに2pxのガウスぼかしを適用してください。
summer-poster.pngとして保存してください。
```

</details>

<details>
<summary>🎬 バッチ処理</summary>

```
image1.jpgを開いてください。
1920×1080にリサイズしてください。
オートコントラストを適用してください。
控えめなシャープネスを適用してください（量80%、半径1.0）。
品質10でprocessed-1.jpgとして保存してください。
オリジナルへの変更を保存せずに閉じてください。

image2.jpgとimage3.jpgでも同じ手順を繰り返してください。
```

</details>

<details>
<summary>🖌️ クリエイティブ加工</summary>

```
2000×2000の正方形ドキュメントを作成してください。
abstract-pattern.jpgを配置してドキュメント全体に収まるようにフィットさせてください。
レイヤーを複製してください。
複製レイヤーに45度、半径50pxのモーションブラーを適用してください。
ブレンドモードをOVERLAY、不透明度を70%に設定してください。
120ptの白で「MOTION」テキストを中央に追加してください。
(200, 200)から(1800, 1800)への矩形選択を作成してください。
選択範囲を反転して削除してください（ボーダーエフェクト作成）。
画像をフラット化してください。
motion-art.jpgとして保存してください。
```

</details>

<details>
<summary>🎯 高度なワークフロー</summary>

```
印刷用に300DPIで3000×2000のドキュメントを作成してください。
hero-image.jpgを配置してキャンバスに合わせてフィットさせてください。
画像レイヤーを複製してください。
複製レイヤーを完全にグレースケール化してください。
ブレンドモードをLUMINOSITY、不透明度を50%に設定してください。
「Overlay」という名前の新しいレイヤーを作成してください。
RGB(255, 150, 0)で塗りつぶし、ブレンドモードをSOFTLIGHT、不透明度30%に設定してください。
上部中央(1500, 200)に96ptで「PORTFOLIO」テキストを追加してください。
テキストカラーをホワイトに設定してください。
(1500, 320)に36ptで「2026 Collection」サブテキストを追加してください。
テキストエリアを囲む矩形選択を作成してください。
オーバーレイレイヤーにレイヤーマスクを作成してください。
表示中のレイヤーを結合してください。
portfolio-cover.psdとして保存してください。
品質12でportfolio-cover.jpgとしてエクスポートしてください。
```

</details>

<details>
<summary>🔄 アクションの使用</summary>

```
my-photo.jpgを開いてください。
「My Actions」セットから「Vintage Look」アクションを再生してください。
明るさを-10に調整して少し暗くしてください。
vintage-photo.jpgとして保存してください。
```

</details>

<details>
<summary>⚡ カスタムスクリプトの実行</summary>

```
以下のカスタムExtendScriptコードを実行してください：
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ 元に戻す／やり直し操作</summary>

```
アクティブなレイヤーに15pxのガウスぼかしを適用してください。
[結果を待つ]
やはりぼかしが強すぎます。元に戻してください。
代わりに5pxのガウスぼかしを適用してください。
```

または：

```
どの操作が実行されたかを確認するために履歴状態を取得してください。
最後の3つの操作を元に戻してください。
1ステップやり直して1つの操作を戻してください。
```

</details>

<details>
<summary>🔁 エラー回復（構造化エンベロープ）</summary>

```
レシピがversion_unsupportedまたはgenerative_unavailableを返した場合は、get_capabilitiesを呼び出してどのPhotoshop機能が不足しているか教えてください。
ツールがsuggested_next_toolで失敗した場合は、そのヒントに従ってください（例：ラスターのみのレシピの前にrasterize_layerを実行するなど）。
推測は禁止です — 失敗後にget_stateを読み取り、次の単一ステップを提案してください。
```

</details>

<details>
<summary>📱 ソーシャルメディア用フォーマットキット（代理店）</summary>

```
日本のキャンペーン用のキービジュアルマスターが開いています。
prepare-for-web recipeでアクティブなドキュメントをsRGBに変換し、最適化したJPEGを~/.photoshop-mcp/exportsにエクスポートしてください。
さらに以下のフォーマットで別々のJPEGをエクスポートしてください：
- Instagramスクエアフィード 1080×1080
- Instagramポートレートフィード 1080×1350
- Instagram・LINE VOOMストーリー＆リール 1080×1920（上下250pxをセーフゾーンとして確保）
- YouTubeサムネイル 1280×720
9:16フォーマットで被写体が切れる場合のみphotoshop_generative_expandを使用してください。
商品は画像面積の最低60%、ロゴは右上に20pxのマージンを設けてください。
すべての出力パスを表にして一覧表示してください。
```

対応するテンプレート：`ps.prepare_for_web`・`ps.export_social_variants`

</details>

<details>
<summary>🖨️ 印刷入稿データ（CMYK / 塗り足し）</summary>

```
日本の商業オフセット印刷向けにアクティブなドキュメントを準備してください：
RGBをCMYKに変換し、プロファイルはJapan Color 2001 CoatedまたはISO Coated v2（ECI）を使用してください。
全辺に3mmの塗り足し（トンボ含む）を設定し、最終サイズでの解像度が350dpi以上であることを確認してください。
ISO Coated v2でソフトプルーフを設定して色ずれの可能性を指摘してください。
ベタ黒の大きな面積はC50 M40 Y40 K100のリッチブラックに、テキストはK100のみにしてください。
埋め込みプロファイル付きのPDF/X-4としてエクスポートし、プレビューを表示してください。
```

</details>

<details>
<summary>📸 EC白抜き・商品写真バッチ（Packshot）</summary>

```
Amazon.co.jp・楽天・Shopify JP向けの商品写真フォルダーがあります。
各画像に対して：Select Subjectで背景を削除し、エッジを2pxフェザー処理し、RGB(255,255,255)の白背景上にセンタリングし、2000×2000pxにリサイズして商品が画像面積の70%以上を占めるようにしてください。
ほこりや傷は別のリタッチレイヤーで除去し、sRGBプロファイルを埋め込み、JPEG品質90で~/.photoshop-mcp/exports/packshots/に保存してください。
まずテスト画像で実行してプレビューを表示してから、残りのフォルダー全体を処理してください。
```

</details>

<details>
<summary>👘 美容・ポートレートリタッチ（美容広告）</summary>

```
美容広告キャンペーン用のポートレート写真があります。
enhance-portrait recipeを中程度の強度で実行してください。
続いて6pxの半径で周波数分離（frequency separation）をセットアップし、Lowレイヤーでスキントーンの均一化、Highレイヤーでテクスチャーの保持を行ってください。
dodge & burnで立体感を強調し、自然に見える範囲でのみ適用してください。
不自然なグラデーションや過度な滑らかさは避けてください。
完了したらプレビューを表示し、承認後にマスターPSDと最終JPEGをエクスポートしてください。
```

対応するMCPプロンプトテンプレート：`ps.enhance_portrait`・`ps.frequency_separation`

</details>

<details>
<summary>🤖 生成AI＋PS仕上げ（キービジュアル）</summary>

```
商品の切り抜きPNGとライフスタイル背景画像がアクティブなドキュメントにあります。
商品を右下に元のサイズの85%で配置してください。
photoshop_generative_fillまたはHarmonize機能を使用して、ライト・シャドウ・色温度をシーンに合わせてください。
自然な影を追加してください（MULTIPLY、不透明度約35%）。
マスターPSDとして保存し、キービジュアル用に1200×628pxのJPEGを~/.photoshop-mcp/exports/kv/にエクスポートしてください。
```

</details>

<details>
<summary>📦 パッケージ・販促モックアップ一括</summary>

```
「Screen」という名前のSmart ObjectレイヤーがあるパッケージングモックアップPSDを開いています。
~/assets/packaging/内のすべてのPNG/JPGで置換し、バリアントごとに1枚JPEGをエクスポートしてください。
フラットなレイヤーは配置せず、パースを維持するためにSmart Objectを差し替えてください。
batch_mockup_replace recipeを使用して、クライアント確認用にすべての出力パスを表にして一覧表示してください。
```

対応するテンプレート：`ps.batch_mockup_replace`

</details>

## 機能

- **スタンドアロンWebUI** — ローカルチャットインターフェイス（`photoshop-mcp-ui`）；プロバイダーごとにAPIキーまたはCLIサブスクリプション認証（Anthropic、Google）
- **Action Plan（ベータ）** — WebUIのオプトイン計画→実行モード（APIキーのみ）：1回の計画呼び出し、直接ツール実行、失敗時の限定的修復
- **WindowsとmacOSの両方で動作**
- **Photoshop 2012〜2025+をサポート**
- **ExtendScript API**：AppleScript/COM自動化による汎用互換性
- **自動検出**：システム上のPhotoshopインストールを自動で検出
- **86ツール**：アトミック`photoshop_*` 74個＋レシピ`photoshop_recipe_*` 12個
- **AI/プロンプトレイヤー**：MCPプロンプトテンプレート19個（レシピ12＋ガイド7）、サーバーInstructions、状態・プレビュー・機能ツール
- **ドキュメント管理**：作成、開く、保存、閉じる、トリミング
- **レイヤー操作**：作成、削除、複製、結合、変形
- **レイヤープロパティ**：不透明度、ブレンドモード、表示/非表示、ロック
- **テキスト書式設定**：フォント、サイズ、カラー、配置
- **画像配置**：画像の配置、ファイルを開く、ドキュメントに合わせる
- **フィルター**：ガウスぼかし、シャープネス、ノイズ、モーションブラー
- **カラー調整**：明るさ/コントラスト、色相/彩度、曲線、オートレベル/コントラスト
- **選択範囲とマスク**：矩形選択、被写体を選択、コンテンツに応じた塗りつぶし、グラデーションマスク、レイヤーマスク
- **履歴管理**：元に戻す/やり直し操作、履歴状態の表示
- **アクション**：記録済みアクションの再生、カスタムスクリプトの実行
- **自動ラスタライズ**：フィルター適用時に必要に応じてレイヤーを自動変換
- **コンテキストトラッキング**：各操作後にドキュメント/レイヤー状態を返し、AIアシスタントのコンテキスト認識を支援

## インストール

### NPXを使用（推奨）

インストールは不要です！MCPクライアントを設定するだけです：

```bash
npx @alisaitteke/photoshop-mcp
```

ローカルでリポジトリを開発する場合は、開発ガイドの[ソースから](docs/development.md#from-source)を参照してください。

## 設定

### Cursor向け

Cursorの設定に追加してください（`.cursor/config.json`またはワークスペース設定）：

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### Claude Desktop向け

Claude Desktopの設定に追加してください（macOSは`~/Library/Application Support/Claude/claude_desktop_config.json`、Windowsは`%APPDATA%\Claude\claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "photoshop": {
      "command": "npx",
      "args": ["-y", "@alisaitteke/photoshop-mcp"],
      "env": {
        "LOG_LEVEL": "1"
      }
    }
  }
}
```

### 環境変数

- `PHOTOSHOP_PATH`：（オプション）Photoshopのカスタムインストールパスを指定
- `LOG_LEVEL`：ログレベル（0=DEBUG、1=INFO、2=WARN、3=ERROR）
- `ANALYTICS_DISABLED`：`1`または`true`に設定して匿名使用状況の解析を完全に無効化
- `POSTHOG_DISABLED`：`ANALYTICS_DISABLED`の旧エイリアス
- `ANALYTICS_PROVIDER`：解析バックエンド — `mixpanel`（デフォルト）または`posthog`（ロールバック）
- `MIXPANEL_TOKEN`：（オプション）Mixpanelプロジェクトトークンを上書き
- `MIXPANEL_API_HOST`：（オプション）Mixpanelインジェストホスト（デフォルト：`https://api-eu.mixpanel.com`）
- `POSTHOG_KEY`：（オプション、旧仕様）PostHogプロジェクトキー — `ANALYTICS_PROVIDER=posthog`の場合のみ使用
- `POSTHOG_API_HOST`：（オプション、旧仕様）PostHogインジェストホスト（デフォルト：`https://a.alisait.com`）
- `POSTHOG_UI_HOST`：（オプション、旧仕様）PostHog UIホスト（デフォルト：`https://eu.posthog.com`）

## 利用可能なツール

すべてのアトミック`photoshop_*`ツールの完全なリファレンス（パラメーター、例、使用方法）：[`docs/available-tools.md`](docs/available-tools.md)

## コンテキストトラッキング

各ツールはPhotoshopの現在の状態に関する包括的なコンテキスト情報を返します：

- **ドキュメント情報**：名前、サイズ、解像度、カラーモード、レイヤー数
- **アクティブレイヤー情報**：名前、タイプ、不透明度、ブレンドモード、表示状態、ロック状態
- **選択範囲の状態**：選択範囲がアクティブかどうか
- **操作結果**：変更内容の詳細

これにより、AIアシスタントは以下を把握し続けられます：
- どのドキュメントがアクティブか
- どのレイヤーで作業しているか
- 現在のレイヤープロパティ（不透明度、ブレンドモードなど）
- ドキュメントのサイズと設定

**レスポンス例：**
```javascript
{
  "applied": true,
  "filter": "Gaussian Blur",
  "radius": 10,
  "wasRasterized": true,
  "context": {
    "hasDocument": true,
    "document": {
      "name": "design.psd",
      "width": 1920,
      "height": 1080,
      "resolution": 72,
      "colorMode": "RGBColorMode",
      "layerCount": 3,
      "hasSelection": false
    },
    "activeLayer": {
      "name": "Background",
      "kind": "NORMAL",
      "opacity": 100,
      "blendMode": "NORMAL",
      "visible": true,
      "locked": false,
      "isBackground": false
    }
  }
}
```

このコンテキストにより、AIアシスタントは複数のコマンドにわたって作業中のドキュメントとレイヤーを記憶します。

---

## プラットフォーム固有の注意事項

### Windows

- COM自動化を使用してPhotoshopと通信します
- レジストリベースのインストールパス自動検出
- 32ビットと64ビットの両バージョンをサポート

### macOS

- Photoshopの通信にAppleScript/OSAを使用します
- Spotlightベースの自動検出
- 複数のPhotoshopバージョンの同時インストールをサポート
- **CLIアカウント認証**（スタンドアロンUI）はmacOS優先：ターミナルで`claude auth login` / `gemini auth login`を実行し、クレデンシャルは`~/.claude/`と`~/.gemini/`に保存されます

## サポートされているPhotoshopバージョン

- **すべてのPhotoshopバージョン**（2012〜2025+）：macOSはAppleScript、WindowsはCOM経由のExtendScript APIを使用

**重要：** Photoshop 2022以降はプラグイン向けにUXPをサポートしていますが、AppleScript/COM経由の外部自動化ではExtendScriptのみ使用できます。UXPは内部プラグイン向けに設計されており、外部スクリプトから呼び出すことはできません。そのため、このMCPサーバーはすべてのPhotoshopバージョンとの最大互換性のためにExtendScriptを使用しています。

## トラブルシューティング

接続、スクリプト、ログに関するよくある問題：[`docs/troubleshooting.md`](docs/troubleshooting.md)

### スタンドアロンUI — CLIアカウント認証

| 症状 | 原因 | 対処法 |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLIがインストールされていない | `npm i -g @anthropic-ai/claude-code`または`npm i -g @google/gemini-cli` |
| `not_authenticated` | OAuthセッションがない | ターミナルで`claude auth login`または`gemini auth login`を実行 |
| `claude` / `gemini`が`PATH`にない | カスタムインストール場所 | 設定 → **CLI path** → **Check connection** |
| IDEではチャットできるがUIでできない（CLIモード） | OAuthトークンはCLI専用 | UIで**CLIアカウント**を使用；APIキーとCLIセッションは別々 |
| Geminiのマルチターンが忘れっぽい | ヘッドレスCLIがターンごとに新しいセッションを開始する場合がある | 既知の制限；履歴はプロンプトに追記（MVP） |

## 開発

ソースからのセットアップ、ビルド、リント、統合テスト（最新結果付き）、使用例：[`docs/development.md`](docs/development.md)

## アーキテクチャ

システム設計、データフロー、プラットフォーム抽象化、UIエージェントモード：[`docs/architecture.md`](docs/architecture.md)

LinkedInやソーシャルメディアでシェアする際は、[`images/og-social.png`](images/og-social.png)と[`docs/social-preview.md`](docs/social-preview.md)をOGセットアップとポスト用テキストとしてご活用ください。

## コントリビューション

コントリビューションを歓迎します！PRを開く前に[CONTRIBUTING.md](CONTRIBUTING.md)をお読みください。

## メンテナーについて

**[Ali Sait Teke](https://alisait.com)** — フルスタックエンジニア＆AI時代のソフトウェアアーキテクト
（Python、Go、Node.js、React、Next.js、Vue）

このプロジェクトは実践的な問いから始まりました：*脆弱な一発スクリプトなしに、LLMがPhotoshopを確実に操作できるようにするにはどうすればいいか？* それは80のツール、信頼性の高いマルチステップワークフロー向けのレシピ/プロンプトレイヤー、そしてクリエイティブな作業にIDEが不要なローカルWebUIを備えたMCPサーバーへと成長しました。

**このコードベースが示すもの：** TypeScriptシステム設計、MCPプロトコル統合、クロスプラットフォームデスクトップ自動化（macOS AppleScript / Windows COM）、エージェントループのための構造化エラー回復、プロダクション品質のlocal-first UI（Vue 3 + Hono + SQLite）。

- [Portfolio](https://alisait.com) · [GitHub](https://github.com/alisaitteke) · [LinkedIn](https://www.linkedin.com/in/alisait/)

## ライセンス

MIT

## 匿名使用状況の解析

製品改善のために、デフォルトで匿名の集計使用イベントが収集されます。いつでもオプトアウトできます。詳細：[`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md)

## 謝辞

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)を使用して構築
- Adobe Photoshopスクリプティングコミュニティに触発されて制作
