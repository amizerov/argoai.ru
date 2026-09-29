# ARGO Transcribe

Локальное распознавание аудио и видео: браузер → Next.js `/api/transcribe` → FastAPI `127.0.0.1:8100` → FFmpeg → faster-whisper → JSON/поток событий → интерфейс `/transcribe`.

Записи не передаются внешним speech-to-text API. При первом запуске faster-whisper загружает **веса модели** из Hugging Face. Для полностью автономного запуска заранее скачайте модель и задайте `WHISPER_MODEL_DIR`. Интерфейс и почтовая форма не требуют изменений настроек друг друга.

## Установка на Ubuntu (CPU)

Пути ниже предполагают checkout `/home/cloud/projects/NextJS/argoai.ru/argoai`; замените его на фактический путь проекта.

```bash
sudo apt update
sudo apt install ffmpeg python3-venv
cd /home/cloud/projects/NextJS/argoai.ru/argoai/services/transcribe
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
mkdir -p .models
```

Нужен Python 3.10+ (проверено на 3.12) и Node.js 22. Для production используйте 64-битную систему. FFmpeg и ffprobe должны быть доступны в PATH.

В `services/transcribe/.env`:

```dotenv
WHISPER_MODEL=large-v3-turbo
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_CPU_THREADS=4
TRANSCRIBE_MAX_CONCURRENT=1
TRANSCRIBE_MAX_QUEUE=2
MAX_UPLOAD_SIZE_MB=500
TRANSCRIBE_MAX_DURATION_SECONDS=7200
TRANSCRIBE_TIMEOUT_SECONDS=3500
FFMPEG_TIMEOUT_SECONDS=300
```

Первый запуск может занять несколько минут из-за загрузки модели:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8100 --workers 1
```

Модель инициализируется **один раз** в lifespan до готовности `/health`. Не увеличивайте `--workers`: каждый процесс загрузит свою копию модели и получит собственный лимит параллельности. По умолчанию используется `large-v3-turbo`. `tiny` подходит для быстрой проверки запуска, но не для оценки качества. После переключения проверяйте поле `model` в `/health`: оно должно быть `large-v3-turbo`. Переменные окружения процесса имеют приоритет над `.env`; удалите старое переопределение `WHISPER_MODEL=tiny` и перезапустите Python-сервис.

Сервис использует [версию large-v3-turbo для CTranslate2](https://huggingface.co/dropbox-dash/faster-whisper-large-v3-turbo). Уже скачанные веса Transformers (`model.safetensors`) напрямую не подходят для faster-whisper: ему нужна преобразованная модель с `model.bin`. При запуске по имени совместимая версия загружается в `.models`.

## Next.js и PM2

Добавьте в **существующий** корневой `.env.local` (не заменяйте почтовые настройки):

```dotenv
TRANSCRIBE_SERVICE_URL=http://127.0.0.1:8100
MAX_UPLOAD_SIZE_MB=500
NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB=500
TRANSCRIBE_TIMEOUT_SECONDS=3600
TRANSCRIBE_MAX_REQUESTS=3
```

`MAX_UPLOAD_SIZE_MB` — серверный лимит Next.js и отображаемый лимит UI. Если он отсутствует, используется `NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB`, затем 500. У Python независимая проверка: задайте одинаковое значение в обоих env. Лимит Nginx должен быть чуть больше для multipart-заголовков. Новые переменные не содержат секретов; приватные `.env` исключены из Git.

```bash
cd /home/cloud/projects/NextJS/argoai.ru/argoai
npm ci
npm run build
npm start
# Либо, если процесс сайта ещё не создан:
pm2 start npm --name argoai -- start
pm2 save
# Для уже существующего процесса после сборки:
pm2 restart argoai --update-env
```

Используйте один экземпляр Next.js для указанных MVP-лимитов. Имя процесса PM2 замените на действующее. Не запускайте `npm start` и PM2 одновременно на одном порту.

## systemd

Пример `deploy/argo-transcribe.service` ничего не устанавливает автоматически. Исправьте `User`, `Group` и все пути под ваш сервер, создайте `.models` и обеспечьте доступ пользователя сервиса к проекту. `PrivateTmp=true` изолирует временные файлы; кэш модели находится в `.models`. Если переопределяете пути кэша или временных файлов, обновите `ReadWritePaths`.

```bash
cd /home/cloud/projects/NextJS/argoai.ru/argoai
sudo cp deploy/argo-transcribe.service /etc/systemd/system/argo-transcribe.service
sudo systemctl daemon-reload
sudo systemctl enable --now argo-transcribe
sudo systemctl status argo-transcribe
journalctl -u argo-transcribe -f
curl --fail http://127.0.0.1:8100/health
```

Настройки сервиса читаются из `services/transcribe/.env`; после их изменения выполните `sudo systemctl restart argo-transcribe`.

## Nginx

Перенесите части `deploy/transcribe-nginx.conf.example` в соответствующие контексты существующего конфига. Блок `limit_req_zone` находится в `http {}`, `location` — в HTTPS `server {}`. Сохраните маршруты главной страницы и chat widget. `proxy_buffering off` нужен для реальных этапов обработки, `proxy_request_buffering off` — для потоковой загрузки. Таймауты прокси должны превышать `TRANSCRIBE_TIMEOUT_SECONDS` Next.js.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Порт 8100 слушает только loopback. Не создавайте публичный Nginx location к FastAPI и не меняйте bind на `0.0.0.0`. Запросы браузера идут только к `/api/transcribe`.

## Проверка через curl

```bash
# Готовность модели (после старта)
curl --fail http://127.0.0.1:8100/health
# Прямой локальный вызов Python: обычный JSON
curl --fail -F 'file=@/path/meeting.wav' -F 'language=ru' http://127.0.0.1:8100/transcribe
# Вся серверная цепочка через Next.js, автоопределение языка
curl --fail -F 'file=@/path/meeting.mp3' http://127.0.0.1:3000/api/transcribe
# Реальные этапы и итоговый result, без буферизации
curl -N -H 'Accept: application/x-ndjson' -F 'file=@/path/meeting.mp4' -F 'language=ru' https://argoai.ru/api/transcribe
# Неподдерживаемый формат должен вернуть 415
printf 'not media' >/tmp/argo-test.txt
curl -i -F 'file=@/tmp/argo-test.txt' http://127.0.0.1:3000/api/transcribe
```

Без `Accept: application/x-ndjson` оба API возвращают JSON `{text, language, language_probability, duration, segments}`. С этим Accept возвращаются строки JSON: `stage`, `progress`, `heartbeat`, `result` либо `error`. После начала потока HTTP-статус уже 200, поэтому клиент обязательно проверяет конечное событие. `queued` — ожидание слота, `extracting` — FFprobe/FFmpeg, `transcribing` — реальное распознавание, `formatting` — сборка результата.

Событие `progress` содержит `processed_seconds` и `duration` в секундах исходной записи. Позиция обновляется по концу каждого сегмента после восстановления таймкодов VAD, не уменьшается и завершается полной длительностью после исчерпания генератора, включая записи без речи. До первого сегмента UI показывает анимацию и «Распознаём первый фрагмент», затем процент и обработанную позицию; 100% появляется на этапе формирования результата. Это прогресс по записи, не оценка оставшегося времени. Загрузка, очередь и извлечение аудио тоже используют индикатор ожидания без выдуманного процента. Отдельно показывается давность последнего события сервера: heartbeat подтверждает соединение, но не продвижение модели. После 30 секунд без событий появляется предупреждение о задержке связи.

По умолчанию в форме выбран русский язык. Для другой речи выберите нужный язык или автоопределение. Явный язык позволяет пропустить дополнительный проход определения языка.

Браузер оставляет выбранный файл локально через object URL для плеера. Таймкоды перематывают поддерживаемые HTML5 форматы; MOV/MKV с неподдерживаемым кодеком могут распознаваться, но не воспроизводиться в браузере. TXT/SRT/VTT создаются как Blob без серверного хранения. Без распознанной речи показывается пустой результат с объяснением, без выдуманного текста.

## CPU, GPU и офлайн-модель

### Почему короткий файл тоже обрабатывается долго

В используемой реализации faster-whisper признаки короткого фрагмента дополняются до 30-секундного окна перед проходом Whisper. Поэтому стоимость распознавания не пропорциональна длительности короткого файла. `large-v3-turbo` остаётся большой моделью, а автоопределение языка добавляет проход энкодера. Модель уже загружена один раз при старте сервиса; ожидание каждого запроса не означает повторное скачивание весов.

Для ускорения:

1. Укажите язык явно. Сравнивайте одинаковые файлы при одинаковой нагрузке сервера.
2. На CPU оставьте `WHISPER_COMPUTE_TYPE=int8`. Число потоков подбирайте измерениями в пределах доступных CPU; увеличение сверх доступных ресурсов не гарантирует ускорения.
3. Можно попробовать `WHISPER_BEAM_SIZE=1` в `services/transcribe/.env` и перезапустить `argo-transcribe`. По умолчанию сохранено 5. Меньший beam сокращает поиск вариантов текста, но может повлиять на точность и почти не ускорить файл, если основное время уходит на энкодер. На локальной проверке четырёхсекундного OGG beam 5 занял около 9,5 с, beam 1 — около 9,3 с; это не замер production и не гарантия для других записей.
4. Если GPU нет, сравните `small` с текущей моделью на реальных записях. Для смены модели требуется скачать соответствующие веса и обновить **оба** `WHISPER_MODEL` и `WHISPER_MODEL_DIR`: существующий путь к turbo имеет приоритет над именем модели. Качество, особенно для сложного звука, может снизиться.
5. Для сохранения большой модели рассмотрите NVIDIA GPU; настройки и зависимости ниже. Сначала проверьте оборудование и доступную память, одного изменения `WHISPER_DEVICE` недостаточно.

После переноса изменений Python и настройки beam на production:

```bash
sudo systemctl restart argo-transcribe
curl --fail http://127.0.0.1:8100/health
```

Изменения индикатора и языка по умолчанию требуют новой сборки Next.js и перезапуска PM2.

CPU работает с `int8`. Скорость зависит от модели, числа ядер, длины и качества записи; `medium` может обрабатывать длинную запись дольше её длительности. Не обещайте пользователям обработку в реальном времени. Начните с одной транскрибации, оставьте запас RAM для Next.js и ОС, измерьте расход на вашем сервере. `small` обычно легче `medium`; `large-v3` требует больше ресурсов. Увеличивайте таймауты Python, Next.js и Nginx согласованно.

Для NVIDIA требуется совместимый драйвер, CUDA 12 и cuDNN 9 для актуального CTranslate2. Установку библиотек GPU выполняйте по [официальному README faster-whisper](https://github.com/SYSTRAN/faster-whisper#gpu). Затем:

```dotenv
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
```

CPU остаётся полноценным вариантом. Если CUDA не настроена, сервис должен завершить startup с ошибкой, а не молча менять устройство. Доступные модели: `tiny`, `base`, `small`, `medium`, `large-v3`, `large-v3-turbo`.

Для офлайн-старта загрузите преобразованную модель до отключения сети:

```bash
source .venv/bin/activate
python -c "from faster_whisper import download_model; print(download_model('large-v3-turbo', output_dir='.models/large-v3-turbo'))"
# В services/transcribe/.env:
# WHISPER_MODEL_DIR=/home/cloud/projects/NextJS/argoai.ru/argoai/services/transcribe/.models/large-v3-turbo
```

## Ограничения и временные файлы

- Next.js пишет загрузку потоком в системный temp (`argo-upload-*`), проверяет extension/MIME и число байтов, пересылает file-backed Blob и удаляет каталог после ответа/ошибки. Весь 500-МБ файл не собирается в памяти Next.js.
- Python ограничивает тело multipart, MIME/extension и реальную длительность. ffprobe подтверждает аудиодорожку. FFmpeg запускается списком аргументов без shell, с UUID-путями, ограниченными демультиплексорами и протоколами. HLS/плейлисты не принимаются.
- Python использует `<temp>/argo-transcribe/<uuid>-*/`, затем удаляет исходник и WAV в `finally`. Multipart spool-файлы закрываются контекстным менеджером. При отмене клиентом активный native-вызов может завершить текущий фрагмент; каталог остаётся до выхода рабочего потока, чтобы не удалять используемый файл. Ожидающие задания также ограничены.
- Максимум 2 часа по умолчанию; это ограничивает распакованный WAV независимо от размера сжатого файла. FFmpeg имеет жёсткий subprocess timeout, Whisper проверяет отмену/таймаут между сегментами; зависший native-вызов не прерывается Python-потоком мгновенно.
- При аварийном `kill -9` обычный `finally` не выполняется. Production unit использует private temp; контролируйте свободное место. Не удаляйте временные каталоги работающих заданий. После полного останова процесса можно очистить его старые каталоги.
- MVP-лимиты живут в одном процессе. Для нескольких серверов потребуется общий лимитер/очередь; Redis/Celery сейчас не добавлены. Пример Nginx ограничивает частоту публичных запросов по IP.

## Тесты

```bash
# Из services/transcribe
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest tests -q
# Из корня Next.js
node --experimental-strip-types --test tests/transcribe.test.mjs
npm run lint
npm run build
```

Python-тесты используют реальный FFmpeg для нормализации и тестовый движок вместо скачивания модели: health, валидация, UUID, очистка, ошибки, поток этапов и лимит конкурентности. Настоящую модель проверяйте приведённым curl с WAV/MP3/MP4. На Windows команды Python внутри venv начинаются с `.venv/Scripts/python.exe`, FFmpeg устанавливается отдельно.

Внешние сервисы, аккаунты, оплата, база данных, распознавание спикеров и LLM-summary не добавлены. Поле `speaker` оставлено необязательным для следующего этапа и сейчас не отображается.
