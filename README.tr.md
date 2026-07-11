# Photoshop MCP Server

<p align="center">
  <a href="https://github.com/alisaitteke/photoshop-mcp">
    <img src="./images/readme-hero.png" alt="Photoshop MCP — Yapay zeka destekli Photoshop otomasyonu" width="100%" />
  </a>
</p>

**Diller:** [English](README.md) · [简体中文](README.zh-CN.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [日本語](README.ja.md) · Türkçe

*v1.1+ — tarif iş akışları, daha az gidiş-dönüş, daha hızlı oturumlar. Bağımsız UI, plan-sonra-uygula çalıştırmaları için **Action Plan (beta)** sunar.*

> **Not:** Bu, resmi olmayan, topluluk tarafından sürdürülen bir projedir; Adobe Inc. ile bağlantılı değildir ve Adobe Inc. tarafından desteklenmemektedir.

[![npm version](https://img.shields.io/npm/v/@alisaitteke/photoshop-mcp.svg)](https://www.npmjs.com/package/@alisaitteke/photoshop-mcp)
[![GitHub release](https://img.shields.io/github/v/release/alisaitteke/photoshop-mcp?include_prereleases)](https://github.com/alisaitteke/photoshop-mcp/releases)
[![Action Plan](https://img.shields.io/badge/Action%20Plan-beta-amber.svg)](#action-plan-beta)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()

Model Context Protocol (MCP) sunucusu; Claude ve Cursor gibi yapay zeka asistanlarının Adobe Photoshop'u programatik olarak kontrol etmesini sağlar. Bu sayede IDE'nizden doğal dil komutlarıyla tasarım oluşturabilir, görselleri düzenleyebilir ve Photoshop iş akışlarını otomatikleştirebilirsiniz. Ayrıca hem API anahtarlarını hem de CLI abonelik hesaplarını (Claude Code / Gemini CLI) destekleyen dahili **bağımsız web UI** üzerinden de çalışabilirsiniz. UI, isteğe bağlı **Action Plan (beta)** modunu da sunar: tüm Photoshop adımları tek bir LLM çağrısında planlanır, ardından tek seferde yürütülür.

## Neden bu proje var

Tasarımcılar ve geliştiriciler Photoshop'u yapay zeka asistanlarıyla yönetmek istiyor; ancak ham ExtendScript çağrıları kırılgandır: ajanlar deneme-yanılmayla token harcar, katman türleri filtreleri bozar ve başarısız bir komut belgeyi bilinmeyen bir durumda bırakır.

Photoshop MCP; **durum farkındalığı** (`get_state`, `get_preview`, `get_capabilities`), çok adımlı sonuçları tek bir geri alma adımında kapsayan **tarif araçları** ve ajanların sıradaki adımı bilmesini sağlayan **yapılandırılmış hata zarfları** ekler. İsteğe bağlı bağımsız UI ve Action Plan modu, uzun iş akışlarındaki gidiş-dönüşleri azaltır — böylece doğal dil gerçekten piksel üretir, yalnızca önermekle kalmaz.

Teknik derinleme: [`docs/architecture.md`](docs/architecture.md).

## 🖥️ Bağımsız UI (IDE gerekmez)

Bunu Claude Desktop veya Cursor'a bağlamak istemiyorsanız? Aynı paket, bir yapay zeka modeliyle sohbet etmenizi ve bu MCP sunucusu aracılığıyla Photoshop'u yönetmenizi sağlayan tam yerel bir web UI içerir. Sağlayıcı API anahtarıyla **ya da** Anthropic ve Google için **Claude Code** veya **Gemini CLI**'dan OAuth oturumunu yeniden kullanarak bağlanın — ayrı API anahtarı gerekmez.

![Bağımsız UI Ekran Görüntüsü](./images/frame_generic_light.png)

```bash
npx -p @alisaitteke/photoshop-mcp photoshop-mcp-ui
```

Hepsi bu. `127.0.0.1` üzerinde yerel bir sunucu başlar (rastgele boş port) ve varsayılan tarayıcınız sohbet UI'ını otomatik olarak açar.

### Desteklenen sağlayıcılar

İlk başlatmada aşağıdakilerden birini seçin — API anahtarıyla **ya da** mevcut CLI abonelik hesabınızla (Anthropic ve Google):

| Sağlayıcı | Modeller | API anahtarı | CLI hesabı |
|---|---|---|---|
| **Anthropic** | Claude Sonnet / Opus / Haiku | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `npm i -g @anthropic-ai/claude-code` → `claude auth login` |
| **OpenAI** | GPT-5, GPT-4.1, o-series | [platform.openai.com](https://platform.openai.com/api-keys) | — |
| **Google** | Gemini 2.5 Pro / Flash / Flash-Lite | [aistudio.google.com](https://aistudio.google.com/apikey) | `npm i -g @google/gemini-cli` → `gemini auth login` |
| **OpenRouter** | 100'den fazla sağlayıcı modeli | [openrouter.ai](https://openrouter.ai/keys) | — |

### Kimlik doğrulama modları

- **`api_key` (varsayılan)** — Vercel AI SDK + kendi sağlayıcı API anahtarınız. Kullanım token başına API ücretleriyle faturalandırılır; UI her sohbet için tahmini maliyeti gösterir.
- **`cli_account`** — Yerel Claude Code veya Gemini CLI OAuth oturumunu kullanır.
  API anahtarı saklanmaz; UI girişi doğrulamak için `claude auth status` / `gemini` başsız modunu yoklar. Kullanım **abonelik kotasına** sayılır, API faturalandırmasına değil — durum çubuğu "Included in subscription" gösterir.

Diğer kimlik bilgisini kaybetmeden sağlayıcı başına Ayarlar'dan kimlik doğrulama yöntemini değiştirebilirsiniz (örn. CLI hesabı denerken API anahtarını saklayın, sonra geri geçin).

### Action Plan (beta)

Bağımsız web UI'da **yalnızca API anahtarı kimlik doğrulaması** için isteğe bağlı bir yürütme modu
(`cli_account` her zaman varsayılan ajansal akışı kullanır). **composer**'daki model seçicinin yanındaki
**Action Plan** düğmesiyle etkinleştirin.

Adım başına ReAct döngüsü (model → araç → model → araç …) yerine Action Plan:

1. Photoshop MCP araç çağrılarını ve parametrelerini içeren sıralı bir yapılacaklar listesi çıkaran **tek** bir planlama LLM çağrısı yapar.
2. Bu araçları **doğrudan** sırayla çalıştırır — adımlar arasında ekstra model gidiş-dönüşü olmadan.
3. Başarısız bir adımda veya çözümlenmemiş bağımlılıkta, sınırlı bir **onarım** döngüsü çalışır (yalnızca kalan adımları yeniden planlar, en fazla 3 kez).

Plan, araç çağrı kartlarının üzerinde adım başına durum gösteren canlı bir yapılacaklar listesi olarak görünür (`pending` → `running` → `done` / `error`). Planlar sohbet geçmişinde kalıcı olarak saklanır ve yeniden yüklemeyi atlatır. Düğme varsayılan olarak kapalıdır; Action Plan devre dışıyken mevcut ajansal akış değişmeden kalır.

*"arka planı kaldır ve web için dışa aktar"* gibi daha az model çağrısı ve daha hızlı uçtan uca yürütme istediğiniz çok adımlı istemler için idealdir.

### İlk başlatmada neler olur

1. Bir sağlayıcı seçin ve **API key** veya **Uses your account** seçeneğini belirleyin.
2. Anahtarı doğrulayın veya CLI bağlantısını kontrol edin. Yapılandırma `~/.photoshop-mcp/data.db` konumunda yerel olarak saklanır (SQLite, `chmod 600`). API anahtarları makinenizi asla terk etmez; CLI modu OAuth'u `~/.claude/` veya `~/.gemini/`'den devralır.
3. Doğal dil istemleri yazın. UI modelin yanıtını akışla iletir, Photoshop araç çağrılarını gerçek zamanlı çalıştırır ve her araç çağrısını incelenebilir bir kart olarak (girdi + sonuç) gösterir.
4. Sağlayıcıyı, kimlik doğrulama yöntemini veya modeli istediğiniz zaman Ayarlar / model seçiciden değiştirin — sohbetler, maliyetler ve araç geçmişi oturumlar arasında kalıcı olarak saklanır.

### Kimlik doğrulama yöntemini daha sonra değiştirme

Kenar çubuğundan istediğiniz zaman **Ayarlar**'ı açın:

| İşlem | API anahtarı modu | CLI hesabı modu |
|---|---|---|
| Kurulum | Anahtarı yapıştır → **Save** | CLI yükle → `auth login` → **Check connection** |
| Geçiş | **API key** seç — saklanan anahtar korunur | **Uses your account** seç — anahtar silinmez |
| Özel ikili | — | `claude` / `gemini` `PATH`'de değilse isteğe bağlı **CLI path** |
| Maliyet göstergesi | Durum çubuğunda token başına tahmin | **Included in subscription** rozeti |

Kimlik doğrulama yöntemi, `~/.photoshop-mcp/data.db` içinde sağlayıcı başına saklanır (`authMethod`:
`api_key` veya `cli_account`). `authMethod` içermeyen mevcut yapılandırmalar varsayılan olarak `api_key`
kullanır ve değişmeden çalışmaya devam eder.

### CLI bayrakları

```
photoshop-mcp-ui [--port 5174] [--host 127.0.0.1] [--no-open]
```

### Notlar

- Ajan yalnızca Photoshop MCP araçlarıyla sınırlıdır — dahili kabuk, dosya
  ve web araçları devre dışıdır.
- Teknoloji yığını: Frontend'de Vue 3 + Tailwind v4 + [shadcn-vue](https://www.shadcn-vue.com/);
  backend'de [Hono](https://hono.dev/). API anahtarı modu [Vercel AI SDK](https://sdk.vercel.ai/)
  kullanır; CLI hesabı modu [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/mcp)
  (Anthropic) veya Gemini CLI başsız `stream-json` (Google) kullanır. Tüm yollar bu Photoshop
  MCP sunucusuyla STDIO üzerinden iletişim kurar.
- **CLI hesabı kısıtlamaları:** Gemini başsız modu her turda yeni bir oturum açabilir
  (geçmiş, isteme eklenir). Anthropic CLI hesabı abonelik kotası tüketir. OAuth girişi
  macOS önceliklidir (`claude auth login` / `gemini auth login` Terminal'de).

---

## Photoshop için Yapay Zeka/İstem Katmanı

Atomik `photoshop_*` araçlarının üzerinde, sunucu; ana LLM'lerin (Cursor, Claude Desktop vb.)
belirsiz kullanıcı isteklerini güvenilir Photoshop eylemlerine dönüştürmesine yardımcı olan görüşlü
bir yapay zeka/istem katmanı sunar:

- **Sunucu `instructions`'ları** — MCP `initialize`'da tanıtılan iş akışı sözleşmesi
  (bir kez ping at, eylemden önce durum al, tarifleri tercih et, hata kurtarma). Bkz.
  [`src/prompts/instructions.ts`](src/prompts/instructions.ts).
- **MCP `prompts` primitifi** — 19 önceden hazırlanmış şablon (12 tarif + 7 kılavuz:
  `ps.enhance_portrait`, `ps.remove_background`, `ps.generative_fill`, …)
  `prompts/list` ve `prompts/get` üzerinden.
- **Tarif araçları** — 12 sonuç odaklı `photoshop_recipe_*` aracı (arka plan kaldırma,
  portre geliştirme, web için hazırlama, sosyal medya varyantları dışa aktarma, renk düzenlemesi,
  frequency separation, toplu mockup, katmanları düzenleme, degrade solması,
  gökyüzü karıştırma, dodge & burn, dikkat dağıtıcıyı kaldırma). Her biri adımları tek bir
  Photoshop geçmiş durumuna sarar (tek bir Geri Al hepsini geri alır). **Toplamda 86 araç**
  (74 atomik + 12 tarif).
- **Üretken Yapay Zeka** — `photoshop_generative_fill`, `photoshop_generative_remove`,
  `photoshop_generative_expand`, `photoshop_generative_upscale`, `photoshop_sky_replacement`,
  `photoshop_generate_image` (ExtendScript aracılığıyla Firefly; Adobe hesabı + kredi gereklidir).
- **Sinir Filtreleri** — isteğe bağlı UXP köprü eklentisi (`uxp-plugin/`) aracılığıyla
  `photoshop_neural_filter`.
- **Durum & Önizleme** — `photoshop_get_state` (ucuz anlık görüntü),
  `photoshop_get_preview` (görsel doğrulama için base64 JPEG),
  `photoshop_get_capabilities` (sürüme duyarlı özellik bayrakları).
- **Yapılandırılmış hatalar** — başarısızlıklar otomatik düzeltme için `code` ve
  `suggested_next_tool` içeren JSON zarfları döndürür.

Tam başvuru: [`docs/prompt-layer.md`](docs/prompt-layer.md).

Pariteyi doğrulayın: `npm run verify:photoshop-prompts`. Son sonuçlar:
[`docs/development.md#integration-test-results`](docs/development.md#integration-test-results).

## Örnek İstemler

Aşağıda bu MCP sunucusu yapılandırıldığında yapay zeka asistanlarıyla (Claude, Cursor vb.)
kullanabileceğiniz örnek istemler yer almaktadır. Çok adımlı sonuçlar için **tarif araçlarını**
(`photoshop_recipe_*`) tercih edin — her tarif tek bir geri alma adımıdır. Atomik `photoshop_*`
araçlarını yalnızca hiçbir tarifin karşılamadığı ince düzenlemeler için kullanın.

<details>
<summary>🧠 Durum farkındalıklı oturum (önerilen ilk adım)</summary>

```
Photoshop'u ping'le ve yüklü sürüm için yetenekleri oku.
Herhangi bir değişiklik yapmadan önce mevcut belge durumunu al.
portrait.jpg'yi aç, konuyu doğrulayabilmek için küçültülmüş bir önizleme al.
Her önemli tariften sonra sonucu onaylamak için başka bir önizleme al.
```

</details>

<details>
<summary>👤 Portre rötuşu (tarif)</summary>

```
Aktif katmandaki portreyi orta yoğunlukta ve cilt düzleştirmeyle geliştir.
enhance-portrait recipe kullan — tek bir geri alınabilir adımda frequency separation + auto-tone istiyorum.
Aktif katman metin veya Smart Object ise önce rasterleştir ya da raster katman seç.
Bitince bir önizleme göster.
```

Eşdeğer MCP istem şablonu: `ps.enhance_portrait` ile `{ intensity: "medium", skin_smoothing: "true" }`.

</details>

<details>
<summary>✂️ Arka plan kaldırma (tarif)</summary>

```
Aktif portre katmanından arka planı Trendyol / Hepsiburada packshot için kaldır.
Select Subject + 2 piksel tüylendirmeli katman maskesi kullan. Orijinal pikselleri maskenin arkasında koru.
Brifing saf beyaz RGB(255,255,255) arka plan gerektiriyorsa ürünü ortala ve çerçeve alanının en az %70'ini kapsamasını sağla.
Konu aktif katmanda olmalı — düz bir renk dolgusu değil.
```

Eşdeğer MCP istem şablonu: `ps.remove_background` ile `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>🎨 Renk düzenlemesi (tarif)</summary>

```
Açık belgeye yıkıcı olmayan ayarlama katmanları olarak sıcak bir film renk düzenlemesi uygula.
apply-color-grade recipe'yi warm_film ön ayarıyla kullan.
Bitince sonucu önizle.
```

</details>

<details>
<summary>🔬 Frekans ayrıştırma kurulumu (tarif)</summary>

```
Aktif raster katmanda 6 piksel bulanıklık yarıçapıyla frequency separation kur.
Low ve High katmanlarına kendim boyayacağım — ek düzleştirme uygulama.
Katman yığını hazır olduğunda hangi katmanların düzenleneceğini söyle.
```

Eşdeğer MCP istem şablonu: `ps.frequency_separation` ile `{ radius_px: "6" }`.

</details>

<details>
<summary>🌐 Web için hazırla + sosyal medya dışa aktarımı (tarifler)</summary>

```
Aktif belgeyi web için hazırla: sRGB, küçült, keskinleştir, ~/.photoshop-mcp/exports'a optimize edilmiş bir JPEG dışa aktar.
Ardından aynı belgeden Instagram gönderisi ve X gönderisi varyantlarını ayrı JPEG'ler olarak dışa aktar.
Çıktı yollarını bir tabloda listele.
```

Eşdeğer şablonlar: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>📦 Toplu mockup değiştirme (tarif)</summary>

```
"Screen" adında bir Smart Object katmanıyla açık bir mockup PSD'im var.
~/assets/mockups/'taki her PNG/JPG ile değiştir ve her varlık için bir JPEG dışa aktar.
Düz katmanlar yerleştirme — perspektif korunacak şekilde Smart Object'i takas et.
```

Eşdeğer MCP istem şablonu: `ps.batch_mockup_replace`.

</details>

<details>
<summary>🗂️ Katmanları düzenleme (tarif)</summary>

```
Katman yığınını düzenle: türe göre yeniden adlandır, ilgili katmanları otomatik grupla, orijinalleri koru.
organize-layers recipe'yi çalıştır, ardından yeni yapıyı gözden geçirebilmem için katmanları listele.
```

</details>

<details>
<summary>🎨 Temel Tasarım Oluşturma</summary>

```
RGB renk modunda 1920x1080 boyutunda bir Photoshop belgesi oluştur.
Açık mavi bir arka plan katmanı ekle ve RGB(240, 248, 255) ile doldur.
64 pt yazı tipinde ortalanmış "Welcome" metni ekle.
Masaüstüme welcome.psd olarak kaydet.
```

</details>

<details>
<summary>🖼️ Stok Görsel Tasarımı (Pexels MCP ile)</summary>

```
Pexels'ta "mountain sunset" görselleri ara.
1920x1080 boyutunda bir Photoshop belgesi oluştur.
İndirilen görseli yerleştir ve tüm tuvali dolduracak şekilde ayarla.
3 piksel ince Gaussian Blur uygula.
Parlaklığı 15 ve kontrastı 10 artır.
Üst kısımda 72 pt'ta ortalanmış beyaz "Adventure Awaits" metni ekle.
Metin opaklığını %90 ve karışım modunu OVERLAY olarak ayarla.
Kalite 10 ile adventure.jpg olarak kaydet.
```

</details>

<details>
<summary>✨ Fotoğraf Geliştirme</summary>

```
Masaüstümden photo.jpg'yi Photoshop'ta aç.
Durumu al, ardından enhance-portrait recipe'yi düşük yoğunlukta çalıştır.
Yalnızca hızlı ton düzeltmelerine ihtiyaç duyarsam, aktif katmanda otomatik düzeyler, otomatik kontrast ve keskinleştirme maskesi (120%, 1.5, 0) uygula.
Tonu +15 ve doygunluğu +15 ayarla; dışa aktarmaya hazır olduğumda prepare-for-web kullan.
Kalite 12 ile enhanced-photo.jpg olarak kaydet.
```

</details>

<details>
<summary>🎭 Katman Efektleri ve Karıştırma</summary>

```
1200x800 boyutunda bir belge oluştur.
"Background" adında yeni bir katman ekle ve RGB(50, 50, 50) ile doldur.
logo.png'yi (100, 100) konumuna yerleştir.
Logo katmanını mevcut boyutunun %50'sine küçült.
Karışım modunu SCREEN ve opaklığı %85 olarak ayarla.
Başka bir katman ekle ve RGB(255, 100, 50) ile doldur.
Bu katmanın karışım modunu MULTIPLY ve opaklığını %60 olarak ayarla.
Tüm görünür katmanları birleştir.
composite.psd olarak kaydet.
```

</details>

<details>
<summary>📝 Metin Posteri Tasarımı</summary>

```
1080x1350 dikey belge oluştur (Instagram story boyutu).
Bir katman ekle ve degrade benzeri renk RGB(120, 40, 200) ile doldur.
(540, 300) konumuna 96 pt'ta "SUMMER" metni ekle.
Metin rengini beyaz RGB(255, 255, 255) olarak değiştir.
Metin hizalamasını CENTER olarak ayarla.
(540, 450) konumuna 128 pt'ta beyaz renkte "2026" metni ekle.
Arka plan katmanına 2px Gaussian Blur uygula.
summer-poster.png olarak kaydet.
```

</details>

<details>
<summary>🎬 Toplu İşleme</summary>

```
image1.jpg'yi aç.
1920x1080'e yeniden boyutlandır.
Otomatik kontrast uygula.
İnce keskinleştirme uygula (miktar %80, yarıçap 1.0).
Kalite 10 ile processed-1.jpg olarak kaydet.
Orijinaldeki değişiklikleri kaydetmeden kapat.

image2.jpg ve image3.jpg için de aynı işlemi tekrarla.
```

</details>

<details>
<summary>🖌️ Yaratıcı Manipülasyon</summary>

```
2000x2000 kare belge oluştur.
abstract-pattern.jpg'yi yerleştir ve belgeyi dolduracak şekilde ayarla.
Katmanı çoğalt.
Kopyalanan katmanda 45 derece, 50px yarıçapta motion blur uygula.
Karışım modunu OVERLAY ve opaklığı %70 olarak ayarla.
Ortaya 120 pt beyaz "MOTION" metni ekle.
(200, 200)'den (1800, 1800)'e dikdörtgen seçim oluştur.
Seçimi tersine çevir ve sil (çerçeve efekti oluşturmak için).
Görseli düzleştir.
motion-art.jpg olarak kaydet.
```

</details>

<details>
<summary>🎯 Gelişmiş İş Akışı</summary>

```
Baskı için 300 DPI'da 3000x2000 belge oluştur.
hero-image.jpg'yi yerleştir ve tuvali dolduracak şekilde ayarla.
Görsel katmanını çoğalt.
Kopyalanan katmanı tamamen doygunluğunu kaldır.
Karışım modunu LUMINOSITY ve opaklığı %50 olarak ayarla.
"Overlay" adında yeni bir katman oluştur.
RGB(255, 150, 0) ile doldur ve karışım modunu %30 opaklıkla SOFTLIGHT olarak ayarla.
Üst ortaya (1500, 200) konumuna 96 pt'ta "PORTFOLIO" metni ekle.
Metin rengini beyaz olarak ayarla.
(1500, 320) konumuna 36 pt'ta "2026 Collection" alt metni ekle.
Metin alanının etrafında dikdörtgen seçim oluştur.
Overlay katmanında katman maskesi oluştur.
Görünür katmanları birleştir.
portfolio-cover.psd olarak kaydet.
Kalite 12 ile portfolio-cover.jpg olarak dışa aktar.
```

</details>

<details>
<summary>🔄 Eylem Kullanımı</summary>

```
my-photo.jpg'yi aç.
"My Actions" setinden "Vintage Look" eylemini çalıştır.
Hafifçe kararatmak için parlaklığı -10 olarak ayarla.
vintage-photo.jpg olarak kaydet.
```

</details>

<details>
<summary>⚡ Özel Betik Çalıştırma</summary>

```
Bu özel ExtendScript kodunu çalıştır:
app.beep();
alert('Processing started!');
```

</details>

<details>
<summary>⏮️ Geri Al / Yeniden Yap İşlemleri</summary>

```
Aktif katmana 15px Gaussian Blur uygula.
[Sonucu bekle]
Aslında bu çok fazla bulanıklık. Geri al.
Bunun yerine 5px Gaussian Blur uygula.
```

Ya da:

```
Hangi işlemlerin gerçekleştirildiğini görmek için geçmiş durumlarını al.
Son 3 işlemi geri al.
Bir işlemi geri getirmek için 1 adım yeniden uygula.
```

</details>

<details>
<summary>🔁 Hata kurtarma (yapılandırılmış zarflar)</summary>

```
Bir tarif version_unsupported veya generative_unavailable döndürürse, get_capabilities çağır ve hangi Photoshop özelliğinin eksik olduğunu söyle.
Bir araç suggested_next_tool ile başarısız olursa o ipucunu takip et (ör. yalnızca raster içeren bir tariften önce rasterize_layer).
Asla tahmin etme — başarısızlıktan sonra get_state oku ve bir sonraki tek adımı öner.
```

</details>

<details>
<summary>📱 Sosyal medya format kiti (ajans)</summary>

```
Türkiye pazarı için bir key visual master'ım var.
Aktif belgeyi prepare-for-web recipe ile sRGB'ye hazırla ve optimize edilmiş JPEG'leri ~/.photoshop-mcp/exports'a aktar.
Ayrıca şu formatları ayrı JPEG'ler olarak dışa aktar:
- Instagram Feed: 1080×1350
- Instagram Story / Reels: 1080×1920 (üst ve alt 250 piksel güvenli zon)
- TikTok: 1080×1920, 9:16 dikey
- X (Twitter): 1200×675
- LinkedIn Sponsored Content: 1200×628
Konu, çerçeve alanının en az %60'ını kapsamalı; logo sağ üstte 20 piksel boşlukla.
9:16 formatta konu kesilecekse photoshop_generative_expand kullan.
Tüm çıktı yollarını bir tabloda listele.
```

Eşdeğer şablonlar: `ps.prepare_for_web`, `ps.export_social_variants`.

</details>

<details>
<summary>🖨️ Baskı teslim dosyası (CMYK / taşma payı)</summary>

```
Aktif belgeyi Türkiye ofset baskı teslimatı için hazırla:
RGB'den CMYK'ya dönüştür; hedef profil ISO Coated v2 veya FOGRA39.
Her kenarda 3 mm taşma payı ekle, son formatta 300 dpi çözünürlüğü doğrula.
ISO Coated v2 için soft proof kur ve renk kaymalarını belirt.
Zengin siyah alanları C50 M20 Y20 K100 olarak ayarla; siyah metin yalnızca K100.
Gömülü profille PDF/X-4 olarak dışa aktar ve önizleme göster.
```

</details>

<details>
<summary>📸 E-ticaret beyaz zemin / ürün fotoğrafı (Packshot)</summary>

```
Trendyol, Hepsiburada ve Amazon TR için ürün fotoğraflarım var.
Her görsel için: Select Subject ile arka planı kaldır, 2 piksel kenar tüylendirmesi yap, saf beyaz RGB(255,255,255) zemine yerleştir, 2000×2000 px üzerinde ortala.
Ürün, çerçeve alanının en az %70'ini kapsamalı.
Ayrı bir rötuş katmanında toz ve çizikleri temizle, sRGB göm, ~/.photoshop-mcp/exports/packshots/'a JPEG kalite 90 olarak kaydet.
Bir test görseli ile başla, önizleme göster, ardından klasörün geri kalanına devam et.
```

Eşdeğer MCP istem şablonu: `ps.remove_background` ile `{ feather_px: "2", keep_shadow: "false" }`.

</details>

<details>
<summary>💄 Güzellik & portre rötuşu (reklam ajansı)</summary>

```
Aktif portre katmanında profesyonel güzellik ve reklam ajansı rötuşu yap:
enhance-portrait recipe'yi yüksek yoğunlukta çalıştır — tek bir geri alınabilir adımda frequency separation + dodge & burn.
Aktif katman metin veya Smart Object ise önce rasterleştir.
Cilt dokusunu koru; aşırı düzleştirmeden kaçın.
Bitince önizleme göster ve hangi katmanlara dokunulduğunu listele.
```

Eşdeğer MCP istem şablonu: `ps.enhance_portrait` ile `{ intensity: "high", skin_smoothing: "true" }`.

</details>

<details>
<summary>🤖 Üretken AI + PS bitirme (key visual)</summary>

```
Aktif belgede bir ürün packshot PNG'si ve bir yaşam tarzı arka plan görseli var.
Ürünü sağ alta özgün boyutunun %85'inde yerleştir.
Işık, gölge ve renk sıcaklığının sahneyle uyuşması için photoshop_generative_fill veya harmonizasyon uygula.
Doğal bir düşen gölge ekle (MULTIPLY, yaklaşık %35 opaklık).
Master PSD olarak kaydet; LinkedIn için ~/.photoshop-mcp/exports/kv/'e 1200×628 px JPEG dışa aktar.
```

</details>

<details>
<summary>📦 Ambalaj & POS mockup toplu üretim</summary>

```
"Screen" adında bir Smart Object katmanıyla açık bir ambalaj mockup PSD'im var.
~/assets/ambalaj/'daki her PNG/JPG ile değiştir ve varyant başına bir JPEG dışa aktar — düz katmanlar değil, perspektif korunacak şekilde Smart Object takas et.
batch_mockup_replace recipe'yi kullan ve müşteri onayı için tüm çıktı yollarını bir tabloda listele.
```

Eşdeğer MCP istem şablonu: `ps.batch_mockup_replace`.

</details>

## Özellikler

- **Bağımsız web UI** — yerel sohbet arayüzü (`photoshop-mcp-ui`); sağlayıcı başına API anahtarı
  veya CLI abonelik kimlik doğrulaması (Anthropic, Google)
- **Action Plan (beta)** — web UI'da isteğe bağlı plan-sonra-uygula modu (yalnızca API anahtarı):
  tek bir planlama çağrısı, doğrudan araç yürütme, başarısızlıkta sınırlı onarım
- **Hem Windows hem macOS'ta çalışır**
- **Photoshop 2012–2025+ destekler**
- **ExtendScript API**: AppleScript/COM otomasyonu aracılığıyla evrensel uyumluluk
- **Otomatik Algılama**: Sisteminizdeki Photoshop kurulumunu otomatik bulur
- **86 Araç**: 74 atomik `photoshop_*` + 12 tarif `photoshop_recipe_*`
- **Yapay Zeka/İstem Katmanı**: 19 MCP istem şablonu (12 tarif + 7 kılavuz), sunucu talimatları,
  durum/önizleme/yetenek araçları
- **Belge Yönetimi**: Belge oluşturma, açma, kaydetme, kapatma, kırpma
- **Katman İşlemleri**: Katman oluşturma, silme, çoğaltma, birleştirme, dönüştürme
- **Katman Özellikleri**: Opaklık, karışım modları, görünürlük, kilitleme
- **Metin Biçimlendirme**: Yazı tipi, boyut, renk, hizalama kontrolleri
- **Görsel Yerleştirme**: Görsel yerleştirme, dosya açma, belgeye sığdırma
- **Filtreler**: Gaussian Blur, Keskinleştirme, Gürültü, Motion Blur
- **Renk Ayarlamaları**: Parlaklık/Kontrast, Ton/Doygunluk, Eğriler, Otomatik Düzeyler/Kontrast
- **Seçimler ve Maskeler**: Dikdörtgen seçimler, konu seçme, içerik duyarlı doldurma,
  degrade maske, katman maskeleri
- **Geçmiş Kontrolü**: Geri Al/Yeniden Yap işlemleri, geçmiş durumlarını görüntüleme
- **Eylemler**: Kayıtlı eylemleri çalıştırma, özel betikler çalıştırma
- **Otomatik Rasterleştirme**: Filtreler için gerektiğinde katmanları otomatik dönüştürür
- **Bağlam Takibi**: Yapay zeka bağlam farkındalığı için her işlemden sonra belge/katman
  durumunu döndürür

## Kurulum

### NPX Kullanımı (Önerilen)

Kurulum gerekmez! Sadece MCP istemcinizi yapılandırın:

```bash
npx @alisaitteke/photoshop-mcp
```

Depoyu yerel olarak geliştirmek için geliştirme kılavuzundaki [Kaynaktan](docs/development.md#from-source) bölümüne bakın.

## Yapılandırma

### Cursor için

Cursor ayarlarınıza ekleyin (`.cursor/config.json` veya workspace ayarları):

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

### Claude Desktop için

Claude Desktop yapılandırmanıza ekleyin (macOS'ta `~/Library/Application Support/Claude/claude_desktop_config.json` veya Windows'ta `%APPDATA%\Claude\claude_desktop_config.json`):

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

### Ortam Değişkenleri

- `PHOTOSHOP_PATH`: (İsteğe bağlı) Özel Photoshop kurulum yolunu belirtin
- `LOG_LEVEL`: Günlük kaydı düzeyi (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
- `ANALYTICS_DISABLED`: Anonim kullanım analizlerini tamamen devre dışı bırakmak için `1` veya `true`
  olarak ayarlayın
- `POSTHOG_DISABLED`: `ANALYTICS_DISABLED` için eski takma ad
- `ANALYTICS_PROVIDER`: Analiz arka ucu — `mixpanel` (varsayılan) veya `posthog` (geri alma)
- `MIXPANEL_TOKEN`: (İsteğe bağlı) Mixpanel proje tokenını geçersiz kılın
- `MIXPANEL_API_HOST`: (İsteğe bağlı) Mixpanel ingest host'u (varsayılan: `https://api-eu.mixpanel.com`)
- `POSTHOG_KEY`: (İsteğe bağlı, eski) PostHog proje anahtarı — yalnızca `ANALYTICS_PROVIDER=posthog`
  olduğunda kullanılır
- `POSTHOG_API_HOST`: (İsteğe bağlı, eski) PostHog ingest host'u (varsayılan: `https://a.alisait.com`)
- `POSTHOG_UI_HOST`: (İsteğe bağlı, eski) PostHog UI host'u (varsayılan: `https://eu.posthog.com`)

## Mevcut Araçlar

Tüm atomik `photoshop_*` araçları için tam başvuru (parametreler, örnekler ve kullanım):
[`docs/available-tools.md`](docs/available-tools.md).


## Bağlam Takibi

Her araç, Photoshop'un mevcut durumu hakkında aşağıdakiler dahil kapsamlı bağlam bilgisi döndürür:

- **Belge Bilgisi**: Ad, boyutlar, çözünürlük, renk modu, katman sayısı
- **Aktif Katman Bilgisi**: Ad, tür, opaklık, karışım modu, görünürlük, kilit durumu
- **Seçim Durumu**: Bir seçimin aktif olup olmadığı
- **İşlem Sonucu**: Neyin değiştirildiğine ilişkin özel ayrıntılar

Bu, yapay zeka asistanlarının şunların farkında kalmasını sağlar:
- Hangi belgenin aktif olduğu
- Üzerinde çalışılan katman
- Mevcut katman özellikleri (opaklık, karışım modu vb.)
- Belge boyutları ve ayarları

**Örnek Yanıt:**
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

Bu bağlam, yapay zeka asistanlarının birden fazla komut boyunca hangi belge ve katman üzerinde
çalıştıklarını hatırlamasına yardımcı olur.

---

## Platforma Özgü Notlar

### Windows

- Photoshop ile iletişim kurmak için COM otomasyonu kullanır
- Kurulum yolları için kayıt defteri tabanlı otomatik algılama
- Hem 32-bit hem 64-bit sürümleri destekler

### macOS

- Photoshop iletişimi için AppleScript/OSA kullanır
- Spotlight tabanlı otomatik algılama
- Aynı anda yüklü birden fazla Photoshop sürümünü destekler
- **CLI hesabı kimlik doğrulaması** (bağımsız UI) macOS önceliklidir: Terminal'de
  `claude auth login` / `gemini auth login` çalıştırın; kimlik bilgileri `~/.claude/`
  ve `~/.gemini/` altında saklanır

## Desteklenen Photoshop Sürümleri

- **Tüm Photoshop sürümleri** (2012–2025+): AppleScript (macOS) veya COM (Windows) aracılığıyla
  ExtendScript API kullanır

**Önemli Not**: Photoshop 2022+ eklentiler için UXP'yi desteklese de AppleScript/COM aracılığıyla
harici otomasyon yalnızca ExtendScript kullanabilir. UXP, dahili eklentiler için tasarlanmıştır ve
harici betiklerden çağrılamaz. Bu nedenle bu MCP sunucusu, tüm Photoshop sürümleriyle maksimum
uyumluluk için ExtendScript kullanır.

## Sorun Giderme

Yaygın bağlantı, betik ve günlük kaydı sorunları:
[`docs/troubleshooting.md`](docs/troubleshooting.md).

### Bağımsız UI — CLI hesabı kimlik doğrulaması

| Belirti | Olası neden | Düzeltme |
|---|---|---|
| `cli_not_found` | Claude Code / Gemini CLI yüklü değil | `npm i -g @anthropic-ai/claude-code` veya `npm i -g @google/gemini-cli` |
| `not_authenticated` | OAuth oturumu yok | Terminal'de `claude auth login` veya `gemini auth login` çalıştırın |
| `claude` / `gemini` `PATH`'de yok | Özel kurulum konumu | Ayarlar → **CLI path** → **Check connection** |
| Sohbet IDE'de çalışıyor ama UI'da çalışmıyor (CLI modu) | OAuth tokenları yalnızca CLI'ya özgü | UI'da **CLI account** kullanın; API anahtarları ve CLI oturumları ayrıdır |
| Gemini çok turlu konuşmalarda unutkanlık gösteriyor | Başsız CLI her turda yeni oturum açabilir | Bilinen kısıtlama; geçmiş isteme eklenir (MVP) |

## Geliştirme

Kaynaktan kurulum, derleme, lint, entegrasyon testleri (son sonuçlarla) ve kullanım örnekleri:
[`docs/development.md`](docs/development.md).

## Mimari

Sistem tasarımı, veri akışı, platform soyutlaması ve UI ajan modları:
[`docs/architecture.md`](docs/architecture.md).

LinkedIn veya sosyal medyada paylaşıyor musunuz? OG kurulumu ve gönderi metni için
[`images/og-social.png`](images/og-social.png) ve
[`docs/social-preview.md`](docs/social-preview.md) kullanın.

## Katkıda Bulunma

Katkılar memnuniyetle karşılanır! PR açmadan önce lütfen [CONTRIBUTING.md](CONTRIBUTING.md)
dosyasını okuyun.

## Geliştirici Hakkında

**[Ali Sait Teke](https://alisait.com)** — Full-Stack mühendis & yapay zeka çağı yazılım mimarı
(Python, Go, Node.js, React, Next.js, Vue).

Bu proje pratik bir sorudan doğdu: *Photoshop'u kırılgan tek seferlik betikler olmadan LLM'lerle
nasıl güvenilir biçimde kontrol edersiniz?* 80 araçlı bir MCP sunucusuna, güvenilir çok adımlı
iş akışları için bir tarif/istem katmanına ve yaratıcı çalışmanın bir IDE gerektirmemesi için
yerel bir web UI'ya dönüştü.

**Bu kod tabanının gösterdikleri:** TypeScript sistem tasarımı, MCP protokol entegrasyonu,
platformlar arası masaüstü otomasyonu (macOS AppleScript / Windows COM), ajansal döngüler için
yapılandırılmış hata kurtarma ve üretim odaklı yerel öncelikli UI (Vue 3 + Hono + SQLite).

- [Portfolio](https://alisait.com) · [GitHub](https://github.com/alisaitteke) · [LinkedIn](https://www.linkedin.com/in/alisait/)

## Lisans

MIT

## Anonim Kullanım Analitiği

Ürünü geliştirmek için varsayılan olarak anonim, toplu kullanım olayları toplanır. İstediğiniz
zaman çıkabilirsiniz. Tüm ayrıntılar:
[`docs/anonymous-usage-analytics.md`](docs/anonymous-usage-analytics.md).

## Teşekkürler

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) ile geliştirildi
- Adobe Photoshop betik yazım topluluğundan ilham alındı
