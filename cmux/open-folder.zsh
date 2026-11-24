# Sourced by the interactive shell in a newly created cmux workspace.
() {
  emulate -L zsh
  local folder cli="${CMUX_BUNDLED_CLI_PATH:-/Applications/cmux.app/Contents/Resources/bin/cmux}"
  [[ -n $CMUX_WORKSPACE_ID && -n $CMUX_SURFACE_ID ]] || return 1
  folder=$(command osascript - "$PWD" <<'APPLESCRIPT'
on run argv
    activate
    try
        set picked to choose folder with prompt "选择要用 Claude 打开的项目文件夹" default location (POSIX file (item 1 of argv))
        return POSIX path of picked
    on error number -128
        return ""
    end try
end run
APPLESCRIPT
  ) || return 1
  if [[ -z $folder ]]; then
    # The picker owns this fresh shell; ending it dismisses only its tab.
    exit 0
  fi
  builtin cd -- "$folder" || return 1
  local title=${PWD:t}
  "$cli" workspace rename "$CMUX_WORKSPACE_ID" --title "${title:-/}" >/dev/null
  if [[ ${1:-} == --relay ]]; then
    "$2"
  else
    claude
  fi
} "$@"
