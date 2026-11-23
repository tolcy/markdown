# Tolcy Markdown v0.1.0

## 中文

Tolcy 首个公开版本：免费开源的 Windows Markdown 编辑器，无需账户，支持本地写作、按文稿加密和多格式导出。

- Markdown 即时渲染与源码模式。
- 本地工作区、多标签、大纲导航、查找替换。
- 浅色、纸色和暗色主题，支持中英文等界面语言。
- 导出 PDF、Word（DOCX）、EPUB、HTML 与 LaTeX。
- 复制公众号排版，插入图片与下载远程图片。
- 新建空白文档未输入内容时，点击 × 直接关闭；有未保存内容时提醒保存。
- 补充 MIT 许可证和第三方组件声明。
- 设置中新增多密钥管理，按文稿加密；安全记住密钥，重启后自动解密。
- 新建文稿保存后立即刷新工作区，避免并行目录扫描留下旧的文件列表。
- 左下角增加文稿加密开关和密钥下拉框，与设置页同步。
- 启动时显示空白编辑区，不再自动创建示例文章。

**安装：** 下载 `TolcyMarkdown_0.1.0_x64-setup.exe`，适用于 Windows 10 / 11 x64。需要 WebView2；PDF 导出需要 Microsoft Edge。安装程序加入“打开方式”，不会替换默认应用。

**校验：** 安装包的 SHA-256 位于随附的 `SHA256SUMS.txt`。

**说明：** 文稿默认在本地保存；远程图片、PlantUML 等相关功能可能访问第三方服务。复杂文稿的导出排版可能有差异。

**加密范围：** 密钥在当前 Windows 账户下记住。别人只有加密文件时仍需正确密钥；能使用你已登录账户的人可能直接打开文稿。当前没有启动密码锁。文件名、图片附件、导出和复制的内容不受文稿加密保护；请另行备份原始密钥。

**许可证：** Tolcy 自有代码采用 MIT，第三方组件保留各自许可证。安装包免费提供。

**AI 说明与版权反馈：** 本项目包含 AI 生成或辅助编写的代码与文档，第三方组件版权仍归各自权利人。若您认为具体内容涉及您的合法权益，请联系 **to_lcy@126.com** 并说明内容位置与权属依据。维护者会核实并视情况更正、替换或移除。

## English

The first public release of Tolcy: a free, open-source Markdown editor for Windows with local writing, per-document encryption, and document export. No account required.

- Instant Markdown rendering and source mode.
- Local workspaces, multiple tabs, outlines, and find/replace.
- Light, paper, and dark themes with Chinese, English, and other interface languages.
- Export PDF, Word (DOCX), EPUB, HTML, and LaTeX.
- Copy WeChat-ready formatting, insert images, and download remote images locally.
- Empty new documents close immediately; documents with unsaved content prompt you to save.
- MIT license for Tolcy code and third-party license notices included.
- Multiple encryption keys in Settings, per-document encryption, and automatic decryption using securely remembered keys.
- Refresh the workspace after saving new documents, including when a directory scan was already in progress.
- An encryption switch and key selector in the bottom-left sidebar, synchronized with Settings.
- Start with an empty editor instead of automatically creating a sample document.

**Install:** Download `TolcyMarkdown_0.1.0_x64-setup.exe` for Windows 10 / 11 x64. WebView2 is required; PDF export requires Microsoft Edge. Tolcy is added to “Open with” without changing the default application.

**Verify:** The installer's SHA-256 is listed in the attached `SHA256SUMS.txt`.

**Notes:** Documents are stored locally by default. Remote images, PlantUML, and related features may contact third-party services. Exported formatting can vary for complex documents.

**Encryption scope:** Keys are remembered for the current Windows account. Someone with only an encrypted file still needs the correct key; someone using your signed-in account may open documents directly. There is no startup password lock. Filenames, image attachments, exports, and copied content are not covered. Back up original keys separately.

**License:** Tolcy's own code uses MIT; third-party components retain their own licenses. The installer is provided free of charge.


**AI assistance and rights enquiries:** This project includes AI-generated or AI-assisted code and documentation. Third-party rights remain with their respective holders. Please send rights enquiries identifying the relevant content and basis of your rights to **to_lcy@126.com**. Reports will be reviewed and material corrected, replaced, or removed as appropriate.
