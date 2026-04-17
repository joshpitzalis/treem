#!/bin/bash
set -euo pipefail

ITERATIONS="${1:-1}"

# Show useful Codex streaming events in real time.
stream_text='
  if .type == "item.completed" and .item.type == "agent_message" then
    ((.item.text // "") | gsub("\n"; "\r\n")) + "\r\n\r\n"
  elif .type == "error" then
    "[codex] " + .message + "\r\n"
  else
    empty
  end
'

# Final result extraction.
final_result='select(.type == "result").result // empty'

ensure_pnpm_dependencies() {
  if [[ -d node_modules ]]; then
    return
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm is required but was not found on PATH." >&2
    exit 1
  fi

  echo "node_modules not found. Installing dependencies with pnpm..."

  if [[ -f pnpm-lock.yaml ]]; then
    if ! pnpm install --frozen-lockfile; then
      echo "pnpm install failed, so Ralph could not create node_modules." >&2
      echo "If you launched this via 'pnpm ralph', pnpm may still print a trailing missing-node_modules warning because the bootstrap never completed." >&2
      exit 1
    fi
    return
  fi

  if ! pnpm install; then
    echo "pnpm install failed, so Ralph could not create node_modules." >&2
    echo "If you launched this via 'pnpm ralph', pnpm may still print a trailing missing-node_modules warning because the bootstrap never completed." >&2
    exit 1
  fi
}

ensure_pnpm_dependencies

for ((i=1; i<=ITERATIONS; i++)); do
  tmpfile=$(mktemp)
  trap "rm -f '$tmpfile'" EXIT

  caveman_preamble=$'/caveman full\nUse caveman skill before any exploration or implementation work. Keep it active unless the skill itself requires clearer language for safety or irreversible actions.\n'
  start_head=$(git rev-parse HEAD 2>/dev/null || echo "")
  commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
  issues=$(gh issue list --state open --json number,title,body,comments 2>/dev/null || echo "[]")
  prompt=$(cat ralph/prompt.md)

  echo "=== Ralph iteration $i/$ITERATIONS ==="

  docker sandbox run codex . -- \
    exec --json \
    "$caveman_preamble"$'\n'"Previous commits: $commits $issues $prompt" \
  | grep --line-buffered '^{' \
  | tee "$tmpfile" \
  | jq --unbuffered -rj "$stream_text"

  result=$(jq -r "$final_result" "$tmpfile")
  end_head=$(git rev-parse HEAD 2>/dev/null || echo "")

  if [[ -n "$start_head" && "$start_head" != "$end_head" ]]; then
    branch=$(git branch --show-current)
    if [[ -n "$branch" ]]; then
      echo "Pushing $branch..."
      git push --set-upstream origin "$branch"
    fi
  fi

  if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
    echo
    echo "Ralph complete after $i iterations."
    exit 0
  fi

  echo
  echo "Iteration $i finished."
done


# # verbose option 
# stream_text='
#   if .type == "thread.started" then
#     "[thread] " + .thread_id + "\r\n"
#   elif .type == "turn.started" then
#     "[turn started]\r\n"
#   elif .type == "item.completed" and .item.type == "agent_message" then
#     (.item.text | gsub("\n"; "\r\n")) + "\r\n\r\n"
#   elif .type == "item.started" and .item.type == "command_execution" then
#     "[running] " + .item.command + "\r\n"
#   elif .type == "item.completed" and .item.type == "command_execution" and .item.status == "completed" then
#     "[done] " + .item.command + "\r\n"
#   elif .type == "item.completed" and .item.type == "command_execution" and .item.status == "failed" then
#     "[failed] " + .item.command + "\r\n"
#   elif .type == "error" then
#     "[codex] " + .message + "\r\n"
#   else
#     empty
#   end
# '


# # Claude option
# #!/bin/bash
# set -eo pipefail

# ITERATIONS="${1:-1}"

# # jq filter to extract streaming text from assistant messages
# stream_text='select(.type == "assistant").message.content[]? | select(.type == "text").text // empty | gsub("\n"; "\r\n") | . + "\r\n\n"'

# # jq filter to extract final result
# final_result='select(.type == "result").result // empty'

# for ((i=1; i<=ITERATIONS; i++)); do
#   tmpfile=$(mktemp)
#   trap "rm -f $tmpfile" EXIT

#   commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
#   issues=$(gh issue list --state open --json number,title,body,comments)
#   prompt=$(cat ralph/prompt.md)

#   docker sandbox run codex . -- \
#     exec --json \
#     "Previous commits: $commits $issues $prompt" \
#   | grep --line-buffered '^{' \
#   | tee "$tmpfile" \
#   | jq --unbuffered -rj "$stream_text"

#   result=$(jq -r "$final_result" "$tmpfile")

#   if [[ "$result" == *"<promise>NO MORE TASKS</promise>"* ]]; then
#     echo "Ralph complete after $i iterations."
#     exit 0
#   fi
# done
