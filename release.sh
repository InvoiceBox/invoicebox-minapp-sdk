#!/bin/bash
set -e  # Останавливает скрипт при любой ошибке

# Функция для определения и предложения новой версии
bump_version() {
  # Получаем текущую версию из package.json
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo "Текущая версия пакета: $CURRENT_VERSION"

  # Если версия передана как аргумент - используем её
  if [ ! -z "$VERSION" ]; then
    NEW_VERSION=$VERSION
    echo "Используем переданную версию: $NEW_VERSION"
    return 0
  fi

  # Разбиваем текущую версию на компоненты
  IFS='-' read -ra VER_PARTS <<< "$CURRENT_VERSION"
  MAIN_VERSION=${VER_PARTS[0]}

  if [[ $CURRENT_VERSION == *"-"* ]]; then
    # Есть префикс (например, alpha, beta)
    PRE_RELEASE=${VER_PARTS[1]}
    IFS='.' read -ra PRE_PARTS <<< "$PRE_RELEASE"
    PRE_TYPE=${PRE_PARTS[0]}
    PRE_NUM=${PRE_PARTS[1]}

    # Увеличиваем последний разряд
    NEW_PRE_NUM=$((PRE_NUM + 1))
    SUGGESTED_VERSION="$MAIN_VERSION-$PRE_TYPE.$NEW_PRE_NUM"
  else
    # Без префикса, обычная версия
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    # Увеличиваем патч-версию
    NEW_PATCH=$((PATCH + 1))
    SUGGESTED_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
  fi

  # Предлагаем пользователю выбор
  echo "Предлагаемая новая версия: $SUGGESTED_VERSION"
  read -p "Использовать эту версию? (y - да, n - ввести другую): " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    NEW_VERSION=$SUGGESTED_VERSION
  else
    read -p "Введите желаемую версию: " CUSTOM_VERSION
    NEW_VERSION=$CUSTOM_VERSION
  fi

  echo "Будет установлена версия: $NEW_VERSION"
  return 0
}

# Переключиться на ветку develop
git checkout develop

# Очистка
echo "Очистка..."
find ./cjs -mindepth 1 ! -regex '\(^\.\/cjs\/package\.json$\)\|\(^\.\/cjs\/\.gitignore$\)' -delete
rm -rf ./esm

# Сборка
echo "Сборка..."
./node_modules/.bin/tsc --project tsconfig.esm.json
./node_modules/.bin/tsc --project tsconfig.cjs.json
./node_modules/.bin/uglifyjs cjs/index.js > cjs/index.min.js

# Проверка, что файлы сборки существуют
echo "Проверка файлов сборки..."
if [ ! -f "./cjs/index.js" ] || [ ! -f "./esm/index.js" ]; then
  echo "Файлы сборки отсутствуют! Прерывание."
  exit 1
fi

# Проверка содержимого пакета перед публикацией
echo "Проверка содержимого пакета..."
npm pack --dry-run

# Определение новой версии
bump_version

# Запрос подтверждения перед продолжением
read -p "Продолжить с обновлением версии и публикацией? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

# Повышение версии
npm version $NEW_VERSION  # Используем нашу определенную версию, npm автоматически создаст коммит и тег

