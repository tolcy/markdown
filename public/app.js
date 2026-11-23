const MARKDOWN = /\.(md|markdown|txt)$/i;
const SKIP_DIRS = new Set(["node_modules", "target", "dist", ".git", ".tools", ".vs"]);

const state = {
  editor: null,
  handle: null,
  filePath: "",
  name: "",
  relPath: "",
  saved: "",
  dirty: false,
  loading: false,
  workspace: null,
  folders: [],
  hidden: new Set(),
  tabs: [],
  activeKey: "",
  stamp: 0,
};

let closing = false;
let closingTab = false;

const fileName = document.getElementById("file-name");
const dirty = document.getElementById("dirty");
const count = document.getElementById("count");
const fallbackOpen = document.getElementById("fallback-open");

const I18N = {
  zh: {
    settings: "设置", workspace: "工作区", collapse: "折叠", openFolder: "打开文件夹",
    noFolder: "未打开文件夹", search: "搜索", clearSearch: "清除搜索", dragOutline: "上下拖动大纲",
    outline: "大纲", dragSidebar: "左右拖动", closeWorkspace: "隐藏侧栏", openWorkspace: "显示侧栏",
    collapseWorkspace: "收起工作区", expandWorkspace: "展开工作区",
    collapseOutline: "收起大纲", expandOutline: "展开大纲",
    close: "关闭", back: "返回", appearance: "外观", file: "文件", export: "导出", language: "语言",
    appearanceHint: "标题栏、侧栏和正文一起切换。",
    themeDark: "暗色", themeDarkHint: "安静的夜间写作", themeLight: "浅色", themeLightHint: "清爽的纯白纸面",
    themePaper: "纸色", themePaperHint: "温暖柔和的阅读",
    fileHint: "新建、打开和保存当前文稿。", newFile: "新建", open: "打开", save: "保存", saveAs: "另存为",
    exportHint: "把当前文稿存成文件，或复制成公众号可用的内容。", wechat: "公众号",
    languageHint: "切换界面语言。正在编辑的正文不会翻译。",
    saved: "已保存", unsaved: "未保存", chars: "字", cancel: "取消", ok: "确定",
    find: "查找", replace: "替换", replaceOne: "替换", replaceAll: "全部替换",
    replaceWorkspace: "工作区", replaceWorkspaceHint: "在工作区全部 Markdown 中替换？共 {count} 个文件。",
    replaceWorkspaceDone: "已在 {files} 个文件中替换 {hits} 处。",
    quickOpen: "按文件名打开", focusMode: "专注模式", typewriter: "打字机模式",
    spellcheck: "拼写检查", spellHint: "使用系统词典；中文提示取决于系统语言包，英文通常更完整。",
    shortcuts: "快捷键", shortcutsHint: "常用操作一览。", moreTabs: "更多标签",
    stats: "字数统计", copyPlain: "复制纯文本", copyHtml: "复制 HTML",
    fetchImages: "下载远程图片", fetchImagesDone: "已下载 {count} 张图片到文稿旁。",
    fetchImagesNone: "没有远程图片。", copied: "已复制。",
    exportOk: "已导出。",     invalidRegex: "正则无效。", regex: "正则",
    fenceLang: "代码块语言", closePalette: "关闭查找 / 快速打开",
    findNextHint: "查找下一个", findPrevHint: "查找上一个",
    gotoHeading: "跳到标题",
    pairHint: "自动成对，光标落在中间",
    bold: "加粗", italic: "斜体", strike: "删除线", headingLevel: "一至六级标题",
    link: "链接", bulletList: "无序列表", orderedList: "有序列表", checkList: "任务列表",
    quote: "引用", codeBlock: "代码块", inlineCode: "行内代码", table: "表格",
    undo: "撤销", redo: "重做", upload: "上传",
    focusHint: "只突出当前段落，打字机模式把当前行保持在中间。",
    words: "词", lines: "行", selection: "选区",
    externalChanged: "文件在外部被修改了。当前文稿有未保存内容，没有自动覆盖。",
    newDoc: "新建文件", newFolder: "新建文件夹", rename: "重命名", showInFolder: "在文件夹中显示", remove: "移除",
    langPrompt: "输入语言，例如 java", useTyped: "回车使用 “{name}”",
    emptyTree: "打开一个文件夹，这里会列出其中的 Markdown。",
    untitled: "未命名", folder: "文件夹", openFailed: "打开失败",
    unsavedTitle: "未保存", stillNew: "当前文档还有未保存的修改。仍然新建？",
    stillOpen: "当前文档还有未保存的修改。仍然打开另一个文件？",
    imagesOnly: "只能插入图片", imageFailed: "插入图片失败",
    newFailed: "新建失败", openFolderFailed: "打开文件夹失败", saveFailed: "保存失败", saveAsFailed: "另存为失败",
    placeholder: "从一个想法开始……", source: "源码", rendered: "正文",
    sourceTip: "切换源码与正文",
    closeDirty: "“{name}”尚未保存，关闭前是否保存？",
    closeUnsaved: "未保存的修改", discard: "不保存",
    saveBeforeClose: "“{name}”尚未保存，关闭前是否保存？",
    locationUnavailable: "原位置不可用，内容已保留",
    linkOpenFailed: "无法打开链接", unsupportedLink: "此链接暂不支持直接打开。", openLink: "打开链接",
    saveBeforeLink: "请先保存当前文档，才能打开相对路径链接。",
    saveElsewhere: "无法保存“{name}”。原位置可能已断开、被移除或不可写。\n\n文稿内容已保留，可以另存到电脑或其他位置。",
    closeMultiple: "有 {count} 个文稿尚未保存：\n{names}\n\n关闭前是否保存？",
    copiedWechat: "已复制公众号排版，到公众号后台粘贴即可。",
    folderName: "文件夹名称", newName: "新名称",
    removeHint: "从工作区去掉「{name}」？只是不在左侧显示，不会删除磁盘上的文件。",
    removeWorkspaceHint: "从工作区去掉文件夹「{name}」？\n路径：{path}\n侧栏会清空该文件夹的列表，磁盘上的文件全部保留。",
    searchNeedFolder: "先打开一个文件夹。", noMatch: "没有匹配。",
    confirm: "确认", failed: "操作失败", notice: "提示",
  },
  en: {
    settings: "Settings", workspace: "Workspace", collapse: "Collapse", openFolder: "Open folder",
    noFolder: "No folder open", search: "Search", clearSearch: "Clear search", dragOutline: "Drag outline",
    outline: "Outline", dragSidebar: "Drag sidebar", closeWorkspace: "Hide sidebar", openWorkspace: "Show sidebar",
    collapseWorkspace: "Collapse workspace", expandWorkspace: "Expand workspace",
    collapseOutline: "Collapse outline", expandOutline: "Expand outline",
    close: "Close", back: "Back", appearance: "Appearance", file: "File", export: "Export", language: "Language",
    appearanceHint: "Title bar, sidebar, and page switch together.",
    themeDark: "Dark", themeDarkHint: "Dark background", themeLight: "Light", themeLightHint: "Light gray",
    themePaper: "Paper", themePaperHint: "Warm background",
    fileHint: "Create, open, and save the current document.", newFile: "New", open: "Open", save: "Save", saveAs: "Save as",
    exportHint: "Save the document, or copy it for WeChat.", wechat: "WeChat",
    languageHint: "Interface language. The document itself is not translated.",
    saved: "Saved", unsaved: "Unsaved", chars: "chars", cancel: "Cancel", ok: "OK",
    find: "Find", replace: "Replace", replaceOne: "Replace", replaceAll: "Replace all",
    replaceWorkspace: "Workspace", replaceWorkspaceHint: "Replace in all Markdown files in the workspace? {count} files.",
    replaceWorkspaceDone: "Replaced {hits} matches in {files} files.",
    quickOpen: "Open by name", focusMode: "Focus mode", typewriter: "Typewriter mode",
    spellcheck: "Spell check", spellHint: "Uses the system dictionary. Chinese hints depend on OS language packs; English is usually stronger.",
    shortcuts: "Shortcuts", shortcutsHint: "Common shortcuts.", moreTabs: "More tabs",
    stats: "Word count", copyPlain: "Copy plain text", copyHtml: "Copy HTML",
    fetchImages: "Download remote images", fetchImagesDone: "Downloaded {count} images beside the document.",
    fetchImagesNone: "No remote images.", copied: "Copied.",
    exportOk: "Exported.", invalidRegex: "Invalid regular expression.", regex: "Regex",
    fenceLang: "Code fence language", closePalette: "Close find / quick open",
    findNextHint: "Find next", findPrevHint: "Find previous",
    gotoHeading: "Go to heading",
    pairHint: "Auto-pair with caret in the middle",
    bold: "Bold", italic: "Italic", strike: "Strikethrough", headingLevel: "Heading levels 1–6",
    link: "Link", bulletList: "Bullet list", orderedList: "Numbered list", checkList: "Task list",
    quote: "Quote", codeBlock: "Code block", inlineCode: "Inline code", table: "Table",
    undo: "Undo", redo: "Redo", upload: "Upload",
    focusHint: "Focus mode fades other paragraphs. Typewriter mode keeps the current line centered.",
    words: "words", lines: "lines", selection: "Selection",
    externalChanged: "The file changed on disk. This document has unsaved edits, so it was not overwritten.",
    newDoc: "New file", newFolder: "New folder", rename: "Rename", showInFolder: "Show in Folder", remove: "Remove",
    langPrompt: "Type a language, for example java", useTyped: "Press Enter to use “{name}”",
    emptyTree: "Open a folder to list its Markdown files.",
    untitled: "Untitled", folder: "Folder", openFailed: "Could not open",
    unsavedTitle: "Unsaved", stillNew: "This document has unsaved changes. Create a new one anyway?",
    stillOpen: "This document has unsaved changes. Open another file anyway?",
    imagesOnly: "Only images can be inserted", imageFailed: "Could not insert the image",
    newFailed: "Could not create", openFolderFailed: "Could not open the folder", saveFailed: "Could not save", saveAsFailed: "Could not save as",
    placeholder: "Start with an idea…", source: "Source", rendered: "Document",
    sourceTip: "Switch source and document",
    closeDirty: "Save changes to “{name}” before closing?",
    closeUnsaved: "Unsaved changes", discard: "Don't save",
    saveBeforeClose: "Save changes to “{name}” before closing?",
    locationUnavailable: "Location unavailable; text retained",
    linkOpenFailed: "Could not open link", unsupportedLink: "This link cannot be opened directly.", openLink: "Open link",
    saveBeforeLink: "Save this document before opening a relative link.",
    saveElsewhere: "Could not save “{name}”. The original location may be disconnected, removed, or unwritable.\n\nYour text is retained. Save it to another location.",
    closeMultiple: "{count} documents have unsaved changes:\n{names}\n\nSave before closing?",
    copiedWechat: "Copied. Paste it into the WeChat editor.",
    folderName: "Folder name", newName: "New name",
    removeHint: "Remove “{name}” from the workspace list? It only hides it in the sidebar; files on disk are kept.",
    removeWorkspaceHint: "Remove folder “{name}” from the workspace?\nPath: {path}\nIt disappears from the sidebar only. Nothing on disk is deleted.",
    searchNeedFolder: "Open a folder first.", noMatch: "No matches.",
    confirm: "Confirm", failed: "Something went wrong", notice: "Notice",
  },
  de: {
    settings: "Einstellungen", workspace: "Arbeitsbereich", collapse: "Einklappen", openFolder: "Ordner öffnen",
    noFolder: "Kein Ordner geöffnet", search: "Suchen", clearSearch: "Suche löschen", dragOutline: "Gliederung ziehen",
    outline: "Gliederung", dragSidebar: "Seitenleiste ziehen", closeWorkspace: "Arbeitsbereich ausblenden", openWorkspace: "Arbeitsbereich einblenden",
    close: "Schließen", back: "Zurück", appearance: "Darstellung", file: "Datei", export: "Export", language: "Sprache",
    appearanceHint: "Titelleiste, Seitenleiste und Text wechseln zusammen.",
    themeDark: "Dunkel", themeDarkHint: "Dunkler Hintergrund", themeLight: "Hell", themeLightHint: "Hellgrau",
    themePaper: "Papier", themePaperHint: "Warmer Hintergrund",
    fileHint: "Dokument erstellen, öffnen und speichern.", newFile: "Neu", open: "Öffnen", save: "Speichern", saveAs: "Speichern unter",
    exportHint: "Dokument speichern oder für WeChat kopieren.", wechat: "WeChat",
    languageHint: "Sprache der Oberfläche. Der Text selbst wird nicht übersetzt.",
    saved: "Gespeichert", unsaved: "Ungespeichert", chars: "Zeichen", cancel: "Abbrechen", ok: "OK",
    newDoc: "Neue Datei", newFolder: "Neuer Ordner", rename: "Umbenennen", showInFolder: "Im Ordner anzeigen", remove: "Entfernen",
    langPrompt: "Sprache eingeben, zum Beispiel java", useTyped: "Eingabetaste für „{name}“",
    emptyTree: "Ordner öffnen, um Markdown-Dateien anzuzeigen.",
    untitled: "Unbenannt", folder: "Ordner", openFailed: "Öffnen fehlgeschlagen",
    unsavedTitle: "Ungespeichert", stillNew: "Das Dokument hat ungespeicherte Änderungen. Trotzdem neu erstellen?",
    stillOpen: "Das Dokument hat ungespeicherte Änderungen. Trotzdem eine andere Datei öffnen?",
    imagesOnly: "Nur Bilder können eingefügt werden", imageFailed: "Bild konnte nicht eingefügt werden",
    newFailed: "Erstellen fehlgeschlagen", openFolderFailed: "Ordner konnte nicht geöffnet werden", saveFailed: "Speichern fehlgeschlagen", saveAsFailed: "Speichern unter fehlgeschlagen",
    placeholder: "Hier schreiben. Die Auszeichnung wird dargestellt, wenn der Cursor das Feld verlässt.", source: "Quelltext", rendered: "Darstellung",
    sourceTip: "Quelltext und Darstellung",
    closeDirty: "„{name}“ hat ungespeicherte Änderungen. Trotzdem schließen?",
    copiedWechat: "Kopiert. Im WeChat-Editor einfügen.",
    folderName: "Ordnername", newName: "Neuer Name",
    removeHint: "„{name}“ aus der Seitenleiste entfernen? Dateien auf der Festplatte bleiben erhalten.",
    searchNeedFolder: "Zuerst einen Ordner öffnen.", noMatch: "Keine Treffer.",
    confirm: "Bestätigen", failed: "Etwas ist schiefgelaufen", notice: "Hinweis",
  },
  fr: {
    settings: "Réglages", workspace: "Espace de travail", collapse: "Réduire", openFolder: "Ouvrir un dossier",
    noFolder: "Aucun dossier ouvert", search: "Rechercher", clearSearch: "Effacer la recherche", dragOutline: "Faire glisser le plan",
    outline: "Plan", dragSidebar: "Faire glisser le volet", closeWorkspace: "Masquer l’espace", openWorkspace: "Afficher l’espace",
    close: "Fermer", back: "Retour", appearance: "Apparence", file: "Fichier", export: "Exporter", language: "Langue",
    appearanceHint: "La barre de titre, le volet et la page changent ensemble.",
    themeDark: "Sombre", themeDarkHint: "Fond sombre", themeLight: "Clair", themeLightHint: "Gris clair",
    themePaper: "Papier", themePaperHint: "Fond chaud",
    fileHint: "Créer, ouvrir et enregistrer le document.", newFile: "Nouveau", open: "Ouvrir", save: "Enregistrer", saveAs: "Enregistrer sous",
    exportHint: "Enregistrer le document, ou le copier pour WeChat.", wechat: "WeChat",
    languageHint: "Langue de l’interface. Le texte en cours n’est pas traduit.",
    saved: "Enregistré", unsaved: "Non enregistré", chars: "car.", cancel: "Annuler", ok: "OK",
    newDoc: "Nouveau fichier", newFolder: "Nouveau dossier", rename: "Renommer", showInFolder: "Afficher dans le dossier", remove: "Retirer",
    langPrompt: "Saisir une langue, par exemple java", useTyped: "Entrée pour utiliser « {name} »",
    emptyTree: "Ouvrez un dossier pour lister les fichiers Markdown.",
    untitled: "Sans titre", folder: "Dossier", openFailed: "Ouverture impossible",
    unsavedTitle: "Non enregistré", stillNew: "Ce document a des modifications non enregistrées. En créer un nouveau quand même ?",
    stillOpen: "Ce document a des modifications non enregistrées. Ouvrir un autre fichier quand même ?",
    imagesOnly: "Seules les images peuvent être insérées", imageFailed: "Impossible d’insérer l’image",
    newFailed: "Création impossible", openFolderFailed: "Impossible d’ouvrir le dossier", saveFailed: "Enregistrement impossible", saveAsFailed: "Enregistrement sous impossible",
    placeholder: "Écrivez ici. La syntaxe s’affiche quand le curseur quitte le texte.", source: "Source", rendered: "Aperçu",
    sourceTip: "Source et aperçu",
    closeDirty: "« {name} » a des modifications non enregistrées. Fermer quand même ?",
    copiedWechat: "Copié. Collez-le dans l’éditeur WeChat.",
    folderName: "Nom du dossier", newName: "Nouveau nom",
    removeHint: "Retirer « {name} » du volet ? Les fichiers sur le disque sont conservés.",
    searchNeedFolder: "Ouvrez d’abord un dossier.", noMatch: "Aucun résultat.",
    confirm: "Confirmer", failed: "Une erreur s’est produite", notice: "Message",
  },
  pt: {
    settings: "Configurações", workspace: "Área de trabalho", collapse: "Recolher", openFolder: "Abrir pasta",
    noFolder: "Nenhuma pasta aberta", search: "Pesquisar", clearSearch: "Limpar pesquisa", dragOutline: "Arrastar o sumário",
    outline: "Sumário", dragSidebar: "Arrastar a barra lateral", closeWorkspace: "Ocultar a área", openWorkspace: "Mostrar a área",
    close: "Fechar", back: "Voltar", appearance: "Aparência", file: "Arquivo", export: "Exportar", language: "Idioma",
    appearanceHint: "A barra de título, a lateral e a página mudam juntas.",
    themeDark: "Escuro", themeDarkHint: "Fundo escuro", themeLight: "Claro", themeLightHint: "Cinza claro",
    themePaper: "Papel", themePaperHint: "Fundo quente",
    fileHint: "Criar, abrir e salvar o documento atual.", newFile: "Novo", open: "Abrir", save: "Salvar", saveAs: "Salvar como",
    exportHint: "Salvar o documento ou copiá-lo para o WeChat.", wechat: "WeChat",
    languageHint: "Idioma da interface. O texto em edição não é traduzido.",
    saved: "Salvo", unsaved: "Não salvo", chars: "caracteres", cancel: "Cancelar", ok: "OK",
    newDoc: "Novo arquivo", newFolder: "Nova pasta", rename: "Renomear", showInFolder: "Mostrar na pasta", remove: "Remover",
    langPrompt: "Digite um idioma, por exemplo java", useTyped: "Enter para usar “{name}”",
    emptyTree: "Abra uma pasta para listar os arquivos Markdown.",
    untitled: "Sem título", folder: "Pasta", openFailed: "Não foi possível abrir",
    unsavedTitle: "Não salvo", stillNew: "Este documento tem alterações não salvas. Criar outro mesmo assim?",
    stillOpen: "Este documento tem alterações não salvas. Abrir outro arquivo mesmo assim?",
    imagesOnly: "Só é possível inserir imagens", imageFailed: "Não foi possível inserir a imagem",
    newFailed: "Não foi possível criar", openFolderFailed: "Não foi possível abrir a pasta", saveFailed: "Não foi possível salvar", saveAsFailed: "Não foi possível salvar como",
    placeholder: "Escreva aqui. A marcação aparece quando o cursor sai.", source: "Código", rendered: "Visualização",
    sourceTip: "Código e visualização",
    closeDirty: "“{name}” tem alterações não salvas. Fechar mesmo assim?",
    copiedWechat: "Copiado. Cole no editor do WeChat.",
    folderName: "Nome da pasta", newName: "Novo nome",
    removeHint: "Remover “{name}” da lateral? Os arquivos no disco são mantidos.",
    searchNeedFolder: "Abra uma pasta primeiro.", noMatch: "Nenhum resultado.",
    confirm: "Confirmar", failed: "Algo deu errado", notice: "Aviso",
  },
  es: {
    settings: "Ajustes", workspace: "Espacio de trabajo", collapse: "Contraer", openFolder: "Abrir carpeta",
    noFolder: "Ninguna carpeta abierta", search: "Buscar", clearSearch: "Borrar búsqueda", dragOutline: "Arrastrar el esquema",
    outline: "Esquema", dragSidebar: "Arrastrar la barra lateral", closeWorkspace: "Ocultar el espacio", openWorkspace: "Mostrar el espacio",
    close: "Cerrar", back: "Volver", appearance: "Apariencia", file: "Archivo", export: "Exportar", language: "Idioma",
    appearanceHint: "La barra de título, el panel y la página cambian juntos.",
    themeDark: "Oscuro", themeDarkHint: "Fondo oscuro", themeLight: "Claro", themeLightHint: "Gris claro",
    themePaper: "Papel", themePaperHint: "Fondo cálido",
    fileHint: "Crear, abrir y guardar el documento.", newFile: "Nuevo", open: "Abrir", save: "Guardar", saveAs: "Guardar como",
    exportHint: "Guardar el documento o copiarlo para WeChat.", wechat: "WeChat",
    languageHint: "Idioma de la interfaz. El texto no se traduce.",
    saved: "Guardado", unsaved: "Sin guardar", chars: "caracteres", cancel: "Cancelar", ok: "Aceptar",
    newDoc: "Nuevo archivo", newFolder: "Nueva carpeta", rename: "Renombrar", showInFolder: "Mostrar en la carpeta", remove: "Quitar",
    langPrompt: "Escribe un idioma, por ejemplo java", useTyped: "Pulsa Intro para usar «{name}»",
    emptyTree: "Abre una carpeta para listar los archivos Markdown.",
    untitled: "Sin título", folder: "Carpeta", openFailed: "No se pudo abrir",
    unsavedTitle: "Sin guardar", stillNew: "Este documento tiene cambios sin guardar. ¿Crear uno nuevo de todos modos?",
    stillOpen: "Este documento tiene cambios sin guardar. ¿Abrir otro archivo de todos modos?",
    imagesOnly: "Solo se pueden insertar imágenes", imageFailed: "No se pudo insertar la imagen",
    newFailed: "No se pudo crear", openFolderFailed: "No se pudo abrir la carpeta", saveFailed: "No se pudo guardar", saveAsFailed: "No se pudo guardar como",
    placeholder: "Escribe aquí. El formato aparece cuando el cursor sale.", source: "Código", rendered: "Vista",
    sourceTip: "Código y vista",
    closeDirty: "«{name}» tiene cambios sin guardar. ¿Cerrarlo de todos modos?",
    copiedWechat: "Copiado. Pégalo en el editor de WeChat.",
    folderName: "Nombre de la carpeta", newName: "Nombre nuevo",
    removeHint: "¿Quitar «{name}» del panel? Los archivos del disco se conservan.",
    searchNeedFolder: "Abre primero una carpeta.", noMatch: "Sin resultados.",
    confirm: "Confirmar", failed: "Algo salió mal", notice: "Aviso",
  },
  ja: {
    settings: "設定", workspace: "ワークスペース", collapse: "折りたたむ", openFolder: "フォルダーを開く",
    noFolder: "フォルダーがありません", search: "検索", clearSearch: "検索をクリア", dragOutline: "アウトラインをドラッグ",
    outline: "アウトライン", dragSidebar: "サイドバーをドラッグ", closeWorkspace: "ワークスペースを隠す", openWorkspace: "ワークスペースを表示",
    close: "閉じる", back: "戻る", appearance: "外観", file: "ファイル", export: "書き出し", language: "言語",
    appearanceHint: "タイトルバー、サイドバー、本文が一緒に切り替わります。",
    themeDark: "ダーク", themeDarkHint: "暗い背景", themeLight: "ライト", themeLightHint: "薄いグレー",
    themePaper: "ペーパー", themePaperHint: "暖かい背景",
    fileHint: "文書を新規作成、開く、保存します。", newFile: "新規", open: "開く", save: "保存", saveAs: "名前を付けて保存",
    exportHint: "文書を保存するか、微信用にコピーします。", wechat: "微信",
    languageHint: "表示言語です。本文は翻訳しません。",
    saved: "保存済み", unsaved: "未保存", chars: "字", cancel: "キャンセル", ok: "OK",
    newDoc: "新規ファイル", newFolder: "新規フォルダー", rename: "名前を変更", showInFolder: "フォルダーで表示", remove: "取り除く",
    langPrompt: "言語を入力（例: java）", useTyped: "Enter で「{name}」を使う",
    emptyTree: "フォルダーを開くと Markdown が表示されます。",
    untitled: "無題", folder: "フォルダー", openFailed: "開けませんでした",
    unsavedTitle: "未保存", stillNew: "未保存の変更があります。新規作成しますか？",
    stillOpen: "未保存の変更があります。別のファイルを開きますか？",
    imagesOnly: "挿入できるのは画像だけです", imageFailed: "画像を挿入できませんでした",
    newFailed: "作成できませんでした", openFolderFailed: "フォルダーを開けませんでした", saveFailed: "保存できませんでした", saveAsFailed: "別名保存できませんでした",
    placeholder: "ここに書きます。カーソルが離れると整形されます。", source: "ソース", rendered: "表示",
    sourceTip: "ソースと表示",
    closeDirty: "「{name}」には未保存の変更があります。閉じますか？",
    copiedWechat: "コピーしました。微信の編集画面に貼り付けてください。",
    folderName: "フォルダー名", newName: "新しい名前",
    removeHint: "「{name}」を左から外しますか？ディスク上のファイルは残ります。",
    searchNeedFolder: "先にフォルダーを開いてください。", noMatch: "一致なし",
    confirm: "確認", failed: "失敗しました", notice: "通知",
  },
  ko: {
    settings: "설정", workspace: "작업 영역", collapse: "접기", openFolder: "폴더 열기",
    noFolder: "열린 폴더 없음", search: "검색", clearSearch: "검색 지우기", dragOutline: "개요 드래그",
    outline: "개요", dragSidebar: "사이드바 드래그", closeWorkspace: "작업 영역 숨기기", openWorkspace: "작업 영역 보기",
    close: "닫기", back: "뒤로", appearance: "모양", file: "파일", export: "내보내기", language: "언어",
    appearanceHint: "제목 표시줄, 사이드바, 본문이 함께 바뀝니다.",
    themeDark: "어둡게", themeDarkHint: "어두운 배경", themeLight: "밝게", themeLightHint: "밝은 회색",
    themePaper: "종이", themePaperHint: "따뜻한 배경",
    fileHint: "문서를 만들고 열고 저장합니다.", newFile: "새로 만들기", open: "열기", save: "저장", saveAs: "다른 이름으로 저장",
    exportHint: "문서를 저장하거나 위챗용으로 복사합니다.", wechat: "위챗",
    languageHint: "인터페이스 언어입니다. 본문은 번역하지 않습니다.",
    saved: "저장됨", unsaved: "저장 안 됨", chars: "자", cancel: "취소", ok: "확인",
    newDoc: "새 파일", newFolder: "새 폴더", rename: "이름 바꾸기", showInFolder: "폴더에서 보기", remove: "제거",
    langPrompt: "언어를 입력하세요. 예: java", useTyped: "Enter로 “{name}” 사용",
    emptyTree: "폴더를 열면 Markdown이 나열됩니다.",
    untitled: "제목 없음", folder: "폴더", openFailed: "열 수 없습니다",
    unsavedTitle: "저장 안 됨", stillNew: "저장하지 않은 변경이 있습니다. 새로 만들까요?",
    stillOpen: "저장하지 않은 변경이 있습니다. 다른 파일을 열까요?",
    imagesOnly: "이미지만 넣을 수 있습니다", imageFailed: "이미지를 넣을 수 없습니다",
    newFailed: "만들 수 없습니다", openFolderFailed: "폴더를 열 수 없습니다", saveFailed: "저장할 수 없습니다", saveAsFailed: "다른 이름으로 저장할 수 없습니다",
    placeholder: "여기에 쓰세요. 커서가 떠나면 문법이 반영됩니다.", source: "소스", rendered: "보기",
    sourceTip: "소스와 보기",
    closeDirty: "“{name}”에 저장하지 않은 변경이 있습니다. 닫을까요?",
    copiedWechat: "복사했습니다. 위챗 편집기에 붙여넣으세요.",
    folderName: "폴더 이름", newName: "새 이름",
    removeHint: "“{name}”을 왼쪽에서 제거할까요? 디스크의 파일은 남습니다.",
    searchNeedFolder: "먼저 폴더를 여세요.", noMatch: "결과 없음",
    confirm: "확인", failed: "실패했습니다", notice: "알림",
  },
  ru: {
    settings: "Настройки", workspace: "Рабочая область", collapse: "Свернуть", openFolder: "Открыть папку",
    noFolder: "Папка не открыта", search: "Поиск", clearSearch: "Очистить поиск", dragOutline: "Перетащить оглавление",
    outline: "Оглавление", dragSidebar: "Перетащить панель", closeWorkspace: "Скрыть область", openWorkspace: "Показать область",
    close: "Закрыть", back: "Назад", appearance: "Оформление", file: "Файл", export: "Экспорт", language: "Язык",
    appearanceHint: "Заголовок, боковая панель и страница меняются вместе.",
    themeDark: "Тёмная", themeDarkHint: "Тёмный фон", themeLight: "Светлая", themeLightHint: "Светло-серый фон",
    themePaper: "Бумага", themePaperHint: "Тёплый фон",
    fileHint: "Создать, открыть и сохранить документ.", newFile: "Создать", open: "Открыть", save: "Сохранить", saveAs: "Сохранить как",
    exportHint: "Сохранить документ или скопировать для WeChat.", wechat: "WeChat",
    languageHint: "Язык интерфейса. Текст документа не переводится.",
    saved: "Сохранено", unsaved: "Не сохранено", chars: "знак.", cancel: "Отмена", ok: "ОК",
    newDoc: "Новый файл", newFolder: "Новая папка", rename: "Переименовать", showInFolder: "Показать в папке", remove: "Убрать",
    langPrompt: "Введите язык, например java", useTyped: "Enter — использовать «{name}»",
    emptyTree: "Откройте папку, чтобы увидеть файлы Markdown.",
    untitled: "Без названия", folder: "Папка", openFailed: "Не удалось открыть",
    unsavedTitle: "Не сохранено", stillNew: "Есть несохранённые изменения. Всё равно создать новый?",
    stillOpen: "Есть несохранённые изменения. Всё равно открыть другой файл?",
    imagesOnly: "Можно вставлять только изображения", imageFailed: "Не удалось вставить изображение",
    newFailed: "Не удалось создать", openFolderFailed: "Не удалось открыть папку", saveFailed: "Не удалось сохранить", saveAsFailed: "Не удалось сохранить как",
    placeholder: "Пишите здесь. Разметка появится, когда курсор уйдёт.", source: "Исходник", rendered: "Вид",
    sourceTip: "Исходник и вид",
    closeDirty: "В «{name}» есть несохранённые изменения. Всё равно закрыть?",
    copiedWechat: "Скопировано. Вставьте в редактор WeChat.",
    folderName: "Имя папки", newName: "Новое имя",
    removeHint: "Убрать «{name}» слева? Файлы на диске останутся.",
    searchNeedFolder: "Сначала откройте папку.", noMatch: "Ничего не найдено.",
    confirm: "Подтвердить", failed: "Что-то пошло не так", notice: "Сообщение",
  },
  ar: {
    settings: "الإعدادات", workspace: "مساحة العمل", collapse: "طي", openFolder: "فتح مجلد",
    noFolder: "لا يوجد مجلد مفتوح", search: "بحث", clearSearch: "مسح البحث", dragOutline: "سحب المخطط",
    outline: "المخطط", dragSidebar: "سحب الشريط", closeWorkspace: "إخفاء المساحة", openWorkspace: "إظهار المساحة",
    close: "إغلاق", back: "رجوع", appearance: "المظهر", file: "ملف", export: "تصدير", language: "اللغة",
    appearanceHint: "يتبدل شريط العنوان والشريط الجانبي والصفحة معًا.",
    themeDark: "داكن", themeDarkHint: "خلفية داكنة", themeLight: "فاتح", themeLightHint: "رمادي فاتح",
    themePaper: "ورقي", themePaperHint: "خلفية دافئة",
    fileHint: "إنشاء المستند وفتحه وحفظه.", newFile: "جديد", open: "فتح", save: "حفظ", saveAs: "حفظ باسم",
    exportHint: "احفظ المستند أو انسخه لويتشات.", wechat: "ويتشات",
    languageHint: "لغة الواجهة. لا يُترجم النص نفسه.",
    saved: "محفوظ", unsaved: "غير محفوظ", chars: "حرفًا", cancel: "إلغاء", ok: "موافق",
    newDoc: "ملف جديد", newFolder: "مجلد جديد", rename: "إعادة تسمية", showInFolder: "إظهار في المجلد", remove: "إزالة",
    langPrompt: "اكتب لغة، مثل java", useTyped: "Enter لاستخدام «{name}»",
    emptyTree: "افتح مجلدًا لعرض ملفات Markdown.",
    untitled: "بدون عنوان", folder: "مجلد", openFailed: "تعذر الفتح",
    unsavedTitle: "غير محفوظ", stillNew: "توجد تغييرات غير محفوظة. هل تنشئ مستندًا جديدًا؟",
    stillOpen: "توجد تغييرات غير محفوظة. هل تفتح ملفًا آخر؟",
    imagesOnly: "يمكن إدراج الصور فقط", imageFailed: "تعذر إدراج الصورة",
    newFailed: "تعذر الإنشاء", openFolderFailed: "تعذر فتح المجلد", saveFailed: "تعذر الحفظ", saveAsFailed: "تعذر الحفظ باسم",
    placeholder: "اكتب هنا. يظهر التنسيق عند مغادرة المؤشر.", source: "المصدر", rendered: "العرض",
    sourceTip: "المصدر والعرض",
    closeDirty: "«{name}» فيه تغييرات غير محفوظة. هل تغلقه؟",
    copiedWechat: "تم النسخ. الصقه في محرر ويتشات.",
    folderName: "اسم المجلد", newName: "الاسم الجديد",
    removeHint: "إزالة «{name}» من الجانب؟ تبقى الملفات على القرص.",
    searchNeedFolder: "افتح مجلدًا أولًا.", noMatch: "لا توجد نتائج.",
    confirm: "تأكيد", failed: "حدث خطأ", notice: "تنبيه",
  },
  hi: {
    settings: "सेटिंग्स", workspace: "कार्यक्षेत्र", collapse: "समेटें", openFolder: "फ़ोल्डर खोलें",
    noFolder: "कोई फ़ोल्डर खुला नहीं", search: "खोजें", clearSearch: "खोज साफ़ करें", dragOutline: "रूपरेखा खींचें",
    outline: "रूपरेखा", dragSidebar: "साइडबार खींचें", closeWorkspace: "कार्यक्षेत्र छिपाएँ", openWorkspace: "कार्यक्षेत्र दिखाएँ",
    close: "बंद करें", back: "वापस", appearance: "रूप", file: "फ़ाइल", export: "निर्यात", language: "भाषा",
    appearanceHint: "शीर्षक पट्टी, साइडबार और पृष्ठ साथ बदलते हैं।",
    themeDark: "गहरा", themeDarkHint: "गहरा पृष्ठ", themeLight: "हल्का", themeLightHint: "हल्का धूसर",
    themePaper: "कागज़", themePaperHint: "गर्म पृष्ठ",
    fileHint: "दस्तावेज़ बनाएँ, खोलें और सहेजें।", newFile: "नया", open: "खोलें", save: "सहेजें", saveAs: "इस रूप में सहेजें",
    exportHint: "दस्तावेज़ सहेजें, या WeChat के लिए कॉपी करें।", wechat: "WeChat",
    languageHint: "इंटरफ़ेस की भाषा। लिखा पाठ अनुवाद नहीं होता।",
    saved: "सहेजा गया", unsaved: "असहेजा", chars: "अक्षर", cancel: "रद्द", ok: "ठीक",
    newDoc: "नई फ़ाइल", newFolder: "नया फ़ोल्डर", rename: "नाम बदलें", showInFolder: "फ़ोल्डर में दिखाएँ", remove: "हटाएँ",
    langPrompt: "भाषा लिखें, जैसे java", useTyped: "Enter से “{name}” चुनें",
    emptyTree: "Markdown फ़ाइलें देखने के लिए फ़ोल्डर खोलें।",
    untitled: "बिना नाम", folder: "फ़ोल्डर", openFailed: "खोला नहीं जा सका",
    unsavedTitle: "असहेजा", stillNew: "असहेजे बदलाव हैं। फिर भी नया बनाएँ?",
    stillOpen: "असहेजे बदलाव हैं। फिर भी दूसरी फ़ाइल खोलें?",
    imagesOnly: "केवल चित्र जोड़े जा सकते हैं", imageFailed: "चित्र नहीं जोड़ा जा सका",
    newFailed: "बनाया नहीं जा सका", openFolderFailed: "फ़ोल्डर नहीं खुला", saveFailed: "सहेजा नहीं जा सका", saveAsFailed: "इस रूप में सहेजा नहीं जा सका",
    placeholder: "यहाँ लिखें। कर्सर हटते ही रूप बनता है।", source: "स्रोत", rendered: "दृश्य",
    sourceTip: "स्रोत और दृश्य",
    closeDirty: "“{name}” में असहेजे बदलाव हैं। फिर भी बंद करें?",
    copiedWechat: "कॉपी हो गया। WeChat संपादक में चिपकाएँ।",
    folderName: "फ़ोल्डर का नाम", newName: "नया नाम",
    removeHint: "“{name}” को बाईं ओर से हटाएँ? डिस्क की फ़ाइलें रहेंगी।",
    searchNeedFolder: "पहले फ़ोल्डर खोलें।", noMatch: "कोई मिलान नहीं।",
    confirm: "पुष्टि", failed: "कुछ गड़बड़ हुई", notice: "सूचना",
  },
  id: {
    settings: "Pengaturan", workspace: "Ruang kerja", collapse: "Ciutkan", openFolder: "Buka folder",
    noFolder: "Tidak ada folder terbuka", search: "Cari", clearSearch: "Hapus pencarian", dragOutline: "Seret kerangka",
    outline: "Kerangka", dragSidebar: "Seret bilah sisi", closeWorkspace: "Sembunyikan ruang kerja", openWorkspace: "Tampilkan ruang kerja",
    close: "Tutup", back: "Kembali", appearance: "Tampilan", file: "Berkas", export: "Ekspor", language: "Bahasa",
    appearanceHint: "Bilah judul, bilah sisi, dan halaman berubah bersama.",
    themeDark: "Gelap", themeDarkHint: "Latar gelap", themeLight: "Terang", themeLightHint: "Abu-abu muda",
    themePaper: "Kertas", themePaperHint: "Latar hangat",
    fileHint: "Buat, buka, dan simpan dokumen.", newFile: "Baru", open: "Buka", save: "Simpan", saveAs: "Simpan sebagai",
    exportHint: "Simpan dokumen, atau salin untuk WeChat.", wechat: "WeChat",
    languageHint: "Bahasa antarmuka. Isi tulisan tidak diterjemahkan.",
    saved: "Tersimpan", unsaved: "Belum disimpan", chars: "karakter", cancel: "Batal", ok: "OK",
    newDoc: "Berkas baru", newFolder: "Folder baru", rename: "Ubah nama", showInFolder: "Tampilkan di folder", remove: "Hapus dari daftar",
    langPrompt: "Ketik bahasa, misalnya java", useTyped: "Enter untuk memakai “{name}”",
    emptyTree: "Buka folder untuk melihat berkas Markdown.",
    untitled: "Tanpa judul", folder: "Folder", openFailed: "Tidak dapat membuka",
    unsavedTitle: "Belum disimpan", stillNew: "Ada perubahan yang belum disimpan. Tetap buat baru?",
    stillOpen: "Ada perubahan yang belum disimpan. Tetap buka berkas lain?",
    imagesOnly: "Hanya gambar yang dapat disisipkan", imageFailed: "Gambar tidak dapat disisipkan",
    newFailed: "Tidak dapat membuat", openFolderFailed: "Folder tidak dapat dibuka", saveFailed: "Tidak dapat menyimpan", saveAsFailed: "Tidak dapat menyimpan sebagai",
    placeholder: "Tulis di sini. Format muncul saat kursor pergi.", source: "Sumber", rendered: "Tampilan",
    sourceTip: "Sumber dan tampilan",
    closeDirty: "“{name}” punya perubahan yang belum disimpan. Tutup saja?",
    copiedWechat: "Disalin. Tempel di editor WeChat.",
    folderName: "Nama folder", newName: "Nama baru",
    removeHint: "Hapus “{name}” dari sisi kiri? Berkas di disk tetap ada.",
    searchNeedFolder: "Buka folder dulu.", noMatch: "Tidak ada hasil.",
    confirm: "Konfirmasi", failed: "Terjadi kesalahan", notice: "Pemberitahuan",
  },
  vi: {
    settings: "Cài đặt", workspace: "Không gian làm việc", collapse: "Thu gọn", openFolder: "Mở thư mục",
    noFolder: "Chưa mở thư mục", search: "Tìm", clearSearch: "Xóa tìm kiếm", dragOutline: "Kéo mục lục",
    outline: "Mục lục", dragSidebar: "Kéo thanh bên", closeWorkspace: "Ẩn không gian", openWorkspace: "Hiện không gian",
    close: "Đóng", back: "Quay lại", appearance: "Giao diện", file: "Tệp", export: "Xuất", language: "Ngôn ngữ",
    appearanceHint: "Thanh tiêu đề, thanh bên và trang đổi cùng nhau.",
    themeDark: "Tối", themeDarkHint: "Nền tối", themeLight: "Sáng", themeLightHint: "Xám nhạt",
    themePaper: "Giấy", themePaperHint: "Nền ấm",
    fileHint: "Tạo, mở và lưu tài liệu.", newFile: "Mới", open: "Mở", save: "Lưu", saveAs: "Lưu thành",
    exportHint: "Lưu tài liệu hoặc sao chép cho WeChat.", wechat: "WeChat",
    languageHint: "Ngôn ngữ giao diện. Nội dung đang viết không được dịch.",
    saved: "Đã lưu", unsaved: "Chưa lưu", chars: "ký tự", cancel: "Hủy", ok: "OK",
    newDoc: "Tệp mới", newFolder: "Thư mục mới", rename: "Đổi tên", showInFolder: "Hiện trong thư mục", remove: "Gỡ",
    langPrompt: "Nhập ngôn ngữ, ví dụ java", useTyped: "Enter để dùng “{name}”",
    emptyTree: "Mở thư mục để liệt kê tệp Markdown.",
    untitled: "Chưa đặt tên", folder: "Thư mục", openFailed: "Không mở được",
    unsavedTitle: "Chưa lưu", stillNew: "Có thay đổi chưa lưu. Vẫn tạo mới?",
    stillOpen: "Có thay đổi chưa lưu. Vẫn mở tệp khác?",
    imagesOnly: "Chỉ chèn được ảnh", imageFailed: "Không chèn được ảnh",
    newFailed: "Không tạo được", openFolderFailed: "Không mở được thư mục", saveFailed: "Không lưu được", saveAsFailed: "Không lưu thành được",
    placeholder: "Viết ở đây. Định dạng hiện khi con trỏ rời đi.", source: "Mã nguồn", rendered: "Xem",
    sourceTip: "Mã nguồn và bản xem",
    closeDirty: "“{name}” có thay đổi chưa lưu. Vẫn đóng?",
    copiedWechat: "Đã sao chép. Dán vào trình soạn WeChat.",
    folderName: "Tên thư mục", newName: "Tên mới",
    removeHint: "Gỡ “{name}” khỏi bên trái? Tệp trên đĩa được giữ.",
    searchNeedFolder: "Hãy mở thư mục trước.", noMatch: "Không khớp.",
    confirm: "Xác nhận", failed: "Đã xảy ra lỗi", notice: "Thông báo",
  },
  "zh-TW": {
    settings: "設定", workspace: "工作區", collapse: "摺疊", openFolder: "開啟資料夾",
    noFolder: "尚未開啟資料夾", search: "搜尋", clearSearch: "清除搜尋", dragOutline: "上下拖動大綱",
    outline: "大綱", dragSidebar: "左右拖動", closeWorkspace: "關閉工作區", openWorkspace: "開啟工作區",
    close: "關閉", back: "返回", appearance: "外觀", file: "檔案", export: "匯出", language: "語言",
    appearanceHint: "標題列、側欄和正文一起切換。",
    themeDark: "暗色", themeDarkHint: "深色背景", themeLight: "淺色", themeLightHint: "淺灰背景",
    themePaper: "紙色", themePaperHint: "暖色背景",
    fileHint: "新增、開啟和儲存目前文稿。", newFile: "新增", open: "開啟", save: "儲存", saveAs: "另存新檔",
    exportHint: "把目前文稿存成檔案，或複製成公眾號可用的內容。", wechat: "公眾號",
    languageHint: "切換介面語言。正在編輯的正文不會翻譯。",
    saved: "已儲存", unsaved: "未儲存", chars: "字", cancel: "取消", ok: "確定",
    newDoc: "新增檔案", newFolder: "新增資料夾", rename: "重新命名", showInFolder: "在資料夾中顯示", remove: "移除",
    langPrompt: "輸入語言，例如 java", useTyped: "按 Enter 使用「{name}」",
    emptyTree: "開啟資料夾後，這裡會列出其中的 Markdown。",
    untitled: "未命名", folder: "資料夾", openFailed: "開啟失敗",
    unsavedTitle: "未儲存", stillNew: "目前文件還有未儲存的修改。仍然新增？",
    stillOpen: "目前文件還有未儲存的修改。仍然開啟另一個檔案？",
    imagesOnly: "只能插入圖片", imageFailed: "插入圖片失敗",
    newFailed: "新增失敗", openFolderFailed: "開啟資料夾失敗", saveFailed: "儲存失敗", saveAsFailed: "另存失敗",
    placeholder: "直接寫。語法會在游標離開後轉成版式。", source: "原始碼", rendered: "編譯後",
    sourceTip: "原始碼和編譯後",
    closeDirty: "「{name}」還有未儲存的修改。仍然關閉？",
    copiedWechat: "已複製公眾號排版，到公眾號後台貼上即可。",
    folderName: "資料夾名稱", newName: "新名稱",
    removeHint: "從左側移除「{name}」？不會刪除磁碟上的檔案。",
    searchNeedFolder: "請先開啟資料夾。", noMatch: "沒有相符項目。",
    confirm: "確認", failed: "操作失敗", notice: "提示",
  },
  it: {
    settings: "Impostazioni", workspace: "Area di lavoro", collapse: "Comprimi", openFolder: "Apri cartella",
    noFolder: "Nessuna cartella aperta", search: "Cerca", clearSearch: "Cancella ricerca", dragOutline: "Trascina la struttura",
    outline: "Struttura", dragSidebar: "Trascina la barra", closeWorkspace: "Nascondi l’area", openWorkspace: "Mostra l’area",
    close: "Chiudi", back: "Indietro", appearance: "Aspetto", file: "File", export: "Esporta", language: "Lingua",
    appearanceHint: "Barra del titolo, barra laterale e pagina cambiano insieme.",
    themeDark: "Scuro", themeDarkHint: "Sfondo scuro", themeLight: "Chiaro", themeLightHint: "Grigio chiaro",
    themePaper: "Carta", themePaperHint: "Sfondo caldo",
    fileHint: "Crea, apri e salva il documento.", newFile: "Nuovo", open: "Apri", save: "Salva", saveAs: "Salva con nome",
    exportHint: "Salva il documento o copialo per WeChat.", wechat: "WeChat",
    languageHint: "Lingua dell’interfaccia. Il testo non viene tradotto.",
    saved: "Salvato", unsaved: "Non salvato", chars: "car.", cancel: "Annulla", ok: "OK",
    newDoc: "Nuovo file", newFolder: "Nuova cartella", rename: "Rinomina", showInFolder: "Mostra nella cartella", remove: "Rimuovi",
    langPrompt: "Scrivi una lingua, per esempio java", useTyped: "Invio per usare «{name}»",
    emptyTree: "Apri una cartella per elencare i file Markdown.",
    untitled: "Senza titolo", folder: "Cartella", openFailed: "Impossibile aprire",
    unsavedTitle: "Non salvato", stillNew: "Ci sono modifiche non salvate. Crearne uno nuovo comunque?",
    stillOpen: "Ci sono modifiche non salvate. Aprire un altro file comunque?",
    imagesOnly: "Si possono inserire solo immagini", imageFailed: "Impossibile inserire l’immagine",
    newFailed: "Impossibile creare", openFolderFailed: "Impossibile aprire la cartella", saveFailed: "Impossibile salvare", saveAsFailed: "Impossibile salvare con nome",
    placeholder: "Scrivi qui. La formattazione appare quando il cursore esce.", source: "Sorgente", rendered: "Vista",
    sourceTip: "Sorgente e vista",
    closeDirty: "«{name}» ha modifiche non salvate. Chiuderlo comunque?",
    copiedWechat: "Copiato. Incollalo nell’editor WeChat.",
    folderName: "Nome cartella", newName: "Nuovo nome",
    removeHint: "Rimuovere «{name}» dal lato? I file sul disco restano.",
    searchNeedFolder: "Apri prima una cartella.", noMatch: "Nessun risultato.",
    confirm: "Conferma", failed: "Qualcosa è andato storto", notice: "Avviso",
  },
  tr: {
    settings: "Ayarlar", workspace: "Çalışma alanı", collapse: "Daralt", openFolder: "Klasör aç",
    noFolder: "Açık klasör yok", search: "Ara", clearSearch: "Aramayı temizle", dragOutline: "Anahattı sürükle",
    outline: "Anahat", dragSidebar: "Kenar çubuğunu sürükle", closeWorkspace: "Alanı gizle", openWorkspace: "Alanı göster",
    close: "Kapat", back: "Geri", appearance: "Görünüm", file: "Dosya", export: "Dışa aktar", language: "Dil",
    appearanceHint: "Başlık çubuğu, kenar çubuğu ve sayfa birlikte değişir.",
    themeDark: "Koyu", themeDarkHint: "Koyu arka plan", themeLight: "Açık", themeLightHint: "Açık gri",
    themePaper: "Kâğıt", themePaperHint: "Sıcak arka plan",
    fileHint: "Belge oluşturun, açın ve kaydedin.", newFile: "Yeni", open: "Aç", save: "Kaydet", saveAs: "Farklı kaydet",
    exportHint: "Belgeyi kaydedin veya WeChat için kopyalayın.", wechat: "WeChat",
    languageHint: "Arayüz dili. Yazılan metin çevrilmez.",
    saved: "Kaydedildi", unsaved: "Kaydedilmedi", chars: "karakter", cancel: "İptal", ok: "Tamam",
    newDoc: "Yeni dosya", newFolder: "Yeni klasör", rename: "Yeniden adlandır", showInFolder: "Klasörde göster", remove: "Kaldır",
    langPrompt: "Bir dil yazın, örneğin java", useTyped: "“{name}” için Enter",
    emptyTree: "Markdown dosyalarını görmek için klasör açın.",
    untitled: "Adsız", folder: "Klasör", openFailed: "Açılamadı",
    unsavedTitle: "Kaydedilmedi", stillNew: "Kaydedilmemiş değişiklikler var. Yine de yeni oluşturulsun mu?",
    stillOpen: "Kaydedilmemiş değişiklikler var. Yine de başka dosya açılsın mı?",
    imagesOnly: "Yalnızca resim eklenebilir", imageFailed: "Resim eklenemedi",
    newFailed: "Oluşturulamadı", openFolderFailed: "Klasör açılamadı", saveFailed: "Kaydedilemedi", saveAsFailed: "Farklı kaydedilemedi",
    placeholder: "Buraya yazın. İmleç ayrılınca biçim görünür.", source: "Kaynak", rendered: "Görünüm",
    sourceTip: "Kaynak ve görünüm",
    closeDirty: "“{name}” kaydedilmemiş değişiklikler içeriyor. Yine de kapatılsın mı?",
    copiedWechat: "Kopyalandı. WeChat düzenleyicisine yapıştırın.",
    folderName: "Klasör adı", newName: "Yeni ad",
    removeHint: "“{name}” soldan kaldırılsın mı? Diskteki dosyalar durur.",
    searchNeedFolder: "Önce bir klasör açın.", noMatch: "Sonuç yok.",
    confirm: "Onayla", failed: "Bir şeyler ters gitti", notice: "Bildirim",
  },
};

const I18N_FEATURE = {
  de: {
    find: "Suchen", replace: "Ersetzen", replaceOne: "Ersetzen", replaceAll: "Alle ersetzen",
    replaceWorkspace: "Arbeitsbereich", replaceWorkspaceHint: "In allen Markdown-Dateien ersetzen? {count} Dateien.",
    replaceWorkspaceDone: "{hits} Treffer in {files} Dateien ersetzt.",
    quickOpen: "Nach Namen öffnen", focusMode: "Fokusmodus", typewriter: "Schreibmaschinenmodus",
    spellcheck: "Rechtschreibung", spellHint: "Nutzt das Systemwörterbuch.",
    shortcuts: "Tastenkürzel", shortcutsHint: "Häufige Tastenkürzel.",
    stats: "Wortzahl", copyPlain: "Nur Text kopieren", copyHtml: "HTML kopieren",
    fetchImages: "Remote-Bilder laden", fetchImagesDone: "{count} Bilder neben dem Dokument gespeichert.",
    fetchImagesNone: "Keine Remote-Bilder.", copied: "Kopiert.", exportOk: "Exportiert.",
    invalidRegex: "Ungültiger regulärer Ausdruck.", regex: "Regex",
    fenceLang: "Codeblock-Sprache", closePalette: "Suche / Schnellöffnen schließen",
    findNextHint: "Weitersuchen", findPrevHint: "Rückwärtssuchen",
    gotoHeading: "Zur Überschrift", pairHint: "Automatisch paaren, Cursor in der Mitte",
    bold: "Fett", italic: "Kursiv", strike: "Durchgestrichen", headingLevel: "Überschriften 1–6",
    link: "Link", bulletList: "Aufzählung", orderedList: "Nummerierte Liste", checkList: "Aufgabenliste",
    quote: "Zitat", codeBlock: "Codeblock", inlineCode: "Inline-Code", table: "Tabelle",
    undo: "Rückgängig", redo: "Wiederholen", upload: "Hochladen",
    focusHint: "Fokusmodus blendet andere Absätze ab. Schreibmaschine hält die Zeile mittig.",
    words: "Wörter", lines: "Zeilen", selection: "Auswahl",
    externalChanged: "Die Datei wurde extern geändert. Unsaved-Änderungen wurden nicht überschrieben.",
  },
  fr: {
    find: "Rechercher", replace: "Remplacer", replaceOne: "Remplacer", replaceAll: "Tout remplacer",
    replaceWorkspace: "Espace de travail", replaceWorkspaceHint: "Remplacer dans tous les Markdown ? {count} fichiers.",
    replaceWorkspaceDone: "{hits} occurrences remplacées dans {files} fichiers.",
    quickOpen: "Ouvrir par nom", focusMode: "Mode focus", typewriter: "Mode machine à écrire",
    spellcheck: "Orthographe", spellHint: "Utilise le dictionnaire système.",
    shortcuts: "Raccourcis", shortcutsHint: "Raccourcis courants.",
    stats: "Nombre de mots", copyPlain: "Copier le texte", copyHtml: "Copier le HTML",
    fetchImages: "Télécharger les images distantes", fetchImagesDone: "{count} images enregistrées à côté du document.",
    fetchImagesNone: "Aucune image distante.", copied: "Copié.", exportOk: "Exporté.",
    invalidRegex: "Expression régulière invalide.", regex: "Regex",
    fenceLang: "Langage du bloc de code", closePalette: "Fermer recherche / ouverture rapide",
    findNextHint: "Occurrence suivante", findPrevHint: "Occurrence précédente",
    gotoHeading: "Aller au titre", pairHint: "Appariement auto, curseur au milieu",
    bold: "Gras", italic: "Italique", strike: "Barré", headingLevel: "Titres 1–6",
    link: "Lien", bulletList: "Liste à puces", orderedList: "Liste numérotée", checkList: "Liste de tâches",
    quote: "Citation", codeBlock: "Bloc de code", inlineCode: "Code en ligne", table: "Tableau",
    undo: "Annuler", redo: "Rétablir", upload: "Téléverser",
    focusHint: "Le mode focus atténue les autres paragraphes. La machine à écrire centre la ligne.",
    words: "mots", lines: "lignes", selection: "Sélection",
    externalChanged: "Le fichier a changé sur le disque. Les modifications non enregistrées n’ont pas été écrasées.",
  },
  pt: {
    find: "Localizar", replace: "Substituir", replaceOne: "Substituir", replaceAll: "Substituir tudo",
    replaceWorkspace: "Área de trabalho", replaceWorkspaceHint: "Substituir em todos os Markdown? {count} arquivos.",
    replaceWorkspaceDone: "Substituídas {hits} ocorrências em {files} arquivos.",
    quickOpen: "Abrir pelo nome", focusMode: "Modo foco", typewriter: "Modo máquina de escrever",
    spellcheck: "Verificação ortográfica", spellHint: "Usa o dicionário do sistema.",
    shortcuts: "Atalhos", shortcutsHint: "Atalhos comuns.",
    stats: "Contagem de palavras", copyPlain: "Copiar texto", copyHtml: "Copiar HTML",
    fetchImages: "Baixar imagens remotas", fetchImagesDone: "{count} imagens salvas ao lado do documento.",
    fetchImagesNone: "Nenhuma imagem remota.", copied: "Copiado.", exportOk: "Exportado.",
    invalidRegex: "Expressão regular inválida.", regex: "Regex",
    fenceLang: "Linguagem do bloco de código", closePalette: "Fechar busca / abertura rápida",
    findNextHint: "Próxima ocorrência", findPrevHint: "Ocorrência anterior",
    gotoHeading: "Ir para o título", pairHint: "Emparelhar automaticamente, cursor no meio",
    bold: "Negrito", italic: "Itálico", strike: "Tachado", headingLevel: "Títulos 1–6",
    link: "Link", bulletList: "Lista com marcadores", orderedList: "Lista numerada", checkList: "Lista de tarefas",
    quote: "Citação", codeBlock: "Bloco de código", inlineCode: "Código em linha", table: "Tabela",
    undo: "Desfazer", redo: "Refazer", upload: "Enviar",
    focusHint: "O modo foco atenua outros parágrafos. A máquina de escrever centraliza a linha.",
    words: "palavras", lines: "linhas", selection: "Seleção",
    externalChanged: "O arquivo mudou no disco. As edições não salvas não foram sobrescritas.",
  },
  es: {
    find: "Buscar", replace: "Reemplazar", replaceOne: "Reemplazar", replaceAll: "Reemplazar todo",
    replaceWorkspace: "Espacio de trabajo", replaceWorkspaceHint: "¿Reemplazar en todos los Markdown? {count} archivos.",
    replaceWorkspaceDone: "Se reemplazaron {hits} coincidencias en {files} archivos.",
    quickOpen: "Abrir por nombre", focusMode: "Modo enfoque", typewriter: "Modo máquina de escribir",
    spellcheck: "Corrector ortográfico", spellHint: "Usa el diccionario del sistema.",
    shortcuts: "Atajos", shortcutsHint: "Atajos habituales.",
    stats: "Recuento de palabras", copyPlain: "Copiar texto", copyHtml: "Copiar HTML",
    fetchImages: "Descargar imágenes remotas", fetchImagesDone: "Se descargaron {count} imágenes junto al documento.",
    fetchImagesNone: "No hay imágenes remotas.", copied: "Copiado.", exportOk: "Exportado.",
    invalidRegex: "Expresión regular no válida.", regex: "Regex",
    fenceLang: "Lenguaje del bloque de código", closePalette: "Cerrar búsqueda / apertura rápida",
    findNextHint: "Buscar siguiente", findPrevHint: "Buscar anterior",
    gotoHeading: "Ir al título", pairHint: "Emparejar automáticamente, cursor en el medio",
    bold: "Negrita", italic: "Cursiva", strike: "Tachado", headingLevel: "Títulos 1–6",
    link: "Enlace", bulletList: "Lista con viñetas", orderedList: "Lista numerada", checkList: "Lista de tareas",
    quote: "Cita", codeBlock: "Bloque de código", inlineCode: "Código en línea", table: "Tabla",
    undo: "Deshacer", redo: "Rehacer", upload: "Subir",
    focusHint: "El modo enfoque atenúa otros párrafos. La máquina de escribir centra la línea.",
    words: "palabras", lines: "líneas", selection: "Selección",
    externalChanged: "El archivo cambió en el disco. No se sobrescribieron los cambios sin guardar.",
  },
  ja: {
    find: "検索", replace: "置換", replaceOne: "置換", replaceAll: "すべて置換",
    replaceWorkspace: "ワークスペース", replaceWorkspaceHint: "ワークスペース内の Markdown をすべて置換しますか？{count} 件。",
    replaceWorkspaceDone: "{files} ファイルで {hits} 件を置換しました。",
    quickOpen: "名前で開く", focusMode: "集中モード", typewriter: "タイプライターモード",
    spellcheck: "スペルチェック", spellHint: "システムの辞書を使います。",
    shortcuts: "ショートカット", shortcutsHint: "よく使うショートカット。",
    stats: "文字数", copyPlain: "プレーンテキストをコピー", copyHtml: "HTML をコピー",
    fetchImages: "リモート画像をダウンロード", fetchImagesDone: "文書の横に {count} 枚の画像を保存しました。",
    fetchImagesNone: "リモート画像はありません。", copied: "コピーしました。", exportOk: "書き出しました。",
    invalidRegex: "正規表現が無効です。", regex: "正規表現",
    fenceLang: "コードブロックの言語", closePalette: "検索 / クイックオープンを閉じる",
    findNextHint: "次を検索", findPrevHint: "前を検索",
    gotoHeading: "見出しへ移動", pairHint: "自動ペア、カーソルは中央",
    bold: "太字", italic: "斜体", strike: "取り消し線", headingLevel: "見出し 1〜6",
    link: "リンク", bulletList: "箇条書き", orderedList: "番号付きリスト", checkList: "タスクリスト",
    quote: "引用", codeBlock: "コードブロック", inlineCode: "インラインコード", table: "表",
    undo: "元に戻す", redo: "やり直し", upload: "アップロード",
    focusHint: "集中モードは他の段落を薄くします。タイプライターは現在行を中央に保ちます。",
    words: "語", lines: "行", selection: "選択",
    externalChanged: "ファイルが外部で変更されました。未保存の内容は上書きしていません。",
  },
  ko: {
    moreTabs: "탭 더보기",
    find: "찾기", replace: "바꾸기", replaceOne: "바꾸기", replaceAll: "모두 바꾸기",
    replaceWorkspace: "작업 영역", replaceWorkspaceHint: "작업 영역의 모든 Markdown에서 바꿀까요? {count}개 파일.",
    replaceWorkspaceDone: "{files}개 파일에서 {hits}곳을 바꿨습니다.",
    quickOpen: "이름으로 열기", focusMode: "집중 모드", typewriter: "타자기 모드",
    spellcheck: "맞춤법 검사", spellHint: "시스템 사전을 사용합니다.",
    shortcuts: "바로 가기", shortcutsHint: "자주 쓰는 바로 가기.",
    stats: "글자 수", copyPlain: "일반 텍스트 복사", copyHtml: "HTML 복사",
    fetchImages: "원격 이미지 다운로드", fetchImagesDone: "문서 옆에 이미지 {count}장을 저장했습니다.",
    fetchImagesNone: "원격 이미지가 없습니다.", copied: "복사했습니다.", exportOk: "내보냈습니다.",
    invalidRegex: "정규식이 올바르지 않습니다.", regex: "정규식",
    fenceLang: "코드 블록 언어", closePalette: "찾기 / 빠른 열기 닫기",
    findNextHint: "다음 찾기", findPrevHint: "이전 찾기",
    gotoHeading: "제목으로 이동", pairHint: "자동 쌍 입력, 커서는 가운데",
    bold: "굵게", italic: "기울임", strike: "취소선", headingLevel: "제목 1–6",
    link: "링크", bulletList: "글머리 기호 목록", orderedList: "번호 목록", checkList: "할 일 목록",
    quote: "인용", codeBlock: "코드 블록", inlineCode: "인라인 코드", table: "표",
    undo: "실행 취소", redo: "다시 실행", upload: "업로드",
    focusHint: "집중 모드는 다른 문단을 흐리게 합니다. 타자기 모드는 현재 줄을 가운데로 유지합니다.",
    words: "단어", lines: "줄", selection: "선택",
    externalChanged: "파일이 외부에서 변경되었습니다. 저장하지 않은 내용은 덮어쓰지 않았습니다.",
  },
  ru: {
    find: "Найти", replace: "Заменить", replaceOne: "Заменить", replaceAll: "Заменить все",
    replaceWorkspace: "Рабочая область", replaceWorkspaceHint: "Заменить во всех Markdown? {count} файлов.",
    replaceWorkspaceDone: "Заменено {hits} вхождений в {files} файлах.",
    quickOpen: "Открыть по имени", focusMode: "Режим фокуса", typewriter: "Режим пишущей машинки",
    spellcheck: "Проверка орфографии", spellHint: "Используется системный словарь.",
    shortcuts: "Горячие клавиши", shortcutsHint: "Частые сочетания.",
    stats: "Число слов", copyPlain: "Копировать текст", copyHtml: "Копировать HTML",
    fetchImages: "Скачать удалённые изображения", fetchImagesDone: "Сохранено {count} изображений рядом с документом.",
    fetchImagesNone: "Нет удалённых изображений.", copied: "Скопировано.", exportOk: "Экспортировано.",
    invalidRegex: "Неверное регулярное выражение.", regex: "Регулярка",
    fenceLang: "Язык блока кода", closePalette: "Закрыть поиск / быстрое открытие",
    findNextHint: "Найти далее", findPrevHint: "Найти ранее",
    gotoHeading: "Перейти к заголовку", pairHint: "Автопарные скобки, курсор посередине",
    bold: "Жирный", italic: "Курсив", strike: "Зачёркнутый", headingLevel: "Заголовки 1–6",
    link: "Ссылка", bulletList: "Маркированный список", orderedList: "Нумерованный список", checkList: "Список задач",
    quote: "Цитата", codeBlock: "Блок кода", inlineCode: "Встроенный код", table: "Таблица",
    undo: "Отменить", redo: "Повторить", upload: "Загрузить",
    focusHint: "Режим фокуса приглушает другие абзацы. Пишущая машинка держит строку по центру.",
    words: "слов", lines: "строк", selection: "Выделение",
    externalChanged: "Файл изменён на диске. Несохранённые правки не перезаписаны.",
  },
  ar: {
    find: "بحث", replace: "استبدال", replaceOne: "استبدال", replaceAll: "استبدال الكل",
    replaceWorkspace: "مساحة العمل", replaceWorkspaceHint: "استبدال في كل ملفات Markdown؟ {count} ملفًا.",
    replaceWorkspaceDone: "تم استبدال {hits} موضعًا في {files} ملفًا.",
    quickOpen: "فتح بالاسم", focusMode: "وضع التركيز", typewriter: "وضع الآلة الكاتبة",
    spellcheck: "تدقيق إملائي", spellHint: "يستخدم قاموس النظام.",
    shortcuts: "اختصارات", shortcutsHint: "اختصارات شائعة.",
    stats: "عدد الكلمات", copyPlain: "نسخ نص عادي", copyHtml: "نسخ HTML",
    fetchImages: "تنزيل الصور البعيدة", fetchImagesDone: "تم حفظ {count} صورة بجانب المستند.",
    fetchImagesNone: "لا توجد صور بعيدة.", copied: "تم النسخ.", exportOk: "تم التصدير.",
    invalidRegex: "تعبير منتظم غير صالح.", regex: "تعبير منتظم",
    fenceLang: "لغة كتلة التعليمات", closePalette: "إغلاق البحث / الفتح السريع",
    findNextHint: "البحث التالي", findPrevHint: "البحث السابق",
    gotoHeading: "الانتقال إلى العنوان", pairHint: "إقران تلقائي والمؤشر في الوسط",
    bold: "عريض", italic: "مائل", strike: "يتوسطه خط", headingLevel: "عناوين 1–6",
    link: "رابط", bulletList: "قائمة نقطية", orderedList: "قائمة مرقمة", checkList: "قائمة مهام",
    quote: "اقتباس", codeBlock: "كتلة تعليمات", inlineCode: "رمز مضمّن", table: "جدول",
    undo: "تراجع", redo: "إعادة", upload: "رفع",
    focusHint: "وضع التركيز يخفت الفقرات الأخرى. الآلة الكاتبة تُبقي السطر في الوسط.",
    words: "كلمات", lines: "أسطر", selection: "تحديد",
    externalChanged: "تغيّر الملف على القرص. لم تُستبدل التعديلات غير المحفوظة.",
  },
  hi: {
    find: "खोजें", replace: "बदलें", replaceOne: "बदलें", replaceAll: "सभी बदलें",
    replaceWorkspace: "कार्यक्षेत्र", replaceWorkspaceHint: "सभी Markdown में बदलें? {count} फ़ाइलें.",
    replaceWorkspaceDone: "{files} फ़ाइलों में {hits} स्थान बदले.",
    quickOpen: "नाम से खोलें", focusMode: "फ़ोकस मोड", typewriter: "टाइपराइटर मोड",
    spellcheck: "वर्तनी जाँच", spellHint: "सिस्टम शब्दकोश का उपयोग करता है.",
    shortcuts: "शॉर्टकट", shortcutsHint: "आम शॉर्टकट.",
    stats: "शब्द संख्या", copyPlain: "सादा पाठ कॉपी करें", copyHtml: "HTML कॉपी करें",
    fetchImages: "रिमोट चित्र डाउनलोड करें", fetchImagesDone: "दस्तावेज़ के पास {count} चित्र सहेजे.",
    fetchImagesNone: "कोई रिमोट चित्र नहीं.", copied: "कॉपी हो गया.", exportOk: "निर्यात हो गया.",
    invalidRegex: "अमान्य नियमित व्यंजक.", regex: "रेगेक्स",
    fenceLang: "कोड ब्लॉक भाषा", closePalette: "खोज / त्वरित खोलना बंद करें",
    findNextHint: "अगला खोजें", findPrevHint: "पिछला खोजें",
    gotoHeading: "शीर्षक पर जाएँ", pairHint: "स्वतः जोड़ी, कर्सर बीच में",
    bold: "मोटा", italic: "तिरछा", strike: "काटना", headingLevel: "शीर्षक 1–6",
    link: "लिंक", bulletList: "बुलेट सूची", orderedList: "क्रमांकित सूची", checkList: "कार्य सूची",
    quote: "उद्धरण", codeBlock: "कोड ब्लॉक", inlineCode: "इनलाइन कोड", table: "तालिका",
    undo: "पूर्ववत", redo: "फिर से करें", upload: "अपलोड",
    focusHint: "फ़ोकस मोड अन्य अनुच्छेदों को धुंधला करता है. टाइपराइटर वर्तमान पंक्ति को बीच में रखता है.",
    words: "शब्द", lines: "पंक्तियाँ", selection: "चयन",
    externalChanged: "फ़ाइल डिस्क पर बदल गई. असहेजे बदलाव ओवरराइट नहीं हुए.",
  },
  id: {
    find: "Cari", replace: "Ganti", replaceOne: "Ganti", replaceAll: "Ganti semua",
    replaceWorkspace: "Ruang kerja", replaceWorkspaceHint: "Ganti di semua Markdown? {count} berkas.",
    replaceWorkspaceDone: "Mengganti {hits} kecocokan di {files} berkas.",
    quickOpen: "Buka menurut nama", focusMode: "Mode fokus", typewriter: "Mode mesin tik",
    spellcheck: "Pemeriksa ejaan", spellHint: "Menggunakan kamus sistem.",
    shortcuts: "Pintasan", shortcutsHint: "Pintasan umum.",
    stats: "Jumlah kata", copyPlain: "Salin teks biasa", copyHtml: "Salin HTML",
    fetchImages: "Unduh gambar jarak jauh", fetchImagesDone: "{count} gambar disimpan di samping dokumen.",
    fetchImagesNone: "Tidak ada gambar jarak jauh.", copied: "Disalin.", exportOk: "Diekspor.",
    invalidRegex: "Ekspresi reguler tidak valid.", regex: "Regex",
    fenceLang: "Bahasa blok kode", closePalette: "Tutup cari / buka cepat",
    findNextHint: "Cari berikutnya", findPrevHint: "Cari sebelumnya",
    gotoHeading: "Ke judul", pairHint: "Pasangan otomatis, kursor di tengah",
    bold: "Tebal", italic: "Miring", strike: "Coret", headingLevel: "Judul 1–6",
    link: "Tautan", bulletList: "Daftar berpoin", orderedList: "Daftar bernomor", checkList: "Daftar tugas",
    quote: "Kutipan", codeBlock: "Blok kode", inlineCode: "Kode sebaris", table: "Tabel",
    undo: "Urungkan", redo: "Ulangi", upload: "Unggah",
    focusHint: "Mode fokus meredupkan paragraf lain. Mesin tik menjaga baris di tengah.",
    words: "kata", lines: "baris", selection: "Seleksi",
    externalChanged: "Berkas berubah di disk. Perubahan belum disimpan tidak ditimpa.",
  },
  vi: {
    find: "Tìm", replace: "Thay thế", replaceOne: "Thay thế", replaceAll: "Thay tất cả",
    replaceWorkspace: "Không gian làm việc", replaceWorkspaceHint: "Thay thế trong mọi Markdown? {count} tệp.",
    replaceWorkspaceDone: "Đã thay {hits} chỗ trong {files} tệp.",
    quickOpen: "Mở theo tên", focusMode: "Chế độ tập trung", typewriter: "Chế độ máy chữ",
    spellcheck: "Kiểm tra chính tả", spellHint: "Dùng từ điển hệ thống.",
    shortcuts: "Phím tắt", shortcutsHint: "Các phím tắt thường dùng.",
    stats: "Đếm từ", copyPlain: "Sao chép văn bản thuần", copyHtml: "Sao chép HTML",
    fetchImages: "Tải ảnh từ xa", fetchImagesDone: "Đã lưu {count} ảnh cạnh tài liệu.",
    fetchImagesNone: "Không có ảnh từ xa.", copied: "Đã sao chép.", exportOk: "Đã xuất.",
    invalidRegex: "Biểu thức chính quy không hợp lệ.", regex: "Regex",
    fenceLang: "Ngôn ngữ khối mã", closePalette: "Đóng tìm / mở nhanh",
    findNextHint: "Tìm tiếp", findPrevHint: "Tìm trước",
    gotoHeading: "Tới tiêu đề", pairHint: "Tự đóng cặp, con trỏ ở giữa",
    bold: "Đậm", italic: "Nghiêng", strike: "Gạch ngang", headingLevel: "Tiêu đề 1–6",
    link: "Liên kết", bulletList: "Danh sách dấu đầu dòng", orderedList: "Danh sách đánh số", checkList: "Danh sách việc",
    quote: "Trích dẫn", codeBlock: "Khối mã", inlineCode: "Mã nội dòng", table: "Bảng",
    undo: "Hoàn tác", redo: "Làm lại", upload: "Tải lên",
    focusHint: "Chế độ tập trung làm mờ đoạn khác. Máy chữ giữ dòng hiện tại ở giữa.",
    words: "từ", lines: "dòng", selection: "Vùng chọn",
    externalChanged: "Tệp đã đổi trên đĩa. Nội dung chưa lưu không bị ghi đè.",
  },
  "zh-TW": {
    moreTabs: "更多標籤",
    find: "尋找", replace: "取代", replaceOne: "取代", replaceAll: "全部取代",
    replaceWorkspace: "工作區", replaceWorkspaceHint: "要在工作區全部 Markdown 中取代嗎？共 {count} 個檔案。",
    replaceWorkspaceDone: "已在 {files} 個檔案中取代 {hits} 處。",
    quickOpen: "依檔名開啟", focusMode: "專注模式", typewriter: "打字機模式",
    spellcheck: "拼字檢查", spellHint: "使用系統詞典。",
    shortcuts: "快捷鍵", shortcutsHint: "常用操作一覽。",
    stats: "字數統計", copyPlain: "複製純文字", copyHtml: "複製 HTML",
    fetchImages: "下載遠端圖片", fetchImagesDone: "已下載 {count} 張圖片到文稿旁。",
    fetchImagesNone: "沒有遠端圖片。", copied: "已複製。", exportOk: "已匯出。",
    invalidRegex: "正規無效。", regex: "正規",
    fenceLang: "程式碼區塊語言", closePalette: "關閉尋找 / 快速開啟",
    findNextHint: "尋找下一個", findPrevHint: "尋找上一個",
    gotoHeading: "跳到標題", pairHint: "自動成對，游標落在中間",
    bold: "粗體", italic: "斜體", strike: "刪除線", headingLevel: "一至六級標題",
    link: "連結", bulletList: "無序清單", orderedList: "有序清單", checkList: "工作清單",
    quote: "引用", codeBlock: "程式碼區塊", inlineCode: "行內程式碼", table: "表格",
    undo: "復原", redo: "重做", upload: "上傳",
    focusHint: "專注模式淡化其他段落。打字機模式把目前列保持在中間。",
    words: "詞", lines: "行", selection: "選區",
    externalChanged: "檔案在外部被修改了。目前文稿有未儲存內容，沒有自動覆蓋。",
  },
  it: {
    find: "Trova", replace: "Sostituisci", replaceOne: "Sostituisci", replaceAll: "Sostituisci tutto",
    replaceWorkspace: "Area di lavoro", replaceWorkspaceHint: "Sostituire in tutti i Markdown? {count} file.",
    replaceWorkspaceDone: "Sostituite {hits} occorrenze in {files} file.",
    quickOpen: "Apri per nome", focusMode: "Modalità focus", typewriter: "Modalità macchina da scrivere",
    spellcheck: "Controllo ortografico", spellHint: "Usa il dizionario di sistema.",
    shortcuts: "Scorciatoie", shortcutsHint: "Scorciatoie comuni.",
    stats: "Conteggio parole", copyPlain: "Copia testo", copyHtml: "Copia HTML",
    fetchImages: "Scarica immagini remote", fetchImagesDone: "Salvate {count} immagini accanto al documento.",
    fetchImagesNone: "Nessuna immagine remota.", copied: "Copiato.", exportOk: "Esportato.",
    invalidRegex: "Espressione regolare non valida.", regex: "Regex",
    fenceLang: "Linguaggio del blocco di codice", closePalette: "Chiudi cerca / apri rapido",
    findNextHint: "Trova successivo", findPrevHint: "Trova precedente",
    gotoHeading: "Vai al titolo", pairHint: "Abbinamento automatico, cursore al centro",
    bold: "Grassetto", italic: "Corsivo", strike: "Barrato", headingLevel: "Titoli 1–6",
    link: "Collegamento", bulletList: "Elenco puntato", orderedList: "Elenco numerato", checkList: "Elenco attività",
    quote: "Citazione", codeBlock: "Blocco di codice", inlineCode: "Codice in linea", table: "Tabella",
    undo: "Annulla", redo: "Ripeti", upload: "Carica",
    focusHint: "La modalità focus attenua gli altri paragrafi. La macchina da scrivere tiene la riga al centro.",
    words: "parole", lines: "righe", selection: "Selezione",
    externalChanged: "Il file è cambiato su disco. Le modifiche non salvate non sono state sovrascritte.",
  },
  tr: {
    find: "Bul", replace: "Değiştir", replaceOne: "Değiştir", replaceAll: "Tümünü değiştir",
    replaceWorkspace: "Çalışma alanı", replaceWorkspaceHint: "Tüm Markdown dosyalarında değiştirilsin mi? {count} dosya.",
    replaceWorkspaceDone: "{files} dosyada {hits} eşleşme değiştirildi.",
    quickOpen: "Ada göre aç", focusMode: "Odak modu", typewriter: "Daktilo modu",
    spellcheck: "Yazım denetimi", spellHint: "Sistem sözlüğünü kullanır.",
    shortcuts: "Kısayollar", shortcutsHint: "Sık kullanılan kısayollar.",
    stats: "Sözcük sayısı", copyPlain: "Düz metni kopyala", copyHtml: "HTML kopyala",
    fetchImages: "Uzak görselleri indir", fetchImagesDone: "Belgenin yanına {count} görsel kaydedildi.",
    fetchImagesNone: "Uzak görsel yok.", copied: "Kopyalandı.", exportOk: "Dışa aktarıldı.",
    invalidRegex: "Geçersiz düzenli ifade.", regex: "Regex",
    fenceLang: "Kod bloğu dili", closePalette: "Bul / hızlı açmayı kapat",
    findNextHint: "Sonrakini bul", findPrevHint: "Öncekini bul",
    gotoHeading: "Başlığa git", pairHint: "Otomatik eşleme, imleç ortada",
    bold: "Kalın", italic: "İtalik", strike: "Üstü çizili", headingLevel: "Başlık 1–6",
    link: "Bağlantı", bulletList: "Madde işaretli liste", orderedList: "Numaralı liste", checkList: "Görev listesi",
    quote: "Alıntı", codeBlock: "Kod bloğu", inlineCode: "Satır içi kod", table: "Tablo",
    undo: "Geri al", redo: "Yinele", upload: "Yükle",
    focusHint: "Odak modu diğer paragrafları soldurur. Daktilo geçerli satırı ortada tutar.",
    words: "sözcük", lines: "satır", selection: "Seçim",
    externalChanged: "Dosya diskte değişti. Kaydedilmemiş değişiklikler üzerine yazılmadı.",
  },
};

(function fillI18nGaps() {
  Object.keys(I18N_FEATURE).forEach((id) => {
    if (I18N[id]) Object.assign(I18N[id], I18N_FEATURE[id]);
  });
  const en = I18N.en;
  Object.keys(I18N).forEach((id) => {
    if (id === "en") return;
    I18N[id] = Object.assign({}, en, I18N[id]);
  });
  // 保证移除提示不会因旧缓存缺失而回退成含糊文案
  if (!I18N.zh.removeWorkspaceHint) {
    I18N.zh.removeWorkspaceHint = "从工作区去掉文件夹「{name}」？\n路径：{path}\n侧栏会清空该文件夹的列表，磁盘上的文件全部保留。";
  }
})();

function uiLang() {
  try {
    const saved = localStorage.getItem("wengao-lang");
    if (saved && I18N[saved]) return saved;
  } catch (error) {}
  return "zh";
}

let lang = uiLang();

function t(key, vars) {
  let text = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || I18N.zh[key] || key;
  if (vars) {
    Object.keys(vars).forEach((name) => {
      text = text.split("{" + name + "}").join(String(vars[name]));
    });
  }
  return text;
}

function applyI18n() {
  const htmlLang = { zh: "zh-CN", "zh-TW": "zh-TW", en: "en", de: "de", fr: "fr", pt: "pt", es: "es", ja: "ja", ko: "ko", ru: "ru", ar: "ar", hi: "hi", id: "id", vi: "vi", it: "it", tr: "tr" };
  document.documentElement.lang = htmlLang[lang] || "zh-CN";
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const label = t(el.dataset.i18nTitle);
    el.title = label;
    if (el.hasAttribute("aria-label")) el.setAttribute("aria-label", label);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-view='sv']").forEach((el) => { el.textContent = t("source"); });
  document.querySelectorAll("[data-view='ir']").forEach((el) => { el.textContent = t("rendered"); });
  if (typeof syncToolbarI18n === "function") syncToolbarI18n();
  const currentLang = LANG_OPTIONS.find((item) => item.id === lang);
  const langLabel = document.getElementById("lang-select-label");
  if (langLabel && currentLang) langLabel.textContent = currentLang.name;
  const hidden = document.querySelector(".shell") && document.querySelector(".shell").classList.contains("sidebar-hidden");
  document.querySelectorAll(".sidebar-toggle").forEach((button) => {
    const label = hidden ? t("openWorkspace") : t("closeWorkspace");
    button.title = label;
    if (button.hasAttribute("aria-label")) button.setAttribute("aria-label", label);
  });
  syncWorkspaceToggle();
  syncOutlineToggle();
  if (typeof renderTree === "function") renderTree();
  if (typeof renderStatus === "function") renderStatus();
  if (typeof renderTabs === "function") renderTabs();
  if (typeof patchHeadingTips === "function") patchHeadingTips();
  if (typeof syncUntitledNames === "function") syncUntitledNames();
  if (typeof renderEncryptionSettings === "function") renderEncryptionSettings();
}
try {
  JSON.parse(localStorage.getItem("wengao-hidden") || "[]").forEach((path) => state.hidden.add(path));
} catch (error) {}

function pathHidden(path) {
  if (!path) return false;
  for (const hidden of state.hidden) {
    if (path === hidden || path.startsWith(hidden + "\\") || path.startsWith(hidden + "/")) return true;
  }
  return false;
}

function normalizeText(text) {
  return String(text == null ? "" : text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n+$/g, "\n");
}

function sameDoc(a, b) {
  if (a == null || b == null) return false;
  return normalizeText(a) === normalizeText(b);
}

function hasUnsavedChanges(text, saved) {
  // An empty draft has nothing to lose, even before its first save.
  if (saved == null) return !/^[\r\n]*$/.test(String(text == null ? "" : text));
  return !sameDoc(text, saved);
}

function encryptionChanged(tab) {
  return !!tab && (tab.encryptionKeyId || "") !== (tab.savedEncryptionKeyId || "");
}

function renderStatus() {
  fileName.textContent = state.name;
  const dot = document.getElementById("save-dot");
  if (dot) dot.className = "save-dot " + (state.dirty ? "is-dirty" : "is-saved");
  dirty.textContent = state.dirty ? t("unsaved") : t("saved");
  const active = state.tabs.find((tab) => tab.key === state.activeKey);
  if (active && active.unavailable) dirty.textContent += " · " + t("locationUnavailable");
  dirty.classList.toggle("is-dirty", state.dirty);
  if (typeof renderEncryptionSettings === "function") renderEncryptionSettings();
  document.title = "Tolcy Markdown";
}

function markDirty() {
  if (state.loading || !state.editor) return;
  const text = state.editor.getValue();
  if (!state.activeKey && !state.name) {
    if (text) ensureUntitled(text);
    return;
  }
  if (state.saved == null) {
    state.dirty = hasUnsavedChanges(text, state.saved);
  } else if (sameDoc(text, state.saved)) {
    // 已保存且未改动：绿色；顺带接纳编辑器换行规范化
    state.saved = text;
    state.dirty = false;
  } else {
    // 已修改未保存：橙色
    state.dirty = true;
  }
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  state.dirty = state.dirty || encryptionChanged(tab);
  if (tab) {
    tab.value = text;
    tab.saved = state.saved;
    tab.dirty = state.dirty;
  }
  renderStatus();
  renderTabs();
  scheduleOutline();
}

function untitledStem() {
  return t("untitled");
}

function isUntitledName(name) {
  if (!name) return false;
  const stems = Object.keys(I18N).map((id) => I18N[id].untitled).filter(Boolean);
  const escaped = stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp("^(" + escaped + ")(-\\d+)?\\.md$", "i").test(name);
}

function nextUntitledName() {
  const base = untitledStem();
  const used = new Set(state.tabs.map((item) => item.name));
  if (!used.has(base + ".md")) return base + ".md";
  let index = 2;
  while (used.has(base + "-" + index + ".md")) index += 1;
  return base + "-" + index + ".md";
}

function syncUntitledNames() {
  const base = untitledStem();
  let index = 1;
  state.tabs.forEach((tab) => {
    if (!isUntitledName(tab.name) || tab.filePath || tab.relPath) return;
    tab.name = index === 1 ? base + ".md" : base + "-" + index + ".md";
    index += 1;
  });
  if (isUntitledName(state.name) && !state.filePath && !state.relPath) {
    const active = state.tabs.find((item) => item.key === state.activeKey);
    state.name = active ? active.name : nextUntitledName();
  }
}

function ensureUntitled(text) {
  state.name = nextUntitledName();
  state.filePath = "";
  state.relPath = "";
  state.handle = null;
  state.saved = "";
  state.dirty = true;
  syncTab(text);
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  if (tab) tab.saved = "";
  state.saved = "";
  state.dirty = true;
  renderStatus();
}

function adoptSaved(text) {
  const previous = state.activeKey;
  const tab = state.tabs.find((item) => item.key === previous);
  state.saved = text;
  state.dirty = false;
  if (tab) {
    tab.name = state.name;
    tab.filePath = state.filePath;
    tab.relPath = state.relPath;
    tab.handle = state.handle;
    tab.value = text;
    tab.saved = text;
    if (state.filePath && tab.key !== state.filePath) {
      tab.key = state.filePath;
      state.activeKey = state.filePath;
    }
  }
  renderStatus();
  renderTabs();
}

function isDesktop() {
  return !!(window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
}

function invoke(command, args) {
  return window.__TAURI_INTERNALS__.invoke(command, args || {});
}

// A disconnected device must never hold the UI or a close request indefinitely.
function invokeFile(command, args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(t("locationUnavailable"));
      error.name = "FileTimeoutError";
      reject(error);
    }, timeoutMs);
    Promise.resolve().then(() => invoke(command, args)).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function readDesktopDocument(path) {
  const result = await invokeFile("read_text", { path }, 15000);
  return typeof result === "string" ? { text: result, keyId: "" } : result;
}

async function writeDocumentWithRecovery(tab, text, allowDiscard = false, forceSaveAs = false, encryptionKeyId = tab.encryptionKeyId || "") {
  let path = forceSaveAs ? "" : (tab.filePath || "");
  while (true) {
    if (!path) path = await invoke("save_file", { name: tab.name || t("untitled") + ".md", extension: "md" });
    if (!path) return null;
    try {
      await invokeFile("write_text", { path, contents: text, encryptionKeyId });
      return { path };
    } catch (error) {
      if (/^SM_/.test(typeof error === "string" ? error : (error && error.message) || "")) {
        await notice(errorText(error));
        return null;
      }
      if (path === tab.filePath) tab.unavailable = true;
      renderStatus();
      const choice = await askDialog({
        title: t("saveFailed"), message: t("saveElsewhere", { name: tab.name || t("untitled") }),
        okText: t("saveAs"), okValue: "save-as",
        extraText: allowDiscard ? t("discard") : "", extraValue: "discard",
        focusCancel: true,
      });
      if (choice === "discard") return { discard: true };
      if (choice !== "save-as") return null;
      path = "";
    }
  }
}

let loadGen = 0;

function load(text, name, handle, relPath, filePath, encryptionKeyId = "") {
  flushActiveTab();
  showEditor();
  const gen = ++loadGen;
  const body = text == null ? "" : String(text);
  state.loading = true;
  state.name = name;
  state.handle = handle || null;
  state.filePath = filePath || "";
  state.relPath = relPath || "";
  state.editor.setValue(body, true);
  // Vditor can reformat Markdown on load, including links and tables.
  state.saved = state.editor.getValue();
  state.dirty = false;
  syncTab(state.saved);
  const loadedTab = state.tabs.find((tab) => tab.key === state.activeKey);
  if (loadedTab) loadedTab.encryptionKeyId = loadedTab.savedEncryptionKeyId = encryptionKeyId || "";
  renderTabs();
  state.loading = false;
  renderTree();
  renderOutline();
  renderStatus();
  state.stamp = 0;
  if (state.filePath && isDesktop()) {
    invokeFile("file_stamp", { path: state.filePath }).then((stamp) => {
      if (gen === loadGen) state.stamp = stamp;
    }).catch(() => { if (gen === loadGen) state.stamp = 0; });
  }
}

function sortNodes(nodes) {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh");
  });
  return nodes;
}

async function listDirectory(handle, depth) {
  if (depth > 6) return [];
  const nodes = [];
  for await (const child of handle.values()) {
    const name = child.name;
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    if (child.kind === "directory") {
      const children = await listDirectory(child, depth + 1);
      if (!children.length) continue;
      nodes.push({ name, kind: "dir", handle: child, children, open: depth < 1 });
    } else if (MARKDOWN.test(name)) {
      nodes.push({ name, kind: "file", handle: child });
    }
  }
  return sortNodes(nodes);
}

function treeFromFileList(files) {
  const root = [];
  const dirs = new Map();
  const folderName = files.length ? files[0].webkitRelativePath.split("/")[0] : "";

  function ensure(parts) {
    let list = root;
    let key = "";
    parts.forEach((part, index) => {
      key = key ? key + "/" + part : part;
      let node = dirs.get(key);
      if (!node) {
        node = { name: part, kind: "dir", children: [], open: index < 1 };
        dirs.set(key, node);
        list.push(node);
        sortNodes(list);
      }
      list = node.children;
    });
    return list;
  }

  Array.from(files).forEach((file) => {
    if (!MARKDOWN.test(file.name)) return;
    const parts = (file.webkitRelativePath || file.name).split("/");
    const relative = parts.slice(1);
    if (!relative.length) return;
    const parent = ensure(relative.slice(0, -1));
    parent.push({ name: file.name, kind: "file", file });
    sortNodes(parent);
  });

  return { name: folderName || "文件夹", tree: root };
}

function treeIcon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  if (kind === "chevron-right" || kind === "chevron-down") {
    svg.setAttribute("class", "tree-chevron");
    path.setAttribute("d", kind === "chevron-down" ? "M3.5 6 L8 10.5 L12.5 6" : "M6 3.5 L10.5 8 L6 12.5");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }
  svg.setAttribute("class", "tree-icon");
  if (kind === "folder") {
    path.setAttribute("d", "M1.2 3.8c0-.7.5-1.2 1.2-1.2h3.2l1.2 1.3h6.8c.7 0 1.2.5 1.2 1.2v.5H1.2V3.8z");
    path.setAttribute("fill", "#E8A317");
    const front = document.createElementNS(svg.namespaceURI, "path");
    front.setAttribute("d", "M1.2 6.2h13.6v6.2c0 .7-.5 1.2-1.2 1.2H2.4c-.7 0-1.2-.5-1.2-1.2V6.2z");
    front.setAttribute("fill", "#FFCE3A");
    svg.append(path, front);
    return svg;
  }
  path.setAttribute("d", "M3 1.5h6.2L13 5.3V14c0 .4-.3.7-.7.7H3.7c-.4 0-.7-.3-.7-.7V2.2c0-.4.3-.7.7-.7z");
  path.setAttribute("fill", "var(--bg-elevated)");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1");
  const fold = document.createElementNS(svg.namespaceURI, "path");
  fold.setAttribute("d", "M9.2 1.6v3.2H12.4");
  fold.setAttribute("fill", "var(--hover)");
  fold.setAttribute("stroke", "currentColor");
  fold.setAttribute("stroke-width", "1");
  const line = document.createElementNS(svg.namespaceURI, "path");
  line.setAttribute("d", "M5 8.2h6M5 10.4h6M5 12.4h4");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#9cdcfe");
  line.setAttribute("stroke-width", "1");
  line.setAttribute("stroke-linecap", "round");
  svg.append(path, fold, line);
  return svg;
}

function fillTreeRow(button, node) {
  if (node.kind === "dir") {
    button.append(
      treeIcon(node.open ? "chevron-down" : "chevron-right"),
      treeIcon("folder")
    );
  } else {
    const spacer = document.createElement("span");
    spacer.className = "tree-chevron-spacer";
    button.append(spacer, treeIcon("file"));
  }
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = node.name;
  button.appendChild(label);
}

function renderNodes(nodes, prefix) {
  const ul = document.createElement("ul");
  nodes.forEach((node) => {
    if (pathHidden(node.path)) return;
    const path = prefix ? prefix + "/" + node.name : node.name;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    if (node.kind === "dir") {
      button.className = "dir";
      fillTreeRow(button, node);
      button.addEventListener("click", () => {
        node.open = !node.open;
        if (state.folders.some((folder) => folder.path === node.path)) {
          state.folders.find((folder) => folder.path === node.path).open = node.open;
        }
        renderTree();
      });
      button.addEventListener("contextmenu", (event) => openTreeMenu(event, node));
      li.appendChild(button);
      const childPrefix = state.folders.some((folder) => folder.path === node.path) ? "" : path;
      if (node.open) li.appendChild(renderNodes(node.children, childPrefix));
    } else {
      const currentFile = (node.path && state.filePath && node.path === state.filePath)
        || (!state.filePath && path === state.relPath)
        || (!state.filePath && state.name && node.name === state.name);
      button.className = "file" + (currentFile ? " is-current" : "");
      fillTreeRow(button, node);
      button.addEventListener("click", () => {
        openTreeFile(node, path).catch((error) => {
          if (error && error.name === "AbortError") return;
          notice(errorText(error) || t("openFailed"));
        });
      });
      button.addEventListener("contextmenu", (event) => openTreeMenu(event, node));
      li.appendChild(button);
    }
    ul.appendChild(li);
  });
  return ul;
}

function renderTree() {
  const tree = document.getElementById("tree");
  const folderName = document.getElementById("folder-name");
  tree.replaceChildren();
  if (!state.folders.length) {
    folderName.hidden = false;
    folderName.textContent = t("noFolder");
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("emptyTree");
    tree.appendChild(empty);
    return;
  }
  folderName.hidden = true;
  const roots = state.folders.map((folder) => ({
    name: folder.name,
    kind: "dir",
    path: folder.path,
    open: folder.open !== false,
    children: folder.tree,
  }));
  tree.appendChild(renderNodes(roots, ""));
}

function findTabForFile(node, path) {
  const filePath = node && node.path ? String(node.path) : "";
  if (filePath) {
    return state.tabs.find((item) => item.filePath === filePath || item.key === filePath) || null;
  }
  const rel = path || (node && node.name) || "";
  if (!rel) return null;
  return state.tabs.find((item) => !item.filePath && (item.relPath === rel || item.key === rel || item.name === rel)) || null;
}

async function openTreeFile(node, path) {
  const filePath = node.path ? String(node.path) : "";
  const existing = findTabForFile(node, path);
  if (existing) {
    if (filePath && isDesktop() && existing.key !== state.activeKey && !tabDirty(existing)) {
      try {
        const document = await readDesktopDocument(filePath);
        if (existing.key !== state.activeKey && !tabDirty(existing)) {
          existing.value = document.text;
          existing.saved = document.text;
          existing.encryptionKeyId = existing.savedEncryptionKeyId = document.keyId;
        }
      } catch (error) {}
    }
    switchTab(existing.key);
    return;
  }
  if (filePath && isDesktop()) {
    const document = await readDesktopDocument(filePath);
    const opened = findTabForFile(node, path);
    if (opened) switchTab(opened.key);
    else load(document.text, node.name || path, null, path, filePath, document.keyId);
    return;
  }
  let text = "";
  let handle = null;
  if (node.handle) {
    const file = await node.handle.getFile();
    text = await file.text();
    handle = node.handle;
  } else if (node.file) {
    text = await node.file.text();
  }
  load(text, node.name || path, handle, path, "");
}

function clearHiddenUnder(folder) {
  const root = String(folder || "");
  if (!root) return;
  let changed = false;
  for (const hidden of [...state.hidden]) {
    if (hidden === root || hidden.startsWith(root + "\\") || hidden.startsWith(root + "/")) {
      state.hidden.delete(hidden);
      changed = true;
    }
  }
  if (changed) {
    try { localStorage.setItem("wengao-hidden", JSON.stringify([...state.hidden])); } catch (error) {}
  }
}

async function addFolder(folder) {
  const tree = await invokeFile("list_workspace", { path: folder });
  const parts = String(folder).split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] || folder;
  clearHiddenUnder(folder);
  const existing = state.folders.find((item) => item.path === folder);
  if (existing) {
    existing.tree = tree;
    existing.open = true;
    existing.name = name;
  } else {
    state.folders.push({ name, path: folder, tree, open: true });
  }
  try { localStorage.setItem("wengao-folders", JSON.stringify(state.folders.map((item) => item.path))); } catch (error) {}
  renderTree();
}

async function openFolder() {
  if (isDesktop()) {
    const folder = await invoke("pick_folder");
    if (!folder) return;
    await addFolder(folder);
    setWorkspaceCollapsed(false);
    return;
  }
  if (window.showDirectoryPicker) {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    setWorkspaceCollapsed(false);
    state.workspace = {
      name: handle.name,
      handle,
      tree: await listDirectory(handle, 0),
    };
    renderTree();
    return;
  }
  document.getElementById("fallback-folder").click();
}

function flushActiveTab() {
  if (!state.editor || !state.activeKey) return;
  const current = state.tabs.find((item) => item.key === state.activeKey);
  if (!current) return;
  const live = state.editor.getValue();
  current.value = live;
  state.dirty = hasUnsavedChanges(live, state.saved) || encryptionChanged(current);
  current.dirty = state.dirty;
}

function markNeverSaved() {
  state.saved = null;
  const text = state.editor ? state.editor.getValue() : "";
  state.dirty = hasUnsavedChanges(text, state.saved);
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  if (tab) {
    tab.saved = null;
    tab.value = text;
    tab.dirty = state.dirty;
  }
  renderStatus();
  renderTabs();
}

async function createDocument() {
  if (state.loading || !state.editor) return;
  if (state.dirty && !await askDialog({ title: t("unsavedTitle"), message: t("stillNew") })) return;
  load("", nextUntitledName(), null, "", "");
  queueMicrotask(markNeverSaved);
}

function insertImages(files) {
  const list = Array.from(files);
  if (!list.length) return null;
  return (async () => {
    for (const file of list) {
      if (!file.type.startsWith("image/")) return t("imagesOnly");
      if (state.filePath && isDesktop()) {
        const parent = state.filePath.replace(/[\\/][^\\/]*$/, "");
        const safe = (file.name || "image.png").replace(/[^\w.\-\u4e00-\u9fff]/g, "_");
        const stored = Date.now() + "-" + safe;
        const path = parent + "\\assets\\" + stored;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const comma = dataUrl.indexOf(",");
        await invoke("write_base64", { path, data: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl });
        state.editor.insertValue("\n![" + file.name + "](assets/" + stored + ")\n");
      } else {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        state.editor.insertValue("\n![" + file.name + "](" + dataUrl + ")\n");
      }
    }
    return null;
  })().catch((error) => errorText(error) || t("imageFailed"));
}

function download(text, name) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function writeHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function saveAs() {
  if (!state.editor || state.loading) return;
  const text = state.editor.getValue();
  if (isDesktop()) {
    if (!state.activeKey) ensureUntitled(text);
    const tab = state.tabs.find((item) => item.key === state.activeKey);
    if (tab) await saveTabBeforeClose(tab, false, true);
    return;
  }
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: state.name,
      types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
    });
    await writeHandle(handle, text);
    state.handle = handle;
    state.name = (await handle.getFile()).name;
  } else {
    download(text, state.name.endsWith(".md") ? state.name : state.name + ".md");
  }
  adoptSaved(text);
}

async function save() {
  if (!state.editor || state.loading) return;
  const text = state.editor.getValue();
  if (!state.activeKey && !state.name) {
    if (!text) return;
    ensureUntitled(text);
  }
  if (isDesktop()) {
    const tab = state.tabs.find((item) => item.key === state.activeKey);
    if (tab) await saveTabBeforeClose(tab, false);
    return;
  }
  if (!state.handle) {
    await saveAs();
    return;
  }
  await writeHandle(state.handle, text);
  adoptSaved(text);
}

async function saveTabBeforeClose(tab, allowDiscard = true, forceSaveAs = false) {
  const active = tab.key === state.activeKey;
  const text = active ? state.editor.getValue() : (tab.value || "");
  const encryptionKeyId = tab.encryptionKeyId || "";
  let path = tab.filePath || "";
  let handle = tab.handle || null;
  let name = tab.name || t("untitled") + ".md";
  if (isDesktop()) {
    const result = await writeDocumentWithRecovery(tab, text, allowDiscard, forceSaveAs, encryptionKeyId);
    if (!result) return false;
    if (result.discard) return "discard";
    path = result.path;
    name = path.split(/[\\/]/).filter(Boolean).pop() || name;
    handle = null;
  } else {
    if (encryptionKeyId) throw new Error(t("encryptionDesktopOnly"));
    if (!handle && window.showSaveFilePicker) {
      handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      });
    }
    if (handle) {
      await writeHandle(handle, text);
      name = handle.name || name;
    } else {
      download(text, name.endsWith(".md") ? name : name + ".md");
    }
  }
  const stillActive = tab.key === state.activeKey;
  const latest = stillActive ? state.editor.getValue() : (tab.value || "");
  const relPath = path && path !== tab.filePath ? name : (tab.relPath || "");
  Object.assign(tab, { filePath: path, handle, name, relPath, value: latest, saved: text, savedEncryptionKeyId: encryptionKeyId, unavailable: false });
  tab.dirty = !sameDoc(latest, text) || encryptionChanged(tab);
  if (stillActive) {
    Object.assign(state, { filePath: path, handle, name, relPath });
    adoptSaved(text);
    // Keep edits made during an asynchronous write marked as unsaved.
    markDirty();
  }
  renderTabs();
  // Every successful native save can add a file, including a draft's first
  // Ctrl+S, Save As, recovery, and saving from the encryption settings.
  // Keep folder I/O outside the save/close path (a disconnected drive can hang).
  if (isDesktop() && state.folders.length) refreshWorkspace({ afterSave: true }).catch(() => {});
  return !tabDirty(tab);
}

async function confirmUnsavedClose(tabs) {
  const modified = tabs.filter(tabDirty);
  if (!modified.length) return true;
  const choice = await askDialog({
    title: t("closeUnsaved"),
    message: modified.length === 1
      ? t("saveBeforeClose", { name: modified[0].name || t("untitled") })
      : t("closeMultiple", { count: modified.length, names: modified.map((tab) => "• " + (tab.name || t("untitled"))).join("\n") }),
    okText: t("save"), okValue: "save",
    extraText: t("discard"), extraValue: "discard",
    focusCancel: true,
  });
  if (choice === "discard") return true;
  if (choice !== "save") return false;
  try {
    const discarded = new Set();
    for (const tab of modified) {
      const result = await saveTabBeforeClose(tab);
      if (!result) return false;
      if (result === "discard") discarded.add(tab);
    }
    return !tabs.some((tab) => !discarded.has(tab) && tabDirty(tab));
  } catch (error) {
    if (error && error.name === "AbortError") return false;
    await notice(errorText(error) || t("saveFailed"));
    return false;
  }
}

async function requestAppClose() {
  if (closing || closingTab || state.loading) return;
  closing = true;
  try {
    markDirty();
    flushActiveTab();
    const tabs = state.tabs.slice();
    if (await confirmUnsavedClose(tabs)) {
      // A newly opened document was not included in the user's close decision.
      if (!state.tabs.some((tab) => !tabs.includes(tab))) await invoke("finish_close");
    }
  } catch (error) {
    await notice(errorText(error));
  } finally {
    closing = false;
  }
}

async function openFile() {
  if (state.dirty && !await askDialog({ title: t("unsavedTitle"), message: t("stillOpen") })) return;
  if (!window.showOpenFilePicker) {
    fallbackOpen.click();
    return;
  }
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{
      description: "Markdown",
      accept: { "text/markdown": [".md", ".markdown"], "text/plain": [".txt"] },
    }],
  });
  const file = await handle.getFile();
  load(await file.text(), file.name, handle);
}

const THEMES = {
  dark: { ui: "dark", content: "dark", code: "monokai" },
  light: { ui: "classic", content: "light", code: "github" },
  paper: { ui: "classic", content: "light", code: "github" },
};

function themeName() {
  const name = document.documentElement.dataset.theme;
  return THEMES[name] ? name : "light";
}

function applyTheme(name) {
  if (!THEMES[name]) name = "light";
  document.documentElement.dataset.theme = name;
  try { localStorage.setItem("wengao-theme", name); } catch (error) {}
  const spec = THEMES[name];
  if (state.editor && state.editor.setTheme) state.editor.setTheme(spec.ui, spec.content, spec.code);
  if (isDesktop()) {
    invoke("set_window_theme", { theme: name === "dark" ? "dark" : "light" }).catch(() => {});
  }
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeChoice === name);
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === name));
  });
}

function createEditor() {
  state.loading = true;
  const spec = THEMES[themeName()];
  state.editor = new Vditor("editor", {
    cdn: location.origin + "/vendor/vditor",
    mode: "ir",
    theme: spec.ui,
    lang: { zh: "zh_CN", "zh-TW": "zh_TW", en: "en_US", de: "de_DE", fr: "fr_FR", pt: "pt_BR", es: "es_ES", ja: "ja_JP", ko: "ko_KR", ru: "ru_RU", vi: "vi_VN" }[lang] || "en_US",
    height: "100%",
    value: "",
    cache: { enable: false },
    placeholder: t("placeholder"),
    link: { isOpen: false },
    preview: {
      mode: "editor",
      actions: [],
    },
    toolbar: [
      "headings", "bold", "italic", "strike", "link", "|",
      "list", "ordered-list", "check", "quote", "code", "inline-code", "table", "|",
      "undo", "redo", "upload", "|",
      "edit-mode",
      {
        name: "view-switch",
        className: "view-switch",
        tip: t("sourceTip"),
        icon: '<span class="view-switch-ui"><span data-view="sv">' + t("source") + '</span><span data-view="ir" class="is-current">' + t("rendered") + '</span></span>',
        click(event) {
          const target = event.target.closest("[data-view]");
          if (!target || !state.editor) return;
          const mode = target.getAttribute("data-view");
          const edit = state.editor.vditor.toolbar.elements["edit-mode"];
          const button = edit && edit.querySelector('button[data-mode="' + mode + '"]');
          if (button) button.click();
          syncViewSwitch();
        },
      },
    ],
    counter: {
      enable: true,
      type: "text",
      after(length) {
        count.textContent = length + " " + t("chars");
      },
    },
    upload: {
      accept: "image/*",
      handler: insertImages,
    },
    input: markDirty,
    after() {
      applyTheme(themeName());
      state.loading = false;
      showBlank();
      state.editor.focus();
      syncViewSwitch();
      applyI18n();
      placeCount();
      restoreLastFolder().then(listenForLaunchFiles);
      applySpellcheck();
      patchHeadingTips();
      const headings = state.editor.vditor.toolbar && state.editor.vditor.toolbar.elements
        ? state.editor.vditor.toolbar.elements.headings
        : null;
      if (headings) headings.addEventListener("click", () => setTimeout(patchHeadingTips, 0));
    },
  });
}

function syncViewSwitch() {
  if (!state.editor) return;
  const view = state.editor.getCurrentMode() === "sv" ? "sv" : "ir";
  document.querySelectorAll(".view-switch-ui [data-view]").forEach((item) => {
    item.classList.toggle("is-current", item.getAttribute("data-view") === view);
  });
}

function syncToolbarI18n() {
  document.querySelectorAll("[data-view='sv']").forEach((el) => { el.textContent = t("source"); });
  document.querySelectorAll("[data-view='ir']").forEach((el) => { el.textContent = t("rendered"); });
  const tip = t("sourceTip");
  document.querySelectorAll(".vditor-toolbar__item.view-switch button, .vditor-toolbar__item.view-switch [class*='tooltipped']").forEach((el) => {
    el.title = tip;
    el.setAttribute("aria-label", tip);
    if (el.hasAttribute("data-tip")) el.setAttribute("data-tip", tip);
  });
  // Vditor 有时把 tip 渲成可见文案，一并替换各语言旧文案
  const tipValues = Object.keys(I18N).map((id) => I18N[id].sourceTip).filter(Boolean);
  document.querySelectorAll(".vditor-toolbar__item.view-switch").forEach((item) => {
    item.querySelectorAll("span, button, div").forEach((el) => {
      if (el.closest(".view-switch-ui")) return;
      const text = (el.textContent || "").trim();
      if (tipValues.includes(text)) el.textContent = tip;
    });
  });
  if (state.editor && state.editor.vditor && state.editor.vditor.options) {
    state.editor.vditor.options.placeholder = t("placeholder");
  }
  document.querySelectorAll(".vditor-ir .vditor-reset[placeholder], .vditor-sv textarea, .vditor-wysiwyg .vditor-reset[placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t("placeholder"));
  });
  if (count && state.editor) {
    try {
      const length = state.editor.getValue().length;
      count.textContent = length + " " + t("chars");
    } catch (error) {}
  }
}

function placeCount() {
  const bar = document.querySelector(".vditor-toolbar");
  const find = document.getElementById("find-bar");
  if (bar && find) bar.appendChild(find);
}

function syncWorkspaceToggle() {
  const sidebar = document.getElementById("sidebar");
  const button = document.getElementById("toggle-workspace");
  if (!sidebar || !button) return;
  const collapsed = sidebar.classList.contains("workspace-collapsed");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = t(collapsed ? "expandWorkspace" : "collapseWorkspace");
  button.setAttribute("aria-label", button.title);
}

function setWorkspaceCollapsed(collapsed) {
  document.getElementById("sidebar").classList.toggle("workspace-collapsed", collapsed);
  syncWorkspaceToggle();
  try { localStorage.setItem("wengao-workspace-collapsed", collapsed ? "1" : "0"); } catch (error) {}
}

document.getElementById("toggle-workspace").addEventListener("click", () => {
  setWorkspaceCollapsed(!document.getElementById("sidebar").classList.contains("workspace-collapsed"));
});
try {
  if (localStorage.getItem("wengao-workspace-collapsed") === "1") setWorkspaceCollapsed(true);
} catch (error) {}

function syncOutlineToggle() {
  const sidebar = document.getElementById("sidebar");
  const button = document.getElementById("toggle-outline");
  if (!sidebar || !button) return;
  const collapsed = sidebar.classList.contains("outline-collapsed");
  button.setAttribute("aria-expanded", String(!collapsed));
  button.title = t(collapsed ? "expandOutline" : "collapseOutline");
  button.setAttribute("aria-label", button.title);
}

function setOutlineCollapsed(collapsed) {
  document.getElementById("sidebar").classList.toggle("outline-collapsed", collapsed);
  syncOutlineToggle();
  try { localStorage.setItem("wengao-outline-collapsed", collapsed ? "1" : "0"); } catch (error) {}
}
document.getElementById("toggle-outline").addEventListener("click", () => {
  setOutlineCollapsed(!document.getElementById("sidebar").classList.contains("outline-collapsed"));
});
try {
  if (localStorage.getItem("wengao-outline-collapsed") === "1") setOutlineCollapsed(true);
} catch (error) {}

function setSidebarHidden(hidden) {
  document.querySelector(".shell").classList.toggle("sidebar-hidden", hidden);
  document.querySelectorAll(".sidebar-toggle").forEach((button) => {
    button.classList.toggle("is-closed", hidden);
    button.title = hidden ? t("openWorkspace") : t("closeWorkspace");
    button.setAttribute("aria-pressed", hidden ? "false" : "true");
  });
  try { localStorage.setItem("wengao-sidebar-hidden", hidden ? "1" : "0"); } catch (error) {}
}

document.querySelectorAll(".sidebar-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    setSidebarHidden(!document.querySelector(".shell").classList.contains("sidebar-hidden"));
  });
});

try {
  if (localStorage.getItem("wengao-sidebar-hidden") === "1") setSidebarHidden(true);
} catch (error) {}

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.settingsTab;
    document.querySelectorAll("[data-settings-tab]").forEach((item) => {
      item.classList.toggle("is-current", item === button);
    });
    document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== name;
    });
  });
});

document.getElementById("new-file").addEventListener("click", () => {
  createDocument().catch((error) => {
    notice(errorText(error) || t("newFailed"));
  });
});

document.getElementById("open-folder").addEventListener("click", () => {
  openFolder().catch((error) => {
    if (error && error.name === "AbortError") return;
    notice(errorText(error) || t("openFolderFailed"));
  });
});

document.getElementById("fallback-folder").addEventListener("change", () => {
  const input = document.getElementById("fallback-folder");
  const files = input.files ? Array.from(input.files) : [];
  input.value = "";
  if (!files.length) return;
  const built = treeFromFileList(files);
  setWorkspaceCollapsed(false);
  state.workspace = { name: built.name, handle: null, tree: built.tree };
  renderTree();
});

document.getElementById("open-file").addEventListener("click", () => {
  openFile().catch((error) => {
    if (error && error.name === "AbortError") return;
    notice(errorText(error) || t("openFailed"));
  });
});

document.getElementById("save-file").addEventListener("click", () => {
  save().catch((error) => {
    if (error && error.name === "AbortError") return;
    notice(errorText(error) || t("saveFailed"));
  });
});

document.getElementById("save-as").addEventListener("click", () => {
  saveAs().catch((error) => {
    if (error && error.name === "AbortError") return;
    notice(errorText(error) || t("saveAsFailed"));
  });
});

fallbackOpen.addEventListener("change", () => {
  const file = fallbackOpen.files && fallbackOpen.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => load(String(reader.result || ""), file.name, null);
  reader.readAsText(file);
  fallbackOpen.value = "";
});

function clickToolbar(name) {
  if (!state.editor || !state.editor.vditor) return false;
  const item = state.editor.vditor.toolbar && state.editor.vditor.toolbar.elements
    ? state.editor.vditor.toolbar.elements[name]
    : null;
  const button = item && (item.querySelector("button") || item);
  if (!button) return false;
  button.click();
  return true;
}
function wrapOrInsert(marker) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  if (!state.editor || !state.editor.vditor) return;
  const root = state.editor.vditor[state.editor.vditor.currentMode].element;
  if (!root.contains(selection.anchorNode) && !root.contains(document.activeElement)) {
    root.focus();
  }
  if (!selection.isCollapsed) {
    document.execCommand("insertText", false, marker + selection.toString() + marker);
    return;
  }
  document.execCommand("insertText", false, marker + marker);
  requestAnimationFrame(() => placeCaretBack([...marker].length));
}
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const command = event.ctrlKey || event.metaKey;
  if (command && key === "s" && !event.shiftKey) {
    event.preventDefault();
    save().catch(() => {});
  } else if (command && key === "f") {
    event.preventDefault();
    openFind(true);
  } else if (command && key === "h" && event.shiftKey) {
    event.preventDefault();
    openFind(true);
  } else if (command && key === "h" && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    openHeadingJump();
  } else if (command && key === "p" && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    openQuick();
  } else if (command && event.shiftKey && key === "i") {
    event.preventDefault();
    document.getElementById("count").click();
  } else if (command && key === "b" && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    event.stopImmediatePropagation();
    wrapOrInsert("**");
  } else if (command && key === "i" && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    event.stopImmediatePropagation();
    wrapOrInsert("*");
  } else if (command && key === "d" && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    event.stopImmediatePropagation();
    wrapOrInsert("~~");
  } else if (command && !event.shiftKey && !event.altKey && /^[1-6]$/.test(key)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    applyHeadingLevel(Number(key));
  }
}, true);

function applyHeadingLevel(level) {
  if (!state.editor || !state.editor.vditor) return;
  setHeadingByMarkdown(level);
}
function currentMarkdownLineIndex() {
  if (!state.editor) return 0;
  const lines = state.editor.getValue().split("\n");
  const selection = window.getSelection();
  const selected = selection && selection.toString().trim();
  if (selected) {
    const index = lines.findIndex((line) => line.replace(/^#{1,6}\s+/, "").trim() === selected || line.includes(selected));
    if (index >= 0) return index;
  }
  let node = selection && selection.anchorNode;
  while (node && node.nodeType === 3) node = node.parentElement;
  while (node && node !== document.body) {
    if (node.nodeType === 1 && /^H[1-6]$/i.test(node.tagName)) {
      const title = (node.textContent || "").replace(/^#+\s*/, "").trim();
      const index = lines.findIndex((line) => line.replace(/^#{1,6}\s+/, "").trim() === title);
      if (index >= 0) return index;
      break;
    }
    const text = (node.textContent || "").trim().split("\n")[0];
    if (text) {
      const index = lines.findIndex((line) => line.replace(/^#{1,6}\s+/, "").trim() === text || line.trim() === text);
      if (index >= 0) return index;
    }
    if (node.parentElement === state.editor.vditor[state.editor.vditor.currentMode].element) break;
    node = node.parentElement;
  }
  return 0;
}
function setHeadingByMarkdown(level) {
  if (!state.editor) return;
  const lines = state.editor.getValue().split("\n");
  const index = currentMarkdownLineIndex();
  const body = (lines[index] || "").replace(/^#{1,6}\s*/, "");
  lines[index] = "#".repeat(level) + (body ? " " + body : " ");
  state.loading = true;
  state.editor.setValue(lines.join("\n"), true);
  state.loading = false;
  markDirty();
  renderOutline();
}
function patchHeadingTips() {
  const tipKeys = [
    [/^(标题|Heading|Überschrift|Titre|Título|見出し|제목|Заголовок)/i, "headingLevel"],
    [/^(粗体|加粗|Bold|Fett|Gras|Negrita|太字|굵게|Жирный)/i, "bold"],
    [/^(斜体|Italic|Kursiv|Italique|Cursiva|斜体|기울임|Курсив)/i, "italic"],
    [/^(删除线|Strike|Durchgestrichen|Barré|Tachado|取り消し|취소선|Зачёркнутый)/i, "strike"],
    [/^(链接|Link|Lien|Enlace|リンク|링크|Ссылка)/i, "link"],
    [/^(无序|Bullet|Aufzählung|Liste à puces|Viñetas|箇条書き|글머리|Маркированный)/i, "bulletList"],
    [/^(有序|Ordered|Numbered|Nummerierte|Liste numérotée|Numerada|番号付き|번호|Нумерованный)/i, "orderedList"],
    [/^(任务|Task|Check|Aufgaben|Tâches|Tareas|タスク|할 일|Задачи)/i, "checkList"],
    [/^(引用|Quote|Zitat|Citation|Cita|引用|인용|Цитата)/i, "quote"],
    [/^(代码块|Code block|Codeblock|Bloc de code|Bloque de código|コードブロック|코드 블록|Блок кода)/i, "codeBlock"],
    [/^(行内代码|Inline code|Inline-Code|Code en ligne|Código en línea|インライン|인라인|Инлайн)/i, "inlineCode"],
    [/^(表格|Table|Tabelle|Tableau|Tabla|表|표|Таблица)/i, "table"],
    [/^(撤销|Undo|Rückgängig|Annuler|Deshacer|元に戻す|실행 취소|Отменить)/i, "undo"],
    [/^(重做|Redo|Wiederholen|Rétablir|Rehacer|やり直し|다시 실행|Повторить)/i, "redo"],
    [/^(上传|Upload|Hochladen|Téléverser|Subir|アップロード|업로드|Загрузить)/i, "upload"],
  ];
  document.querySelectorAll(".vditor-hint button, .vditor-toolbar .vditor-tooltipped").forEach((el) => {
    ["aria-label", "title", "data-tip"].forEach((attr) => {
      let value = el.getAttribute(attr);
      if (!value) return;
      value = value.replace(/Alt\+Ctrl\+(\d)/g, "Ctrl+$1").replace(/⌥⌘(\d)/g, "Ctrl+$1");
      for (const [re, key] of tipKeys) {
        if (re.test(value)) {
          const shortcut = (value.match(/<[^>]+>/) || [""])[0];
          value = t(key) + (shortcut ? " " + shortcut : "");
          break;
        }
      }
      el.setAttribute(attr, value);
    });
    if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
      el.firstChild.textContent = el.firstChild.textContent.replace(/Alt\+Ctrl\+(\d)/g, "Ctrl+$1");
    }
  });
}

let findAt = 0;
function openFind(withReplace = true) {
  const bar = document.getElementById("find-bar");
  bar.hidden = false;
  document.getElementById("replace-input").hidden = !withReplace;
  document.getElementById("replace-one").hidden = !withReplace;
  document.getElementById("replace-all").hidden = !withReplace;
  document.getElementById("replace-workspace").hidden = !withReplace || !state.folders.length;
  document.getElementById("find-input").focus();
  findAt = 0;
  showFindCount();
}
function findPattern(query) {
  if (!query) return null;
  const regexOn = document.getElementById("find-regex").checked;
  try {
    if (regexOn) return new RegExp(query, "giu");
    return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu");
  } catch (error) {
    return null;
  }
}
function matchSpans(text, query) {
  const spans = [];
  const pattern = findPattern(query);
  if (!pattern) return spans;
  pattern.lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (!match[0].length) {
      pattern.lastIndex += 1;
      continue;
    }
    spans.push({ index: match.index, length: match[0].length, text: match[0] });
    if (!pattern.global) break;
  }
  return spans;
}
function showFindCount() {
  const label = document.getElementById("find-count");
  const query = document.getElementById("find-input").value;
  if (query && !findPattern(query)) {
    label.textContent = "!";
    clearFindPaint();
    return;
  }
  const ranges = findRanges();
  if (!ranges.length) {
    label.textContent = "0";
    clearFindPaint();
    return;
  }
  if (findAt >= ranges.length) findAt = 0;
  label.textContent = (findAt + 1) + "/" + ranges.length;
  paintFind(ranges);
}
function findRanges() {
  const ranges = [];
  if (!state.editor || !state.editor.vditor) return ranges;
  const query = document.getElementById("find-input").value;
  const pattern = findPattern(query);
  if (!pattern) return ranges;
  const root = state.editor.vditor[state.editor.vditor.currentMode].element;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.textContent || "";
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(value))) {
      if (!match[0].length) {
        pattern.lastIndex += 1;
        continue;
      }
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, Math.min(value.length, match.index + match[0].length));
      ranges.push(range);
      if (!pattern.global) break;
    }
    node = walker.nextNode();
  }
  return ranges;
}
function clearFindPaint() {
  if (window.CSS && CSS.highlights) {
    CSS.highlights.delete("find-all");
    CSS.highlights.delete("find-current");
  }
}
function paintFind(ranges) {
  const current = ranges[findAt];
  if (window.Highlight && window.CSS && CSS.highlights) {
    CSS.highlights.set("find-all", new Highlight(...ranges));
    CSS.highlights.set("find-current", new Highlight(current));
  }
  const node = current.startContainer;
  (node.parentElement || node).scrollIntoView({ block: "center" });
}
function revealFind() {
  const ranges = findRanges();
  if (!ranges.length) { clearFindPaint(); return; }
  if (findAt >= ranges.length) findAt = 0;
  paintFind(ranges);
}
function stepFind(delta) {
  const ranges = findRanges();
  if (!ranges.length) { showFindCount(); return; }
  findAt = (findAt + delta + ranges.length) % ranges.length;
  showFindCount();
}
document.getElementById("find-input").addEventListener("input", () => { findAt = 0; showFindCount(); });
document.getElementById("find-regex").addEventListener("change", () => { findAt = 0; showFindCount(); });
document.getElementById("find-input").addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFind();
  else if (event.key === "ArrowDown" || (event.key === "Enter" && !event.shiftKey)) { event.preventDefault(); stepFind(1); }
  else if (event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey)) { event.preventDefault(); stepFind(-1); }
});
document.getElementById("replace-input").addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFind();
  else if (event.key === "ArrowDown") { event.preventDefault(); stepFind(1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); stepFind(-1); }
});
document.getElementById("find-next").addEventListener("click", () => stepFind(1));
document.getElementById("find-prev").addEventListener("click", () => stepFind(-1));
function closeFind() {
  const bar = document.getElementById("find-bar");
  bar.hidden = true;
  document.getElementById("find-input").value = "";
  clearFindPaint();
  const label = document.getElementById("find-count");
  if (label) label.textContent = "";
}
document.getElementById("find-close").addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  closeFind();
});
document.getElementById("replace-one").addEventListener("click", () => {
  const query = document.getElementById("find-input").value;
  if (!query || !state.editor) return;
  if (!findPattern(query)) { notice(t("invalidRegex")); return; }
  const text = state.editor.getValue();
  const spans = matchSpans(text, query);
  if (!spans.length) return;
  const hit = spans[Math.min(findAt, spans.length - 1)];
  const replacement = document.getElementById("replace-input").value;
  const next = text.slice(0, hit.index) + replacement + text.slice(hit.index + hit.length);
  state.loading = true;
  state.editor.setValue(next, true);
  state.loading = false;
  markDirty();
  showFindCount();
});
document.getElementById("replace-all").addEventListener("click", () => {
  const query = document.getElementById("find-input").value;
  if (!query || !state.editor) return;
  const pattern = findPattern(query);
  if (!pattern) { notice(t("invalidRegex")); return; }
  const source = state.editor.getValue();
  const replacement = document.getElementById("replace-input").value;
  state.loading = true;
  state.editor.setValue(source.replace(pattern, replacement), true);
  state.loading = false;
  markDirty();
  findAt = 0;
  showFindCount();
});
document.getElementById("replace-workspace").addEventListener("click", () => {
  replaceInWorkspace().catch((error) => notice(errorText(error)));
});
async function replaceInWorkspace() {
  const query = document.getElementById("find-input").value;
  const pattern = findPattern(query);
  if (!pattern) { notice(t("invalidRegex")); return; }
  if (!isDesktop() || !state.folders.length) { notice(t("searchNeedFolder")); return; }
  const files = workspaceFiles();
  if (!await askDialog({ title: t("replaceWorkspace"), message: t("replaceWorkspaceHint", { count: files.length }) })) return;
  const replacement = document.getElementById("replace-input").value;
  let filesHit = 0;
  let hits = 0;
  for (const file of files) {
    let text = "";
    try { text = (await readDesktopDocument(file.path)).text; } catch (error) { continue; }
    const spans = matchSpans(text, query);
    if (!spans.length) continue;
    const next = text.replace(findPattern(query), replacement);
    if (next === text) continue;
    await invokeFile("write_text", { path: file.path, contents: next });
    filesHit += 1;
    hits += spans.length;
    if (state.filePath === file.path && state.editor) {
      state.loading = true;
      state.editor.setValue(next, true);
      state.loading = false;
      adoptSaved(state.editor.getValue());
      markDirty();
    }
  }
  notice(t("replaceWorkspaceDone", { files: filesHit, hits }));
  showFindCount();
}

let quickIndex = 0;
function workspaceFiles() {
  const files = [];
  const walk = (nodes) => {
    (nodes || []).forEach((node) => {
      if (node.kind === "dir") walk(node.children);
      else if (node.path) files.push(node);
    });
  };
  state.folders.forEach((folder) => walk(folder.tree));
  return files;
}
function quickPathLabel(file) {
  const path = String(file.path || "");
  const roots = state.folders.map((folder) => folder.path);
  for (const root of roots) {
    if (path === root) return file.name;
    if (path.startsWith(root + "\\") || path.startsWith(root + "/")) {
      return path.slice(root.length + 1).replace(/\\/g, "/");
    }
  }
  return path.replace(/\\/g, "/") || file.name;
}
function renderQuick() {
  const query = document.getElementById("quick-input").value.trim().toLowerCase();
  const list = document.getElementById("quick-list");
  const files = workspaceFiles().filter((file) => {
    if (!query) return true;
    const label = quickPathLabel(file).toLowerCase();
    return file.name.toLowerCase().includes(query) || label.includes(query);
  }).slice(0, 30);
  if (quickIndex >= files.length) quickIndex = 0;
  list.replaceChildren();
  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = state.folders.length ? t("noMatch") : t("searchNeedFolder");
    list.appendChild(empty);
    return files;
  }
  files.forEach((file, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-item" + (index === quickIndex ? " is-current" : "");
    const title = document.createElement("strong");
    title.textContent = file.name;
    const path = document.createElement("small");
    path.textContent = quickPathLabel(file);
    button.appendChild(title);
    button.appendChild(path);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      closeQuick();
      openTreeFile(file, file.name).catch(() => {});
    });
    item.appendChild(button);
    list.appendChild(item);
  });
  return files;
}
function openQuick() {
  closeHeadingJump();
  const palette = document.getElementById("quick-open");
  palette.hidden = false;
  document.getElementById("quick-input").value = "";
  quickIndex = 0;
  renderQuick();
  document.getElementById("quick-input").focus();
}
function closeQuick() {
  document.getElementById("quick-open").hidden = true;
}

let headingIndex = 0;
function documentHeadings() {
  if (!state.editor) return [];
  const lines = state.editor.getValue().split("\n");
  const counts = new Map();
  const items = [];
  lines.forEach((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) return;
    const level = match[1].length;
    const title = match[2];
    const key = match[1] + " " + title;
    const occurrence = (counts.get(key) || 0) + 1;
    counts.set(key, occurrence);
    items.push({ level, title, occurrence, label: "#".repeat(level) + " " + title });
  });
  return items;
}
function renderHeadingJump() {
  const query = document.getElementById("heading-input").value.trim().toLowerCase();
  const list = document.getElementById("heading-list");
  const items = documentHeadings().filter((item) => !query || item.title.toLowerCase().includes(query) || item.label.toLowerCase().includes(query));
  if (headingIndex >= items.length) headingIndex = 0;
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = t("noMatch");
    list.appendChild(empty);
    return items;
  }
  items.forEach((item, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-item" + (index === headingIndex ? " is-current" : "");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const path = document.createElement("small");
    path.textContent = "H" + item.level;
    button.appendChild(title);
    button.appendChild(path);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      closeHeadingJump();
      jumpToHeading(item.title, item.level, item.occurrence);
    });
    li.appendChild(button);
    list.appendChild(li);
  });
  return items;
}
function openHeadingJump() {
  closeQuick();
  const palette = document.getElementById("heading-open");
  palette.hidden = false;
  document.getElementById("heading-input").value = "";
  headingIndex = 0;
  renderHeadingJump();
  document.getElementById("heading-input").focus();
}
function closeHeadingJump() {
  const palette = document.getElementById("heading-open");
  if (palette) palette.hidden = true;
}
document.getElementById("heading-input").addEventListener("input", () => { headingIndex = 0; renderHeadingJump(); });
document.getElementById("heading-input").addEventListener("keydown", (event) => {
  const items = renderHeadingJump();
  if (event.key === "ArrowDown") { event.preventDefault(); headingIndex = items.length ? (headingIndex + 1) % items.length : 0; renderHeadingJump(); }
  else if (event.key === "ArrowUp") { event.preventDefault(); headingIndex = items.length ? (headingIndex - 1 + items.length) % items.length : 0; renderHeadingJump(); }
  else if (event.key === "Enter") {
    event.preventDefault();
    const item = items[headingIndex];
    closeHeadingJump();
    if (item) jumpToHeading(item.title, item.level, item.occurrence);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeHeadingJump();
  }
});
document.addEventListener("mousedown", (event) => {
  const palette = document.getElementById("heading-open");
  if (!palette || palette.hidden || palette.contains(event.target)) return;
  closeHeadingJump();
});
document.addEventListener("keydown", (event) => {
  const palette = document.getElementById("heading-open");
  if (!palette || palette.hidden || event.key !== "Escape") return;
  event.preventDefault();
  closeHeadingJump();
}, true);
document.getElementById("quick-input").addEventListener("input", () => { quickIndex = 0; renderQuick(); });
document.getElementById("quick-input").addEventListener("keydown", (event) => {
  const files = renderQuick();
  if (event.key === "ArrowDown") { event.preventDefault(); quickIndex = files.length ? (quickIndex + 1) % files.length : 0; renderQuick(); }
  else if (event.key === "ArrowUp") { event.preventDefault(); quickIndex = files.length ? (quickIndex - 1 + files.length) % files.length : 0; renderQuick(); }
  else if (event.key === "Enter") {
    event.preventDefault();
    const file = files[quickIndex];
    closeQuick();
    if (file) openTreeFile(file, file.name).catch(() => {});
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeQuick();
  }
});
document.addEventListener("mousedown", (event) => {
  const palette = document.getElementById("quick-open");
  if (!palette || palette.hidden || palette.contains(event.target)) return;
  closeQuick();
});
document.addEventListener("keydown", (event) => {
  const palette = document.getElementById("quick-open");
  if (!palette || palette.hidden || event.key !== "Escape") return;
  event.preventDefault();
  closeQuick();
}, true);

const focusBox = document.getElementById("focus-mode");
const typeBox = document.getElementById("typewriter-mode");
const spellBox = document.getElementById("spellcheck");
try {
  focusBox.checked = localStorage.getItem("wengao-focus") === "1";
  typeBox.checked = localStorage.getItem("wengao-typewriter") === "1";
  spellBox.checked = localStorage.getItem("wengao-spell") === "1";
} catch (error) {}
function spellLang() {
  const map = { zh: "zh-CN", "zh-TW": "zh-TW", en: "en", de: "de", fr: "fr", pt: "pt", es: "es", ja: "ja", ko: "ko", ru: "ru", ar: "ar", hi: "hi", id: "id", vi: "vi", it: "it", tr: "tr" };
  return map[lang] || "en";
}
function applySpellcheck() {
  const on = !!spellBox.checked;
  document.body.spellcheck = on;
  const code = spellLang();
  document.querySelectorAll("[contenteditable], .vditor-ir, .vditor-wysiwyg, .vditor-sv, textarea").forEach((el) => {
    el.setAttribute("spellcheck", on ? "true" : "false");
    el.setAttribute("lang", code);
  });
  try { localStorage.setItem("wengao-spell", on ? "1" : "0"); } catch (error) {}
}
function saveWritingModes() {
  document.body.classList.toggle("focus-mode", focusBox.checked);
  document.body.classList.toggle("typewriter-mode", typeBox.checked);
  try {
    localStorage.setItem("wengao-focus", focusBox.checked ? "1" : "0");
    localStorage.setItem("wengao-typewriter", typeBox.checked ? "1" : "0");
  } catch (error) {}
  applySpellcheck();
}
focusBox.addEventListener("change", saveWritingModes);
typeBox.addEventListener("change", saveWritingModes);
spellBox.addEventListener("change", applySpellcheck);
saveWritingModes();
function writingBlock() {
  if (!state.editor || !state.editor.vditor) return null;
  const root = state.editor.vditor[state.editor.vditor.currentMode].element;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  let node = selection.anchorNode;
  if (!node || !root.contains(node)) return null;
  if (node.nodeType === 3) node = node.parentElement;
  while (node && node.parentElement !== root) node = node.parentElement;
  return node;
}
document.addEventListener("selectionchange", () => {
  if (!focusBox.checked && !typeBox.checked) return;
  const block = writingBlock();
  if (!block || !block.parentElement) return;
  if (focusBox.checked) {
    [...block.parentElement.children].forEach((child) => child.classList.toggle("is-active-block", child === block));
  }
  if (typeBox.checked) {
    const scroller = document.querySelector(".vditor-content");
    if (!scroller) return;
    const rect = block.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    scroller.scrollTop += rect.top - box.top - box.height / 3;
  }
});

const PAIRS = {
  "(": ")", "[": "]", "{": "}", "\"": "\"", "'": "'",
  "`": "`", "*": "*", "_": "_", "~": "~",
  "（": "）", "【": "】", "「": "」", "『": "』", "《": "》", "〈": "〉", "｛": "｝", "［": "］",
};
function placeCaretBack(chars) {
  const sel = window.getSelection();
  if (!sel || chars <= 0) return;
  for (let i = 0; i < chars; i += 1) {
    try { sel.modify("move", "backward", "character"); } catch (error) { break; }
  }
}
function textParts(root) {
  const parts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let start = 0;
  while (node) {
    const text = node.textContent || "";
    if (text) {
      parts.push({ node, text, start });
      start += text.length;
    }
    node = walker.nextNode();
  }
  return parts;
}
function caretAbsolute(parts, sel) {
  if (!sel || !sel.rangeCount || !parts.length) return parts.reduce((sum, part) => sum + part.text.length, 0);
  const node = sel.anchorNode;
  const offset = sel.anchorOffset;
  for (const part of parts) {
    if (part.node === node) return part.start + offset;
    if (node && node.nodeType === 1 && part.node.parentElement === node) {
      return part.start + Math.min(offset, part.text.length);
    }
  }
  return parts[parts.length - 1].start + parts[parts.length - 1].text.length;
}
function placeCaretBetweenPair(open, closer) {
  const root = editorPairRoot();
  const sel = window.getSelection();
  if (!root || !sel) return;
  const parts = textParts(root);
  if (!parts.length) {
    placeCaretBack([...closer].length);
    return;
  }
  const full = parts.map((part) => part.text).join("");
  const needle = open + closer;
  const abs = caretAbsolute(parts, sel);
  let index = -1;
  let from = 0;
  while (from <= full.length) {
    const found = full.indexOf(needle, from);
    if (found < 0) break;
    if (found <= abs) index = found;
    from = found + 1;
  }
  if (index < 0) index = full.lastIndexOf(needle);
  if (index < 0) {
    placeCaretBack([...closer].length);
    return;
  }
  const mid = index + [...open].length;
  for (const part of parts) {
    if (mid > part.start + part.text.length) continue;
    const local = mid - part.start;
    try {
      const range = document.createRange();
      range.setStart(part.node, local);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      root.focus();
    } catch (error) {
      placeCaretBack([...closer].length);
    }
    return;
  }
  placeCaretBack([...closer].length);
}
let pairLock = false;
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function insertPair(open, closer, selection) {
  if (pairLock) return false;
  if (!selection || !selection.rangeCount) return false;
  pairLock = true;
  setTimeout(() => { pairLock = false; }, 80);
  if (!selection.isCollapsed) {
    document.execCommand("insertText", false, open + selection.toString() + closer);
    return true;
  }
  const root = editorPairRoot();
  const html = escapeHtml(open) + "<span id=\"wengao-pair-caret\"></span>" + escapeHtml(closer);
  const ok = document.execCommand("insertHTML", false, html);
  const park = () => {
    const mark = document.getElementById("wengao-pair-caret");
    const sel = window.getSelection();
    if (mark && sel) {
      const range = document.createRange();
      range.setStartBefore(mark);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      mark.remove();
      if (root) root.focus();
      return true;
    }
    placeCaretBetweenPair(open, closer);
    return false;
  };
  if (!ok) {
    document.execCommand("insertText", false, open + closer);
  }
  // IR may nudge the caret once after render — snap back a few times, then stop
  // so the next keystroke can still insert in the middle (nested pairs).
  park();
  requestAnimationFrame(park);
  setTimeout(park, 0);
  setTimeout(() => placeCaretBetweenPair(open, closer), 30);
  setTimeout(() => placeCaretBetweenPair(open, closer), 90);
  return true;
}
function editorPairRoot() {
  if (!state.editor || !state.editor.vditor) return null;
  return state.editor.vditor[state.editor.vditor.currentMode].element;
}
function onPairKeydown(event) {
  if (pairLock || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
  const closer = PAIRS[event.key];
  if (!closer) return;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const root = editorPairRoot();
  if (!root || (!root.contains(event.target) && !root.contains(selection.anchorNode))) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  insertPair(event.key, closer, selection);
}
function onPairBeforeInput(event) {
  if (pairLock || event.defaultPrevented || event.inputType !== "insertText" || !event.data || [...event.data].length !== 1) return;
  const open = event.data;
  const closer = PAIRS[open];
  if (!closer) return;
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const root = editorPairRoot();
  if (!root || (!root.contains(event.target) && !root.contains(selection.anchorNode))) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  insertPair(open, closer, selection);
}
document.getElementById("editor").addEventListener("keydown", onPairKeydown, true);
document.getElementById("editor").addEventListener("beforeinput", onPairBeforeInput, true);

let externalRefreshing = false;
async function refreshExternal() {
  if (!isDesktop() || externalRefreshing || state.loading || closing || closingTab) return;
  // Workspace scanning must not delay checking or closing the active document.
  refreshWorkspace().catch(() => {});
  const tab = state.tabs.find((item) => item.key === state.activeKey);
  if (!state.filePath || !state.editor || !tab) return;
  const key = state.activeKey, path = state.filePath, generation = loadGen;
  const current = () => state.activeKey === key && state.filePath === path
    && loadGen === generation && state.tabs.includes(tab) && !closing && !closingTab && !state.loading;
  externalRefreshing = true;
  try {
    const stamp = await invokeFile("file_stamp", { path });
    if (!current()) return;
    tab.unavailable = false;
    renderStatus();
    if (!state.stamp || stamp === state.stamp) {
      state.stamp = stamp;
      return;
    }
    if (!sameDoc(state.editor.getValue(), state.saved) || encryptionChanged(tab)) {
      notice(t("externalChanged"));
      state.stamp = stamp;
      return;
    }
    const beforeRead = state.editor.getValue();
    const beforeKey = tab.encryptionKeyId;
    const document = await readDesktopDocument(path);
    // An old device read must not replace another tab or edits made meanwhile.
    if (!current() || !sameDoc(state.editor.getValue(), beforeRead) || tab.encryptionKeyId !== beforeKey) return;
    state.loading = true;
    state.editor.setValue(document.text, true);
    state.loading = false;
    state.stamp = stamp;
    tab.encryptionKeyId = tab.savedEncryptionKeyId = document.keyId;
    adoptSaved(state.editor.getValue());
    renderOutline();
  } catch (error) {
    if (current()) {
      tab.unavailable = true;
      renderStatus();
    }
  } finally {
    externalRefreshing = false;
  }
}
if (isDesktop() && window.__TAURI_INTERNALS__.transformCallback) {
  const focusHandler = window.__TAURI_INTERNALS__.transformCallback(() => { refreshExternal(); });
  invoke("plugin:event|listen", { event: "tauri://focus", target: { kind: "Any" }, handler: focusHandler }).catch(() => {});
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshExternal();
});

function countUnits(text) {
  const chars = text.length;
  const lines = text ? text.split("\n").length : 0;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const rest = text.replace(/[\u4e00-\u9fff]/g, " ").trim();
  const words = cjk + (rest ? rest.split(/\s+/).length : 0);
  return { chars, lines, words };
}
document.getElementById("count").addEventListener("click", () => {
  const panel = document.getElementById("stats-panel");
  if (!panel.hidden) { panel.hidden = true; return; }
  const text = state.editor ? state.editor.getValue() : "";
  const all = countUnits(text);
  const selected = countUnits(window.getSelection() ? window.getSelection().toString() : "");
  panel.innerHTML = t("chars") + " " + all.chars + "<br>" + t("words") + " " + all.words + "<br>" + t("lines") + " " + all.lines + "<br>" + t("selection") + " " + selected.chars + " / " + selected.words;
  panel.hidden = false;
});

const LANGUAGES = [
  ["java"],
  ["javascript", "js"],
  ["typescript", "ts"],
  ["python", "py"],
  ["go", "golang"],
  ["rust", "rs"],
  ["c"],
  ["cpp", "c++"],
  ["csharp", "c#"],
  ["kotlin", "kt"],
  ["swift"],
  ["php"],
  ["ruby", "rb"],
  ["html"],
  ["css"],
  ["scss"],
  ["json"],
  ["yaml", "yml"],
  ["xml"],
  ["sql"],
  ["bash", "sh"],
  ["shell"],
  ["powershell", "ps1"],
  ["markdown", "md"],
  ["text", "txt"],
];

let langIndex = 0;
let savedRange = null;

function rememberCursor() {
  const vditor = state.editor && state.editor.vditor;
  const selection = window.getSelection();
  if (!vditor || !selection || selection.rangeCount === 0) {
    savedRange = null;
    return;
  }
  const range = selection.getRangeAt(0);
  const element = vditor[vditor.currentMode] && vditor[vditor.currentMode].element;
  if (!element || (!element.contains(range.startContainer) && element !== range.startContainer)) {
    savedRange = null;
    return;
  }
  savedRange = range.cloneRange();
  vditor[vditor.currentMode].range = savedRange;
}

function restoreCursor() {
  const vditor = state.editor && state.editor.vditor;
  if (!vditor) return;
  const mode = vditor.currentMode;
  const element = vditor[mode] && vditor[mode].element;
  if (!element) return;
  let range = savedRange;
  if (!range || !document.contains(range.startContainer)) {
    range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
  }
  element.focus();
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  vditor[mode].range = range;
}

function matchingLanguages(query) {
  const text = query.trim().toLowerCase();
  if (!text) return LANGUAGES.map((item) => item[0]);
  return LANGUAGES
    .filter((item) => item.some((name) => name.includes(text)))
    .sort((a, b) => {
      const rank = (item) => item.some((name) => name.startsWith(text)) ? 0 : 1;
      return rank(a) - rank(b) || a[0].localeCompare(b[0]);
    })
    .map((item) => item[0]);
}

function renderLangList() {
  const input = document.getElementById("lang-input");
  const list = document.getElementById("lang-list");
  const items = matchingLanguages(input.value);
  if (langIndex >= items.length) langIndex = Math.max(0, items.length - 1);
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "palette-empty";
    empty.textContent = t("useTyped", { name: input.value.trim() });
    list.appendChild(empty);
    return;
  }
  items.forEach((name, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-item" + (index === langIndex ? " is-current" : "");
    button.textContent = name;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      chooseLanguage(name);
    });
    item.appendChild(button);
    list.appendChild(item);
  });
  const current = list.querySelector(".is-current");
  if (current) current.scrollIntoView({ block: "nearest" });
}

function currentLanguage() {
  const items = matchingLanguages(document.getElementById("lang-input").value);
  if (items.length) return items[Math.min(langIndex, items.length - 1)];
  return document.getElementById("lang-input").value.trim();
}

function focusNewCodeBlock() {
  const vditor = state.editor && state.editor.vditor;
  if (!vditor) return;
  const mode = vditor.currentMode;
  const root = vditor[mode] && vditor[mode].element;
  if (!root) return;
  const selection = window.getSelection();
  let anchor = selection && selection.rangeCount ? selection.getRangeAt(0).startContainer : null;
  let node = anchor && anchor.nodeType === 1 ? anchor : anchor && anchor.parentElement;
  let block = null;
  while (node && node !== root) {
    if (node.getAttribute && node.getAttribute("data-type") === "code-block") {
      block = node;
      break;
    }
    node = node.parentElement;
  }
  let code = null;
  if (mode === "ir") {
    if (!block) {
      const blocks = root.querySelectorAll('[data-type="code-block"]');
      block = blocks[blocks.length - 1];
    }
    if (block) {
      code = block.querySelector(".vditor-ir__marker--pre code") || block.querySelector("code");
    }
  } else if (mode === "wysiwyg") {
    if (block) code = block.querySelector("code");
    if (!code) {
      const blocks = root.querySelectorAll('[data-type="code-block"] code');
      code = blocks[blocks.length - 1];
    }
  }
  if (!code) return;
  if (!code.firstChild) code.appendChild(document.createTextNode(""));
  const range = document.createRange();
  range.selectNodeContents(code);
  range.collapse(false);
  root.focus();
  const nextSelection = window.getSelection();
  nextSelection.removeAllRanges();
  nextSelection.addRange(range);
  vditor[mode].range = range.cloneRange();
}

function chooseLanguage(name) {
  const lang = (name || currentLanguage() || "text").trim();
  if (!lang) return;
  closePalette();
  showEditor();
  if (!state.editor) return;
  restoreCursor();
  state.editor.insertMD("```" + lang + "\n\n```");
  focusNewCodeBlock();
}

function placePalette() {
  const palette = document.getElementById("lang-palette");
  const selection = window.getSelection();
  let top = 80;
  let left = Math.max(12, (window.innerWidth - 280) / 2);
  if (savedRange) {
    const rect = savedRange.getBoundingClientRect();
    if (rect && (rect.bottom || rect.left)) {
      top = Math.min(window.innerHeight - 300, Math.max(8, rect.bottom + 6));
      left = Math.min(window.innerWidth - 292, Math.max(8, rect.left));
    }
  } else if (selection && selection.rangeCount) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect && rect.bottom) top = Math.min(window.innerHeight - 300, rect.bottom + 6);
  }
  palette.style.top = top + "px";
  palette.style.left = left + "px";
}

function openPalette() {
  const palette = document.getElementById("lang-palette");
  const input = document.getElementById("lang-input");
  palette.hidden = false;
  input.value = "";
  langIndex = 0;
  renderLangList();
  placePalette();
  input.focus();
  requestAnimationFrame(() => input.focus());
}

function closePalette() {
  document.getElementById("lang-palette").hidden = true;
}

document.getElementById("lang-input").addEventListener("input", () => {
  langIndex = 0;
  renderLangList();
});

document.getElementById("lang-input").addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  const items = matchingLanguages(event.currentTarget.value);
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!items.length) return;
    langIndex = (langIndex + 1) % items.length;
    renderLangList();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!items.length) return;
    langIndex = (langIndex - 1 + items.length) % items.length;
    renderLangList();
  } else if (event.key === "Enter") {
    event.preventDefault();
    chooseLanguage(currentLanguage());
  } else if (event.key === "Escape") {
    event.preventDefault();
    closePalette();
    restoreCursor();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.shiftKey) return;
  if (!((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u")) return;
  event.preventDefault();
  event.stopPropagation();
  const palette = document.getElementById("lang-palette");
  if (palette.hidden) {
    rememberCursor();
    openPalette();
  } else {
    closePalette();
    restoreCursor();
  }
}, true);

function bringTabFront(tab) {
  state.tabs = [tab, ...state.tabs.filter((item) => item !== tab)];
}

function syncTab(text) {
  const key = state.filePath || state.relPath || state.name || "untitled";
  let tab = state.filePath
    ? state.tabs.find((item) => item.filePath === state.filePath || item.key === state.filePath)
    : state.tabs.find((item) => item.key === key);
  if (!tab) {
    tab = { key };
    state.tabs.unshift(tab);
  } else {
    tab.key = key;
    bringTabFront(tab);
  }
  tab.name = state.name;
  tab.handle = state.handle;
  tab.relPath = state.relPath;
  tab.filePath = state.filePath;
  tab.value = text;
  if (state.saved == null) tab.saved = null;
  else tab.saved = text;
  state.activeKey = key;
  renderTabs();
}

function tabDirty(tab) {
  if (tab.key === state.activeKey) return state.dirty;
  return hasUnsavedChanges(tab.value, tab.saved) || encryptionChanged(tab);
}

let tabsMenuOpen = false;

function closeTabsMenu() {
  tabsMenuOpen = false;
  const menu = document.getElementById("tabs-menu");
  const more = document.getElementById("tabs-more");
  if (menu) menu.hidden = true;
  if (more) more.setAttribute("aria-expanded", "false");
}

function openTabsMenu() {
  const menu = document.getElementById("tabs-menu");
  const more = document.getElementById("tabs-more");
  if (!menu || !more || more.hidden) return;
  tabsMenuOpen = true;
  menu.hidden = false;
  more.setAttribute("aria-expanded", "true");
}

function appendTabChrome(parent, tab, fromMenu) {
  const dirty = tabDirty(tab);
  const active = tab.key === state.activeKey;
  const dot = document.createElement("span");
  dot.className = "save-dot " + (dirty ? "is-dirty" : "is-saved");
  const name = document.createElement("span");
  name.className = "tab-name";
  name.textContent = (tab.savedEncryptionKeyId ? "🔒 " : "") + (tab.name || t("untitled"));
  const close = document.createElement("button");
  close.type = "button";
  close.className = "tab-close";
  close.title = t("close");
  close.textContent = "×";
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeTab(tab.key).then(() => {
      if (fromMenu && state.tabs.length) {
        tabsMenuOpen = true;
        renderTabs();
        requestAnimationFrame(() => layoutTabs(true));
      }
    });
  });
  parent.appendChild(dot);
  parent.appendChild(name);
  parent.appendChild(close);
  return active;
}

function renderTabsMenu(hiddenTabs) {
  const menu = document.getElementById("tabs-menu");
  if (!menu) return;
  menu.replaceChildren();
  hiddenTabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tabs-menu-item" + (tab.key === state.activeKey ? " is-current" : "");
    item.setAttribute("role", "option");
    appendTabChrome(item, tab, true);
    item.addEventListener("click", (event) => {
      if (event.target.closest(".tab-close")) return;
      closeTabsMenu();
      switchTab(tab.key);
    });
    menu.appendChild(item);
  });
}

function layoutTabs(keepMenu) {
  const root = document.getElementById("tabs");
  const more = document.getElementById("tabs-more");
  if (!root || !more) return;
  const items = Array.from(root.querySelectorAll(".tab"));
  items.forEach((item) => { item.hidden = false; });
  more.hidden = true;
  if (!keepMenu) closeTabsMenu();
  if (!items.length) return;
  const fit = () => root.clientWidth >= root.scrollWidth - 1;
  if (fit()) return;
  more.hidden = false;
  const hiddenTabs = [];
  const active = items.find((item) => item.classList.contains("is-active"));
  const rest = items.filter((item) => item !== active);
  for (let i = rest.length - 1; i >= 0 && !fit(); i -= 1) {
    rest[i].hidden = true;
    const tab = state.tabs.find((item) => item.key === rest[i].dataset.key);
    if (tab) hiddenTabs.unshift(tab);
  }
  if (!fit() && active) {
    active.hidden = true;
    const tab = state.tabs.find((item) => item.key === active.dataset.key);
    if (tab && !hiddenTabs.includes(tab)) hiddenTabs.unshift(tab);
  }
  renderTabsMenu(hiddenTabs);
  if (!hiddenTabs.length) {
    more.hidden = true;
    closeTabsMenu();
    return;
  }
  if (keepMenu || tabsMenuOpen) openTabsMenu();
}

function renderTabs() {
  const root = document.getElementById("tabs");
  if (!root) return;
  root.replaceChildren();
  state.tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tab" + (tab.key === state.activeKey ? " is-active" : "");
    item.dataset.key = tab.key;
    item.setAttribute("role", "tab");
    item.setAttribute("aria-selected", tab.key === state.activeKey ? "true" : "false");
    item.title = tab.name || t("untitled");
    appendTabChrome(item, tab, false);
    item.addEventListener("click", (event) => {
      if (event.target.closest(".tab-close")) return;
      switchTab(item.dataset.key);
    });
    item.addEventListener("auxclick", (event) => {
      if (event.button === 1) {
        event.preventDefault();
        closeTab(item.dataset.key);
      }
    });
    root.appendChild(item);
  });
  requestAnimationFrame(() => layoutTabs(tabsMenuOpen));
}

async function closeTab(key) {
  if (closing || closingTab || state.loading) return;
  const tab = state.tabs.find((item) => item.key === key);
  if (!tab) return;
  closingTab = true;
  try {
    markDirty();
    flushActiveTab();
    if (!await confirmUnsavedClose([tab])) return;
    const index = state.tabs.indexOf(tab);
    if (index < 0) return;
    const active = tab.key === state.activeKey;
    state.tabs.splice(index, 1);
    if (!state.tabs.length) {
      showBlank();
    } else if (active) {
      const next = state.tabs[Math.min(index, state.tabs.length - 1)];
      state.activeKey = "";
      switchTab(next.key);
    } else {
      renderTabs();
    }
  } finally {
    closingTab = false;
  }
}

function showBlank() {
  state.tabs = [];
  state.activeKey = "";
  state.name = "";
  state.handle = null;
  state.filePath = "";
  state.relPath = "";
  state.saved = "";
  state.dirty = false;
  state.loading = true;
  if (state.editor) state.editor.setValue("", true);
  state.loading = false;
  renderStatus();
  renderTabs();
  renderOutline();
}

document.getElementById("tab-new").addEventListener("click", () => {
  createDocument().catch((error) => notice(error.message || t("newFailed")));
});
document.getElementById("tabs-more").addEventListener("click", (event) => {
  event.stopPropagation();
  if (tabsMenuOpen) closeTabsMenu();
  else openTabsMenu();
});
document.getElementById("tabs-menu").addEventListener("click", (event) => {
  event.stopPropagation();
});
document.addEventListener("click", (event) => {
  const strip = document.getElementById("tab-strip");
  if (strip && !strip.contains(event.target)) closeTabsMenu();
});
window.addEventListener("resize", () => { layoutTabs(tabsMenuOpen); });

function walkOpen(nodes, open) {
  (nodes || []).forEach((node) => {
    if (node.kind !== "dir") return;
    node.open = open;
    walkOpen(node.children, open);
  });
}

document.getElementById("collapse-tree").addEventListener("click", () => {
  const anyOpen = state.folders.some((folder) => folder.open !== false);
  state.folders.forEach((folder) => {
    folder.open = !anyOpen;
    walkOpen(folder.tree, !anyOpen);
  });
  renderTree();
});

function switchTab(key) {
  if (!key) return;
  if (key === state.activeKey) {
    showEditor();
    return;
  }
  const next = state.tabs.find((item) => item.key === key);
  if (!next || !state.editor) return;
  flushActiveTab();
  const gen = ++loadGen;
  const incoming = next.value == null ? "" : String(next.value);
  const neverSaved = next.saved == null;
  const wasClean = !neverSaved && sameDoc(incoming, next.saved);
  state.loading = true;
  state.name = next.name;
  state.handle = next.handle || null;
  state.filePath = next.filePath || "";
  state.relPath = next.relPath || "";
  state.activeKey = key;
  state.saved = neverSaved ? null : (wasClean ? incoming : String(next.saved == null ? "" : next.saved));
  state.dirty = hasUnsavedChanges(incoming, next.saved) || encryptionChanged(next);
  next.value = incoming;
  if (neverSaved) next.saved = null;
  else if (wasClean) next.saved = incoming;
  state.editor.setValue(incoming, true);
  state.loading = false;
  if (wasClean) {
    state.saved = next.saved = next.value = state.editor.getValue();
  }
  showEditor();
  renderStatus();
  renderTree();
  renderTabs();
  renderOutline();
  state.stamp = 0;
  if (state.filePath && isDesktop()) {
    invokeFile("file_stamp", { path: state.filePath }).then((stamp) => {
      if (gen === loadGen) state.stamp = stamp;
    }).catch(() => {});
  }
}

let outlineTimer = 0;
let outlineSignature = "";
let outlineTab = null;
const collapsedOutlineBranches = new WeakMap();

function scheduleOutline() {
  clearTimeout(outlineTimer);
  outlineTimer = setTimeout(renderOutline, 160);
}

function renderOutline() {
  const root = document.getElementById("outline");
  if (!root || !state.editor) return;
  const lines = state.editor.getValue().split("\n");
  const headings = [];
  const counts = new Map();
  lines.forEach((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!match) return;
    const level = match[1].length;
    const title = match[2].trim();
    const key = match[1] + " " + title;
    const occurrence = (counts.get(key) || 0) + 1;
    counts.set(key, occurrence);
    headings.push({ level, title, occurrence });
  });
  const signature = headings.map((item) => item.level + ":" + item.title + ":" + item.occurrence).join("\n");
  const tab = state.tabs.find((item) => item.key === state.activeKey) || null;
  if (signature === outlineSignature && tab === outlineTab) return;
  const currentKey = tab === outlineTab ? root.querySelector(".outline-item.is-current")?.dataset.key : "";
  outlineTab = tab;
  outlineSignature = signature;
  root.replaceChildren();
  if (!headings.length) return;

  const collapsed = collapsedOutlineBranches.get(tab) || new Set();
  if (tab) collapsedOutlineBranches.set(tab, collapsed);
  const list = document.createElement("ul");
  list.className = "outline-list";
  root.appendChild(list);
  const ancestors = [];

  headings.forEach((item, index) => {
    while (ancestors.length && ancestors.at(-1).level >= item.level) ancestors.pop();
    const parentList = ancestors.at(-1)?.list || list;
    const entry = document.createElement("li");
    const row = document.createElement("div");
    row.className = "outline-row";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "outline-item";
    button.dataset.key = item.level + ":" + item.title + ":" + item.occurrence;
    button.textContent = item.title;
    button.title = item.title;
    if (button.dataset.key === currentKey) button.classList.add("is-current");
    button.addEventListener("click", () => {
      root.querySelector(".outline-item.is-current")?.classList.remove("is-current");
      button.classList.add("is-current");
      jumpToHeading(item.title, item.level, item.occurrence);
    });
    entry.appendChild(row);
    parentList.appendChild(entry);

    if (headings[index + 1]?.level > item.level) {
      const children = document.createElement("ul");
      children.className = "outline-list outline-children";
      children.id = "outline-children-" + index;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "outline-branch-toggle";
      toggle.setAttribute("aria-label", item.title);
      toggle.setAttribute("aria-controls", children.id);
      const setExpanded = (expanded) => {
        children.hidden = !expanded;
        toggle.setAttribute("aria-expanded", String(expanded));
      };
      setExpanded(!collapsed.has(button.dataset.key));
      toggle.addEventListener("click", () => {
        if (children.hidden) collapsed.delete(button.dataset.key);
        else collapsed.add(button.dataset.key);
        setExpanded(children.hidden);
      });
      row.appendChild(toggle);
      entry.appendChild(children);
      ancestors.push({ level: item.level, list: children });
    }
    row.appendChild(button);
  });
}

function jumpToHeading(title, level, occurrence) {
  const vditor = state.editor && state.editor.vditor;
  if (!vditor) return;
  const root = vditor[vditor.currentMode] && vditor[vditor.currentMode].element;
  if (!root) return;
  const marker = "#".repeat(level) + " " + title;
  const flash = (element) => {
    element.classList.add("heading-jump");
    element.scrollIntoView({ block: "center" });
    setTimeout(() => element.classList.remove("heading-jump"), 1200);
  };
  let seen = 0;
  const headings = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  for (const heading of headings) {
    if (Number(heading.tagName.slice(1)) !== level) continue;
    const text = (heading.textContent || "").replace(/^#+\s*/, "").trim();
    if (text !== title && !text.startsWith(title)) continue;
    seen += 1;
    if (seen !== occurrence) continue;
    flash(heading);
    return;
  }
  seen = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent || "";
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(marker, from);
      if (index < 0) break;
      seen += 1;
      if (seen === occurrence) {
        const range = document.createRange();
        range.setStart(node, index);
        range.collapse(true);
        root.focus();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const parent = node.parentElement || root;
        flash(parent);
        return;
      }
      from = index + marker.length;
    }
    node = walker.nextNode();
  }
}

function editorLinkAt(target) {
  const element = target && (target.nodeType === 3 ? target.parentElement : target);
  const link = element && element.closest('[data-type="a"], a[href], .vditor-sv__marker--link');
  if (!link || !document.getElementById("editor").contains(link)) return null;
  const marker = link.querySelector(".vditor-ir__marker--link");
  const href = (link.getAttribute("href") || (marker && marker.textContent)
    || (link.matches(".vditor-sv__marker--link") ? link.textContent : "") || "").trim();
  return href ? { link, href } : null;
}

function jumpToLinkFragment(fragment) {
  if (!fragment) return;
  const id = decodeURIComponent(fragment);
  const root = state.editor && state.editor.vditor[state.editor.getCurrentMode()]?.element;
  if (!root) return;
  const exact = document.getElementById(id);
  const slug = (value) => value.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s+/g, "-");
  const heading = exact && root.contains(exact) ? exact : Array.from(root.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .find((item) => slug(item.textContent.replace(/^#+\s*/, "")) === slug(id));
  if (heading) heading.scrollIntoView({ block: "start", behavior: "smooth" });
}

async function followEditorLink(href) {
  if (/[\u0000-\u001f\u007f]/.test(href)) throw new Error(t("unsupportedLink"));
  if (href.startsWith("#")) {
    jumpToLinkFragment(href.slice(1));
    return;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    if (!isDesktop()) throw new Error(t("unsupportedLink"));
    const source = state.filePath;
    if (!source) throw new Error(t("saveBeforeLink"));
    const hash = href.indexOf("#");
    const fragment = hash < 0 ? "" : href.slice(hash + 1);
    const target = decodeURIComponent(href.split(/[?#]/, 1)[0]);
    const file = await invokeFile("resolve_markdown_link", { source, target });
    const tab = findTabForFile(file);
    if (tab) switchTab(tab.key);
    else await openTreeFile(file, file.name);
    jumpToLinkFragment(fragment);
    return;
  }
  let url;
  try { url = new URL(href); } catch (error) { throw new Error(t("unsupportedLink")); }
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error(t("unsupportedLink"));
  if (isDesktop()) await invoke("open_external_url", { url: url.href });
  else window.open(url.href, "_blank", "noopener,noreferrer");
}

let pressedEditorLink = null;
document.getElementById("editor").addEventListener("mousedown", (event) => {
  pressedEditorLink = null;
  if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return;
  pressedEditorLink = editorLinkAt(event.target);
  if (!pressedEditorLink) return;
  // Keep the IR renderer from expanding markup before the following click.
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
document.getElementById("editor").addEventListener("click", (event) => {
  const found = editorLinkAt(event.target);
  const pressed = pressedEditorLink;
  pressedEditorLink = null;
  if (!found) return;
  event.preventDefault();
  if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return;
  event.stopImmediatePropagation();
  const href = pressed && pressed.link === found.link ? pressed.href : found.href;
  followEditorLink(href).catch((error) => notice(errorText(error) || t("linkOpenFailed")));
}, true);
function updateLinkModifier(event) {
  document.body.classList.toggle("link-open-mode", !!(event.ctrlKey || event.metaKey));
}
document.addEventListener("keydown", updateLinkModifier);
document.addEventListener("keyup", updateLinkModifier);
window.addEventListener("blur", () => {
  pressedEditorLink = null;
  document.body.classList.remove("link-open-mode");
});

document.getElementById("editor").addEventListener("pointerdown", () => {
  document.querySelectorAll(".outline-item.is-current").forEach((item) => item.classList.remove("is-current"));
});

let workspaceRefreshing = null;
let workspaceRefreshPending = null;
function refreshWorkspace({ afterSave = false } = {}) {
  if (!isDesktop()) return Promise.resolve();
  if (workspaceRefreshing) {
    if (!afterSave) return workspaceRefreshing;
    // A scan that began before a save may return the old directory contents.
    // Coalesce saves during that scan into one fresh scan after it finishes.
    if (!workspaceRefreshPending) {
      workspaceRefreshPending = workspaceRefreshing.then(() => {
        workspaceRefreshPending = null;
        return refreshWorkspace();
      });
    }
    return workspaceRefreshPending;
  }
  workspaceRefreshing = Promise.all(state.folders.map(async (folder) => {
    try {
      folder.tree = await invokeFile("list_workspace", { path: folder.path });
      folder.unavailable = false;
    } catch (error) {
      folder.unavailable = true;
      folder.tree = [];
    }
  })).then(() => {
    // Keep disconnected folders registered so reconnecting can restore their tree.
    try { localStorage.setItem("wengao-folders", JSON.stringify(state.folders.map((item) => item.path))); } catch (error) {}
    renderTree();
  }).finally(() => { workspaceRefreshing = null; });
  return workspaceRefreshing;
}

let menuNode = null;
let menuOpenedAt = 0;

function clearTreeMenuTarget() {
  document.querySelectorAll("#tree button.is-menu-target").forEach((button) => {
    button.classList.remove("is-menu-target");
  });
  const tree = document.getElementById("tree");
  if (tree) tree.classList.remove("has-menu-target");
}

function closeTreeMenu() {
  const menu = document.getElementById("tree-menu");
  if (menu) menu.hidden = true;
  clearTreeMenuTarget();
  menuNode = null;
}

function openTreeMenu(event, node) {
  if (!node.path) return;
  event.preventDefault();
  event.stopPropagation();
  clearTreeMenuTarget();
  menuNode = node;
  menuOpenedAt = Date.now();
  const row = event.currentTarget;
  if (row && row.classList) row.classList.add("is-menu-target");
  const tree = document.getElementById("tree");
  if (tree) tree.classList.add("has-menu-target");
  const menu = document.getElementById("tree-menu");
  menu.hidden = false;
  const width = 188;
  const height = 220;
  const x = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
  const y = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8));
  menu.style.position = "fixed";
  menu.style.zIndex = "40";
  menu.style.left = x + "px";
  menu.style.top = y + "px";
}

async function restoreLastFolder() {
  if (!isDesktop() || state.folders.length) return;
  let folders = [];
  try {
    folders = JSON.parse(localStorage.getItem("wengao-folders") || "[]");
    if (!folders.length) {
      const single = localStorage.getItem("wengao-folder");
      if (single) folders = [single];
    }
  } catch (error) {}
  for (const folder of folders) {
    try { await addFolder(folder); } catch (error) {}
  }
}

let launchFilesQueue = Promise.resolve();
function openLaunchFiles() {
  launchFilesQueue = launchFilesQueue.then(async () => {
    const paths = await invoke("launch_args").catch(() => []);
    for (const path of paths) {
      const name = path.split(/[\\/]/).pop();
      if (!name) continue;
      const file = { path, name };
      const existing = findTabForFile(file);
      if (existing) switchTab(existing.key);
      else {
        try { await openTreeFile(file, name); }
        catch (error) { notice(errorText(error) || t("openFailed")); }
      }
    }
  });
}

async function listenForLaunchFiles() {
  if (!isDesktop()) return;
  const handler = window.__TAURI_INTERNALS__.transformCallback(openLaunchFiles);
  await invoke("plugin:event|listen", {
    event: "launch-files", target: { kind: "Any" }, handler,
  }).catch(() => {});
  // Drain after registration so a launch during startup cannot be missed.
  openLaunchFiles();
}

function articleHtml(body) {
  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>" + state.name + "</title><style>body{font-family:Segoe UI,Microsoft YaHei,sans-serif;line-height:1.7;max-width:760px;margin:32px auto;padding:0 16px;color:#222}pre,code{font-family:Consolas,monospace}pre{background:#f6f8fa;padding:12px;overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 8px}img,svg{max-width:100%}code.language-math,span.language-math,.katex{font-size:1.05em}.language-mermaid,.vditor-mermaid{text-align:center;overflow:auto}</style></head><body>" + body + "</body></html>";
}

function exportHtmlBody() {
  if (!state.editor) return "";
  let html = state.editor.getHTML() || "";
  if (!html.includes("katex") && /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(state.editor.getValue())) {
    html += "<!-- math present; open in app to render KaTeX -->";
  }
  if (!/mermaid|language-mermaid/.test(html) && /```mermaid/.test(state.editor.getValue())) {
    html += "<!-- mermaid present; open in app to render -->";
  }
  return html;
}

async function inlineHtmlRemoteImages(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const images = [...root.querySelectorAll("img[src^='http']")];
  for (const img of images) {
    try {
      const response = await fetch(img.getAttribute("src"));
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      const mime = response.headers.get("content-type") || "image/png";
      img.setAttribute("src", "data:" + mime.split(";")[0] + ";base64," + btoa(binary));
    } catch (error) {}
  }
  return root.innerHTML;
}

async function loadKatexCss() {
  try {
    const response = await fetch("/vendor/vditor/dist/js/katex/katex.min.css");
    if (!response.ok) return "";
    return await response.text();
  } catch (error) {
    return "";
  }
}

async function prepareRichExportHtml() {
  if (!state.editor) return { html: "", css: "" };
  await new Promise((resolve) => setTimeout(resolve, 80));
  let html = exportHtmlBody();
  html = await inlineHtmlRemoteImages(html);
  const css = await loadKatexCss();
  return { html, css };
}

function markdownToLatex(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out = ["\\documentclass{article}", "\\usepackage[utf8]{inputenc}", "\\usepackage{graphicx}", "\\usepackage{hyperref}", "\\usepackage{amsmath}", "\\begin{document}"];
  let inCode = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCode) { out.push("\\end{verbatim}"); inCode = false; }
      else { out.push("\\begin{verbatim}"); inCode = true; }
      continue;
    }
    if (inCode) { out.push(line.replace(/\\/g, "\\textbackslash{}")); continue; }
    if (line.includes("|") && lines[i + 1] && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) {
        if (!/^\s*\|?[\s:-]+\|/.test(lines[i])) rows.push(lines[i]);
        i += 1;
      }
      i -= 1;
      const cells = rows.map((row) => row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      const cols = "l".repeat((cells[0] || []).length || 1);
      out.push("\\begin{tabular}{" + cols + "}");
      cells.forEach((row, index) => {
        out.push(row.map(latexEscape).join(" & ") + " \\\\" + (index === 0 ? " \\hline" : ""));
      });
      out.push("\\end{tabular}");
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const text = latexEscape(line.replace(/^#+\s*/, ""));
      out.push((level === 1 ? "\\section*{" : level === 2 ? "\\subsection*{" : "\\subsubsection*{") + text + "}");
      continue;
    }
    if (/^>\s?/.test(line)) {
      out.push("\\begin{quote}" + latexEscape(line.replace(/^>\s?/, "")) + "\\end{quote}");
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      out.push("\\item " + latexInline(line.replace(/^[-*+]\s+/, "")));
      continue;
    }
    if (!line.trim()) { out.push(""); continue; }
    out.push(latexInline(line));
  }
  out.push("\\end{document}");
  return out.join("\n");
}
function latexEscape(text) {
  return String(text || "").replace(/([\\{}#&$%_^~])/g, "\\$1");
}
function latexInline(text) {
  return latexEscape(text)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "\\includegraphics{$2}")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}")
    .replace(/`([^`]+)`/g, "\\texttt{$1}")
    .replace(/\*\*([^*]+)\*\*/g, "\\textbf{$1}")
    .replace(/\*([^*]+)\*/g, "\\textit{$1}");
}

async function fetchRemoteImages() {
  if (!state.editor) return;
  if (!state.filePath && isDesktop()) {
    notice(t("saveFailed"));
    return;
  }
  const source = state.editor.getValue();
  const matches = [...source.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)];
  if (!matches.length) { notice(t("fetchImagesNone")); return; }
  let next = source;
  let count = 0;
  const dir = isDesktop() && state.filePath
    ? state.filePath.replace(/[\\/][^\\/]*$/, "")
    : "";
  const assets = dir ? dir + "\\assets" : "assets";
  for (const match of matches) {
    const url = match[2];
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      bytes.forEach((b) => { binary += String.fromCharCode(b); });
      const base64 = btoa(binary);
      const ext = ((url.split("?")[0].match(/\.(png|jpe?g|gif|webp|svg)$/i) || [])[1] || "png").toLowerCase().replace("jpeg", "jpg");
      const name = "img-" + Date.now() + "-" + count + "." + ext;
      const rel = "assets/" + name;
      if (isDesktop()) {
        const path = assets + "\\" + name;
        await invoke("write_base64", { path, data: base64 });
      }
      next = next.split(match[0]).join("![" + match[1] + "](" + rel + ")");
      count += 1;
    } catch (error) {}
  }
  if (!count) { notice(t("fetchImagesNone")); return; }
  state.loading = true;
  state.editor.setValue(next, true);
  state.loading = false;
  markDirty();
  notice(t("fetchImagesDone", { count }));
}

function wechatHtml(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const styles = {
    h1: "font-size:22px;font-weight:700;margin:1em 0 .6em;color:#222;",
    h2: "font-size:18px;font-weight:700;margin:1em 0 .5em;padding-bottom:.3em;border-bottom:1px solid #eee;color:#222;",
    h3: "font-size:16px;font-weight:700;margin:1em 0 .4em;color:#222;",
    p: "font-size:16px;line-height:1.8;margin:.8em 0;color:#333;",
    blockquote: "border-left:4px solid #ddd;color:#666;margin:1em 0;padding:.2em 1em;",
    pre: "background:#f6f8fa;padding:12px;overflow:auto;font-size:14px;line-height:1.6;",
    code: "font-size:14px;background:#f6f8fa;",
    table: "border-collapse:collapse;width:100%;",
    td: "border:1px solid #ddd;padding:6px 8px;",
    th: "border:1px solid #ddd;padding:6px 8px;background:#f6f8fa;",
    img: "max-width:100%;",
    a: "color:#576b95;text-decoration:none;",
    li: "margin:.35em 0;line-height:1.7;",
  };
  root.querySelectorAll(Object.keys(styles).join(",")).forEach((element) => {
    const extra = styles[element.tagName.toLowerCase()];
    element.setAttribute("style", (element.getAttribute("style") || "") + extra);
  });
  return root.innerHTML;
}

async function writeExport(extension, contents, suggested) {
  if (isDesktop()) {
    const path = await invoke("save_file", { name: suggested, extension });
    if (!path) return;
    await invokeFile("write_text", { path, contents, encryptionKeyId: "" });
    return;
  }
  download(contents, suggested + "." + extension);
}

async function exportDocument(kind) {
  if (!state.editor) return;
  const encryptedTab = state.tabs.find((tab) => tab.key === state.activeKey);
  if (encryptedTab && (encryptedTab.encryptionKeyId || encryptedTab.savedEncryptionKeyId)) {
    if (!await askDialog({ title: t("export"), message: t("encryptionExportWarning") })) return;
  }
  showEditor();
  const html = exportHtmlBody();
  const base = (state.name || untitledStem()).replace(/\.(md|markdown|txt)$/i, "");
  if (kind === "pdf") {
    const page = articleHtml(html);
    if (isDesktop()) {
      const path = await invoke("save_file", { name: base + ".pdf", extension: "pdf" });
      if (!path) return;
      await invoke("export_pdf", { html: page, path });
      notice(t("exportOk"));
      return;
    }
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    frame.contentDocument.open();
    frame.contentDocument.write(page);
    frame.contentDocument.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
    return;
  }
  if (kind === "html") {
    await writeExport("html", articleHtml(html), base);
    notice(t("exportOk"));
    return;
  }
  if (kind === "word") {
    if (isDesktop()) {
      const path = await invoke("save_file", { name: base + ".docx", extension: "docx" });
      if (!path) return;
      const baseDir = state.filePath ? state.filePath.replace(/[\\/][^\\/]*$/, "") : "";
      await invoke("export_docx", { markdown: state.editor.getValue(), path, baseDir });
      notice(t("exportOk"));
      return;
    }
    const word = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body>" + html + "</body></html>";
    await writeExport("doc", word, base);
    notice(t("exportOk"));
    return;
  }
  if (kind === "epub") {
    if (isDesktop()) {
      const path = await invoke("save_file", { name: base + ".epub", extension: "epub" });
      if (!path) return;
      const rich = await prepareRichExportHtml();
      await invoke("export_epub", { title: base, html: rich.html || html, css: rich.css || "", path });
      notice(t("exportOk"));
      return;
    }
    notice(t("exportOk"));
    return;
  }
  if (kind === "latex") {
    await writeExport("tex", markdownToLatex(state.editor.getValue()), base);
    notice(t("exportOk"));
    return;
  }
  if (kind === "copy-plain") {
    await navigator.clipboard.writeText(state.editor.getValue());
    notice(t("copied"));
    return;
  }
  if (kind === "copy-html") {
    const fragment = articleHtml(html);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([fragment], { type: "text/plain" }),
        }),
      ]);
    } catch (error) {
      await navigator.clipboard.writeText(html);
    }
    notice(t("copied"));
    return;
  }
  if (kind === "wechat") {
    const fragment = wechatHtml(html);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([fragment], { type: "text/html" }),
          "text/plain": new Blob([state.editor.getValue()], { type: "text/plain" }),
        }),
      ]);
    } catch (error) {
      await navigator.clipboard.writeText(fragment);
    }
    notice(t("copiedWechat"));
  }
}

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    exportDocument(button.dataset.export).catch((error) => {
      notice(errorText(error));
    });
  });
});
document.getElementById("fetch-images").addEventListener("click", () => {
  fetchRemoteImages().catch((error) => notice(errorText(error)));
});

document.querySelectorAll("[data-tree-act]").forEach((button) => {
  button.addEventListener("click", () => {
    const node = menuNode;
    closeTreeMenu();
    if (!node || !node.path || !isDesktop()) return;
    const action = button.dataset.treeAct;
    const dir = node.kind === "dir" ? node.path : node.path.replace(/[\\/][^\\/]*$/, "");
    const run = async () => {
      if (action === "new-file") {
        const created = await invoke("create_markdown", { dir });
        await refreshWorkspace();
        const file = await readDesktopDocument(created.path);
        load(file.text, created.name, null, created.name, created.path, file.keyId);
      } else if (action === "new-dir") {
        const name = await askDialog({ title: t("newFolder"), message: t("folderName"), input: true });
        if (!name) return;
        await invoke("create_folder", { dir, name });
        await refreshWorkspace();
      } else if (action === "rename") {
        const name = await askDialog({ title: t("rename"), message: t("newName"), input: true, value: node.name });
        if (!name || name === node.name) return;
        await invoke("rename_path", { from: node.path, toName: name });
        await refreshWorkspace();
      } else if (action === "reveal") {
        await invoke("reveal_in_folder", { path: node.path });
      } else if (action === "delete") {
        // 仅从工作区列表去掉，绝不调用 remove_path / 删盘
        const under = (path) => path === node.path || String(path || "").startsWith(node.path + "\\") || String(path || "").startsWith(node.path + "/");
        const isRoot = state.folders.some((folder) => folder.path === node.path);
        const message = isRoot
          ? t("removeWorkspaceHint", { name: node.name, path: node.path })
          : t("removeHint", { name: node.name });
        if (!await askDialog({ title: t("remove"), message })) return;
        if (isRoot) {
          state.folders = state.folders.filter((folder) => !under(folder.path));
          clearHiddenUnder(node.path);
        } else {
          state.hidden.add(node.path);
          try { localStorage.setItem("wengao-hidden", JSON.stringify([...state.hidden])); } catch (error) {}
        }
        state.tabs = state.tabs.filter((tab) => !under(tab.filePath));
        if (under(state.filePath)) {
          const next = state.tabs[0];
          if (next) {
            state.activeKey = "";
            switchTab(next.key);
          } else {
            showBlank();
          }
        }
        try { localStorage.setItem("wengao-folders", JSON.stringify(state.folders.map((item) => item.path))); } catch (error) {}
        await refreshWorkspace();
        renderTabs();
      }
    };
    run().catch((error) => notice(errorText(error)));
  });
});

let searchTimer = 0;
let searchGen = 0;
function shortFront(text, keep) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= keep) return value;
  return "…" + value.slice(value.length - keep);
}

function resetSearchView() {
  const results = document.getElementById("search-results");
  const tree = document.getElementById("tree");
  const clear = document.getElementById("search-clear");
  if (results) {
    results.hidden = true;
    results.replaceChildren();
  }
  if (tree) tree.hidden = false;
  if (clear) clear.hidden = true;
}

document.getElementById("search").addEventListener("input", (event) => {
  const input = event.currentTarget;
  const query = input.value.trim();
  const results = document.getElementById("search-results");
  const tree = document.getElementById("tree");
  const clear = document.getElementById("search-clear");
  clear.hidden = !input.value;
  clearTimeout(searchTimer);
  const gen = ++searchGen;
  if (!query) {
    resetSearchView();
    clear.hidden = !input.value;
    return;
  }
  searchTimer = setTimeout(async () => {
    if (gen !== searchGen) return;
    tree.hidden = true;
    results.hidden = false;
    results.replaceChildren();
    if (!state.folders.length || !isDesktop()) {
      results.textContent = t("searchNeedFolder");
      return;
    }
    let groups = [];
    try {
      groups = await Promise.all(state.folders.map((folder) => invoke("search_workspace", { path: folder.path, query })));
    } catch (error) {
      if (gen !== searchGen) return;
      results.textContent = errorText(error);
      return;
    }
    if (gen !== searchGen) return;
    const hits = groups.flat();
    results.replaceChildren();
    if (!hits.length) {
      results.textContent = t("noMatch");
      return;
    }
    hits.forEach((hit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-hit";
      button.title = hit.name + ":" + hit.line + " " + hit.text;
      const file = document.createElement("span");
      file.className = "search-file";
      file.textContent = hit.name;
      const line = document.createElement("span");
      line.className = "search-line";
      line.textContent = String(hit.line);
      const snippet = document.createElement("span");
      snippet.className = "search-text";
      snippet.textContent = shortFront(hit.text, 28);
      button.append(file, line, snippet);
      button.addEventListener("click", async () => {
        try {
          const document = await readDesktopDocument(hit.path);
          load(document.text, hit.name, null, hit.name, hit.path, document.keyId);
        } catch (error) { notice(errorText(error)); }
      });
      results.appendChild(button);
    });
  }, 200);
});

document.getElementById("search-clear").addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const input = document.getElementById("search");
  input.value = "";
  searchGen += 1;
  clearTimeout(searchTimer);
  resetSearchView();
  input.focus();
});

document.addEventListener("mousedown", (event) => {
  if (Date.now() - menuOpenedAt < 400) return;
  const treeMenu = document.getElementById("tree-menu");
  if (!treeMenu || treeMenu.hidden) return;
  if (treeMenu.contains(event.target)) return;
  closeTreeMenu();
});

window.addEventListener("beforeunload", (event) => {
  if (isDesktop()) return;
  markDirty();
  flushActiveTab();
  if (state.tabs.some(tabDirty)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

function listenAppClose() {
  if (!isDesktop() || !window.__TAURI_INTERNALS__.transformCallback) return;
  const handler = window.__TAURI_INTERNALS__.transformCallback(() => {
    requestAppClose();
  });
  invoke("plugin:event|listen", {
    event: "app-close",
    target: { kind: "Any" },
    handler,
  }).catch(() => {});
}
listenAppClose();

let dialogQueue = Promise.resolve();
function askDialog(options) {
  const result = dialogQueue.then(() => showDialog(options));
  dialogQueue = result.catch(() => {});
  return result;
}

function showDialog(options) {
  const root = document.getElementById("dialog");
  const title = document.getElementById("dialog-title");
  const message = document.getElementById("dialog-message");
  const input = document.getElementById("dialog-input");
  const ok = document.getElementById("dialog-ok");
  const cancel = document.getElementById("dialog-cancel");
  const extra = document.getElementById("dialog-extra");
  const previousFocus = document.activeElement;
  title.textContent = options.title || t("confirm");
  message.textContent = options.message || "";
  message.hidden = !options.message;
  input.hidden = !options.input;
  input.value = options.value || "";
  cancel.hidden = options.cancel === false;
  ok.textContent = options.okText || t("ok");
  cancel.textContent = options.cancelText || t("cancel");
  extra.hidden = !options.extraText;
  extra.textContent = options.extraText || "";
  root.hidden = false;
  if (options.input) input.focus();
  else if (options.focusCancel) cancel.focus();
  else ok.focus();
  return new Promise((resolve) => {
    const finish = (value) => {
      root.hidden = true;
      ok.onclick = null;
      cancel.onclick = null;
      extra.onclick = null;
      input.onkeydown = null;
      root.onkeydown = null;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      resolve(value);
    };
    ok.onclick = () => finish(options.input ? input.value : (options.okValue ?? true));
    cancel.onclick = () => finish(options.input ? null : false);
    extra.onclick = () => finish(options.extraValue);
    input.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(input.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };
    root.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(options.input ? null : false);
      }
    };
  });
}

function errorText(error) {
  const message = typeof error === "string" ? error : error && error.message;
  return message ? (/^SM_/.test(message) ? t(message) : message) : t("failed");
}

function notice(message) {
  return askDialog({ title: t("notice"), message: message, cancel: false });
}

function showEditor() {
  const page = document.getElementById("settings-page");
  const editor = document.getElementById("editor");
  const bar = document.getElementById("editor-bar");
  const button = document.getElementById("open-settings");
  if (page) page.hidden = true;
  if (editor) editor.hidden = false;
  if (bar) bar.hidden = false;
  if (button) {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  }
}

function showSettings() {
  document.getElementById("settings-page").hidden = false;
  document.getElementById("editor").hidden = true;
  document.getElementById("editor-bar").hidden = true;
  const button = document.getElementById("open-settings");
  button.classList.add("is-active");
  button.setAttribute("aria-pressed", "true");
}

const settingsButton = document.getElementById("open-settings");
settingsButton.addEventListener("click", () => {
  const open = document.getElementById("settings-page").hidden;
  if (open) showSettings();
  else showEditor();
});

document.getElementById("close-settings").addEventListener("click", showEditor);

// Keep document actions available in the writing view as well as Preferences.
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.action === "export") {
      showSettings();
      document.querySelector('[data-settings-tab="export"]').click();
      return;
    }
    const target = document.getElementById(button.dataset.action);
    if (target) target.click();
  });
});

function bindDrag(handle, onStart, onMove, onEnd) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const state = onStart(event);
    handle.classList.add("is-active");
    const move = (ev) => onMove(ev, state);
    const up = () => {
      handle.classList.remove("is-active");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (onEnd) onEnd();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
}

const outlineList = document.getElementById("outline");
const sidebar = document.getElementById("sidebar");
try {
  const savedHeight = Number(localStorage.getItem("wengao-outline-height"));
  if (savedHeight >= 72) outlineList.style.height = savedHeight + "px";
  const savedWidth = Number(localStorage.getItem("wengao-sidebar-width"));
  if (savedWidth >= 160 && savedWidth <= 520) sidebar.style.width = savedWidth + "px";
} catch (error) {}
bindDrag(
  document.getElementById("outline-splitter"),
  (event) => ({ y: event.clientY, height: outlineList.getBoundingClientRect().height || 140 }),
  (event, start) => {
    const limit = Math.floor(sidebar.getBoundingClientRect().height * 0.8);
    const next = Math.min(limit, Math.max(72, start.height + start.y - event.clientY));
    outlineList.style.height = next + "px";
  },
  () => {
    try { localStorage.setItem("wengao-outline-height", String(parseInt(outlineList.style.height, 10))); } catch (error) {}
  }
);

bindDrag(
  document.getElementById("splitter"),
  () => null,
  (event) => {
    const next = Math.min(520, Math.max(160, event.clientX));
    sidebar.style.width = next + "px";
  },
  () => {
    try { localStorage.setItem("wengao-sidebar-width", String(parseInt(sidebar.style.width, 10))); } catch (error) {}
  }
);

document.querySelectorAll("[data-theme-choice]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(button.dataset.themeChoice));
});

const LANG_OPTIONS = [
  { id: "zh", name: "简体中文", alias: "chinese 中文" },
  { id: "zh-TW", name: "繁體中文", alias: "traditional 繁体" },
  { id: "en", name: "English", alias: "英语" },
  { id: "de", name: "Deutsch", alias: "german 德语" },
  { id: "fr", name: "Français", alias: "french 法语" },
  { id: "es", name: "Español", alias: "spanish 西班牙语" },
  { id: "pt", name: "Português", alias: "portuguese 葡萄牙语" },
  { id: "ja", name: "日本語", alias: "japanese 日语" },
  { id: "ko", name: "한국어", alias: "korean 韩语" },
  { id: "ru", name: "Русский", alias: "russian 俄语" },
  { id: "ar", name: "العربية", alias: "arabic 阿拉伯语" },
  { id: "hi", name: "हिन्दी", alias: "hindi 印地语" },
  { id: "id", name: "Bahasa Indonesia", alias: "indonesian 印尼语" },
  { id: "vi", name: "Tiếng Việt", alias: "vietnamese 越南语" },
  { id: "it", name: "Italiano", alias: "italian 意大利语" },
  { id: "tr", name: "Türkçe", alias: "turkish 土耳其语" },
];

function chooseLanguageUi(next) {
  if (!I18N[next] || next === lang) return;
  lang = next;
  try { localStorage.setItem("wengao-lang", lang); } catch (error) {}
  applyI18n();
  if (typeof applySpellcheck === "function") applySpellcheck();
  renderLangOptions(document.getElementById("lang-select-search").value);
}

function renderLangOptions(query) {
  const list = document.getElementById("lang-select-list");
  if (!list) return;
  const text = String(query || "").trim().toLowerCase();
  list.replaceChildren();
  LANG_OPTIONS.filter((item) => !text || (item.name + " " + item.alias + " " + item.id).toLowerCase().includes(text)).forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-option" + (item.id === lang ? " is-current" : "");
    button.textContent = item.name;
    button.addEventListener("click", () => {
      chooseLanguageUi(item.id);
      document.getElementById("lang-select-panel").hidden = true;
      document.getElementById("lang-select-button").setAttribute("aria-expanded", "false");
    });
    li.appendChild(button);
    list.appendChild(li);
  });
}

document.getElementById("lang-select-button").addEventListener("click", () => {
  const panel = document.getElementById("lang-select-panel");
  const open = panel.hidden;
  panel.hidden = !open;
  document.getElementById("lang-select-button").setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    const search = document.getElementById("lang-select-search");
    search.value = "";
    renderLangOptions("");
    search.focus();
  }
});

document.getElementById("lang-select-search").addEventListener("input", (event) => {
  renderLangOptions(event.currentTarget.value);
});

document.addEventListener("mousedown", (event) => {
  const root = document.getElementById("lang-select");
  const panel = document.getElementById("lang-select-panel");
  if (!root || !panel || panel.hidden || root.contains(event.target)) return;
  panel.hidden = true;
  document.getElementById("lang-select-button").setAttribute("aria-expanded", "false");
});

applyI18n();
applyTheme(themeName());
createEditor();
renderStatus();
renderTree();
