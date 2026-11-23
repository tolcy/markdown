; Register Tolcy in Windows "Open with" for Markdown / text (additive; does not steal default).
!macro NSIS_HOOK_POSTINSTALL
  ; Packaged launchers may virtualize LOCALAPPDATA. Shell links and registry values
  ; must reference the physical location that Explorer can access independently.
  Push $0
  Push $1
  Push $2
  System::Call 'kernel32::CreateFileW(w "$INSTDIR\${MAINBINARYNAME}.exe", i 0, i 7, p 0, i 3, i 0, p 0) p .r0'
  ${If} $0 != -1
    System::Call 'kernel32::GetFinalPathNameByHandleW(p r0, w .r1, i ${NSIS_MAX_STRLEN}, i 0) i .r2'
    System::Call 'kernel32::CloseHandle(p r0)'
    ${If} $2 > 0
    ${AndIf} $2 < ${NSIS_MAX_STRLEN}
      StrCpy $2 $1 8
      ${If} $2 == "\\?\UNC\"
        StrCpy $1 $1 "" 8
        StrCpy $1 "\\$1"
      ${Else}
        StrCpy $2 $1 4
        ${If} $2 == "\\?\"
          StrCpy $1 $1 "" 4
        ${EndIf}
      ${EndIf}
      ${GetParent} "$1" $INSTDIR
      WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" '"$INSTDIR"'
      WriteRegStr SHCTX "${UNINSTKEY}" "DisplayIcon" '"$INSTDIR\${MAINBINARYNAME}.exe"'
      WriteRegStr SHCTX "${UNINSTKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
  ; Pin shortcut icons to a stable resource, including when upgrading an existing link.
  ${If} $NoShortcutMode != 1
    SetOutPath "$INSTDIR"
    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\Tolcy.ico" 0
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
    !if "${STARTMENUFOLDER}" != ""
      CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
      CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\Tolcy.ico" 0
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
    !else
      CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\Tolcy.ico" 0
      !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    !endif
  ${EndIf}
  WriteRegStr SHCTX "Software\Classes\Tolcy.md" "" "Markdown Document"
  WriteRegStr SHCTX "Software\Classes\Tolcy.md\DefaultIcon" "" "$INSTDIR\tolcy.exe,0"
  WriteRegStr SHCTX "Software\Classes\Tolcy.md\shell\open\command" "" '"$INSTDIR\tolcy.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\Tolcy.txt" "" "Text Document"
  WriteRegStr SHCTX "Software\Classes\Tolcy.txt\DefaultIcon" "" "$INSTDIR\tolcy.exe,0"
  WriteRegStr SHCTX "Software\Classes\Tolcy.txt\shell\open\command" "" '"$INSTDIR\tolcy.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\Applications\tolcy.exe" "FriendlyAppName" "Tolcy"
  WriteRegStr SHCTX "Software\Classes\Applications\tolcy.exe\shell\open\command" "" '"$INSTDIR\tolcy.exe" "%1"'
  WriteRegStr SHCTX "Software\Classes\Applications\tolcy.exe\SupportedTypes" ".md" ""
  WriteRegStr SHCTX "Software\Classes\Applications\tolcy.exe\SupportedTypes" ".markdown" ""
  WriteRegStr SHCTX "Software\Classes\Applications\tolcy.exe\SupportedTypes" ".txt" ""
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.md\shell\OpenWithTolcy" "" "用 Tolcy 打开"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.md\shell\OpenWithTolcy" "Icon" "$INSTDIR\tolcy.exe,0"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.md\shell\OpenWithTolcy\command" "" '"$INSTDIR\tolcy.exe" "%1"'

  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithTolcy" "" "用 Tolcy 打开"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithTolcy" "Icon" "$INSTDIR\tolcy.exe,0"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithTolcy\command" "" '"$INSTDIR\tolcy.exe" "%1"'

  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.txt\shell\OpenWithTolcy" "" "用 Tolcy 打开"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.txt\shell\OpenWithTolcy" "Icon" "$INSTDIR\tolcy.exe,0"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\.txt\shell\OpenWithTolcy\command" "" '"$INSTDIR\tolcy.exe" "%1"'

  WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "Tolcy.md" ""
  WriteRegStr SHCTX "Software\Classes\.markdown\OpenWithProgids" "Tolcy.md" ""
  WriteRegStr SHCTX "Software\Classes\.txt\OpenWithProgids" "Tolcy.txt" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\Tolcy.md"
  DeleteRegKey SHCTX "Software\Classes\Tolcy.txt"
  DeleteRegKey SHCTX "Software\Classes\Applications\tolcy.exe"
  DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\.md\shell\OpenWithTolcy"
  DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\.markdown\shell\OpenWithTolcy"
  DeleteRegKey SHCTX "Software\Classes\SystemFileAssociations\.txt\shell\OpenWithTolcy"
  DeleteRegValue SHCTX "Software\Classes\.md\OpenWithProgids" "Tolcy.md"
  DeleteRegValue SHCTX "Software\Classes\.markdown\OpenWithProgids" "Tolcy.md"
  DeleteRegValue SHCTX "Software\Classes\.txt\OpenWithProgids" "Tolcy.txt"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
