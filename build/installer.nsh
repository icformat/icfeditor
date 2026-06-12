; Custom NSIS hooks for ICF Editor (auto-included by electron-builder).
;
; electron-builder already registers the .icf / .icx associations (ProgID,
; OpenWithProgids, and the default under Software\Classes). On modern Windows a
; previously chosen "default app" is stored in a protected per-extension
; UserChoice key that takes precedence over that registration and cannot be
; rewritten programmatically — but it CAN be deleted from the user's own hive.
; Deleting it lets our registration become the effective default, which is how
; we override any prior association. We then notify the shell to refresh icons
; and handlers so the change is visible without a sign-out.

!macro customInstall
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.icf\UserChoice"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.icx\UserChoice"
  ; SHCNE_ASSOCCHANGED, SHCNF_IDLIST — tell Explorer associations changed.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
