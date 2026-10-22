#!/usr/bin/env bash
# Зарубежный сервер: АГЕНТ ПРАВОК (Claude Code + Telegram).
# Запуск от root на чистой Ubuntu 24.04:
#   bash setup-agent.sh <ссылка на репозиторий GitHub> <токен GitHub>
# Пример:
#   bash setup-agent.sh https://github.com/bazarcom/baza-r-com.git github_pat_XXXX
set -euo pipefail
REPO="${1:?Укажите ссылку на репозиторий GitHub}"
TOKEN="${2:?Укажите токен GitHub с правом записи в репозиторий}"
export DEBIAN_FRONTEND=noninteractive

echo "==> 1/5 Ставим git, tmux, unzip и Pillow (для сжатия фото)"
apt-get update -q
apt-get install -yq git curl unzip tmux ca-certificates python3-pil

echo "==> 2/5 Ставим Node.js 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

echo "==> 3/5 Создаём пользователя agent (Claude не работает от root)"
id agent >/dev/null 2>&1 || useradd --create-home --shell /bin/bash agent

echo "==> 4/5 Ставим Claude Code и Bun (Bun нужен плагину Telegram)"
runuser -l agent -c 'curl -fsSL https://claude.ai/install.sh | bash' || runuser -l agent -c 'npm install -g --prefix ~/.local @anthropic-ai/claude-code'
runuser -l agent -c 'curl -fsSL https://bun.sh/install | bash'
grep -q 'local/bin' /home/agent/.profile || echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/agent/.profile
grep -q '.bun/bin' /home/agent/.profile || echo 'export PATH="$HOME/.bun/bin:$PATH"' >> /home/agent/.profile

echo "==> 5/5 Скачиваем сайт из GitHub с правом записи"
NAME="$(basename "$REPO" .git)"
AUTH_URL="https://x-access-token:${TOKEN}@${REPO#https://}"
if [ ! -d "/home/agent/$NAME/.git" ]; then
  runuser -l agent -c "git clone -q '$AUTH_URL' ~/$NAME"
fi
runuser -l agent -c "git -C ~/$NAME config user.name 'Агент магазина' && git -C ~/$NAME config user.email 'agent@localhost'"

cat > /usr/local/bin/agent-start <<START
#!/bin/sh
# Запускает агента в фоне (tmux). Повторный запуск — подключиться к работающему.
exec runuser -l agent -c "tmux new-session -A -s agent 'cd ~/$NAME && git pull -q; claude --channels plugin:telegram@claude-plugins-official'"
START
chmod +x /usr/local/bin/agent-start

cat <<DONE

==================================================
 Агент установлен. Дальше — один раз вручную:
   su - agent
   cd ~/$NAME
   claude                         ← войти в аккаунт Claude селлера
   /plugin install telegram@claude-plugins-official
   /telegram:configure <токен бота-помощника>
   /exit
   exit
 Запуск агента:     agent-start
 Отойти, не выключая:  Ctrl+B, потом D
 Вернуться:         agent-start
==================================================
DONE
